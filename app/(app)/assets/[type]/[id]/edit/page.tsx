import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AssetForm, AssetFormFallback } from "@/components/assets/asset-form";
import { PageHeader } from "@/components/layout/page-header";
import { getRouteAsset } from "@/lib/assets/asset-detail";
import { toAssetFormValues } from "@/lib/assets/asset-form";
import { getAssetFormOptions } from "@/lib/assets/asset-form-options";
import {
  ASSETS_PATH,
  getAssetPath,
  getAssetTypeConfig,
  getAssetTypePath,
  getEditAssetPath,
} from "@/lib/assets/asset-types";
import { getAssetDisplayName } from "@/lib/assets/format";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { updateAsset } from "../actions";

type EditAssetPageProps = PageProps<"/assets/[type]/[id]/edit">;

export async function generateMetadata({
  params,
}: EditAssetPageProps): Promise<Metadata> {
  const asset = await getRouteAsset(await params, getEditAssetPath);
  return { title: `Edit ${getAssetDisplayName(asset)}` };
}

// The asset and the lists are read per request, so they stream in.
export default function EditAssetPage({ params }: EditAssetPageProps) {
  return (
    <div className="max-w-4xl">
      <Suspense fallback={<AssetFormFallback />}>
        <EditAssetContent params={params} />
      </Suspense>
    </div>
  );
}

async function EditAssetContent({
  params,
}: Pick<EditAssetPageProps, "params">) {
  const asset = await getRouteAsset(await params, getEditAssetPath);
  const assetPath = getAssetPath(asset.type, asset.id);
  const user = await getCurrentUser();
  // The "Edit" button is hidden too; this covers a typed or shared link.
  if (!can(user.role, "asset:edit")) redirect(assetPath);

  const config = getAssetTypeConfig(asset.type);
  const title = getAssetDisplayName(asset);
  const options = await getAssetFormOptions();

  return (
    <>
      <PageHeader
        title={`Edit ${title}`}
        breadcrumbs={[
          { label: "Assets", href: ASSETS_PATH },
          { label: config.label, href: getAssetTypePath(config.slug) },
          { label: title, href: assetPath },
          { label: "Edit" },
        ]}
      />
      <AssetForm
        type={asset.type}
        mode="edit"
        source={asset.source}
        options={options}
        defaultValues={toAssetFormValues(asset)}
        action={updateAsset.bind(null, asset.id)}
        submitLabel="Save changes"
        cancelHref={assetPath}
      />
    </>
  );
}
