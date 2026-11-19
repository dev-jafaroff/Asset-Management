"use client";

import { Ban, Pencil, Plus } from "lucide-react";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { CategoryIcon } from "@/components/assets/asset-icons";
import {
  AssignmentDialog,
  ChoiceField,
} from "@/components/assets/assignment-dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import {
  getEmptyLookupValues,
  LOOKUP_NAME_MAX_LENGTH,
  type LookupField,
  type LookupValues,
} from "@/lib/schemas/lookup";
import { cn } from "@/lib/utils";

type LookupDialogProps = {
  // What one row is called, e.g. "status".
  noun: string;
  fields: LookupField[];
  // The row being edited; without it the dialog adds a new one.
  values?: LookupValues;
  onSave: (values: LookupValues) => Promise<AssignmentErrors | null>;
};

// Adds or edits one row of any lookup table; the tab's fields say what it
// asks for. "New …" sits above the table, Edit at the end of each row.
export function LookupDialog({
  noun,
  fields,
  values,
  onSave,
}: LookupDialogProps) {
  const isNew = values === undefined;
  const startValues = values ?? getEmptyLookupValues(fields);
  const [current, setCurrent] = useState(startValues);

  return (
    <AssignmentDialog
      triggerLabel={isNew ? `New ${noun}` : "Edit"}
      triggerIcon={isNew ? Plus : Pencil}
      triggerVariant={isNew ? "default" : "ghost"}
      title={isNew ? `New ${noun}` : `Edit ${noun}`}
      description={
        isNew
          ? "It can be chosen in forms as soon as it is saved."
          : `The change shows everywhere this ${noun} is used.`
      }
      submitLabel={isNew ? "Add" : "Save"}
      withNote={false}
      onOpen={() => setCurrent(startValues)}
      onSubmit={() => onSave(current)}
    >
      {(fieldErrors, clearFieldError) =>
        fields.map((field) => (
          <LookupFieldControl
            key={field.name}
            field={field}
            value={current[field.name] ?? null}
            error={fieldErrors[field.name]}
            onChange={(value) => {
              setCurrent((values) => ({ ...values, [field.name]: value }));
              clearFieldError(field.name);
            }}
          />
        ))
      }
    </AssignmentDialog>
  );
}

type FieldControlProps = {
  field: LookupField;
  value: string | number | null;
  error?: string;
  onChange: (value: string | number | null) => void;
};

// One field, drawn by its kind.
function LookupFieldControl({
  field,
  value,
  error,
  onChange,
}: FieldControlProps) {
  const id = useId();

  if (field.kind === "choice") {
    return (
      <ChoiceField
        label={field.label}
        value={typeof value === "number" ? value : null}
        onChange={onChange}
        choices={field.choices}
        placeholder={field.placeholder}
        error={error}
        description={field.description}
      />
    );
  }

  const text = typeof value === "string" ? value : null;
  // Pickers are groups of buttons: their label names the group, not an input.
  const isPicker = field.kind !== "text";

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={isPicker ? undefined : id} id={`${id}-label`}>
        {field.label}
        {field.kind === "text" && field.optional && (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </FieldLabel>

      {field.kind === "text" && (
        <Input
          id={id}
          value={text ?? ""}
          onChange={(event) => onChange(event.target.value)}
          maxLength={LOOKUP_NAME_MAX_LENGTH}
          placeholder={field.placeholder}
          aria-invalid={error ? true : undefined}
        />
      )}

      {field.kind === "segmented" && (
        <RadioGroup
          labelId={`${id}-label`}
          className="flex w-full overflow-hidden rounded-md border"
        >
          {field.options.map((option) => (
            <Radio
              key={option.value}
              checked={text === option.value}
              onSelect={() => onChange(option.value)}
              className="flex-1 border-r px-2 py-1.5 text-sm last:border-r-0 aria-checked:bg-primary/10 aria-checked:font-semibold aria-checked:text-primary"
            >
              {option.label}
            </Radio>
          ))}
        </RadioGroup>
      )}

      {field.kind === "icons" && (
        <IconPicker
          labelId={`${id}-label`}
          options={field.options}
          value={text}
          onChange={onChange}
        />
      )}

      {field.kind === "color" && (
        <ColorPicker
          labelId={`${id}-label`}
          colors={field.colors}
          value={text ?? ""}
          invalid={Boolean(error)}
          onChange={onChange}
        />
      )}

      {error || !field.description ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldDescription>{field.description}</FieldDescription>
      )}
    </Field>
  );
}

// A set of buttons where one is chosen, read out like radio buttons.
function RadioGroup({
  labelId,
  className,
  children,
}: {
  labelId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className={className}>
      {children}
    </div>
  );
}

function Radio({
  checked,
  onSelect,
  label,
  className,
  style,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  // For buttons that only show an icon or a color.
  label?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
}

type IconOption = { value: string; label: string; group: string };

// Icons in their groups (Computers, Network, …), with "No icon" first. Each
// one says what it is on hover.
function IconPicker({
  labelId,
  options,
  value,
  onChange,
}: {
  labelId: string;
  options: readonly IconOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const groups = new Map<string, IconOption[]>();
  for (const option of options) {
    groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
  }
  const iconClassName =
    "rounded-md p-0.5 aria-checked:ring-2 aria-checked:ring-primary";

  return (
    <RadioGroup
      labelId={labelId}
      className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-md border p-2"
    >
      <Radio
        label="No icon"
        checked={value === null}
        onSelect={() => onChange(null)}
        className={cn(iconClassName, "w-fit")}
      >
        <span className="flex size-6.5 items-center justify-center rounded-md border text-muted-foreground">
          <Ban aria-hidden className="size-3.5" />
        </span>
      </Radio>
      {[...groups].map(([group, icons]) => (
        <div key={group} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{group}</span>
          <div className="flex flex-wrap gap-1">
            {icons.map((option) => (
              <Radio
                key={option.value}
                label={option.label}
                checked={value === option.value}
                onSelect={() => onChange(option.value)}
                className={iconClassName}
              >
                <CategoryIcon iconKey={option.value} />
              </Radio>
            ))}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

const hexColorPattern = /^#[0-9a-f]{6}$/i;

// Quick swatches, a picker for any other color, and the color's code, which
// can also be typed, e.g. #2563eb.
function ColorPicker({
  labelId,
  colors,
  value,
  invalid,
  onChange,
}: {
  labelId: string;
  colors: readonly { value: string; label: string }[];
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const isValid = hexColorPattern.test(value);
  const isPreset = colors.some(
    (color) => color.value.toLowerCase() === value.toLowerCase(),
  );
  const isCustom = isValid && !isPreset;
  const swatchClassName =
    "size-6 rounded-md outline-offset-2 aria-checked:outline-2 aria-checked:outline-foreground";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RadioGroup labelId={labelId} className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <Radio
            key={color.value}
            label={color.label}
            checked={color.value.toLowerCase() === value.toLowerCase()}
            onSelect={() => onChange(color.value)}
            className={swatchClassName}
            style={{ backgroundColor: color.value }}
          />
        ))}
      </RadioGroup>
      {/* Any other color, from the browser's color picker. Rainbow until
          one is picked, then that color. */}
      <label
        title="Any color"
        className={cn(
          "relative size-6 cursor-pointer rounded-md bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] outline-offset-2 focus-within:ring-2 focus-within:ring-ring",
          isCustom && "outline-2 outline-foreground",
        )}
        style={isCustom ? { background: value } : undefined}
      >
        <input
          type="color"
          aria-label="Any color"
          value={isValid ? value.toLowerCase() : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        aria-label="Color code"
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        maxLength={7}
        placeholder="#2563eb"
        aria-invalid={invalid || undefined}
        className="w-28 font-mono"
      />
    </div>
  );
}
