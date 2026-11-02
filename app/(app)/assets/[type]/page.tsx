import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AssetList, AssetListFallback } from "@/components/assets/asset-list";
import { PageHeader } from "@/components/layout/page-header";
import { assetTypeConfigs, getAssetTypeBySlug } from "@/lib/assets/asset-types";

// All valid slugs are known up front, so every type page is prerendered at build time.
export function generateStaticParams() {
  return assetTypeConfigs.map(({ slug }) => ({ type: slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/assets/[type]">): Promise<Metadata> {
  const { type } = await params;
  return { title: getAssetTypeBySlug(type)?.label };
}

export default async function AssetTypePage({
  params,
}: PageProps<"/assets/[type]">) {
  const { type } = await params;
  const config = getAssetTypeBySlug(type);
  if (!config) notFound();

  return (
    <>
      <PageHeader title={config.label} />

      <Suspense fallback={<AssetListFallback />}>
        <AssetList filter={{ type: config.type }} />
      </Suspense>
    </>
  );
}
