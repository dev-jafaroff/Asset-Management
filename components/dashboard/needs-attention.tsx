import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAssetPath } from "@/lib/assets/asset-types";
import { getAssetDisplayName } from "@/lib/assets/format";
import {
  LONG_UNAVAILABLE_DAYS,
  listInactiveHolders,
  listIntuneHolderMismatches,
  listIntuneSyncProblems,
  listLongUnavailableAssets,
  listMissingInIntune,
} from "@/lib/dashboard/queries";
import { getUserPath } from "@/lib/users/queries";
import { formatAccessoryCount } from "@/lib/schemas/accessory";
import { formatCount } from "@/lib/utils";

const TITLE = "Needs attention";

type AttentionItem = {
  key: string;
  href: string;
  icon: ReactNode;
  label: string;
  // Why it is listed, e.g. "In repair for 21 days".
  detail: string;
};

type AttentionGroup = {
  title: string;
  // What to do about it, under the title.
  hint: string;
  items: AttentionItem[];
};

// Things to follow up: assets out of use for long, people who left with
// assets, devices held by someone other than Intune says, devices the Intune
// sync found a problem with or lost. Groups with nothing in them are left out.
export async function NeedsAttention() {
  // Live data and today's date: rendered per request, never prerendered.
  await connection();
  const [unavailable, inactiveHolders, missing, holderMismatches, problems] =
    await Promise.all([
      listLongUnavailableAssets(),
      listInactiveHolders(),
      listMissingInIntune(),
      listIntuneHolderMismatches(),
      listIntuneSyncProblems(),
    ]);

  const groups: AttentionGroup[] = [
    {
      title: "Long out of use",
      hint: `Unavailable for more than ${LONG_UNAVAILABLE_DAYS} days. Still in repair?`,
      items: unavailable.map((asset) => ({
        key: `asset-${asset.id}`,
        href: getAssetPath(asset.type, asset.id),
        icon: <AssetTypeIcon type={asset.type} />,
        label: getAssetDisplayName(asset),
        detail: `${asset.status.name} for ${formatCount(asset.days, "day")}`,
      })),
    },
    {
      title: "People who left, still holding items",
      hint: "Take them back on their page.",
      items: inactiveHolders.map((user) => ({
        key: `user-${user.id}`,
        href: getUserPath(user.id),
        icon: <UserAvatar name={user.displayName} size="sm" />,
        label: user.displayName,
        // e.g. "IT · 2 assets · 1 accessory"; a count of 0 is left out.
        detail: [
          user.department,
          user._count.assignedAssets > 0 &&
            formatCount(user._count.assignedAssets, "asset"),
          user.heldAccessories > 0 &&
            formatAccessoryCount(user.heldAccessories),
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    },
    {
      title: "Holder differs from Intune",
      hint: "Intune's primary user is someone else, or it is not checked out.",
      items: holderMismatches.map((asset) => ({
        key: `holder-${asset.id}`,
        href: getAssetPath(asset.type, asset.id),
        icon: <AssetTypeIcon type={asset.type} />,
        label: getAssetDisplayName(asset),
        detail: `Intune: ${asset.intuneUser}`,
      })),
    },
    {
      title: "Intune sync problems",
      hint: "Fix what the asset's Intune card says, then sync it from there.",
      items: problems.map((asset) => ({
        key: `problem-${asset.id}`,
        href: getAssetPath(asset.type, asset.id),
        icon: <AssetTypeIcon type={asset.type} />,
        label: getAssetDisplayName(asset),
        detail: asset.intuneSyncProblem ?? "",
      })),
    },
    {
      title: "Missing in Intune",
      hint: "The last Intune sync did not find these devices.",
      items: missing.map((asset) => ({
        key: `intune-${asset.id}`,
        href: getAssetPath(asset.type, asset.id),
        icon: <AssetTypeIcon type={asset.type} />,
        label: getAssetDisplayName(asset),
        detail: asset.status.name,
      })),
    },
  ].filter((group) => group.items.length > 0);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <NeedsAttentionCard count={total}>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <CircleCheck aria-hidden className="size-4 text-emerald-600" />
          Nothing needs attention.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <AttentionSection key={group.title} group={group} />
          ))}
        </div>
      )}
    </NeedsAttentionCard>
  );
}

function NeedsAttentionCard({
  count,
  children,
}: {
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        {count !== undefined && count > 0 && (
          <CardAction className="text-xs text-muted-foreground">
            {formatCount(count, "item")}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function AttentionSection({ group }: { group: AttentionGroup }) {
  return (
    <section>
      <h3 className="text-sm font-medium">{group.title}</h3>
      <p className="text-xs text-muted-foreground">{group.hint}</p>
      <ul className="-mx-2 mt-2 flex flex-col">
        {group.items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">
                {item.label}
              </span>
              {/* A long detail (e.g. a sync problem) is cut, whole on hover. */}
              <span
                title={item.detail}
                className="max-w-2/3 truncate text-xs text-muted-foreground"
              >
                {item.detail}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NeedsAttentionFallback() {
  return (
    <NeedsAttentionCard>
      <p className="text-muted-foreground">Loading…</p>
    </NeedsAttentionCard>
  );
}
