import { cn, getInitials } from "@/lib/utils";

// Light background with dark text of the same hue; readable in both themes.
const avatarColors = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200",
];

const avatarSizes = {
  // 30px: same as a medium IconTile, so avatars and icons line up in lists.
  md: "size-7.5 text-xs",
  // 32px: the header.
  lg: "size-8 text-xs",
};

// The same name always gets the same color, so people are easy to spot.
function getAvatarColor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return avatarColors[hash % avatarColors.length];
}

type UserAvatarProps = {
  name: string;
  size?: keyof typeof avatarSizes;
  className?: string;
};

// Initials on a colored circle. Decorative: the name is always shown next to it.
export function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        avatarSizes[size],
        getAvatarColor(name),
        className,
      )}
    >
      {getInitials(name)}
    </span>
  );
}
