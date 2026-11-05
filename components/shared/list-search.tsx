"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type SubmitEvent } from "react";
import { SearchInput } from "@/components/shared/search-input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { buildHref, PAGE_PARAM, SEARCH_PARAM } from "@/lib/search-params";
import { cn } from "@/lib/utils";

// Long enough to skip the keys of a word being typed, short enough to feel instant.
const SEARCH_DELAY_MS = 300;

type ListSearchProps = {
  label: string;
  placeholder: string;
  className?: string;
};

// Searches the current list while typing. The query goes to the URL once typing
// pauses, at once on Enter, and an emptied field brings the full list back
// immediately. Other params (status tab, filters) are kept; the page resets.
export function ListSearch({ label, placeholder, className }: ListSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlQuery = searchParams.get(SEARCH_PARAM) ?? "";
  const [value, setValue] = useState(urlQuery);
  // Last query this field sent, to tell its own URL updates from outside ones.
  const [sentQuery, setSentQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);

  // The URL changed from outside (sidebar link, back button): show its query.
  // Our own updates are skipped, so text typed meanwhile is never overwritten.
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== sentQuery) {
      setValue(urlQuery);
      setSentQuery(urlQuery);
    }
  }

  function search(text: string) {
    const query = text.trim();
    // e.g. only a trailing space was added: nothing to fetch.
    if (query === urlQuery) return;

    setSentQuery(query);
    startTransition(() => {
      router.replace(
        buildHref(pathname, Object.fromEntries(searchParams), {
          [SEARCH_PARAM]: query || undefined,
          [PAGE_PARAM]: undefined,
        }),
        { scroll: false },
      );
    });
  }

  const debouncedSearch = useDebouncedCallback(search, SEARCH_DELAY_MS);

  function handleChange(text: string) {
    setValue(text);
    if (text.trim() === "") {
      debouncedSearch.cancel();
      search("");
    } else {
      debouncedSearch.run(text);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    debouncedSearch.cancel();
    search(value);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className={cn("w-full", className)}
    >
      <SearchInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        isPending={isPending}
      />
    </form>
  );
}
