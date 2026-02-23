/**
 * Phase 1.5: Role-tailored questionnaire question sets.
 * 3–6 multiple-choice questions per role. No typing.
 */

import type { OnboardingRole } from "./role";

export type QuestionOption = { value: string; label: string };

export type Question = {
  id: string;
  prompt: string;
  options: QuestionOption[];
  /** When true, user can select multiple options; answer stored as string[] (or comma-separated). */
  multiSelect?: boolean;
};

export type QuestionSet = Question[];

const VENDOR_QUESTIONS: QuestionSet = [
  {
    id: "vendor_what_sell",
    prompt: "What do you sell?",
    multiSelect: true,
    options: [
      { value: "cbd", label: "CBD / wellness" },
      { value: "building", label: "Hemp building materials" },
      { value: "food", label: "Food & beverage" },
      { value: "textiles", label: "Textiles" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "vendor_type",
    prompt: "Are you a brand, distributor, or retailer?",
    options: [
      { value: "brand", label: "Brand / manufacturer" },
      { value: "distributor", label: "Distributor" },
      { value: "retailer", label: "Retailer" },
    ],
  },
  {
    id: "vendor_inventory",
    prompt: "Do you have inventory ready now?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "vendor_experience",
    prompt: "How would you describe your experience?",
    options: [
      { value: "new", label: "New to hemp marketplace" },
      { value: "experienced", label: "Experienced vendor" },
      { value: "established", label: "Established brand" },
    ],
  },
  {
    id: "vendor_goals",
    prompt: "What are you looking to achieve?",
    options: [
      { value: "grow", label: "Grow my business" },
      { value: "discover", label: "Discover new markets" },
      { value: "connect", label: "Connect with community" },
    ],
  },
];

/** Consumer: personal vs business (wholesale). When "business" we add wholesale role and route to /wholesale. */
export const CONSUMER_USE_TYPE_QUESTION: Question = {
  id: "consumer_use_type",
  prompt: "Are you purchasing for personal use or for a business?",
  options: [
    { value: "personal", label: "Personal / Retail" },
    { value: "business", label: "Business / Wholesale" },
  ],
};

/** Personal path only: interests, categories, frequency, goals. No business/wholesale questions. */
const CONSUMER_PERSONAL_QUESTIONS: QuestionSet = [
  {
    id: "consumer_interest",
    prompt: "What interests you?",
    multiSelect: true,
    options: [
      { value: "products", label: "Products" },
      { value: "services", label: "Services" },
      { value: "events", label: "Events" },
      { value: "education", label: "Education" },
      { value: "building", label: "Hemp building" },
      { value: "partnership", label: "Partnership / Affiliate" },
    ],
  },
  {
    id: "consumer_categories",
    prompt: "Preferred categories?",
    multiSelect: true,
    options: [
      { value: "cbd", label: "CBD / wellness" },
      { value: "building", label: "Hemp building" },
      { value: "food", label: "Food & beverage" },
      { value: "textiles", label: "Textiles" },
      { value: "events_activities", label: "Events / Activities" },
      { value: "education", label: "Education" },
      { value: "services", label: "Services" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "consumer_frequency",
    prompt: "How often do you plan to engage?",
    options: [
      { value: "regular", label: "Regularly" },
      { value: "sometimes", label: "Occasionally" },
      { value: "exploring", label: "Just exploring" },
    ],
  },
  {
    id: "consumer_goals",
    prompt: "What are you looking for?",
    options: [
      { value: "shop", label: "Shop & buy" },
      { value: "discover", label: "Discover brands" },
      { value: "connect", label: "Connect with community" },
    ],
  },
];

/** Business/wholesale path only. No N/A options; intent captured for future credential/verification. */
export const CONSUMER_WHOLESALE_QUESTIONS_ONLY: QuestionSet = [
  {
    id: "wholesale_business_type",
    prompt: "What type of business?",
    multiSelect: true,
    options: [
      { value: "hotel", label: "Hotel" },
      { value: "apartment", label: "Apartment / Multifamily" },
      { value: "retail", label: "Retail store" },
      { value: "restaurant", label: "Restaurant" },
      { value: "distributor", label: "Distributor" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "wholesale_company_size",
    prompt: "Company size?",
    options: [
      { value: "1-5", label: "1–5" },
      { value: "6-25", label: "6–25" },
      { value: "26-100", label: "26–100" },
      { value: "100+", label: "100+" },
    ],
  },
  {
    id: "wholesale_products",
    prompt: "What products are you sourcing?",
    multiSelect: true,
    options: [
      { value: "cbd", label: "CBD / wellness" },
      { value: "building", label: "Hemp building" },
      { value: "food", label: "Food & beverage" },
      { value: "textiles", label: "Textiles" },
      { value: "other", label: "Other" },
    ],
  },
];

/** Returns follow-up questions for consumer after use-type. Personal = interests/categories/frequency/goals; Business = wholesale only. */
export function getConsumerFollowUpQuestions(useType: "personal" | "business"): QuestionSet {
  return useType === "business" ? CONSUMER_WHOLESALE_QUESTIONS_ONLY : CONSUMER_PERSONAL_QUESTIONS;
}

/** Default consumer set: use-type + personal (backward compat when not branching). */
const CONSUMER_QUESTIONS: QuestionSet = [
  CONSUMER_USE_TYPE_QUESTION,
  ...CONSUMER_PERSONAL_QUESTIONS,
];

const DRIVER_QUESTIONS: QuestionSet = [
  {
    id: "driver_interested",
    prompt: "Interested in:",
    multiSelect: true,
    options: [
      { value: "deliveries", label: "Deliveries" },
      { value: "courier", label: "Courier" },
      { value: "long_haul", label: "Long-haul" },
      { value: "local", label: "Local" },
    ],
  },
  {
    id: "driver_own_services",
    prompt: "Do you want to offer your own logistics services as a vendor-type provider?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    id: "driver_mode",
    prompt: "What type of delivery interests you?",
    options: [
      { value: "on_demand", label: "On-demand delivery" },
      { value: "vendor_listed", label: "Vendor-listed / scheduled" },
      { value: "both", label: "Both" },
    ],
  },
  {
    id: "driver_experience",
    prompt: "Delivery experience?",
    options: [
      { value: "new", label: "New to delivery" },
      { value: "experienced", label: "Experienced driver" },
    ],
  },
  {
    id: "driver_availability",
    prompt: "When are you typically available?",
    options: [
      { value: "flexible", label: "Flexible schedule" },
      { value: "part_time", label: "Part-time" },
      { value: "full_time", label: "Full-time" },
    ],
  },
];

const INDUSTRIAL_QUESTIONS: QuestionSet = [
  {
    id: "industrial_need",
    prompt: "What do you need?",
    multiSelect: true,
    options: [
      { value: "bulk", label: "Bulk materials" },
      { value: "manufacturing", label: "Manufacturing" },
      { value: "supply_chain", label: "Supply chain" },
    ],
  },
  {
    id: "industrial_focus",
    prompt: "What's your primary focus?",
    options: [
      { value: "building", label: "Hemp building materials" },
      { value: "materials", label: "Industrial materials" },
      { value: "both", label: "Both" },
    ],
  },
  {
    id: "industrial_scale",
    prompt: "Project scale?",
    options: [
      { value: "small", label: "Small projects" },
      { value: "large", label: "Large-scale" },
      { value: "exploring", label: "Exploring options" },
    ],
  },
  {
    id: "industrial_goals",
    prompt: "What are you looking for?",
    options: [
      { value: "sourcing", label: "Source materials" },
      { value: "supply", label: "Supply chain" },
      { value: "network", label: "Industry network" },
    ],
  },
];

const AFFILIATE_QUESTIONS: QuestionSet = [
  {
    id: "affiliate_promotion",
    prompt: "How do you promote?",
    multiSelect: true,
    options: [
      { value: "social", label: "Social media" },
      { value: "blog", label: "Blog / website" },
      { value: "email", label: "Email" },
      { value: "in_person", label: "In-person" },
    ],
  },
  {
    id: "affiliate_audience_size",
    prompt: "Rough audience size?",
    options: [
      { value: "small", label: "Small (under 1K)" },
      { value: "medium", label: "Medium (1K–10K)" },
      { value: "large", label: "Large (10K+)" },
    ],
  },
  {
    id: "affiliate_audience",
    prompt: "Who is your primary audience?",
    options: [
      { value: "consumers", label: "Consumers" },
      { value: "business", label: "Businesses" },
      { value: "both", label: "Both" },
    ],
  },
  {
    id: "affiliate_goals",
    prompt: "What are your goals?",
    options: [
      { value: "income", label: "Earn income" },
      { value: "support", label: "Support brands I love" },
      { value: "both", label: "Both" },
    ],
  },
];

const BUILDER_QUESTIONS: QuestionSet = [
  {
    id: "builder_focus",
    prompt: "What's your focus?",
    multiSelect: true,
    options: [
      { value: "hempcrete", label: "Hempcrete" },
      { value: "construction", label: "Construction services" },
      { value: "consulting", label: "Consulting" },
      { value: "training", label: "Training" },
    ],
  },
  {
    id: "builder_leads_learning",
    prompt: "Are you looking for leads or learning?",
    options: [
      { value: "leads", label: "Leads" },
      { value: "learning", label: "Learning" },
      { value: "both", label: "Both" },
    ],
  },
  {
    id: "builder_scale",
    prompt: "Project scale?",
    options: [
      { value: "small", label: "Small projects" },
      { value: "large", label: "Large-scale" },
      { value: "exploring", label: "Exploring" },
    ],
  },
];

const EDUCATOR_QUESTIONS: QuestionSet = [
  {
    id: "educator_interests",
    prompt: "What are you interested in?",
    multiSelect: true,
    options: [
      { value: "basics", label: "Hemp basics" },
      { value: "business", label: "Business" },
      { value: "building", label: "Building" },
      { value: "compliance", label: "Compliance" },
      { value: "events", label: "Events" },
    ],
  },
  {
    id: "educator_focus",
    prompt: "What do you want to learn?",
    options: [
      { value: "basics", label: "Hemp basics" },
      { value: "compliance", label: "Compliance & regulations" },
      { value: "business", label: "Business & sales" },
    ],
  },
  {
    id: "educator_format",
    prompt: "Preferred format?",
    options: [
      { value: "episodes", label: "Episodes / video" },
      { value: "guides", label: "Guides & articles" },
      { value: "both", label: "Both" },
    ],
  },
];

const EVENTS_QUESTIONS: QuestionSet = [
  {
    id: "events_interest",
    prompt: "What are you interested in?",
    multiSelect: true,
    options: [
      { value: "attending", label: "Attending events" },
      { value: "hosting", label: "Hosting events" },
      { value: "coordinating", label: "Coordinating events" },
    ],
  },
];

export function getQuestionsForRole(role: OnboardingRole): QuestionSet {
  switch (role) {
    case "vendor":
      return VENDOR_QUESTIONS;
    case "consumer":
      return CONSUMER_QUESTIONS;
    case "driver":
      return DRIVER_QUESTIONS;
    case "industrial":
      return INDUSTRIAL_QUESTIONS;
    case "affiliate":
      return AFFILIATE_QUESTIONS;
    case "builder":
      return BUILDER_QUESTIONS;
    case "educator":
      return EDUCATOR_QUESTIONS;
    case "events":
      return EVENTS_QUESTIONS;
    default:
      return CONSUMER_QUESTIONS;
  }
}
