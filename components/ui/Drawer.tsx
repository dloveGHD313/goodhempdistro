import { useEffect, useId, useMemo, useRef } from "react";
import type { ReactNode } from "react";

type DrawerProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: string;
  children: ReactNode;
  side?: "right" | "bottom";
  widthClassName?: string;
};

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Drawer({
  open,
  onOpenChange,
  title,
  children,
  side = "right",
  widthClassName = "w-full max-w-xl",
}: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const panelClasses = useMemo(() => {
    if (side === "bottom") {
      return `w-full h-[85vh] rounded-t-2xl ${open ? "translate-y-0" : "translate-y-full"}`;
    }
    return `${widthClassName} h-full ${open ? "translate-x-0" : "translate-x-full"}`;
  }, [open, side, widthClassName]);

  useEffect(() => {
    if (!open) return;
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusables.length > 0) {
        focusables[0]?.focus();
      } else {
        panel.focus();
      }
    };

    const timer = window.setTimeout(focusFirst, 10);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) return;
    document.body.style.overflow = "";
    if (lastFocusedRef.current) {
      lastFocusedRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch justify-end bg-black/50 backdrop-blur-sm transition-opacity"
      aria-hidden={!open}
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={panelRef}
        tabIndex={-1}
        className={`bg-[var(--surface)]/95 border border-[var(--border)] shadow-2xl transform transition-transform duration-300 ease-out ${panelClasses}`}
        onClick={(event) => event.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
