import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { submitNewAccessory } from "@/app/(app)/assets/accessories/actions";
import { AccessoryForm } from "@/components/accessories/accessory-form";
import { AssetFormFallback } from "@/components/assets/asset-form";
import { PageHeader } from "@/components/layout/page-header";
import {
  ACCESSORIES_PATH,
  listAccessoryCategoryOptions,
} from "@/lib/accessories/queries";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "New accessory" };

export default function NewAccessoryPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New accessory"
        breadcrumbs={[
          { label: "Accessories", href: ACCESSORIES_PATH },
          { label: "New" },
        ]}
      />
      <Suspense fallback={<AssetFormFallback />}>
        <NewAccessoryForm />
      </Suspense>
    </div>
  );
}

// The categories are read per request, so they stream in.
async function NewAccessoryForm() {
  const user = await getCurrentUser();
  // The "New accessory" button is hidden too; this covers a typed link.
  if (!can(user.role, "asset:edit")) redirect(ACCESSORIES_PATH);

  return (
    <AccessoryForm
      categories={await listAccessoryCategoryOptions()}
      defaultValues={{
        name: "",
        categoryId: null,
        totalQuantity: "",
        note: "",
      }}
      action={submitNewAccessory}
      submitLabel="Add accessory"
      cancelHref={ACCESSORIES_PATH}
    />
  );
}
