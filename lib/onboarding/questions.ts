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
};

export type QuestionSet = Question[];

const VENDOR_QUESTIONS: QuestionSet = [
  { id: "vendor_focus", prompt: "What's your primary focus?", options: [{ value: "products", label: "Selling products" }, { value: "services", label: "Offering services" }, { value: "both", label: "Both products & services" }, { value: "exploring", label: "Just exploring" }] },
  { id: "vendor_experience", prompt: "How would you describe your experience?", options: [{ value: "new", label: "New to hemp marketplace" }, { value: "experienced", label: "Experienced vendor" }, { value: "established", label: "Established brand" }] },
  { id: "vendor_goals", prompt: "What are you looking to achieve?", options: [{ value: "grow", label: "Grow my business" }, { value: "discover", label: "Discover new markets" }, { value: "connect", label: "Connect with community" }] },
];

const CONSUMER_QUESTIONS: QuestionSet = [
  { id: "consumer_interest", prompt: "What interests you most?", options: [{ value: "products", label: "Products" }, { value: "services", label: "Services" }, { value: "events", label: "Events" }, { value: "all", label: "A bit of everything" }] },
  { id: "consumer_frequency", prompt: "How often do you plan to engage?", options: [{ value: "regular", label: "Regularly" }, { value: "sometimes", label: "Occasionally" }, { value: "exploring", label: "Just exploring" }] },
  { id: "consumer_goals", prompt: "What are you looking for?", options: [{ value: "shop", label: "Shop & buy" }, { value: "discover", label: "Discover brands" }, { value: "connect", label: "Connect with community" }] },
];

const DRIVER_QUESTIONS: QuestionSet = [
  { id: "driver_mode", prompt: "What type of delivery interests you?", options: [{ value: "on_demand", label: "On-demand delivery" }, { value: "vendor_listed", label: "Vendor-listed / scheduled" }, { value: "both", label: "Both" }] },
  { id: "driver_experience", prompt: "Delivery experience?", options: [{ value: "new", label: "New to delivery" }, { value: "experienced", label: "Experienced driver" }] },
  { id: "driver_availability", prompt: "When are you typically available?", options: [{ value: "flexible", label: "Flexible schedule" }, { value: "part_time", label: "Part-time" }, { value: "full_time", label: "Full-time" }] },
];

const INDUSTRIAL_QUESTIONS: QuestionSet = [
  { id: "industrial_focus", prompt: "What's your primary focus?", options: [{ value: "building", label: "Hemp building materials" }, { value: "materials", label: "Industrial materials" }, { value: "both", label: "Both" }] },
  { id: "industrial_scale", prompt: "Project scale?", options: [{ value: "small", label: "Small projects" }, { value: "large", label: "Large-scale" }, { value: "exploring", label: "Exploring options" }] },
  { id: "industrial_goals", prompt: "What are you looking for?", options: [{ value: "sourcing", label: "Source materials" }, { value: "supply", label: "Supply chain" }, { value: "network", label: "Industry network" }] },
];

const AFFILIATE_QUESTIONS: QuestionSet = [
  { id: "affiliate_audience", prompt: "Who is your primary audience?", options: [{ value: "consumers", label: "Consumers" }, { value: "business", label: "Businesses" }, { value: "both", label: "Both" }] },
  { id: "affiliate_platform", prompt: "Where do you promote?", options: [{ value: "social", label: "Social media" }, { value: "blog", label: "Blog / website" }, { value: "network", label: "Personal network" }] },
  { id: "affiliate_goals", prompt: "What are your goals?", options: [{ value: "income", label: "Earn income" }, { value: "support", label: "Support brands I love" }, { value: "both", label: "Both" }] },
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
    default:
      return CONSUMER_QUESTIONS;
  }
}
