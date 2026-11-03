import { Suspense, type ReactNode } from "react";
import type { Role } from "@/lib/current-user";
import { NavGroup } from "./nav-group";
import {
  isNavGroup,
  navSections,
  type NavItem,
  type NavSection,
} from "./nav-items";
import { NavLink } from "./nav-link";
import { StatusNav } from "./status-nav";

function SidebarItem({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const icon = Icon ? <Icon /> : undefined;

  if (isNavGroup(item)) {
    return (
      <NavGroup label={item.label} icon={icon} basePath={item.basePath}>
        {item.items.map((child) => (
          <SidebarItem key={child.href} item={child} />
        ))}
      </NavGroup>
    );
  }

  return (
    <NavLink
      href={item.href}
      label={item.label}
      icon={icon}
      exact={item.exact}
    />
  );
}

function SidebarSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {title && (
        <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function renderSection(section: NavSection, index: number) {
  return (
    <SidebarSection key={section.title ?? index} title={section.title}>
      {section.items.map((item) => (
        <SidebarItem
          key={isNavGroup(item) ? item.basePath : item.href}
          item={item}
        />
      ))}
    </SidebarSection>
  );
}

export function SidebarNav({ role }: { role: Role }) {
  const sections = navSections.filter(
    (section) => !section.roles || section.roles.includes(role),
  );
  // Role-restricted sections (Admin) stay at the bottom, below "By status".
  const openSections = sections.filter((section) => !section.roles);
  const restrictedSections = sections.filter((section) => section.roles);

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
      {openSections.map(renderSection)}

      <SidebarSection title="By status">
        <Suspense fallback={null}>
          <StatusNav />
        </Suspense>
      </SidebarSection>

      {restrictedSections.map(renderSection)}
    </nav>
  );
}
