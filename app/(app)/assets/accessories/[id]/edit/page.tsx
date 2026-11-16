import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { submitAccessoryEdit } from "@/app/(app)/assets/accessories/actions";
import { AccessoryForm } from "@/components/accessories/accessory-form";
import { AssetFormFallback } from "@/components/assets/asset-form";
import { PageHeader } from "@/components/layout/page-header";
import {
  ACCESSORIES_PATH,
  getAccessoryPath,
  getRouteAccessory,
  listAccessoryCategoryOptions,
} from "@/lib/accessories/queries";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";

type EditAccessoryPageProps = PageProps<"/assets/accessories/[id]/edit">;

export async function generateMetadata({
  params,
}: EditAccessoryPageProps): Promise<Metadata> {
  const accessory = await getRouteAccessory(await params);
  return { title: `Edit ${accessory.name}` };
}

// The accessory and the categories are read per request, so they stream in.
export default function EditAccessoryPage({ params }: EditAccessoryPageProps) {
  return (
    <div className="max-w-4xl">
      <Suspense fallback={<AssetFormFallback />}>
        <EditAccessoryContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditAccessoryContent({
  params,
}: Pick<EditAccessoryPageProps, "params">) {
  const accessory = await getRouteAccessory(await params);
  const accessoryPath = getAccessoryPath(accessory.id);
  const user = await getCurrentUser();
  // The "Edit" button is hidden too; this covers a typed or shared link.
  if (!can(user.role, "asset:edit")) redirect(accessoryPath);

  return (
    <>
      <PageHeader
        title={`Edit ${accessory.name}`}
        breadcrumbs={[
          { label: "Accessories", href: ACCESSORIES_PATH },
          { label: accessory.name, href: accessoryPath },
          { label: "Edit" },
        ]}
      />
      <AccessoryForm
        categories={await listAccessoryCategoryOptions()}
        defaultValues={{
          name: accessory.name,
          categoryId: accessory.category.id,
          totalQuantity: String(accessory.totalQuantity),
          note: "",
        }}
        assigned={accessory.stock.assigned}
        action={submitAccessoryEdit.bind(null, accessory.id)}
        submitLabel="Save changes"
        cancelHref={accessoryPath}
      />
    </>
  );
}
