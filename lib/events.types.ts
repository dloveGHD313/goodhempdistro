/**
 * TypeScript types for Events + Ticketing system
 */

export type EventStatus = "draft" | "pending_review" | "approved" | "rejected" | "published" | "cancelled";
export type EventOrderStatus = "pending" | "paid" | "cancelled";

export type Event = {
  id: string;
  vendor_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  tickets_sold: number;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  vendors?: {
    business_name: string;
  } | null;
};

export type EventTicketType = {
  id: string;
  event_id: string;
  name: string;
  price_cents: number;
  quantity: number | null;
  sold: number;
  created_at: string;
  updated_at: string;
};

export type EventOrder = {
  id: string;
  user_id: string;
  event_id: string;
  total_cents: number;
  stripe_session_id: string | null;
  status: EventOrderStatus;
  created_at: string;
  updated_at: string;
  events?: Event;
};

export type EventOrderItem = {
  id: string;
  event_order_id: string;
  ticket_type_id: string;
  quantity: number;
  price_cents: number;
  created_at: string;
  event_ticket_types?: EventTicketType;
};

export type EventWithTicketTypes = Event & {
  event_ticket_types: EventTicketType[];
};

export type TicketPurchase = {
  ticket_type_id: string;
  quantity: number;
};
