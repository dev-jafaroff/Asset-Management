import Link from "next/link";
import {
  submitAccessoryReturn,
  submitReturnAllAccessories,
} from "@/app/(app)/assets/accessories/actions";
import {
  ReturnAccessoryDialog,
  ReturnAllAccessoriesDialog,
} from "@/components/accessories/return-accessory-dialog";
import { AccessoryIcon } from "@/components/assets/asset-icons";
import { DateTime } from "@/components/shared/date-time";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAccessoryPath } from "@/lib/accessories/queries";
import { formatAccessoryCount, sumQuantity } from "@/lib/schemas/accessory";
import type { UserAccessory } from "@/lib/users/queries";

type UserAccessoriesCardProps = {
  userId: number;
  userName: string;
  accessories: UserAccessory[];
  // Editors take any handout back here, fully or in part, or all at once.
  canEdit: boolean;
};

// The accessories the person has now, one row per handout.
export function UserAccessoriesCard({
  userId,
  userName,
  accessories,
  canEdit,
}: UserAccessoriesCardProps) {
  const pieces = sumQuantity(accessories);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accessories</CardTitle>
        <CardAction className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {formatAccessoryCount(pieces)}
          </span>
          {canEdit && accessories.length > 0 && (
            <ReturnAllAccessoriesDialog
              holderName={userName}
              pieces={pieces}
              onSubmit={submitReturnAllAccessories.bind(null, userId)}
            />
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {accessories.length === 0 ? (
          <p className="text-muted-foreground">
            {userName} holds no accessories.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Accessory</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Since</TableHead>
                {canEdit && (
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessories.map((held) => (
                <TableRow key={held.id}>
                  <TableCell>
                    <Link
                      href={getAccessoryPath(held.accessory.id)}
                      className="flex w-fit items-center gap-2 font-medium text-primary hover:underline"
                    >
                      <AccessoryIcon iconKey={held.accessory.category.icon} />
                      {held.accessory.name}
                    </Link>
                  </TableCell>
                  <TableCell>{held.accessory.category.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {held.quantity}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <DateTime date={held.assignedAt} />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <ReturnAccessoryDialog
                        accessoryName={held.accessory.name}
                        holderName={userName}
                        held={held.quantity}
                        onSubmit={submitAccessoryReturn.bind(null, held.id)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
