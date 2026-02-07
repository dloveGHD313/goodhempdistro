import { logMascotFlagMismatch } from "@/lib/mascotFlags";
import JaxFloatingScaffold from "@/components/mascot/JaxFloatingScaffold";

export default function WelcomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { clientEnabled, serverEnabled } = logMascotFlagMismatch("welcome");
  const mascotEnabled = clientEnabled && serverEnabled;

  return (
    <>
      {children}
      {mascotEnabled ? <JaxFloatingScaffold /> : null}
    </>
  );
}
