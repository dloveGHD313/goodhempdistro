import Link from "next/link";

export default function Footer() {
  return (
    <footer className="section-shell section-shell--tight">
      <div className="surface-card p-6 text-muted">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-accent transition">Privacy</Link>
            <Link href="/terms" className="hover:text-accent transition">Terms</Link>
            <Link href="/refunds" className="hover:text-accent transition">Refunds</Link>
            <Link href="/contact" className="hover:text-accent transition">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
