import "dotenv/config";
import type { StatusType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const statuses: { name: string; type: StatusType; color: string }[] = [
  { name: "In stock", type: "DEPLOYABLE", color: "#107C10" },
  { name: "In storage", type: "DEPLOYABLE", color: "#038387" },
  { name: "Pending", type: "PENDING", color: "#CA5010" },
  { name: "In repair", type: "UNDEPLOYABLE", color: "#D13438" },
  { name: "Archived", type: "ARCHIVED", color: "#616161" },
];

const companies = ["DRL", "eiLink", "EIG", "Waverity"];

// Icons are keys of components/assets/asset-icons.tsx.
const accessoryCategories = [
  { name: "Keyboard", icon: "keyboard" },
  { name: "Mouse", icon: "mouse" },
  { name: "Headset", icon: "headset" },
  { name: "Docking station", icon: "dock" },
  { name: "Adapter / Cable", icon: "cable" },
  { name: "Webcam", icon: "webcam" },
  { name: "Charger", icon: "charger" },
];

async function seedStatuses() {
  for (const status of statuses) {
    await prisma.statusLabel.upsert({
      where: { name: status.name },
      update: {},
      create: status,
    });
  }
}

async function seedCompanies() {
  for (const name of companies) {
    await prisma.company.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function seedCategories() {
  for (const category of accessoryCategories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
}

async function main() {
  await seedStatuses();
  await seedCompanies();
  await seedCategories();
  console.log("Seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
