-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('PC', 'MONITOR', 'PRINTER', 'PHONE', 'VM');

-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('MANUAL', 'INTUNE', 'SNIPEIT');

-- CreateEnum
CREATE TYPE "StatusType" AS ENUM ('DEPLOYABLE', 'PENDING', 'UNDEPLOYABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "AssetEventType" AS ENUM ('CREATED', 'UPDATED', 'CHECKOUT', 'CHECKIN', 'SYNC', 'IMPORTED');

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusLabel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StatusType" NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "entraObjectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "department" TEXT,
    "jobTitle" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "type" "AssetType" NOT NULL,
    "assetTag" TEXT,
    "serial" TEXT,
    "name" TEXT,
    "notes" TEXT,
    "imei" TEXT,
    "phoneNumber" TEXT,
    "operatingSystem" TEXT,
    "osVersion" TEXT,
    "vmHost" TEXT,
    "vCpu" INTEGER,
    "ramGb" INTEGER,
    "purchaseCost" DECIMAL(10,2),
    "purchaseDate" DATE,
    "source" "AssetSource" NOT NULL DEFAULT 'MANUAL',
    "intuneId" TEXT,
    "lastIntuneSync" TIMESTAMP(3),
    "missingInIntune" BOOLEAN NOT NULL DEFAULT false,
    "legacySnipeId" INTEGER,
    "statusId" INTEGER NOT NULL,
    "modelId" INTEGER,
    "companyId" INTEGER,
    "locationId" INTEGER,
    "assignedToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "type" "AssetEventType" NOT NULL,
    "actorId" INTEGER,
    "targetUserId" INTEGER,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessoryAssignment" (
    "id" SERIAL NOT NULL,
    "accessoryId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "assignedById" INTEGER,

    CONSTRAINT "AccessoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "missing" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_manufacturer_name_key" ON "AssetModel"("manufacturer", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StatusLabel_name_key" ON "StatusLabel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraObjectId_key" ON "User"("entraObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_assetTag_key" ON "Asset"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serial_key" ON "Asset"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_imei_key" ON "Asset"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_intuneId_key" ON "Asset"("intuneId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_legacySnipeId_key" ON "Asset"("legacySnipeId");

-- CreateIndex
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex
CREATE INDEX "Asset_statusId_idx" ON "Asset"("statusId");

-- CreateIndex
CREATE INDEX "Asset_assignedToId_idx" ON "Asset"("assignedToId");

-- CreateIndex
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");

-- CreateIndex
CREATE INDEX "AssetEvent_assetId_createdAt_idx" ON "AssetEvent"("assetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Accessory_name_key" ON "Accessory"("name");

-- CreateIndex
CREATE INDEX "AccessoryAssignment_userId_idx" ON "AccessoryAssignment"("userId");

-- CreateIndex
CREATE INDEX "AccessoryAssignment_accessoryId_returnedAt_idx" ON "AccessoryAssignment"("accessoryId", "returnedAt");

-- AddForeignKey
ALTER TABLE "AssetModel" ADD CONSTRAINT "AssetModel_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "StatusLabel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AssetModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryAssignment" ADD CONSTRAINT "AccessoryAssignment_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryAssignment" ADD CONSTRAINT "AccessoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessoryAssignment" ADD CONSTRAINT "AccessoryAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
