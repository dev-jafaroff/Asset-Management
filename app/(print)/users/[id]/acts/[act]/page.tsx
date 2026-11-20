import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import {
  getHandoverActPath,
  getHandoverItems,
  handoverActKinds,
  handoverActs,
  isHandoverActKind,
  type HandoverActKind,
  type HandoverItem,
} from "@/lib/users/handover-acts";
import {
  getRouteUser,
  getUserPath,
  type UserDetail,
} from "@/lib/users/queries";
import { cn, formatDate, formatSortableDate } from "@/lib/utils";
import logo from "@/public/brand/logo.png";

type ActPageProps = PageProps<"/users/[id]/acts/[act]">;

// The kind in the URL; anything else is a 404.
function getActKind(act: string): HandoverActKind {
  if (!isHandoverActKind(act)) notFound();
  return act;
}

// Also the file name "Save as PDF" suggests, e.g.
// "Equipment handover act - Aysel Huseynova - 2026-11-20".
export async function generateMetadata({
  params,
}: ActPageProps): Promise<Metadata> {
  const route = await params;
  const { title } = handoverActs[getActKind(route.act)];
  const user = await getRouteUser(route);
  return {
    title: {
      absolute: `${title} - ${user.displayName} - ${formatSortableDate(new Date())}`,
    },
  };
}

// Outside the app layout: only the paper, and a bar above it that is not
// printed. The person is read per request.
export default function HandoverActPage({ params }: ActPageProps) {
  return (
    <div className="min-h-screen bg-muted print:bg-white">
      <Suspense fallback={null}>
        <HandoverAct params={params} />
      </Suspense>
    </div>
  );
}

async function HandoverAct({ params }: Pick<ActPageProps, "params">) {
  const route = await params;
  const kind = getActKind(route.act);
  // IT staff hand equipment out and take it back.
  const itPerson = await getCurrentUser();
  if (!can(itPerson.role, "asset:edit")) notFound();

  const user = await getRouteUser(route);
  const act = handoverActs[kind];
  const items = getHandoverItems(user);

  const employeeSide = { role: "Employee", name: user.displayName };
  const itSide = { role: "IT department", name: itPerson.displayName };
  const [giver, receiver] =
    act.givenBy === "it" ? [itSide, employeeSide] : [employeeSide, itSide];

  return (
    <>
      <ActToolbar user={user} kind={kind} />

      <article className="mx-auto mb-10 flex min-h-[297mm] w-[210mm] flex-col gap-8 bg-white p-[15mm] text-[10.5pt] text-neutral-900 shadow-sm print:m-0 print:min-h-0 print:w-auto print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[18pt] font-semibold">{act.title}</h1>
            <p className="text-neutral-600">{formatDate(new Date())}</p>
          </div>
          <Image
            src={logo}
            alt="Asset Management System"
            className="h-9 w-auto"
          />
        </header>

        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1">
          <Detail label="Employee" value={user.displayName} />
          <Detail label="Job title" value={user.jobTitle} />
          <Detail label="Department" value={user.department} />
          <Detail label="Email" value={user.email} />
        </dl>

        <p>{act.statement(user.displayName)}</p>

        <ItemTable items={items} withCondition={act.withCondition} />

        <section className="mt-auto grid grid-cols-2 gap-12 pt-6">
          <Signature label="Handed over by" side={giver} />
          <Signature label="Received by" side={receiver} />
        </section>
      </article>
    </>
  );
}

// Back to the person, the kind of act, and printing. Not printed.
function ActToolbar({
  user,
  kind,
}: {
  user: UserDetail;
  kind: HandoverActKind;
}) {
  return (
    <div className="mx-auto flex w-[210mm] max-w-full flex-wrap items-center justify-between gap-3 py-4 print:hidden">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href={getUserPath(user.id)} />}
      >
        <ArrowLeft aria-hidden />
        {user.displayName}
      </Button>

      <nav
        aria-label="Kind of act"
        className="flex overflow-hidden rounded-md border bg-card"
      >
        {handoverActKinds.map((option) => (
          <Link
            key={option}
            href={getHandoverActPath(user.id, option)}
            replace
            aria-current={option === kind ? "page" : undefined}
            className={cn(
              "border-r px-3 py-1.5 text-sm last:border-r-0 hover:bg-muted",
              option === kind &&
                "bg-primary/10 font-semibold text-primary hover:bg-primary/10",
            )}
          >
            {handoverActs[option].label}
          </Link>
        ))}
      </nav>

      <PrintButton />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <>
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium">{value ?? "—"}</dd>
    </>
  );
}

const cellClassName = "border border-neutral-400 px-2 py-1.5 align-top";

function ItemTable({
  items,
  withCondition,
}: {
  items: HandoverItem[];
  withCondition: boolean;
}) {
  const headers = [
    "No.",
    "Item",
    "Model",
    "Asset tag",
    "Serial / IMEI",
    "Qty",
    ...(withCondition ? ["Condition"] : []),
  ];

  return (
    <table className="w-full border-collapse text-left">
      <thead className="bg-neutral-100 print:bg-neutral-100">
        <tr>
          {headers.map((header) => (
            <th key={header} className={cn(cellClassName, "font-semibold")}>
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className={cellClassName}>
              No equipment.
            </td>
          </tr>
        ) : (
          items.map((item, index) => (
            <tr key={item.key} className="break-inside-avoid">
              <td className={cn(cellClassName, "w-10 tabular-nums")}>
                {index + 1}
              </td>
              <td className={cellClassName}>{item.item}</td>
              <td className={cellClassName}>{item.model ?? "—"}</td>
              <td className={cn(cellClassName, "whitespace-nowrap")}>
                {item.assetTag ?? "—"}
              </td>
              <td className={cellClassName}>
                {item.identifiers.length > 0
                  ? item.identifiers.map((line) => (
                      <div key={line} className="font-mono text-[9pt]">
                        {line}
                      </div>
                    ))
                  : "—"}
              </td>
              <td className={cn(cellClassName, "w-12 text-right tabular-nums")}>
                {item.quantity}
              </td>
              {withCondition && <td className={cn(cellClassName, "w-32")} />}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

type Side = { role: string; name: string };

// Name printed, signature and date written by hand.
function Signature({ label, side }: { label: string; side: Side }) {
  return (
    <div className="flex break-inside-avoid flex-col gap-1">
      <p className="font-semibold">{label}</p>
      <p className="text-neutral-600">{side.role}</p>
      <p className="font-medium">{side.name}</p>
      <SignatureLine label="Signature" />
      <SignatureLine label="Date" />
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-end gap-2">
      <span className="text-neutral-600">{label}</span>
      <span className="flex-1 border-b border-neutral-500" />
    </div>
  );
}
