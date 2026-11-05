import Link from "next/link";
import { Fragment, type ReactNode } from "react";

export type Breadcrumb = {
  label: string;
  // The last crumb is the current page and has no link.
  href?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  // Path to a nested page, e.g. Assets / PCs / PC-00007.
  breadcrumbs?: Breadcrumb[];
  // Shown next to the title, e.g. the status badge.
  badges?: ReactNode;
  actions?: ReactNode;
};

function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map(({ label, href }, index) => (
          <Fragment key={label}>
            {index > 0 && <li aria-hidden>/</li>}
            <li>
              {href ? (
                <Link href={href} className="text-primary hover:underline">
                  {label}
                </Link>
              ) : (
                <span aria-current="page">{label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badges,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold">{title}</h1>
          {badges}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
