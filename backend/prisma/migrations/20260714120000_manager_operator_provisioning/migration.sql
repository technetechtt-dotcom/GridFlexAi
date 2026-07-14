-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managedById" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_managedById_idx" ON "User"("managedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_managedById_fkey" FOREIGN KEY ("managedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ManagerOperatorProvisioning" (
    "managerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxOperators" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ManagerOperatorProvisioning_pkey" PRIMARY KEY ("managerId")
);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ManagerOperatorProvisioning" ADD CONSTRAINT "ManagerOperatorProvisioning_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
