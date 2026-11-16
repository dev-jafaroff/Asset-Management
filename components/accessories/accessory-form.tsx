"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { FieldShell } from "@/components/assets/asset-form";
import { ChoiceSelect, type Choice } from "@/components/shared/choice-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import {
  ACCESSORY_NAME_MAX_LENGTH,
  ACCESSORY_QUANTITY_MAX,
  accessoryFormSchema,
  describeHandedOut,
  type AccessoryFormData,
  type AccessoryFormValues,
} from "@/lib/schemas/accessory";
import { ASSET_EVENT_NOTE_MAX_LENGTH } from "@/lib/schemas/asset";

const formFields = ["name", "categoryId", "totalQuantity", "note"] as const;

type AccessoryFormProps = {
  categories: Choice[];
  defaultValues: AccessoryFormValues;
  // How many are handed out now; set when editing, as the total's floor.
  assigned?: number;
  // Saves the form; returns the errors when it cannot be saved.
  action: (values: AccessoryFormValues) => Promise<AssignmentErrors>;
  submitLabel: string;
  cancelHref: string;
};

// New and edit form of an accessory. The total is the whole stock, handed
// out or not; a change of it goes to the stock history with the note.
export function AccessoryForm({
  categories,
  defaultValues,
  assigned,
  action,
  submitLabel,
  cancelHref,
}: AccessoryFormProps) {
  const isNew = assigned === undefined;
  const ids = {
    name: useId(),
    categoryId: useId(),
    totalQuantity: useId(),
    note: useId(),
  };
  const form = useForm<AccessoryFormValues, unknown, AccessoryFormData>({
    resolver: zodResolver(accessoryFormSchema),
    defaultValues,
    // Check a field once it is left, then again on every change.
    mode: "onTouched",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function save() {
    setFormError(null);
    startSaving(async () => {
      const errors = await action(form.getValues());
      setFormError(errors.message ?? null);
      // Server errors go under their fields; the first one gets the focus.
      const failed = formFields.filter((field) => errors.fields?.[field]);
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
      className="flex max-w-3xl flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldShell
                id={ids.name}
                label="Name"
                required
                error={fieldState.error?.message}
                wide
              >
                <Input
                  {...field}
                  id={ids.name}
                  maxLength={ACCESSORY_NAME_MAX_LENGTH}
                  placeholder="e.g. Logitech M185"
                  aria-invalid={fieldState.invalid || undefined}
                />
              </FieldShell>
            )}
          />
          <Controller
            name="categoryId"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldShell
                id={ids.categoryId}
                label="Category"
                required
                error={fieldState.error?.message}
              >
                <ChoiceSelect
                  id={ids.categoryId}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  choices={categories}
                  placeholder="Choose a category"
                  invalid={fieldState.invalid}
                />
              </FieldShell>
            )}
          />
          <Controller
            name="totalQuantity"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldShell
                id={ids.totalQuantity}
                label="Total quantity"
                required
                description={
                  isNew
                    ? "Everything you have, in stock and handed out."
                    : `${describeHandedOut(assigned)} now.`
                }
                error={fieldState.error?.message}
              >
                <Input
                  {...field}
                  id={ids.totalQuantity}
                  type="number"
                  inputMode="numeric"
                  min={assigned ?? 0}
                  max={ACCESSORY_QUANTITY_MAX}
                  step={1}
                  aria-invalid={fieldState.invalid || undefined}
                  className="w-32"
                />
              </FieldShell>
            )}
          />
          <Controller
            name="note"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldShell
                id={ids.note}
                label="Note"
                required={false}
                description={
                  isNew
                    ? "Shown in the stock history."
                    : "Saved in the stock history when the total changes."
                }
                error={fieldState.error?.message}
                wide
              >
                <Textarea
                  {...field}
                  id={ids.note}
                  maxLength={ASSET_EVENT_NOTE_MAX_LENGTH}
                  placeholder="Optional, e.g. 10 more bought for the new office"
                  aria-invalid={fieldState.invalid || undefined}
                />
              </FieldShell>
            )}
          />
        </CardContent>
      </Card>

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
