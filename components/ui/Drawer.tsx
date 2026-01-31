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

const lockBodyScroll = () => {
  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
  return () => {
    const y = document.body.style.top;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
    window.scrollTo(0, parseInt(y || "0", 10) * -1);
  };
};

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

  const panelClasses = useMemo(() => {
    if (side === "bottom") {
      return `w-full h-[85vh] rounded-t-2xl ${open ? "translate-y-0" : "translate-y-full"}`;
    }
    return `${widthClassName} h-full ${open ? "translate-x-0" : "translate-x-full"}`;
  }, [open, side, widthClassName]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockBodyScroll();
    return () => unlock();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch justify-end bg-black/50 backdrop-blur-sm transition-opacity pointer-events-auto"
      aria-hidden={!open}
      onClick={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        ref={panelRef}
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
