"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";

type TicketType = {
  id: string;
  name: string;
  price: string;
  quantity: string;
};

export default function NewEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTicketType = () => {
    setTicketTypes([...ticketTypes, { id: Date.now().toString(), name: "", price: "", quantity: "" }]);
  };

  const removeTicketType = (id: string) => {
    setTicketTypes(ticketTypes.filter((tt) => tt.id !== id));
  };

  const updateTicketType = (id: string, field: keyof TicketType, value: string) => {
    setTicketTypes(ticketTypes.map((tt) => (tt.id === id ? { ...tt, [field]: value } : tt)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate
      if (!title || !startTime || !endTime) {
        setError("Title, start time, and end time are required");
        setLoading(false);
        return;
      }

      if (ticketTypes.length === 0) {
        setError("At least one ticket type is required");
        setLoading(false);
        return;
      }

      // Validate ticket types
      for (const tt of ticketTypes) {
        if (!tt.name || !tt.price) {
          setError("All ticket types must have a name and price");
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/vendors/events/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          start_time: startTime,
          end_time: endTime,
          capacity: capacity ? parseInt(capacity) : null,
          status,
          ticket_types: ticketTypes.map((tt) => ({
            name: tt.name.trim(),
            price_cents: Math.round(parseFloat(tt.price) * 100),
            quantity: tt.quantity ? parseInt(tt.quantity) : null,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create event");
        setLoading(false);
        return;
      }

      router.push("/vendors/events");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-8 text-accent">Create Event</h1>

            <form onSubmit={handleSubmit} className="space-y-6 card-glass p-8">
              {error && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Event Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-2">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium mb-2">
                    Start Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="start_time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium mb-2">
                    End Time <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="end_time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="capacity" className="block text-sm font-medium mb-2">
                  Capacity (leave empty for unlimited)
                </label>
                <input
                  type="number"
                  id="capacity"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  min="1"
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div className="border-t border-[var(--border)] pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Ticket Types</h3>
                  <button
                    type="button"
                    onClick={addTicketType}
                    className="btn-secondary text-sm"
                  >
                    Add Ticket Type
                  </button>
                </div>

                {ticketTypes.length === 0 ? (
                  <p className="text-muted text-sm mb-4">No ticket types added. Click "Add Ticket Type" to add one.</p>
                ) : (
                  <div className="space-y-4">
                    {ticketTypes.map((tt) => (
                      <div key={tt.id} className="border border-[var(--border)] rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Ticket Type</span>
                          <button
                            type="button"
                            onClick={() => removeTicketType(tt.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm mb-1">Name <span className="text-red-400">*</span></label>
                          <input
                            type="text"
                            value={tt.name}
                            onChange={(e) => updateTicketType(tt.id, "name", e.target.value)}
                            required
                            placeholder="General Admission, VIP, etc."
                            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm mb-1">Price ($) <span className="text-red-400">*</span></label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={tt.price}
                              onChange={(e) => updateTicketType(tt.id, "price", e.target.value)}
                              required
                              placeholder="0.00"
                              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1">Quantity (leave empty for unlimited)</label>
                            <input
                              type="number"
                              min="1"
                              value={tt.quantity}
                              onChange={(e) => updateTicketType(tt.id, "quantity", e.target.value)}
                              placeholder="Unlimited"
                              className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={status === "published"}
                    onChange={(e) => setStatus(e.target.checked ? "published" : "draft")}
                    className="w-4 h-4 accent-accent"
                  />
                  <span>Publish immediately (uncheck to save as draft)</span>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Event"}
                </button>
                <Link href="/vendors/events" className="btn-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
