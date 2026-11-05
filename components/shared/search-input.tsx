import type { ComponentProps } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  // Shows a spinner instead of the search icon while results load.
  isPending?: boolean;
};

// Search field look shared by the header search and list searches.
export function SearchInput({
  label,
  isPending = false,
  className,
  ...props
}: SearchInputProps) {
  const Icon = isPending ? LoaderCircle : Search;

  return (
    <div className="relative w-full">
      <Icon
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground",
          isPending && "animate-spin",
        )}
      />
      <Input
        type="search"
        aria-label={label}
        className={cn("pl-8", className)}
        {...props}
      />
    </div>
  );
}
