import { createSupabaseServerClient } from "@/lib/supabase";

export type MascotLoadResult = {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: string | null;
};

export async function getLogisticsLoads(): Promise<MascotLoadResult[]> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return [];
  }

  const { data: application } = await supabase
    .from("logistics_applications")
    .select("id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!application || application.status !== "approved") {
    return [];
  }

  return [];
}
