-- Add new values to existing enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'INITIATEUR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VALIDATEUR';

-- Migrate existing USER rows to INITIATEUR
UPDATE "users" SET "role" = 'INITIATEUR' WHERE "role" = 'USER';

-- Replace enum (cannot remove values directly, must recreate)
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INITIATEUR', 'VALIDATEUR');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'INITIATEUR';
DROP TYPE "UserRole_old";
