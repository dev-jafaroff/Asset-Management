"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import {
  AssignmentDialog,
  QuantityField,
  type AssignmentSubmit,
} from "@/components/assets/assignment-dialog";
import type { ReturnAccessoryValues } from "@/lib/schemas/accessory";

type ReturnAccessoryDialogProps = {
  accessoryName: string;
  // Who brings it back, e.g. "Aysel Huseynova".
  holderName: string;
  // How many they have in this handout.
  held: number;
  onSubmit: AssignmentSubmit<ReturnAccessoryValues>;
};

// Takes some or all of one handout back into stock.
export function ReturnAccessoryDialog({
  accessoryName,
  holderName,
  held,
  onSubmit,
}: ReturnAccessoryDialogProps) {
  const [quantity, setQuantity] = useState(String(held));

  return (
    <AssignmentDialog
      triggerLabel="Return"
      triggerIcon={LogIn}
      title={`Return ${accessoryName}`}
      description={`From ${holderName}, who has ${held}.`}
      submitLabel="Return"
      withNote={false}
      onOpen={() => setQuantity(String(held))}
      onSubmit={() => onSubmit({ quantity })}
    >
      {(fieldErrors, clearFieldError) =>
        // One item needs no count: the dialog just confirms.
        held > 1 && (
          <QuantityField
            label="Quantity"
            value={quantity}
            onChange={(value) => {
              setQuantity(value);
              clearFieldError("quantity");
            }}
            max={held}
            error={fieldErrors.quantity}
            description="The rest stays with them."
          />
        )
      }
    </AssignmentDialog>
  );
}
