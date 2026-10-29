import type { Role } from "@/lib/current-user";
import { NavGroup } from "./nav-group";
import { isNavGroup, navSections, type NavItem } from "./nav-items";
import { NavLink } from "./nav-link";

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

export function SidebarNav({ role }: { role: Role }) {
  const sections = navSections.filter(
    (section) => !section.roles || section.roles.includes(role),
  );

  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-2">
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <SidebarItem
              key={isNavGroup(item) ? item.basePath : item.href}
              item={item}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
