import { Shield, Truck, FlaskConical, Lock } from "lucide-react";

const badges = [
  {
    icon: FlaskConical,
    title: "Lab Verified",
    description: "All products independently tested",
  },
  {
    icon: Lock,
    title: "Secure Checkout",
    description: "256-bit SSL encryption",
  },
  {
    icon: Truck,
    title: "Fast Shipping",
    description: "2-3 day delivery nationwide",
  },
  {
    icon: Shield,
    title: "Buyer Protection",
    description: "100% money-back guarantee",
  },
];

export default function TrustBadges() {
  return (
    <section className="relative py-16 border-y border-border/30">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-secondary/5 to-transparent" />

      <div className="section-shell section-shell--tight relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {badges.map((badge, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-6 rounded-xl hover-lift group"
            >
              <div className="w-14 h-14 rounded-xl glass-card flex items-center justify-center mb-4 group-hover:glow-teal transition-shadow duration-300">
                <badge.icon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{badge.title}</h3>
              <p className="text-sm text-muted-foreground">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
