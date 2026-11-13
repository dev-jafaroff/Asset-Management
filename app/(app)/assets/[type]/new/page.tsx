import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AssetForm, AssetFormFallback } from "@/components/assets/asset-form";
import { PageHeader } from "@/components/layout/page-header";
import { getNewAssetFormValues } from "@/lib/assets/asset-form";
import { getAssetFormOptions } from "@/lib/assets/asset-form-options";
import { getNextAssetTag } from "@/lib/assets/asset-tags";
import {
  ASSETS_PATH,
  getAssetNoun,
  getAssetTypeBySlug,
  getAssetTypePath,
} from "@/lib/assets/asset-types";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { createAsset } from "./actions";

type NewAssetPageProps = PageProps<"/assets/[type]/new">;

export async function generateMetadata({
  params,
}: NewAssetPageProps): Promise<Metadata> {
  const { type } = await params;
  const config = getAssetTypeBySlug(type);
  return { title: config && `New ${getAssetNoun(config)}` };
}

// The lists and the next tag are read per request, so they stream in.
export default function NewAssetPage({ params }: NewAssetPageProps) {
  return (
    <div className="max-w-4xl">
      <Suspense fallback={<AssetFormFallback />}>
        <NewAssetContent params={params} />
      </Suspense>
    </div>
  );
}

async function NewAssetContent({ params }: Pick<NewAssetPageProps, "params">) {
  const { type } = await params;
  const config = getAssetTypeBySlug(type);
  if (!config) notFound();

  const listPath = getAssetTypePath(config.slug);
  const user = await getCurrentUser();
  // The "New" button is hidden too; this covers a typed or shared link.
  if (!can(user.role, "asset:edit")) redirect(listPath);

  const [options, nextTag] = await Promise.all([
    getAssetFormOptions(),
    config.tagPrefix ? getNextAssetTag(config.tagPrefix) : "",
  ]);

  return (
    <>
      <PageHeader
        title={`New ${getAssetNoun(config)}`}
        breadcrumbs={[
          { label: "Assets", href: ASSETS_PATH },
          { label: config.label, href: listPath },
          { label: "New" },
        ]}
      />
      <AssetForm
        type={config.type}
        mode="create"
        source="MANUAL"
        options={options}
        defaultValues={getNewAssetFormValues(config.type, {
          assetTag: nextTag,
          statusId: options.defaultStatusId,
        })}
        action={createAsset.bind(null, config.type)}
        submitLabel={`Add ${getAssetNoun(config)}`}
        cancelHref={listPath}
      />
    </>
  );
}
