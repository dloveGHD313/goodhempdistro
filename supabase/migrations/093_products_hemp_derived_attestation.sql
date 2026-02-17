-- Add hemp_derived_attestation to products (required for all listings).
ALTER TABLE products ADD COLUMN IF NOT EXISTS hemp_derived_attestation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN products.hemp_derived_attestation IS 'Vendor attestation that the product is hemp-derived; required for all products.';
