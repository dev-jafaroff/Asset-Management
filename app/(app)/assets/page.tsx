import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetList, AssetListFallback } from "@/components/assets/asset-list";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "All assets",
};

export default function AllAssetsPage({ searchParams }: PageProps<"/assets">) {
  return (
    <>
      <PageHeader
        title="All assets"
        description="Every asset across all types."
      />

      <Suspense fallback={<AssetListFallback />}>
        <AssetList basePath="/assets" searchParams={searchParams} />
      </Suspense>
    </>
  );
}
