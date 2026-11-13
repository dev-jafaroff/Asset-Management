"use client";

import { LogIn } from "lucide-react";
import { useId, useState } from "react";
import { submitCheckin } from "@/app/(app)/assets/[type]/[id]/actions";
import { AssignmentDialog } from "@/components/assets/checkout-dialog";
import { ChoiceSelect, type Choice } from "@/components/shared/choice-select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

type CheckinDialogProps = {
  assetId: number;
  // e.g. "PC-00041", in the title.
  assetName: string;
  // Who or where it comes back from, e.g. "Aysel Huseynova".
  holder: string;
  statuses: Choice[];
  // Chosen when the dialog opens, e.g. "In storage".
  defaultStatusId: number | null;
};

// Takes the asset back and sets the status it returns to.
export function CheckinDialog({
  assetId,
  assetName,
  holder,
  statuses,
  defaultStatusId,
}: CheckinDialogProps) {
  const [statusId, setStatusId] = useState(defaultStatusId);
  const statusFieldId = useId();

  return (
    <AssignmentDialog
      triggerLabel="Check in"
      triggerIcon={LogIn}
      title={`Check in ${assetName}`}
      description={`Take it back from ${holder}.`}
      submitLabel="Check in"
      onOpen={() => setStatusId(defaultStatusId)}
      onSubmit={(note) => submitCheckin(assetId, { statusId, note })}
    >
      {(fieldErrors, clearFieldError) => (
        <Field data-invalid={fieldErrors.statusId ? true : undefined}>
          <FieldLabel htmlFor={statusFieldId}>Status after return</FieldLabel>
          <ChoiceSelect
            id={statusFieldId}
            value={statusId}
            onChange={(id) => {
              setStatusId(id);
              clearFieldError("statusId");
            }}
            choices={statuses}
            placeholder="Choose a status"
            invalid={Boolean(fieldErrors.statusId)}
          />
          {fieldErrors.statusId ? (
            <FieldError>{fieldErrors.statusId}</FieldError>
          ) : (
            <FieldDescription>
              In storage: ready to hand out again. Pending: waiting for a wipe
              or a check.
            </FieldDescription>
          )}
        </Field>
      )}
    </AssignmentDialog>
  );
}
