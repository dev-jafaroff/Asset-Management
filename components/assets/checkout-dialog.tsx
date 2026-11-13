"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import {
  AssignmentDialog,
  ChoiceField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import type { Choice } from "@/components/shared/choice-select";
import type { AssignTarget } from "@/lib/assets/asset-types";
import type { CheckoutValues } from "@/lib/schemas/asset";

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
  // e.g. "Check out PC-00041" or "Check out 3 assets".
  title: string;
  // e.g. "Choose the user it goes to."
  description: string;
  assignTo: AssignTarget;
  // The people, companies or locations it can go to.
  holders: Choice[];
  disabled?: boolean;
  onSubmit: AssignmentSubmit<CheckoutValues>;
};

// Hands one asset, or a selection, to a person, company or location.
export function CheckoutDialog({
  title,
  description,
  assignTo,
  holders,
  disabled,
  onSubmit,
}: CheckoutDialogProps) {
  const [holderId, setHolderId] = useState<number | null>(null);
  const holderField = holderFields[assignTo];

  return (
    <AssignmentDialog
      triggerLabel="Check out"
      triggerIcon={LogOut}
      disabled={disabled}
      title={title}
      description={description}
      submitLabel="Check out"
      onOpen={() => setHolderId(null)}
      onSubmit={(note) => onSubmit({ holderId, note })}
    >
      {(fieldErrors, clearFieldError) => (
        <ChoiceField
          label={holderField.label}
          value={holderId}
          onChange={(id) => {
            setHolderId(id);
            clearFieldError("holderId");
          }}
          choices={holders}
          placeholder={holderField.placeholder}
          searchable={holderField.searchable}
          error={fieldErrors.holderId}
        />
      )}
    </AssignmentDialog>
  );
}
