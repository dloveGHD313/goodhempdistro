import { createClient } from "@supabase/supabase-js";

const resolveSupabaseUrl = () => {
  const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    const error =
      "[supabase/admin] Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL for admin client.";
    console.error(error);
    throw new Error(error);
  }
  return url;
};

const resolveServiceKey = () => {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE?.trim();
  if (!key) {
    const error =
      "[supabase/admin] Missing service role key. Checked SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE.";
    console.error(error);
    throw new Error(error);
  }
  return key;
};

export const createSupabaseAdminClient = () => {
  return createClient(resolveSupabaseUrl(), resolveServiceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};
