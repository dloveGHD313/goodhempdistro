import { Users, MessageCircle, Award, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Member Network",
    description: "Connect with enthusiasts, growers, and industry professionals in our thriving community.",
  },
  {
    icon: MessageCircle,
    title: "Discussion Forums",
    description: "Share experiences, ask questions, and learn from fellow community members.",
  },
  {
    icon: Award,
    title: "Reputation System",
    description: "Build trust through verified reviews and community endorsements.",
  },
  {
    icon: TrendingUp,
    title: "Market Insights",
    description: "Access exclusive industry trends, pricing data, and market analysis.",
  },
];

export default function Community() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-secondary/5 rounded-full blur-3xl" />

      <div className="section-shell section-shell--tight relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full bg-secondary/10 border border-secondary/20 text-sm text-secondary">
              <Users className="w-4 h-4" />
              Community
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Join the <span className="text-gradient-lime">Movement</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              More than a marketplace - we are building the largest community of hemp
              enthusiasts, vendors, and advocates. Connect, learn, and grow together.
            </p>

            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-primary">25K+</div>
                <div className="text-sm text-muted-foreground">Active Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-secondary">5K+</div>
                <div className="text-sm text-muted-foreground">Daily Discussions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">100+</div>
                <div className="text-sm text-muted-foreground">Expert AMAs</div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="glass-card p-6 hover-lift group">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-secondary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
