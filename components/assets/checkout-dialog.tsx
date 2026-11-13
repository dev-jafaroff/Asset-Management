"use client";

import { LogOut, type LucideIcon } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";
import { submitCheckout } from "@/app/(app)/assets/[type]/[id]/actions";
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
import type { AssignTarget } from "@/lib/assets/asset-types";
import type { AssignmentErrors } from "@/lib/assets/checkout";
import { ASSET_EVENT_NOTE_MAX_LENGTH } from "@/lib/schemas/asset";

// ─── Shared dialog ───────────────────────────────────────────────────────────

type AssignmentDialogProps = {
  triggerLabel: string;
  triggerIcon: LucideIcon;
  title: string;
  description: ReactNode;
  submitLabel: string;
  // Called as the dialog opens, so it starts from fresh values.
  onOpen: () => void;
  // Saves the dialog; returns the errors, or null when done (it then closes).
  onSubmit: (note: string) => Promise<AssignmentErrors | null>;
  // The dialog's own fields, above the note. They get their errors by name,
  // and clear one as soon as its value changes.
  children: (
    fieldErrors: Record<string, string>,
    clearFieldError: (field: string) => void,
  ) => ReactNode;
};

// Checkout and checkin dialogs: their fields, an optional note for the
// history, and Cancel / submit. Also used by CheckinDialog.
export function AssignmentDialog({
  triggerLabel,
  triggerIcon: TriggerIcon,
  title,
  description,
  submitLabel,
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
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
              placeholder="Optional, e.g. Charger and bag handed over"
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

// ─── Checkout ────────────────────────────────────────────────────────────────

// How the holder is chosen, per the type's assignTo. People are many, so
// they are searched; companies and locations fit in a short list.
const holderFields: Record<
  AssignTarget,
  { label: string; placeholder: string; searchable: boolean }
> = {
  user: {
    label: "User",
    placeholder: "Search by name or email",
    searchable: true,
  },
  company: {
    label: "Company",
    placeholder: "Choose a company",
    searchable: false,
  },
  location: {
    label: "Location",
    placeholder: "Choose a location",
    searchable: false,
  },
};

type CheckoutDialogProps = {
  assetId: number;
  // e.g. "PC-00041", in the title.
  assetName: string;
  assignTo: AssignTarget;
  // The people, companies or locations it can go to.
  holders: Choice[];
};

// Hands the asset to a person, company or location, per its type.
export function CheckoutDialog({
  assetId,
  assetName,
  assignTo,
  holders,
}: CheckoutDialogProps) {
  const [holderId, setHolderId] = useState<number | null>(null);
  const holderFieldId = useId();
  const holderField = holderFields[assignTo];

  return (
    <AssignmentDialog
      triggerLabel="Check out"
      triggerIcon={LogOut}
      title={`Check out ${assetName}`}
      description={`Choose the ${holderField.label.toLowerCase()} it goes to.`}
      submitLabel="Check out"
      onOpen={() => setHolderId(null)}
      onSubmit={(note) => submitCheckout(assetId, { holderId, note })}
    >
      {(fieldErrors, clearFieldError) => (
        <Field data-invalid={fieldErrors.holderId ? true : undefined}>
          <FieldLabel htmlFor={holderFieldId}>{holderField.label}</FieldLabel>
          <ChoiceSelect
            id={holderFieldId}
            value={holderId}
            onChange={(id) => {
              setHolderId(id);
              clearFieldError("holderId");
            }}
            choices={holders}
            placeholder={holderField.placeholder}
            searchable={holderField.searchable}
            invalid={Boolean(fieldErrors.holderId)}
          />
          <FieldError>{fieldErrors.holderId}</FieldError>
        </Field>
      )}
    </AssignmentDialog>
  );
}
