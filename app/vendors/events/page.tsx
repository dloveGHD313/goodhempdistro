import Link from "next/link";
export default function VendorEventsPage(){return <main className="section-shell"><h1 className="text-3xl text-accent mb-4">My Events</h1><p className="text-muted mb-6">Manage your events and ticket sales.</p><Link href="/vendors/events/create" className="btn-primary">Create Event</Link></main>}
