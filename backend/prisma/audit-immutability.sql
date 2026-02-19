-- Enforce immutability on audit_events table at database level.
-- Run after Prisma migrations: psql $DATABASE_URL -f prisma/audit-immutability.sql

-- Prevent UPDATE
CREATE OR REPLACE FUNCTION prevent_audit_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'UPDATE operations are not allowed on audit_events table';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit_events;
CREATE TRIGGER audit_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_update();

-- Prevent DELETE
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELETE operations are not allowed on audit_events table';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_delete ON audit_events;
CREATE TRIGGER audit_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_delete();
