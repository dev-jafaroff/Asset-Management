/*
  Warnings:

  - Added the required column `kind` to the `SyncRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SyncKind" AS ENUM ('USERS', 'INTUNE');

-- AlterTable
ALTER TABLE "SyncRun" ADD COLUMN     "kind" "SyncKind" NOT NULL;

-- CreateIndex
CREATE INDEX "SyncRun_kind_startedAt_idx" ON "SyncRun"("kind", "startedAt");
