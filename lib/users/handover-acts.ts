import { getAssetTypeConfig } from "@/lib/assets/asset-types";
import { formatModelName } from "@/lib/assets/format";
import { getUserPath, type UserDetail } from "@/lib/users/queries";

// The act signed when equipment changes hands: on joining, the person gets
// what is listed; on leaving, they hand it back. Both list what the person
// holds now, so the page is printed before the checkout or the checkin.
export const handoverActKinds = ["onboarding", "offboarding"] as const;
export type HandoverActKind = (typeof handoverActKinds)[number];

export function isHandoverActKind(value: string): value is HandoverActKind {
  return (handoverActKinds as readonly string[]).includes(value);
}

type HandoverActConfig = {
  // The switch on the page, e.g. "Onboarding".
  label: string;
  title: string;
  // Who hands the equipment over; the other side receives it.
  givenBy: "it" | "employee";
  statement: (employee: string) => string;
  // An empty column to write each item's condition in by hand.
  withCondition: boolean;
};

export const handoverActs: Record<HandoverActKind, HandoverActConfig> = {
  onboarding: {
    label: "Onboarding",
    title: "Equipment assignment act",
    givenBy: "it",
    statement: (employee) =>
      `${employee} has received the equipment listed below in working order, is responsible for its proper use and safekeeping, and returns it to IT on request or when leaving the company.`,
    withCondition: false,
  },
  offboarding: {
    label: "Offboarding",
    title: "Equipment handover act",
    givenBy: "employee",
    statement: (employee) =>
      `${employee} has handed the equipment listed below back to IT. Its condition on return is noted next to each item.`,
    withCondition: true,
  },
};

// e.g. "/users/12/acts/offboarding"
export function getHandoverActPath(
  userId: number,
  kind: HandoverActKind,
): string {
  return `${getUserPath(userId)}/acts/${kind}`;
}

// One line of the act's table.
export type HandoverItem = {
  key: string;
  // What it is, e.g. "Laptop" or "Mouse".
  item: string;
  model: string | null;
  assetTag: string | null;
  // Serial, IMEI and phone number, whichever the item has.
  identifiers: string[];
  quantity: number;
};

// Everything the person holds now: assets first, then accessories, one line
// per accessory however many handouts it came in.
export function getHandoverItems(user: UserDetail): HandoverItem[] {
  const assets = user.assignedAssets.map((asset) => ({
    key: `asset-${asset.id}`,
    item:
      asset.model?.category.name ??
      getAssetTypeConfig(asset.type).singularLabel,
    model: formatModelName(asset.model),
    assetTag: asset.assetTag,
    identifiers: [
      asset.serial && `S/N ${asset.serial}`,
      asset.imei && `IMEI ${asset.imei}`,
      asset.phoneNumber,
    ].filter((value): value is string => Boolean(value)),
    quantity: 1,
  }));

  const accessories = new Map<number, HandoverItem>();
  for (const { accessory, quantity } of user.accessories) {
    const line = accessories.get(accessory.id);
    if (line) {
      line.quantity += quantity;
    } else {
      accessories.set(accessory.id, {
        key: `accessory-${accessory.id}`,
        item: accessory.category.name,
        model: accessory.name,
        assetTag: null,
        identifiers: [],
        quantity,
      });
    }
  }

  return [...assets, ...accessories.values()];
}
