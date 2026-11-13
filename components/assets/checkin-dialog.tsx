"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import {
  AssignmentDialog,
  ChoiceField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import type { Choice } from "@/components/shared/choice-select";
import type { CheckinValues } from "@/lib/schemas/asset";

type CheckinDialogProps = {
  // e.g. "Check in PC-00041" or "Check in 3 assets".
  title: string;
  // e.g. "Take it back from Aysel Huseynova."
  description: string;
  statuses: Choice[];
  // Chosen when the dialog opens, e.g. "In storage".
  defaultStatusId: number | null;
  onSubmit: AssignmentSubmit<CheckinValues>;
};

// Takes one asset, or a selection, back and sets the status it returns to.
export function CheckinDialog({
  title,
  description,
  statuses,
  defaultStatusId,
  onSubmit,
}: CheckinDialogProps) {
  const [statusId, setStatusId] = useState(defaultStatusId);

  return (
    <AssignmentDialog
      triggerLabel="Check in"
      triggerIcon={LogIn}
      title={title}
      description={description}
      submitLabel="Check in"
      onOpen={() => setStatusId(defaultStatusId)}
      onSubmit={(note) => onSubmit({ statusId, note })}
    >
      {(fieldErrors, clearFieldError) => (
        <ChoiceField
          label="Status after return"
          value={statusId}
          onChange={(id) => {
            setStatusId(id);
            clearFieldError("statusId");
          }}
          choices={statuses}
          placeholder="Choose a status"
          error={fieldErrors.statusId}
          description="In storage: ready to hand out again. Pending: waiting for a wipe or a check."
        />
      )}
    </AssignmentDialog>
  );
}
