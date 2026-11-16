"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import {
  AssignmentDialog,
  ChoiceField,
  QuantityField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import type { Choice } from "@/components/shared/choice-select";
import type { AssignAccessoryValues } from "@/lib/schemas/accessory";

type AssignAccessoryDialogProps = {
  accessoryName: string;
  inStock: number;
  // People who can get it (active only).
  users: Choice[];
  onSubmit: AssignmentSubmit<AssignAccessoryValues>;
};

// Hands some of the accessory to a person, out of what is in stock.
export function AssignAccessoryDialog({
  accessoryName,
  inStock,
  users,
  onSubmit,
}: AssignAccessoryDialogProps) {
  const [userId, setUserId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("1");

  return (
    <AssignmentDialog
      triggerLabel="Assign"
      triggerIcon={LogOut}
      disabled={inStock === 0}
      title={`Assign ${accessoryName}`}
      description={`${inStock} in stock.`}
      submitLabel="Assign"
      withNote={false}
      onOpen={() => {
        setUserId(null);
        setQuantity("1");
      }}
      onSubmit={() => onSubmit({ userId, quantity })}
    >
      {(fieldErrors, clearFieldError) => (
        <>
          <ChoiceField
            label="User"
            value={userId}
            onChange={(id) => {
              setUserId(id);
              clearFieldError("userId");
            }}
            choices={users}
            placeholder="Search by name or email"
            searchable
            error={fieldErrors.userId}
          />
          <QuantityField
            label="Quantity"
            value={quantity}
            onChange={(value) => {
              setQuantity(value);
              clearFieldError("quantity");
            }}
            max={inStock}
            error={fieldErrors.quantity}
          />
        </>
      )}
    </AssignmentDialog>
  );
}
