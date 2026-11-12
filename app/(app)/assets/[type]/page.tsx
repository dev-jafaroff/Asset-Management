import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AssetList, AssetListFallback } from "@/components/assets/asset-list";
import { PageHeader } from "@/components/layout/page-header";
import { RequirePermission } from "@/components/shared/require-permission";
import { Button } from "@/components/ui/button";
import {
  assetTypeConfigs,
  getAssetNoun,
  getAssetTypeBySlug,
  getAssetTypePath,
  getNewAssetPath,
} from "@/lib/assets/asset-types";

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
  searchParams,
}: PageProps<"/assets/[type]">) {
  const { type } = await params;
  const config = getAssetTypeBySlug(type);
  if (!config) notFound();

  return (
    <>
      <PageHeader
        title={config.label}
        actions={
          <RequirePermission permission="asset:edit">
            <Button
              nativeButton={false}
              render={<Link href={getNewAssetPath(config.slug)} />}
            >
              <Plus aria-hidden />
              New {getAssetNoun(config)}
            </Button>
          </RequirePermission>
        }
      />

      <Suspense fallback={<AssetListFallback />}>
        <AssetList
          type={config.type}
          basePath={getAssetTypePath(config.slug)}
          searchParams={searchParams}
        />
      </Suspense>
    </>
  );
}
