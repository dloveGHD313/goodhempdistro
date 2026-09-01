/**
 * Curated category showcase — the public "what you'll find here / what you can
 * list" directory shown at /categories and in empty-catalog states.
 *
 * Slugs must exist in the production `categories` table; the /categories page
 * cross-checks against the live table server-side and silently drops any slug
 * that no longer resolves (fail-soft), so a taxonomy edit never breaks the page.
 *
 * Curation rules (CEO brand direction):
 * - Hemp-based products and hemp-industry services only.
 * - No smokable/vape/inhalable categories — the platform is not a smoke shop.
 * - Groups ordered to lead with the industrial-hemp strategic focus.
 */

export type ShowcaseCategory = {
  slug: string;
  /** Display label (may differ from the raw DB name for polish). */
  label: string;
};

export type ShowcaseGroup = {
  key: string;
  title: string;
  icon: string;
  blurb: string;
  categories: ShowcaseCategory[];
};

export const CATEGORY_SHOWCASE: ShowcaseGroup[] = [
  {
    key: "building",
    title: "Building & Construction",
    icon: "🏗️",
    blurb: "Hempcrete, insulation, and panels for the next generation of healthy buildings.",
    categories: [
      { slug: "hempcrete-building-materials", label: "Hempcrete & Building Materials" },
      { slug: "insulation-hemp-", label: "Hemp Insulation" },
      { slug: "fiberboard-panels", label: "Fiberboard & Panels" },
      { slug: "construction-renovation", label: "Hempcrete Construction & Renovation" },
      { slug: "industrial-hemp-materials", label: "Industrial Hemp Materials" },
    ],
  },
  {
    key: "fiber",
    title: "Fiber, Rope & Raw Materials",
    icon: "🧵",
    blurb: "From bast fiber bales to twine — the raw side of the hemp supply chain.",
    categories: [
      { slug: "fiber-textiles-industrial-", label: "Industrial Fiber & Textiles" },
      { slug: "hemp-rope-cordage", label: "Rope & Cordage" },
      { slug: "raw-hemp-biomass", label: "Raw Hemp Biomass" },
      { slug: "hemp-seeds-agriculture-", label: "Hemp Seeds (Agriculture)" },
      { slug: "bioplastics", label: "Bioplastics" },
      { slug: "plastics-composites", label: "Plastics & Composites" },
    ],
  },
  {
    key: "apparel",
    title: "Apparel & Accessories",
    icon: "👕",
    blurb: "Clothing, hats, shoes, bags, and jewelry made from hemp.",
    categories: [
      { slug: "hemp-clothing", label: "Hemp Clothing" },
      { slug: "hemp-hats", label: "Hemp Hats" },
      { slug: "hemp-footwear", label: "Hemp Footwear" },
      { slug: "hemp-bags", label: "Hemp Bags" },
      { slug: "hemp-accessories", label: "Hemp Accessories" },
      { slug: "hemp-jewelry", label: "Hemp Jewelry" },
    ],
  },
  {
    key: "textiles",
    title: "Textiles & Fabric",
    icon: "🪡",
    blurb: "Fabric by the yard, bedding, and towels for makers and homes.",
    categories: [
      { slug: "hemp-textiles", label: "Hemp Textiles" },
      { slug: "fabric-yarn", label: "Fabric & Yarn" },
      { slug: "hemp-bedding", label: "Hemp Bedding" },
      { slug: "hemp-towels", label: "Hemp Towels" },
    ],
  },
  {
    key: "paper",
    title: "Paper & Packaging",
    icon: "📄",
    blurb: "Tree-free paper, print stock, and packaging.",
    categories: [
      { slug: "hemp-paper-products", label: "Hemp Paper Products" },
      { slug: "hemp-paper-stock-industrial", label: "Industrial Paper Stock" },
      { slug: "paper-pulp", label: "Paper & Pulp" },
      { slug: "packaging", label: "Packaging" },
    ],
  },
  {
    key: "home",
    title: "Home & Living",
    icon: "🏠",
    blurb: "Everyday household goods, naturally hemp.",
    categories: [
      { slug: "home-living", label: "Home & Living" },
      { slug: "hemp-plates-cups", label: "Hemp Plates & Cups" },
      { slug: "candles-hemp-cbd-", label: "Hemp Candles" },
      { slug: "hemp-soap-non-cbd", label: "Hemp Soap" },
      { slug: "hemp-shampoo-haircare", label: "Hemp Shampoo & Haircare" },
      { slug: "bath-body", label: "Bath & Body" },
    ],
  },
  {
    key: "food",
    title: "Food & Nutrition",
    icon: "🥣",
    blurb: "Hemp hearts, protein, oil, and snacks — lab-tested and COA-backed.",
    categories: [
      { slug: "hemp-hearts", label: "Hemp Hearts" },
      { slug: "hemp-protein", label: "Hemp Protein" },
      { slug: "hemp-oil-food-grade-", label: "Hemp Oil (Food Grade)" },
      { slug: "hemp-seed-foods", label: "Hemp Seed Foods" },
      { slug: "hemp-snacks", label: "Hemp Snacks" },
      { slug: "hemp-beverages", label: "Hemp Beverages" },
    ],
  },
  {
    key: "wellness",
    title: "Wellness & Topicals",
    icon: "🌿",
    blurb: "Non-smokable wellness — every product listed with its lab results.",
    categories: [
      { slug: "topicals", label: "Topicals" },
      { slug: "salves-balms", label: "Salves & Balms" },
      { slug: "tinctures-wellness-", label: "Tinctures (Wellness)" },
      { slug: "capsules-supplements", label: "Capsules & Supplements" },
    ],
  },
  {
    key: "pet",
    title: "Pet & Farm",
    icon: "🐾",
    blurb: "Hemp gear and bedding for animals large and small.",
    categories: [
      { slug: "hemp-pet-toys", label: "Hemp Pet Toys" },
      { slug: "hemp-pet-bedding", label: "Hemp Pet Bedding" },
      { slug: "hemp-animal-bedding-industrial", label: "Animal Bedding (Farm & Stable)" },
      { slug: "pet-treats", label: "Pet Treats" },
    ],
  },
  {
    key: "services",
    title: "Services & B2B",
    icon: "🤝",
    blurb: "The professionals and partners who keep the hemp industry moving.",
    categories: [
      { slug: "testing-labs", label: "Testing Labs (COA Providers)" },
      { slug: "legal-compliance", label: "Legal & Compliance" },
      { slug: "logistics-fulfillment", label: "Logistics & Fulfillment" },
      { slug: "marketing-branding", label: "Marketing & Branding" },
      { slug: "white-label-products", label: "White Label" },
      { slug: "wholesale", label: "Wholesale" },
    ],
  },
];

export const SHOWCASE_SLUGS: string[] = CATEGORY_SHOWCASE.flatMap((g) =>
  g.categories.map((c) => c.slug)
);
