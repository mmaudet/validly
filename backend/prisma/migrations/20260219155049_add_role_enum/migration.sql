-- Replace UserRole enum: USER|ADMIN → ADMIN|INITIATEUR|VALIDATEUR
-- Must recreate enum (PostgreSQL cannot use new ADD VALUE in same transaction)

-- 1. Rename old enum
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

-- 2. Create new enum with target values
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'INITIATEUR', 'VALIDATEUR');

-- 3. Drop default, cast column to new enum (USER→INITIATEUR via text mapping)
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole"
  USING (
    CASE "role"::text
      WHEN 'USER' THEN 'INITIATEUR'
      ELSE "role"::text
    END
  )::"UserRole";

-- 4. Set new default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'INITIATEUR';

-- 5. Drop old enum
DROP TYPE "UserRole_old";
