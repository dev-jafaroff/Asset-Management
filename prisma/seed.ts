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

const accessoryCategories = [
  "Keyboard",
  "Mouse",
  "Headset",
  "Docking station",
  "Adapter / Cable",
  "Webcam",
  "Charger",
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
  for (const name of accessoryCategories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
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
