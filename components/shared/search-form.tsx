import Form from "next/form";
import { SearchInput } from "@/components/shared/search-input";
import { SEARCH_PARAM } from "@/lib/search-params";
import { cn } from "@/lib/utils";

type SearchFormProps = {
  // Page the search opens on Enter, e.g. "/assets".
  action: string;
  label: string;
  placeholder: string;
  className?: string;
};

// Search that opens another page on Enter (the header search).
// Searching inside a list while typing is ListSearch.
export function SearchForm({
  action,
  label,
  placeholder,
  className,
}: SearchFormProps) {
  return (
    <Form action={action} className={cn("w-full", className)}>
      <SearchInput
        name={SEARCH_PARAM}
        label={label}
        placeholder={placeholder}
      />
    </Form>
  );
}
