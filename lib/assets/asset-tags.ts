import { formatAssetTag } from "@/lib/assets/asset-types";
import { prisma } from "@/lib/prisma";

// The tag after the highest one in use, e.g. "PC-00042" after "PC-00041".
// Tags not in the usual form (e.g. "PC-OLD") are skipped. The tag is only a
// suggestion: two people may get the same one, and the second save is then
// refused by the unique tag (see createAsset).
export async function getNextAssetTag(tagPrefix: string): Promise<string> {
  const assets = await prisma.asset.findMany({
    where: { assetTag: { startsWith: tagPrefix } },
    select: { assetTag: true },
  });

  const highest = Math.max(
    0,
    ...assets.map(({ assetTag }) => {
      const sequence = assetTag?.slice(tagPrefix.length) ?? "";
      return /^\d+$/.test(sequence) ? Number(sequence) : 0;
    }),
  );
  return formatAssetTag(tagPrefix, highest + 1);
}
