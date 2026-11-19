import { z } from "zod";
import { StatusType } from "@/lib/generated/prisma/enums";
import { requiredChoice } from "@/lib/schemas/asset";

// The tabs of the lookup tables page, each one table, in the page's order.
export const lookupSlugs = [
  "statuses",
  "models",
  "categories",
  "companies",
  "locations",
] as const;

export type LookupSlug = (typeof lookupSlugs)[number];

export const lookupSlugSchema = z.enum(lookupSlugs);
// An existing row.
export const lookupRowIdSchema = z.number().int().positive();
// Null when the dialog adds a new row.
export const lookupIdSchema = lookupRowIdSchema.nullable();

export const LOOKUP_NAME_MAX_LENGTH = 100;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(
    LOOKUP_NAME_MAX_LENGTH,
    `Use at most ${LOOKUP_NAME_MAX_LENGTH} characters.`,
  );

// The icons a category can have, in groups for the picker. The keys are
// stored in Category.icon and drawn by components/assets/asset-icons.tsx.
export const categoryIconOptions = [
  { value: "laptop", label: "Laptop", group: "Computers" },
  { value: "desktop", label: "Desktop", group: "Computers" },
  { value: "monitor", label: "Monitor", group: "Computers" },
  { value: "tablet", label: "Tablet", group: "Computers" },
  { value: "phone", label: "Mobile phone", group: "Computers" },
  { value: "server", label: "Server", group: "Computers" },
  { value: "hard-drive", label: "Hard drive", group: "Computers" },
  { value: "chip", label: "Component", group: "Computers" },
  { value: "keyboard", label: "Keyboard", group: "Peripherals" },
  { value: "mouse", label: "Mouse", group: "Peripherals" },
  { value: "headset", label: "Headset", group: "Peripherals" },
  { value: "headphones", label: "Headphones", group: "Peripherals" },
  { value: "webcam", label: "Webcam", group: "Peripherals" },
  { value: "dock", label: "Docking station", group: "Peripherals" },
  { value: "printer", label: "Printer", group: "Peripherals" },
  { value: "scanner", label: "Scanner", group: "Peripherals" },
  { value: "barcode-scanner", label: "Barcode scanner", group: "Peripherals" },
  { value: "shredder", label: "Shredder", group: "Peripherals" },
  { value: "calculator", label: "Calculator", group: "Peripherals" },
  { value: "access-point", label: "Access point", group: "Network" },
  { value: "router", label: "Router", group: "Network" },
  { value: "switch", label: "Network switch", group: "Network" },
  { value: "ethernet", label: "Network port", group: "Network" },
  { value: "antenna", label: "Antenna", group: "Network" },
  { value: "camera", label: "Security camera", group: "Audio and video" },
  { value: "video-camera", label: "Video camera", group: "Audio and video" },
  { value: "projector", label: "Projector", group: "Audio and video" },
  { value: "tv", label: "TV / screen", group: "Audio and video" },
  { value: "speaker", label: "Speaker", group: "Audio and video" },
  { value: "microphone", label: "Microphone", group: "Audio and video" },
  { value: "conference", label: "Conference room", group: "Audio and video" },
  { value: "card-reader", label: "Card reader", group: "Access and security" },
  {
    value: "payment-card",
    label: "Payment card",
    group: "Access and security",
  },
  {
    value: "fingerprint",
    label: "Fingerprint reader",
    group: "Access and security",
  },
  { value: "lock", label: "Lock", group: "Access and security" },
  { value: "key", label: "Key", group: "Access and security" },
  { value: "door", label: "Door", group: "Access and security" },
  { value: "qr-code", label: "QR code", group: "Access and security" },
  { value: "charger", label: "Charger", group: "Power and cables" },
  { value: "cable", label: "Cable", group: "Power and cables" },
  { value: "plug", label: "Plug", group: "Power and cables" },
  { value: "battery", label: "Battery", group: "Power and cables" },
  { value: "ups", label: "UPS", group: "Power and cables" },
  { value: "usb", label: "USB", group: "Power and cables" },
  { value: "memory-stick", label: "USB stick", group: "Power and cables" },
  { value: "desk-phone", label: "Desk phone", group: "Other" },
  { value: "watch", label: "Watch", group: "Other" },
  { value: "gamepad", label: "Gamepad", group: "Other" },
  { value: "thermometer", label: "Sensor", group: "Other" },
  { value: "lightbulb", label: "Light", group: "Other" },
  { value: "tools", label: "Tools", group: "Other" },
  { value: "toolbox", label: "Toolbox", group: "Other" },
  { value: "package", label: "Box", group: "Other" },
  { value: "other", label: "Other device", group: "Other" },
] as const;

export type CategoryIconKey = (typeof categoryIconOptions)[number]["value"];

const categoryIconKeys: readonly string[] = categoryIconOptions.map(
  (option) => option.value,
);

// What an icon shows, e.g. "Card reader", for its hover label.
export function getCategoryIconLabel(key: string | null): string | undefined {
  return categoryIconOptions.find((option) => option.value === key)?.label;
}

// Quick picks for a status color; any other color can be chosen too.
export const statusColorOptions = [
  { value: "#107C10", label: "Green" },
  { value: "#038387", label: "Teal" },
  { value: "#0F6CBD", label: "Blue" },
  { value: "#8764B8", label: "Purple" },
  { value: "#CA5010", label: "Orange" },
  { value: "#D13438", label: "Red" },
  { value: "#616161", label: "Gray" },
] as const;

// The values of every lookup dialog, as its fields hold them: text, a chosen
// id, a chosen key, or null for "none".
export type LookupValues = Record<string, string | number | null>;

// One field of a lookup dialog. The page describes the fields of each tab,
// and one dialog draws them all.
type LookupFieldBase = {
  name: string;
  label: string;
  // Shown under the field while there is no error.
  description?: string;
};

export type LookupField = LookupFieldBase &
  (
    | { kind: "text"; placeholder?: string; optional?: boolean }
    // A row of another table, e.g. a model's category.
    | {
        kind: "choice";
        choices: { value: number; label: string }[];
        placeholder: string;
      }
    // A few fixed keys side by side, e.g. a status type.
    | {
        kind: "segmented";
        options: readonly { value: string; label: string }[];
      }
    // A grid of icons in groups, with "No icon" first, e.g. a category's icon.
    | {
        kind: "icons";
        options: readonly { value: string; label: string; group: string }[];
      }
    // Swatches to pick from, and any other color from the color picker.
    | {
        kind: "color";
        colors: readonly { value: string; label: string }[];
      }
  );

// What a field holds before anything is typed or chosen: a new status
// starts with the first color.
export function getEmptyLookupValues(fields: LookupField[]): LookupValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.kind === "text"
        ? ""
        : field.kind === "color"
          ? field.colors[0].value
          : null,
    ]),
  );
}

export const categorySchema = z.object({
  name: nameSchema,
  icon: z
    .string()
    .nullable()
    .refine(
      (icon) => icon === null || categoryIconKeys.includes(icon),
      "Choose an icon from the list.",
    ),
});

export const modelSchema = z.object({
  name: nameSchema,
  manufacturer: z
    .string()
    .trim()
    .max(
      LOOKUP_NAME_MAX_LENGTH,
      `Use at most ${LOOKUP_NAME_MAX_LENGTH} characters.`,
    )
    .transform((text) => text || null),
  categoryId: requiredChoice("Choose a category."),
});

// Companies and locations only have a name.
export const namedLookupSchema = z.object({ name: nameSchema });

export const statusSchema = z.object({
  name: nameSchema,
  type: z.enum(StatusType, "Choose a type."),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Use a color code like #2563eb."),
});
