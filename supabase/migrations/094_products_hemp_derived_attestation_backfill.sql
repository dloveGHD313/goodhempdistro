-- Backfill existing products so they remain editable (Phase 2: hemp-only platform).
-- New inserts still use DEFAULT false so vendors must explicitly attest on create.
UPDATE products SET hemp_derived_attestation = true;
