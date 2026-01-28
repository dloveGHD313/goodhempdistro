import { createSupabaseServerClient } from "@/lib/supabase";

type EventSearchFilters = {
  limit?: number;
};

export type MascotEventResult = {
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
};

export async function searchEvents(
  query: string,
  filters: EventSearchFilters = {}
): Promise<MascotEventResult[]> {
  const supabase = await createSupabaseServerClient();
  const limit = Math.min(filters.limit || 6, 12);

  let eventQuery = supabase
    .from("events")
    .select("id, title, location, start_time, status")
    .in("status", ["approved", "published"])
    .order("start_time", { ascending: true })
    .limit(limit);

  if (query) {
    eventQuery = eventQuery.ilike("title", `%${query}%`);
  }

  const { data, error } = await eventQuery;
  if (error || !data) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[mascot] searchEvents error", error);
    }
    return [];
  }

  return data.map((event) => {
    const dateLabel = event.start_time
      ? new Date(event.start_time).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "Date TBD";
    return {
      title: event.title,
      subtitle: event.location || "Location TBD",
      href: `/events/${event.id}`,
      meta: dateLabel,
    };
  });
}
