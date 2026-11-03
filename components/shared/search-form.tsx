import Form from "next/form";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SEARCH_PARAM } from "@/lib/search-params";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  // Page the search runs on, e.g. "/assets".
  action: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  // Params kept when a new search is submitted (e.g. the active status tab).
  // A GET form replaces the whole query string, so they go in hidden inputs.
  preserve?: Record<string, string | undefined>;
  className?: string;
};

export function SearchForm({
  action,
  label,
  placeholder,
  defaultValue,
  preserve = {},
  className,
}: SearchFormProps) {
  return (
    <Form action={action} className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        // Remount when the URL changes so the field shows the current query.
        key={defaultValue}
        type="search"
        name={SEARCH_PARAM}
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label={label}
        className="pl-8"
      />
      {Object.entries(preserve).map(
        ([name, value]) =>
          value && <input key={name} type="hidden" name={name} value={value} />,
      )}
    </Form>
  );
}
