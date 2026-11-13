"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// One entry of the list, picked by its record id. The description is shown
// under the label and searched too, e.g. a person's email and department.
export type Choice = {
  value: number;
  label: string;
  description?: string;
};

export type ChoiceSelectProps = {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
  choices: Choice[];
  placeholder: string;
  // Long lists (models, people) are searched by typing; short ones open a list.
  searchable?: boolean;
  // Optional fields can be emptied again.
  clearable?: boolean;
  invalid?: boolean;
  onBlur?: () => void;
  // Lets a form focus the control, e.g. when the server rejects its value.
  inputRef?: (element: HTMLElement | null) => void;
};

// Picks one record from a list, in forms and dialogs alike.
export function ChoiceSelect({ searchable, ...props }: ChoiceSelectProps) {
  return searchable ? <SearchSelect {...props} /> : <PlainSelect {...props} />;
}

type ControlProps = Omit<ChoiceSelectProps, "searchable">;

// A short list (statuses, companies, locations).
function PlainSelect({
  id,
  value,
  onChange,
  choices,
  placeholder,
  clearable,
  invalid,
  onBlur,
  inputRef,
}: ControlProps) {
  // null is the "empty" entry, e.g. "No company".
  const items = [
    ...(clearable ? [{ value: null, label: placeholder }] : []),
    ...choices,
  ];

  return (
    <Select items={items} value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        ref={inputRef}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        className="w-full"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value ?? "none"} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Every typed word must appear in the label or the description, so
// "aysel it" finds Aysel Huseynova from the IT department.
function matchesChoice(choice: Choice, query: string): boolean {
  const text = `${choice.label} ${choice.description ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}

// A long list (models, people), searched by typing.
function SearchSelect({
  id,
  value,
  onChange,
  choices,
  placeholder,
  clearable,
  invalid,
  onBlur,
  inputRef,
}: ControlProps) {
  const selected = choices.find((choice) => choice.value === value) ?? null;

  return (
    <Combobox
      items={choices}
      value={selected}
      onValueChange={(choice) => onChange(choice?.value ?? null)}
      itemToStringLabel={(choice) => choice.label}
      isItemEqualToValue={(choice, other) => choice.value === other.value}
      filter={matchesChoice}
      inputRef={inputRef}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        onBlur={onBlur}
        showClear={Boolean(clearable) && selected !== null}
        aria-invalid={invalid || undefined}
        className="w-full"
      />
      <ComboboxContent>
        <ComboboxEmpty>No matches.</ComboboxEmpty>
        <ComboboxList>
          {(choice: Choice) => (
            <ComboboxItem key={choice.value} value={choice}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{choice.label}</span>
                {choice.description && (
                  <span className="truncate text-xs text-muted-foreground">
                    {choice.description}
                  </span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
