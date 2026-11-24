import { z } from "zod";
import { normalizeEmail } from "@/lib/auth/entra";
import { Prisma } from "@/lib/generated/prisma/client";
import { graphGetAll } from "@/lib/graph/client";
import { prisma } from "@/lib/prisma";
import { runSync, type SyncTally } from "@/lib/sync/sync-run";
import { formatCount } from "@/lib/utils";

// Who works here, from Entra ID: the members of one "employees" group per
// tenant. A group (not "every licensed member") because some licensed
// accounts are not people, e.g. a shared account for a Figma license.
// Waverity people are guests in the EIG tenant's group, so one group can
// hold both companies.
//
// In the group → a User row, active. Out of the group, disabled or deleted
// → inactive ("Left"); their items and history stay. Roles are not touched:
// they come from the app roles when the person signs in.

const syncGroupSchema = z.object({
  tenantId: z.uuid(),
  groupId: z.uuid(),
});

type SyncGroup = z.infer<typeof syncGroupSchema>;

// USER_SYNC_GROUPS="<tenant id>=<group id>,…", both ids as Entra shows them
// (GUIDs). Wrong entries are reported, not guessed at.
function getSyncGroups(tally: SyncTally): SyncGroup[] {
  const entries = (process.env.USER_SYNC_GROUPS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    tally.errors.push("USER_SYNC_GROUPS is not set.");
  }

  const groups: SyncGroup[] = [];
  entries.forEach((entry, index) => {
    const [tenantId = "", groupId = ""] = entry.toLowerCase().split("=");
    const group = syncGroupSchema.safeParse({
      tenantId: tenantId.trim(),
      groupId: groupId.trim(),
    });
    if (group.success) groups.push(group.data);
    else {
      tally.errors.push(
        `USER_SYNC_GROUPS entry ${index + 1} is not "<tenant id>=<group id>" with two GUIDs.`,
      );
    }
  });
  return groups;
}

const memberFields = [
  "id",
  "displayName",
  "mail",
  "userPrincipalName",
  "department",
  "jobTitle",
  "accountEnabled",
] as const;

const memberSchema = z.object({
  id: z.string(),
  displayName: z.string().nullish(),
  // Null for accounts without a mailbox. Guests have their own address here
  // and "name_company#EXT#@…" as the principal name.
  mail: z.string().nullish(),
  userPrincipalName: z.string(),
  department: z.string().nullish(),
  jobTitle: z.string().nullish(),
  accountEnabled: z.boolean().nullish(),
});

type Member = z.infer<typeof memberSchema>;

// The fields of a User row that Entra owns.
type Person = {
  entraObjectId: string;
  tenantId: string;
  email: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  isActive: boolean;
};

function toPerson(member: Member, tenantId: string): Person {
  const email = normalizeEmail(member.mail ?? member.userPrincipalName);
  return {
    entraObjectId: member.id,
    tenantId,
    email,
    displayName: member.displayName?.trim() || email,
    department: member.department?.trim() || null,
    jobTitle: member.jobTitle?.trim() || null,
    // A dynamic group can lag behind a disabled account.
    isActive: member.accountEnabled !== false,
  };
}

// Users only, also through nested groups.
function getMembersPath(groupId: string): string {
  const query = new URLSearchParams({
    $select: memberFields.join(","),
    $top: "999",
  });
  return `/groups/${encodeURIComponent(groupId)}/transitiveMembers/microsoft.graph.user?${query}`;
}

async function readGroupMembers(
  { tenantId, groupId }: SyncGroup,
  tally: SyncTally,
): Promise<Person[]> {
  const people: Person[] = [];
  let skipped = 0;
  for (const item of await graphGetAll(tenantId, getMembersPath(groupId))) {
    const member = memberSchema.safeParse(item);
    if (member.success) people.push(toPerson(member.data, tenantId));
    else skipped++;
  }
  // Graph sends members as bare ids when the app may list the group but not
  // read users.
  if (skipped > 0) {
    tally.errors.push(
      `Skipped ${formatCount(skipped, "group member")} Graph sent without a name or email. Does the app have User.Read.All (Application) with admin consent in tenant ${tenantId}?`,
    );
  }
  return people;
}

const rowSelect = {
  id: true,
  entraObjectId: true,
  tenantId: true,
  email: true,
  displayName: true,
  department: true,
  jobTitle: true,
  isActive: true,
} satisfies Prisma.UserSelect;

type Row = Prisma.UserGetPayload<{ select: typeof rowSelect }>;

function isUnchanged(row: Row, person: Person): boolean {
  return (Object.keys(person) as (keyof Person)[]).every(
    (field) => row[field] === person[field],
  );
}

function describeSaveError(person: Person, error: unknown): string {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return `${person.email}: another user already has this email.`;
  }
  throw error;
}

async function syncGroup(group: SyncGroup, tally: SyncTally): Promise<void> {
  const people = await readGroupMembers(group, tally);
  // An empty group is a mistake (wrong id, broken rule), not everyone
  // leaving at once: change nothing.
  if (people.length === 0) {
    tally.errors.push(
      `The group ${group.groupId} in tenant ${group.tenantId} has no members. Nothing was changed.`,
    );
    return;
  }

  // Everyone the group's tenant had before, and anyone who signed in before
  // being synced (a Waverity person comes with their own tenant's id, so
  // the email finds them).
  const rows = await prisma.user.findMany({
    where: {
      OR: [
        { tenantId: group.tenantId },
        { entraObjectId: { in: people.map((person) => person.entraObjectId) } },
        { email: { in: people.map((person) => person.email) } },
      ],
    },
    select: rowSelect,
  });
  const byObjectId = new Map(rows.map((row) => [row.entraObjectId, row]));
  const byEmail = new Map(rows.map((row) => [row.email, row]));
  const synced = new Set<number>();

  for (const person of people) {
    const row =
      byObjectId.get(person.entraObjectId) ?? byEmail.get(person.email);
    try {
      if (!row) {
        await prisma.user.create({ data: person });
        tally.created++;
        continue;
      }
      synced.add(row.id);
      if (isUnchanged(row, person)) continue;
      await prisma.user.update({ where: { id: row.id }, data: person });
      tally.updated++;
    } catch (error) {
      tally.errors.push(describeSaveError(person, error));
    }
  }

  // Rows of this tenant no longer in the group: removed from it, or deleted
  // in Entra (e.g. by OAS offboarding).
  const left = await prisma.user.updateMany({
    where: {
      tenantId: group.tenantId,
      isActive: true,
      id: { notIn: [...synced] },
      entraObjectId: { notIn: people.map((person) => person.entraObjectId) },
    },
    data: { isActive: false },
  });
  tally.missing += left.count;
}

async function syncUsersFromEntra(tally: SyncTally): Promise<void> {
  const groups = getSyncGroups(tally);
  // One tenant failing (e.g. no admin consent yet) does not stop the others.
  for (const group of groups) {
    try {
      await syncGroup(group, tally);
    } catch (error) {
      tally.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
}

// Started by the schedule (/api/cron/user-sync) or by "Sync now".
export function syncUsers() {
  return runSync("USERS", syncUsersFromEntra);
}
