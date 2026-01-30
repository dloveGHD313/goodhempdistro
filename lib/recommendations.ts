import { createSupabaseServerClient, hasSupabase } from "@/lib/supabase";
import { getUserVerificationStatus } from "@/lib/server/idVerification";

export type ViewerProfile = {
  state: string | null;
  city: string | null;
  interests: string[] | null;
  experience_level: "new" | "experienced" | null;
  purchase_intent: string[] | null;
};

export type DiscoveryVendor = {
  id: string;
  business_name: string;
  description: string | null;
  state: string | null;
  city: string | null;
  vendor_type: string | null;
  categories: string[] | null;
  tags: string[] | null;
};

export type DiscoveryProduct = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  vendor_id: string | null;
};

export type DiscoveryService = {
  id: string;
  title: string;
  description: string | null;
  pricing_type: string | null;
  price_cents: number | null;
  vendor_id: string | null;
};

export type DiscoveryEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  vendor_id: string;
};

export type EducationResource = {
  id: string;
  title: string;
  summary: string | null;
  state: string | null;
  url: string | null;
  experience_level: "new" | "experienced" | "all" | null;
};

export type DiscoveryResults = {
  isAuthenticated: boolean;
  viewerProfile: ViewerProfile | null;
  vendors: DiscoveryVendor[];
  products: DiscoveryProduct[];
  services: DiscoveryService[];
  events: DiscoveryEvent[];
  education: EducationResource[];
  error?: string;
};

const SCORE = {
  sameState: 50,
  sameCity: 30,
  interestMatch: 15,
  intentMatch: 10,
};

function normalizeText(value: string | null | undefined) {
  return value ? value.trim().toLowerCase() : "";
}

function scoreVendor(vendor: DiscoveryVendor, viewer: ViewerProfile | null): number {
  if (!viewer) return 0;
  let score = 0;

  const viewerState = normalizeText(viewer.state);
  const viewerCity = normalizeText(viewer.city);
  const vendorState = normalizeText(vendor.state);
  const vendorCity = normalizeText(vendor.city);

  if (viewerState && vendorState && viewerState === vendorState) {
    score += SCORE.sameState;
  }
  if (viewerCity && vendorCity && viewerCity === vendorCity) {
    score += SCORE.sameCity;
  }

  const interestMatches = (viewer.interests || [])
    .map(normalizeText)
    .filter((interest) =>
      (vendor.categories || []).map(normalizeText).includes(interest)
    );

  if (interestMatches.length > 0) {
    score += SCORE.interestMatch;
  }

  const purchaseIntents = (viewer.purchase_intent || []).map(normalizeText);
  const vendorType = normalizeText(vendor.vendor_type);
  if (
    purchaseIntents.includes("bulk") &&
    ["wholesaler", "hotel_b2b_supplier", "b2b"].includes(vendorType)
  ) {
    score += SCORE.intentMatch;
  }

  if (
    purchaseIntents.includes("recurring") &&
    ["retailer", "service_provider"].includes(vendorType)
  ) {
    score += SCORE.intentMatch;
  }

  if (
    purchaseIntents.includes("one-time") &&
    ["retailer", "farmer"].includes(vendorType)
  ) {
    score += SCORE.intentMatch;
  }

  if (
    (viewer.interests || []).includes("services") &&
    vendorType === "service_provider"
  ) {
    score += SCORE.interestMatch;
  }

  return score;
}

function rankByScore<T>(items: T[], scorer: (item: T) => number): T[] {
  return [...items].sort((a, b) => scorer(b) - scorer(a));
}

function scoreEducation(resource: EducationResource, viewer: ViewerProfile | null): number {
  let score = 0;
  if (!viewer) return score;

  const viewerState = normalizeText(viewer.state);
  const resourceState = normalizeText(resource.state);
  if (viewerState && resourceState && viewerState === resourceState) {
    score += 25;
  }

  if (viewer.experience_level) {
    if (resource.experience_level === viewer.experience_level) {
      score += 15;
    } else if (resource.experience_level === "all") {
      score += 8;
    }
  }

  return score;
}

async function fetchVendors(viewer: ViewerProfile | null, limit: number) {
  const supabase = await createSupabaseServerClient();
  const baseQuery = supabase
    .from("vendors")
    .select("id, business_name, description, state, city, vendor_type, categories, tags, status, is_active, is_approved");

  if (viewer?.state) {
    baseQuery.eq("state", viewer.state);
  }

  const { data: primaryVendors, error } = await baseQuery
    .eq("is_active", true)
    .or("is_approved.eq.true,status.eq.active")
    .limit(limit * 2);

  if (error) {
    console.error("[recommendations] vendor query failed:", error.message);
    return [];
  }

  return (primaryVendors || []) as DiscoveryVendor[];
}

async function fetchFallbackVendors(limit: number, excludeIds: string[]) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("vendors")
    .select("id, business_name, description, state, city, vendor_type, categories, tags, status, is_active, is_approved")
    .eq("is_active", true)
    .or("is_approved.eq.true,status.eq.active")
    .limit(limit * 2);

  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[recommendations] fallback vendor query failed:", error.message);
    return [];
  }
  return (data || []) as DiscoveryVendor[];
}

async function fetchProducts(vendorIds: string[], limit: number, includeGated: boolean) {
  if (vendorIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("products")
    .select("id, name, description, price_cents, vendor_id")
    .eq("status", "approved")
    .eq("active", true)
    .in("vendor_id", vendorIds)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (!includeGated) {
    query = query.eq("is_gated", false);
  }
  const { data, error } = await query;

  if (error) {
    console.error("[recommendations] products query failed:", error.message);
    return [];
  }
  return (data || []) as DiscoveryProduct[];
}

async function fetchServices(vendorIds: string[], limit: number) {
  if (vendorIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, title, description, pricing_type, price_cents, vendor_id")
    .eq("status", "approved")
    .eq("active", true)
    .in("vendor_id", vendorIds)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[recommendations] services query failed:", error.message);
    return [];
  }
  return (data || []) as DiscoveryService[];
}

async function fetchEvents(vendorIds: string[], limit: number) {
  if (vendorIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, location, start_time, end_time, vendor_id")
    .eq("status", "published")
    .in("vendor_id", vendorIds)
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[recommendations] events query failed:", error.message);
    return [];
  }
  return (data || []) as DiscoveryEvent[];
}

async function fetchEducation(viewer: ViewerProfile | null, limit: number) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("education_resources")
    .select("id, title, summary, state, url, experience_level")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (viewer?.state) {
    query = query.or(`state.eq.${viewer.state},state.is.null`);
  } else {
    query = query.is("state", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[recommendations] education query failed:", error.message);
    return [];
  }

  const resources = (data || []) as EducationResource[];
  return viewer ? rankByScore(resources, (item) => scoreEducation(item, viewer)) : resources;
}

export async function getDiscoveryRecommendations(limit = 6): Promise<DiscoveryResults> {
  if (!hasSupabase()) {
    return {
      isAuthenticated: false,
      viewerProfile: null,
      vendors: [],
      products: [],
      services: [],
      events: [],
      education: [],
      error: "Supabase is not configured yet.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let viewerProfile: ViewerProfile | null = null;
  let includeGated = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("state, city, interests, experience_level, purchase_intent")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      viewerProfile = {
        state: profile.state ?? null,
        city: profile.city ?? null,
        interests: profile.interests ?? null,
        experience_level: profile.experience_level ?? null,
        purchase_intent: profile.purchase_intent ?? null,
      };
    }
    const verification = await getUserVerificationStatus(user.id);
    includeGated = verification.status === "approved";
  }

  const primaryVendors = await fetchVendors(viewerProfile, limit);
  const rankedPrimary = rankByScore(primaryVendors, (vendor) =>
    scoreVendor(vendor, viewerProfile)
  );

  const vendorIds = rankedPrimary.map((vendor) => vendor.id);
  let combinedVendors = rankedPrimary;

  if (combinedVendors.length < limit) {
    const fallback = await fetchFallbackVendors(limit, vendorIds);
    const rankedFallback = rankByScore(fallback, (vendor) =>
      scoreVendor(vendor, viewerProfile)
    );
    combinedVendors = [...combinedVendors, ...rankedFallback].slice(0, limit);
  }

  const approvedVendorIds = combinedVendors.map((vendor) => vendor.id);

  const [products, services, events, education] = await Promise.all([
    fetchProducts(approvedVendorIds, limit, includeGated),
    fetchServices(approvedVendorIds, limit),
    fetchEvents(approvedVendorIds, limit),
    fetchEducation(viewerProfile, limit),
  ]);

  return {
    isAuthenticated: !!user,
    viewerProfile,
    vendors: combinedVendors,
    products,
    services,
    events,
    education,
  };
}
