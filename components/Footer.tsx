 "use client";

import Link from "next/link";
import { HoverLift } from "@/components/motion";

export default function Footer() {
  return (
    <footer className="section-shell section-shell--tight">
      <div className="surface-card p-6 text-muted">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <HoverLift as="span">
              <Link href="/privacy" className="hover:text-accent transition">Privacy</Link>
            </HoverLift>
            <HoverLift as="span">
              <Link href="/terms" className="hover:text-accent transition">Terms</Link>
            </HoverLift>
            <HoverLift as="span">
              <Link href="/refunds" className="hover:text-accent transition">Refunds</Link>
            </HoverLift>
            <HoverLift as="span">
              <Link href="/contact" className="hover:text-accent transition">Contact</Link>
            </HoverLift>
          </div>
        </div>
        <div className="mt-4 space-y-1 text-xs">
          <p>
            These statements have not been evaluated by the Food and Drug
            Administration. These products are not intended to diagnose, treat,
            cure, or prevent any disease.
          </p>
          <p>This site is intended for adults 21 years of age or older.</p>
        </div>
      </div>
    </footer>
  );
}
