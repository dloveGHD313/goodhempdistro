# Supabase Seed Script Documentation

## Overview

The `seed-supabase.ts` script syncs local seed data to your production Supabase instance. This is useful for initializing tables with default data after deployment.

## Prerequisites

1. **Environment Variables** in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

2. **Supabase Tables** (create these in Supabase Dashboard → SQL Editor):

### Required Table Schemas

#### 1. Navigation Table
```sql
CREATE TABLE IF NOT EXISTS navigation (
  id BIGINT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 2. Site Config Table
```sql
CREATE TABLE IF NOT EXISTS site_config (
  id BIGINT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Design Settings Table
```sql
CREATE TABLE IF NOT EXISTS design_settings (
  id BIGINT PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Products Table (Optional)
```sql
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  category TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Installation

```bash
# Install dependencies
npm install

# This installs tsx (TypeScript executor) and dotenv
```

## Usage

### Run the Seed Script

```bash
npm run seed:supabase
```

### Expected Output

```
🌱 Starting Supabase seed process...

📍 Target: https://xxxxx.supabase.co

📌 Seeding navigation links...
   ✅ Upserted 4 navigation links
⚙️  Seeding site configuration...
   ✅ Upserted 4 config entries
🎨 Seeding design settings...
   ✅ Upserted 2 design settings
📦 Seeding product data...
   ✅ Upserted 3 products

============================================================
📊 SEED SUMMARY
============================================================

✅ Successful: 4
   - navigation: 4 records
   - site_config: 4 records
   - design_settings: 2 records
   - products: 3 records

============================================================

✅ Seed completed successfully!
```

## Features

### ✅ Safe Table Checking
The script checks if each table exists before attempting to insert data. If a table doesn't exist, it logs a warning and continues.

```
⚠️  Skipped (table not found): 1
   - products
```

### ✅ Upsert Logic
Uses PostgreSQL's `UPSERT` (INSERT ... ON CONFLICT DO UPDATE) to:
- Insert new records
- Update existing records (based on `id` or other unique constraint)

### ✅ Error Handling
- Validates environment variables before connecting
- Catches and logs errors per table
- Exits with appropriate status codes

### ✅ Customizable Seed Data
Edit the seed data arrays in `scripts/seed-supabase.ts`:

```typescript
const navigationLinks = [
  { id: 1, label: "Products", href: "/products", order: 1, visible: true },
  // Add more...
];

const productSeeds = [
  {
    id: 1,
    name: "Premium CBD Oil",
    description: "Full-spectrum CBD oil",
    price_cents: 4999,
    // ...
  },
];
```

## Troubleshooting

### Error: "Missing required environment variables"

**Solution:** Ensure `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Error: "relation 'navigation' does not exist"

**Solution:** Create the table in Supabase:
1. Go to Supabase Dashboard → SQL Editor
2. Run the SQL schema from the "Required Table Schemas" section above
3. Re-run the seed script

### Error: "duplicate key value violates unique constraint"

**Solution:** This is expected if data already exists. The script uses `UPSERT`, so it will update existing records. If you see this error, the script is working correctly.

### Warning: "Table does not exist (skipping)"

**Solution:** This is a safe warning. The script skips tables that don't exist. Create the table if you need it, or ignore the warning.

## When to Run This Script

- **After initial Vercel deployment** – Populate default navigation, site config, etc.
- **After schema changes** – Sync updated seed data
- **During development** – Reset tables to known state
- **Before demos** – Ensure consistent data

## Security Notes

⚠️ **IMPORTANT:**
- The script uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses Row Level Security (RLS)
- Never expose this key in client-side code
- Only run this script locally or in trusted CI/CD environments
- The service role key is only in `.env.local` (not committed to Git)

## Customization

### Add More Tables

1. Define seed data:
```typescript
const myTableData = [
  { id: 1, name: "Example", value: 123 },
];
```

2. Add upsert call in `seedSupabase()`:
```typescript
console.log("📝 Seeding my_table...");
const result = await upsertData("my_table", myTableData);
results.push({ table: "my_table", ...result });
```

### Change Conflict Resolution

By default, upsert uses `id` as the conflict column. To use a different column:

```typescript
await upsertData("my_table", data, "email"); // conflict on email instead of id
```

## Example Workflow

```bash
# 1. Create tables in Supabase (run SQL schemas)
# 2. Update seed data in scripts/seed-supabase.ts
# 3. Run seed script
npm run seed:supabase

# 4. Verify in Supabase Dashboard → Table Editor
```

---

**Script Location:** `scripts/seed-supabase.ts`  
**Package Script:** `npm run seed:supabase`  
**Documentation:** This file (SEED_SCRIPT_README.md)
