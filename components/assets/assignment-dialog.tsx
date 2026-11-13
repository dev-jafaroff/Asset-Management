"use client";

import type { LucideIcon } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { ChoiceSelect, type Choice } from "@/components/shared/choice-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import { ASSET_EVENT_NOTE_MAX_LENGTH } from "@/lib/schemas/asset";

// Saves a dialog; returns the errors, or null when done (it then closes).
// The same shape serves one asset on its page and a selection in a list.
export type AssignmentSubmit<Values> = (
  values: Values,
) => Promise<AssignmentErrors | null>;

type AssignmentDialogProps = {
  triggerLabel: string;
  triggerIcon: LucideIcon;
  // e.g. while the selection cannot be checked out as one.
  disabled?: boolean;
  title: string;
  description: ReactNode;
  submitLabel: string;
  notePlaceholder?: string;
  // Called as the dialog opens, so it starts from fresh values.
  onOpen: () => void;
  onSubmit: (note: string) => Promise<AssignmentErrors | null>;
  // The dialog's own fields, above the note. They get their errors by name,
  // and clear one as soon as its value changes.
  children: (
    fieldErrors: Record<string, string>,
    clearFieldError: (field: string) => void,
  ) => ReactNode;
};

// Checkout, checkin and status dialogs: their fields, an optional note for
// the history, and Cancel / submit.
export function AssignmentDialog({
  triggerLabel,
  triggerIcon: TriggerIcon,
  disabled,
  title,
  description,
  submitLabel,
  notePlaceholder = "Optional, e.g. Charger and bag handed over",
  onOpen,
  onSubmit,
  children,
}: AssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<AssignmentErrors>({});
  const [isSaving, startSaving] = useTransition();
  const noteId = useId();

  function handleOpenChange(next: boolean) {
    if (next) {
      setNote("");
      setErrors({});
      onOpen();
    }
    setOpen(next);
  }

  function save() {
    startSaving(async () => {
      const result = await onSubmit(note);
      if (result) setErrors(result);
      else setOpen(false);
    });
  }

  function clearFieldError(field: string) {
    setErrors((current) => {
      if (!current.fields?.[field]) return current;
      const fields = Object.fromEntries(
        Object.entries(current.fields).filter(([name]) => name !== field),
      );
      return { ...current, fields };
    });
  }

  const noteError = errors.fields?.note;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        disabled={disabled}
        render={<Button variant="outline" size="sm" />}
      >
        <TriggerIcon aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
          noValidate
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {children(errors.fields ?? {}, clearFieldError)}

          <Field data-invalid={noteError ? true : undefined}>
            <FieldLabel htmlFor={noteId}>Note</FieldLabel>
            <Textarea
              id={noteId}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
                clearFieldError("note");
              }}
              maxLength={ASSET_EVENT_NOTE_MAX_LENGTH}
              placeholder={notePlaceholder}
              aria-invalid={noteError ? true : undefined}
            />
            {noteError ? (
              <FieldError>{noteError}</FieldError>
            ) : (
              <FieldDescription>Shown in the asset history.</FieldDescription>
            )}
          </Field>

          {errors.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.message}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ChoiceFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  choices: Choice[];
  placeholder: string;
  searchable?: boolean;
  error?: string;
  // Shown under the list while there is no error.
  description?: ReactNode;
};

// One list in a dialog (holder, status), with its label and error.
export function ChoiceField({
  label,
  error,
  description,
  ...select
}: ChoiceFieldProps) {
  const id = useId();

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <ChoiceSelect id={id} invalid={Boolean(error)} {...select} />
      {error || !description ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldDescription>{description}</FieldDescription>
      )}
    </Field>
  );
}
