"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { ChoiceSelect } from "@/components/shared/choice-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  assetFormFieldLabels,
  getAssetFormSections,
  getEditableAssetFields,
  getLockedAssetFields,
  getRequiredAssetFields,
  isAssetListField,
  isNamedAfterTag,
  type AssetFormErrors,
  type AssetFormField,
  type AssetFormMode,
  type AssetListField,
  type AssetTextField,
} from "@/lib/assets/asset-form";
import type { AssetFormOptions } from "@/lib/assets/asset-form-options";
import type { AssetSource, AssetType } from "@/lib/generated/prisma/enums";
import {
  ASSET_NOTES_MAX_LENGTH,
  getAssetFormSchema,
  type AssetFormData,
  type AssetFormValues,
} from "@/lib/schemas/asset";
import { cn } from "@/lib/utils";

// ─── How each field is entered ───────────────────────────────────────────────

type TextFieldSpec = {
  type?: "text" | "date" | "tel";
  // Keyboard on phones, e.g. digits only.
  inputMode?: "numeric" | "decimal" | "tel";
  placeholder?: string;
  // Identifiers read better in a monospace font.
  mono?: boolean;
  // A text area across the whole width.
  multiline?: boolean;
  // Shown after the value, e.g. the currency.
  suffix?: string;
  description?: string;
};

const textFieldSpecs: Record<AssetTextField, TextFieldSpec> = {
  assetTag: {
    mono: true,
    description: "The next free tag. Change it to use a label already printed.",
  },
  name: {},
  serial: { mono: true },
  imei: { mono: true, inputMode: "numeric", placeholder: "15 digits" },
  phoneNumber: {
    type: "tel",
    inputMode: "tel",
    placeholder: "+994 50 123 45 67",
  },
  operatingSystem: {},
  vmHost: { placeholder: "e.g. HV-01" },
  vCpu: { inputMode: "numeric" },
  ramGb: { inputMode: "numeric" },
  purchaseDate: { type: "date" },
  purchaseCost: { inputMode: "decimal", placeholder: "0.00", suffix: "₼" },
  notes: {
    multiline: true,
    placeholder: "e.g. Screen replaced in March; charger kept in IT",
  },
};

type OptionList = Exclude<keyof AssetFormOptions, "defaultStatusId">;

type ListFieldSpec = {
  options: OptionList;
  // Long lists (models, people) are searched by typing.
  searchable?: boolean;
  placeholder: string;
};

const listFieldSpecs: Record<AssetListField, ListFieldSpec> = {
  modelId: {
    options: "models",
    searchable: true,
    placeholder: "Search models",
  },
  statusId: { options: "statuses", placeholder: "Choose a status" },
  companyId: { options: "companies", placeholder: "No company" },
  locationId: { options: "locations", placeholder: "No location" },
  assignedToId: {
    options: "users",
    searchable: true,
    placeholder: "Search by name or email",
  },
};

// ─── Form ────────────────────────────────────────────────────────────────────

type AssetFormProps = {
  type: AssetType;
  mode: AssetFormMode;
  // Where the record came from; Intune owns some fields of synced devices.
  source: AssetSource;
  options: AssetFormOptions;
  defaultValues: AssetFormValues;
  // Saves the values; returns the errors, or opens the asset when it is saved.
  action: (values: AssetFormValues) => Promise<AssetFormErrors>;
  submitLabel: string;
  cancelHref: string;
};

// One form for every asset type: its cards and fields follow the type
// (lib/assets/asset-form.ts). Mistakes show while typing; the server checks
// everything again and its errors appear under the same fields.
export function AssetForm({
  type,
  mode,
  source,
  options,
  defaultValues,
  action,
  submitLabel,
  cancelHref,
}: AssetFormProps) {
  const editable = useMemo(
    () => getEditableAssetFields(type, mode, source),
    [type, mode, source],
  );
  const schema = useMemo(
    () => getAssetFormSchema(type, editable),
    [type, editable],
  );
  const locked = getLockedAssetFields(mode, source);
  // A new asset named after its tag keeps following the tag, until the name
  // is changed by hand.
  const nameFollowsTag = mode === "create" && isNamedAfterTag(type);
  const hints: Partial<Record<AssetFormField, string>> = nameFollowsTag
    ? {
        name: "Same as the tag. Change it only for a differently named device.",
      }
    : {};

  const form = useForm<AssetFormValues, unknown, AssetFormData>({
    resolver: zodResolver(schema),
    defaultValues,
    // Check a field once it is left, then again on every change.
    mode: "onTouched",
  });

  useEffect(() => {
    if (!nameFollowsTag) return;
    // Returns the unsubscribe, which the effect runs on cleanup.
    return form.subscribe({
      name: "assetTag",
      formState: { values: true },
      callback: ({ values }) => {
        if (form.getFieldState("name").isDirty) return;
        form.setValue("name", values.assetTag.trim().toUpperCase());
      },
    });
  }, [form, nameFollowsTag]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const required = new Set(
    getRequiredAssetFields(type).filter((field) => editable.includes(field)),
  );

  function save() {
    setFormError(null);
    startSaving(async () => {
      const errors = await action(form.getValues());
      setFormError(errors.message ?? null);
      // Server errors go under their fields; the first one gets the focus.
      const failed = editable.filter((field) => errors.fields?.[field]);
      failed.forEach((field, index) => {
        form.setError(
          field,
          { type: "server", message: errors.fields?.[field] },
          { shouldFocus: index === 0 },
        );
      });
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(save)}
      noValidate
      className="flex flex-col gap-4"
    >
      {getAssetFormSections(type, mode).map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && (
              <CardDescription>{section.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <AssetFormFieldControl
                key={field}
                field={field}
                control={form.control}
                options={options}
                required={required.has(field)}
                lockedReason={locked[field]}
                hint={hints[field]}
                // A lone field named like its card (Notes) keeps its label for screen readers only.
                hideLabel={
                  section.fields.length === 1 &&
                  assetFormFieldLabels[field] === section.title
                }
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving…" : submitLabel}
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={cancelHref} />}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ─── Fields ──────────────────────────────────────────────────────────────────

type FieldControlProps = {
  field: AssetFormField;
  control: Control<AssetFormValues, unknown, AssetFormData>;
  options: AssetFormOptions;
  required: boolean;
  hideLabel: boolean;
  // Set when the field is shown but cannot be changed (e.g. owned by Intune).
  lockedReason?: string;
  // Replaces the field's usual hint, e.g. why the name matches the tag.
  hint?: string;
};

// Only text fields are ever locked (tag, Intune-owned name, serial and OS).
function AssetFormFieldControl({
  field,
  lockedReason,
  hint,
  ...props
}: FieldControlProps) {
  return isAssetListField(field) ? (
    <ListField name={field} {...props} />
  ) : (
    <TextField
      name={field}
      lockedReason={lockedReason}
      hint={hint}
      {...props}
    />
  );
}

type FieldShellProps = {
  id: string;
  label: string;
  required: boolean;
  description?: string;
  error?: string;
  wide?: boolean;
  hideLabel: boolean;
  children: ReactNode;
};

// Label, control, then the error (or the hint while there is none).
function FieldShell({
  id,
  label,
  required,
  description,
  error,
  wide,
  hideLabel,
  children,
}: FieldShellProps) {
  return (
    <Field
      data-invalid={error ? true : undefined}
      className={cn(wide && "sm:col-span-2")}
    >
      <FieldLabel htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
        {required && (
          <span aria-hidden className="-ml-1.5 text-destructive">
            *
          </span>
        )}
      </FieldLabel>
      {children}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        description && <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  );
}

type TextFieldProps = Omit<FieldControlProps, "field" | "options"> & {
  name: AssetTextField;
};

function TextField({
  name,
  control,
  required,
  hideLabel,
  lockedReason,
  hint,
}: TextFieldProps) {
  const id = useId();
  const spec = textFieldSpecs[name];

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => {
        const inputProps = {
          ...field,
          id,
          required,
          placeholder: spec.placeholder,
          // Read-only rather than disabled, so the value is still sent and checked.
          readOnly: Boolean(lockedReason),
          "aria-invalid": fieldState.invalid || undefined,
          "aria-describedby": fieldState.error ? `${id}-error` : undefined,
        };
        return (
          <FieldShell
            id={id}
            label={assetFormFieldLabels[name]}
            required={required}
            description={lockedReason ?? hint ?? spec.description}
            error={fieldState.error?.message}
            wide={spec.multiline}
            hideLabel={hideLabel}
          >
            {spec.multiline ? (
              <Textarea
                {...inputProps}
                maxLength={ASSET_NOTES_MAX_LENGTH}
                className="max-h-80"
              />
            ) : spec.suffix ? (
              <InputGroup>
                <InputGroupInput
                  {...inputProps}
                  inputMode={spec.inputMode}
                  className={cn(spec.mono && "font-mono")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{spec.suffix}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            ) : (
              <Input
                {...inputProps}
                type={spec.type ?? "text"}
                inputMode={spec.inputMode}
                className={cn(
                  spec.mono && "font-mono",
                  lockedReason && "bg-muted text-muted-foreground",
                )}
              />
            )}
          </FieldShell>
        );
      }}
    />
  );
}

type ListFieldProps = Omit<
  FieldControlProps,
  "field" | "lockedReason" | "hint"
> & {
  name: AssetListField;
};

function ListField({
  name,
  control,
  options,
  required,
  hideLabel,
}: ListFieldProps) {
  const id = useId();
  const spec = listFieldSpecs[name];
  const choices = options[spec.options];

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <FieldShell
          id={id}
          label={assetFormFieldLabels[name]}
          required={required}
          hideLabel={hideLabel}
          error={fieldState.error?.message}
        >
          <ChoiceSelect
            id={id}
            searchable={spec.searchable}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            inputRef={field.ref}
            choices={choices}
            placeholder={spec.placeholder}
            clearable={!required}
            invalid={fieldState.invalid}
          />
        </FieldShell>
      )}
    />
  );
}

// ─── Loading ─────────────────────────────────────────────────────────────────

// Outline of the form while its lists load.
export function AssetFormFallback() {
  return (
    <div aria-busy className="flex flex-col gap-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <span className="sr-only">Loading form…</span>
    </div>
  );
}
