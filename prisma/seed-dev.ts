// Sample data for local UI development. Never run against a real database.
// Requires the base seed (`npx prisma db seed`) for statuses, companies and accessory categories.
import "dotenv/config";
import { faker } from "@faker-js/faker";
import {
  formatAssetTag,
  getAssetTypeConfig,
  type AssetTypeConfig,
} from "@/lib/assets/asset-types";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;
type Named = { id: number; name: string };
type ModelRef = { id: number; manufacturer: string | null };

type Refs = {
  userIds: number[];
  companyIds: number[];
  locationIds: number[];
  statuses: Named[];
  modelsByType: Map<AssetType, ModelRef[]>;
};

// ─── Data ────────────────────────────────────────────────────────────────────

const USER_COUNT = 25;
const INACTIVE_USER_COUNT = 2;

const assetCounts: Record<AssetType, number> = {
  PC: 40,
  MONITOR: 35,
  PRINTER: 6,
  PHONE: 20,
  VM: 8,
  ACCESS_POINT: 12,
  CAMERA: 10,
  OTHER: 2,
};

const purchaseCostRanges: Partial<Record<AssetType, [number, number]>> = {
  PC: [900, 2200],
  MONITOR: [180, 650],
  PRINTER: [300, 1200],
  PHONE: [250, 1100],
  ACCESS_POINT: [120, 350],
  CAMERA: [100, 450],
  OTHER: [80, 400],
};

const departments = [
  "IT",
  "Finance",
  "HR",
  "Procurement",
  "Sales",
  "Operations",
  "Legal",
];

const locations = [
  "HQ — Floor 1",
  "HQ — Floor 2",
  "HQ — Floor 3",
  "HQ — Server room",
  "Warehouse",
];

const assetCategories = [
  "Laptop",
  "Desktop",
  "Monitor",
  "Printer",
  "Phone",
  "Access point",
  "Camera",
];

const assetModels: {
  type: AssetType;
  category: string;
  manufacturer: string;
  name: string;
}[] = [
  {
    type: "PC",
    category: "Laptop",
    manufacturer: "Dell",
    name: "Latitude 5440",
  },
  {
    type: "PC",
    category: "Laptop",
    manufacturer: "Lenovo",
    name: "ThinkPad T14 Gen 4",
  },
  {
    type: "PC",
    category: "Laptop",
    manufacturer: "HP",
    name: "EliteBook 840 G10",
  },
  {
    type: "PC",
    category: "Desktop",
    manufacturer: "Dell",
    name: "OptiPlex 7010",
  },
  {
    type: "MONITOR",
    category: "Monitor",
    manufacturer: "Dell",
    name: "P2423D",
  },
  {
    type: "MONITOR",
    category: "Monitor",
    manufacturer: "Dell",
    name: "U2724D",
  },
  { type: "MONITOR", category: "Monitor", manufacturer: "LG", name: "27UP850" },
  {
    type: "PRINTER",
    category: "Printer",
    manufacturer: "HP",
    name: "LaserJet Pro M404dn",
  },
  {
    type: "PRINTER",
    category: "Printer",
    manufacturer: "Canon",
    name: "i-SENSYS MF453dw",
  },
  {
    type: "PHONE",
    category: "Phone",
    manufacturer: "Samsung",
    name: "Galaxy A55",
  },
  {
    type: "PHONE",
    category: "Phone",
    manufacturer: "Samsung",
    name: "Galaxy S24",
  },
  {
    type: "PHONE",
    category: "Phone",
    manufacturer: "Apple",
    name: "iPhone 15",
  },
  {
    type: "ACCESS_POINT",
    category: "Access point",
    manufacturer: "Ubiquiti",
    name: "UniFi U6 Pro",
  },
  {
    type: "ACCESS_POINT",
    category: "Access point",
    manufacturer: "Ubiquiti",
    name: "UniFi U7 Lite",
  },
  {
    type: "CAMERA",
    category: "Camera",
    manufacturer: "Ubiquiti",
    name: "UniFi G5 Bullet",
  },
  {
    type: "CAMERA",
    category: "Camera",
    manufacturer: "Ubiquiti",
    name: "UniFi G5 Dome",
  },
  {
    type: "OTHER",
    category: "Card reader",
    manufacturer: "HID",
    name: "Signo 20",
  },
];

const accessories = [
  { name: "Logitech K120", category: "Keyboard", totalQuantity: 30 },
  { name: "Logitech M185", category: "Mouse", totalQuantity: 35 },
  { name: "Jabra Evolve2 40", category: "Headset", totalQuantity: 15 },
  { name: "Dell WD19S", category: "Docking station", totalQuantity: 12 },
  {
    name: "USB-C to HDMI adapter",
    category: "Adapter / Cable",
    totalQuantity: 20,
  },
  { name: "Logitech C920", category: "Webcam", totalQuantity: 10 },
  { name: "Dell 65W USB-C charger", category: "Charger", totalQuantity: 18 },
];

// "Assigned" is not a status: assigned assets keep a deployable label and set their
// holder (a user, or a location for access points and cameras).
const assetStates = [
  { weight: 55, value: { status: "In stock", assigned: true } },
  { weight: 10, value: { status: "In stock", assigned: false } },
  { weight: 15, value: { status: "In storage", assigned: false } },
  { weight: 7, value: { status: "Pending", assigned: false } },
  { weight: 7, value: { status: "In repair", assigned: false } },
  { weight: 6, value: { status: "Archived", assigned: false } },
];

// VMs belong to a company, never to a user.
const vmStates = [
  { weight: 85, value: { status: "In stock", assigned: false } },
  { weight: 15, value: { status: "Archived", assigned: false } },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function idByName(rows: Named[], name: string): number {
  const row = rows.find((r) => r.name === name);
  if (!row)
    throw new Error(`"${name}" not found. Run \`npx prisma db seed\` first.`);
  return row.id;
}

function padded(index: number, length = 4): string {
  return String(index).padStart(length, "0");
}

function serial(): string {
  return faker.string.alphanumeric({ length: 10, casing: "upper" });
}

function azerbaijanPhoneNumber(): string {
  const operator = faker.helpers.arrayElement(["50", "51", "55", "70", "77"]);
  return faker.helpers.replaceSymbols(`+994${operator}#######`);
}

// Labeled assets sit at a location. Location-only types (access points, cameras)
// count as assigned once installed, so the ones in stock get no location.
function pickLocation(
  config: AssetTypeConfig,
  assigned: boolean,
  refs: Refs,
): number | undefined {
  if (config.assignTo === "location" && !assigned) return undefined;
  return config.tagPrefix
    ? faker.helpers.arrayElement(refs.locationIds)
    : undefined;
}

// Fields that depend on the asset type.
function typeFields(
  type: AssetType,
  index: number,
  assigned: boolean,
  refs: Refs,
): Partial<Prisma.AssetUncheckedCreateInput> {
  if (type === "VM") {
    return {
      name: `${faker.helpers.arrayElement(["APP", "SQL", "FS", "WEB"])}-${padded(index, 2)}`,
      operatingSystem: faker.helpers.arrayElement([
        "Windows Server 2022",
        "Windows Server 2025",
        "Ubuntu 24.04 LTS",
      ]),
      vmHost: faker.helpers.arrayElement(["HV-HOST-01", "HV-HOST-02"]),
      vCpu: faker.helpers.arrayElement([2, 4, 8]),
      ramGb: faker.helpers.arrayElement([4, 8, 16, 32]),
    };
  }

  const model = faker.helpers.arrayElement(refs.modelsByType.get(type) ?? []);
  const [minCost, maxCost] = purchaseCostRanges[type] ?? [0, 0];
  const config = getAssetTypeConfig(type);
  const common = {
    serial: serial(),
    modelId: model.id,
    purchaseCost: faker.commerce.price({ min: minCost, max: maxCost }),
    purchaseDate: faker.date.past({ years: 4 }),
    ...(config.tagPrefix && {
      assetTag: formatAssetTag(config.tagPrefix, index),
    }),
    locationId: pickLocation(config, assigned, refs),
  };

  if (type === "PC") {
    return {
      ...common,
      name: `WS-${padded(index)}`,
      operatingSystem: "Windows 11 Enterprise",
      osVersion: `10.0.${faker.helpers.arrayElement(["22631", "26100"])}.${faker.number.int({ min: 1000, max: 5000 })}`,
      source: "INTUNE",
      intuneId: faker.string.uuid(),
      lastIntuneSync: faker.date.recent({ days: 1 }),
    };
  }

  if (type === "PHONE") {
    return {
      ...common,
      imei: faker.phone.imei(),
      phoneNumber: azerbaijanPhoneNumber(),
      operatingSystem: model.manufacturer === "Apple" ? "iOS" : "Android",
    };
  }

  return common;
}

// ─── Seed steps ──────────────────────────────────────────────────────────────

async function createUsers(tx: Tx): Promise<number[]> {
  const users = Array.from({ length: USER_COUNT }, (_, index) => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    return {
      entraObjectId: faker.string.uuid(),
      email: faker.internet
        .email({ firstName, lastName, provider: "ei-g.com" })
        .toLowerCase(),
      displayName: `${firstName} ${lastName}`,
      department: faker.helpers.arrayElement(departments),
      jobTitle: faker.person.jobTitle(),
      isActive: index >= INACTIVE_USER_COUNT,
    };
  });

  const created = await tx.user.createManyAndReturn({
    data: users,
    select: { id: true },
  });
  return created.map((user) => user.id);
}

async function createLocations(tx: Tx): Promise<number[]> {
  const created = await tx.location.createManyAndReturn({
    data: locations.map((name) => ({ name })),
    select: { id: true },
  });
  return created.map((location) => location.id);
}

async function createModels(tx: Tx): Promise<Map<AssetType, ModelRef[]>> {
  for (const name of assetCategories) {
    await tx.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  const categories = await tx.category.findMany({
    select: { id: true, name: true },
  });

  const modelsByType = new Map<AssetType, ModelRef[]>();
  for (const { type, category, manufacturer, name } of assetModels) {
    const model = await tx.assetModel.create({
      data: { name, manufacturer, categoryId: idByName(categories, category) },
      select: { id: true, manufacturer: true },
    });
    modelsByType.set(type, [...(modelsByType.get(type) ?? []), model]);
  }
  return modelsByType;
}

async function createAssets(tx: Tx, refs: Refs) {
  for (const [type, count] of Object.entries(assetCounts) as [
    AssetType,
    number,
  ][]) {
    for (let index = 1; index <= count; index++) {
      const { assignTo } = getAssetTypeConfig(type);
      const state = faker.helpers.weightedArrayElement(
        assignTo === "company" ? vmStates : assetStates,
      );
      const assignedToId =
        state.assigned && assignTo === "user"
          ? faker.helpers.arrayElement(refs.userIds)
          : undefined;

      await tx.asset.create({
        data: {
          type,
          statusId: idByName(refs.statuses, state.status),
          companyId: faker.helpers.arrayElement(refs.companyIds),
          assignedToId,
          ...typeFields(type, index, state.assigned, refs),
          events: {
            create: [
              { type: "CREATED" },
              ...(assignedToId
                ? [{ type: "CHECKOUT" as const, targetUserId: assignedToId }]
                : []),
            ],
          },
        },
      });
    }
  }
}

async function createAccessories(tx: Tx, userIds: number[]) {
  const categories = await tx.category.findMany({
    select: { id: true, name: true },
  });

  for (const { name, category, totalQuantity } of accessories) {
    const accessory = await tx.accessory.create({
      data: { name, totalQuantity, categoryId: idByName(categories, category) },
    });

    const assignmentCount = faker.number.int({ min: 0, max: 6 });
    for (let i = 0; i < assignmentCount; i++) {
      const assignedAt = faker.date.past({ years: 2 });
      await tx.accessoryAssignment.create({
        data: {
          accessoryId: accessory.id,
          userId: faker.helpers.arrayElement(userIds),
          assignedAt,
          returnedAt: faker.helpers.maybe(
            () => faker.date.between({ from: assignedAt, to: new Date() }),
            { probability: 0.2 },
          ),
        },
      });
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The dev seed must never run in production.");
  }

  if ((await prisma.asset.count()) > 0) {
    console.log("Assets already exist; dev seed skipped.");
    return;
  }

  const statuses = await prisma.statusLabel.findMany({
    select: { id: true, name: true },
  });
  const companies = await prisma.company.findMany({ select: { id: true } });
  if (statuses.length === 0 || companies.length === 0) {
    throw new Error("Base data missing. Run `npx prisma db seed` first.");
  }

  // Same seed → same data on every run, so screens look identical between resets.
  faker.seed(42);

  await prisma.$transaction(
    async (tx) => {
      const userIds = await createUsers(tx);
      const refs: Refs = {
        userIds,
        companyIds: companies.map((company) => company.id),
        locationIds: await createLocations(tx),
        statuses,
        modelsByType: await createModels(tx),
      };
      await createAssets(tx, refs);
      await createAccessories(tx, userIds);
    },
    { timeout: 60_000 },
  );

  console.log("Dev seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
