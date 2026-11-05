import Form from "next/form";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  PAGE_PARAM,
  SEARCH_PARAM,
  type SearchParams,
} from "@/lib/search-params";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  // Page the search runs on, e.g. "/assets".
  action: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  // Current params to keep (status tab, filters) when a new search is submitted.
  // A GET form replaces the whole query string, so they go in hidden inputs.
  // The old query and page are dropped: a new search starts on page 1.
  preserve?: SearchParams;
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
  const hiddenFields = Object.entries(preserve).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" &&
      entry[0] !== SEARCH_PARAM &&
      entry[0] !== PAGE_PARAM,
  );

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
      {hiddenFields.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </Form>
  );
}
