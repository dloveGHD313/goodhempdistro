import type { MascotMood } from "./config";

export type MascotResultItem = {
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: string | null;
  imageUrl?: string | null;
};

export type MascotResults = {
  type: "posts" | "products" | "events" | "deliveries" | "loads" | "links" | "none";
  items: MascotResultItem[];
};

export type MascotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mood?: MascotMood;
  results?: MascotResults | null;
  microLine?: string | null;
};
