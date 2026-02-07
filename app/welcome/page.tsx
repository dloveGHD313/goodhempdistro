import { brand } from "@/lib/brand";
import { getMascotFlagStatus } from "@/lib/mascotFlags";
import WelcomeClient from "./WelcomeClient";

export const metadata = {
  title: `Welcome · ${brand.name}`,
  description: "Find your path in the Good Hemp community.",
};

/**
 * Public /welcome: cinematic entry + quiz intent.
 * No auth required. Answers stored in localStorage; after sign-in can be attached to profile.
 */
export default function WelcomePage() {
  const { clientEnabled, serverEnabled } = getMascotFlagStatus();
  const mascotEnabled = clientEnabled && serverEnabled;

  return (
    <main className="welcome-hero">
      <WelcomeClient mascotEnabled={mascotEnabled} />
    </main>
  );
}
