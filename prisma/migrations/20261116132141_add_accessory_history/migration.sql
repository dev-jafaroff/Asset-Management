-- AlterTable
ALTER TABLE "AccessoryAssignment" ADD COLUMN     "returnedById" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "icon" TEXT;

-- CreateTable
CREATE TABLE "AccessoryStockChange" (
    "id" SERIAL NOT NULL,
    "accessoryId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "fromQuantity" INTEGER,
    "toQuantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessoryStockChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessoryStockChange_accessoryId_createdAt_idx" ON "AccessoryStockChange"("accessoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccessoryAssignment" ADD CONSTRAINT "AccessoryAssignment_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryStockChange" ADD CONSTRAINT "AccessoryStockChange_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryStockChange" ADD CONSTRAINT "AccessoryStockChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Icons of the accessory categories from the base seed (see prisma/seed.ts).
UPDATE "Category" SET "icon" = 'keyboard' WHERE "name" = 'Keyboard';
UPDATE "Category" SET "icon" = 'mouse' WHERE "name" = 'Mouse';
UPDATE "Category" SET "icon" = 'headset' WHERE "name" = 'Headset';
UPDATE "Category" SET "icon" = 'dock' WHERE "name" = 'Docking station';
UPDATE "Category" SET "icon" = 'cable' WHERE "name" = 'Adapter / Cable';
UPDATE "Category" SET "icon" = 'webcam' WHERE "name" = 'Webcam';
UPDATE "Category" SET "icon" = 'charger' WHERE "name" = 'Charger';

-- Existing accessories start their stock history with their current total.
INSERT INTO "AccessoryStockChange" ("accessoryId", "toQuantity", "createdAt")
SELECT "id", "totalQuantity", "createdAt" FROM "Accessory";
