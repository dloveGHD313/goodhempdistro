import { Droplets, Cookie, Pill, Flower2, Sparkles, Box } from "lucide-react";

const categories = [
  {
    icon: Droplets,
    name: "Tinctures & Oils",
    count: "1,200+ products",
    gradient: "from-primary/20 to-secondary/20",
  },
  {
    icon: Cookie,
    name: "Edibles",
    count: "800+ products",
    gradient: "from-accent/20 to-primary/20",
  },
  {
    icon: Flower2,
    name: "Flower",
    count: "2,500+ products",
    gradient: "from-secondary/20 to-primary/20",
  },
  {
    icon: Pill,
    name: "Capsules",
    count: "450+ products",
    gradient: "from-primary/20 to-accent/20",
  },
  {
    icon: Sparkles,
    name: "Topicals",
    count: "600+ products",
    gradient: "from-accent/20 to-secondary/20",
  },
  {
    icon: Box,
    name: "Concentrates",
    count: "900+ products",
    gradient: "from-secondary/20 to-accent/20",
  },
];

export default function Categories() {
  return (
    <section className="relative py-24">
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-secondary/5 rounded-full blur-3xl -translate-y-1/2" />

      <div className="section-shell section-shell--tight relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Browse the <span className="text-gradient-lime">Marketplace</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our curated collection of premium hemp products from verified vendors.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {categories.map((category, index) => (
            <div
              key={index}
              className="group glass-card p-6 md:p-8 cursor-pointer hover-lift hover-glow-lime transition-all duration-300"
            >
              <div
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <category.icon className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              <p className="text-sm text-muted-foreground">{category.count}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
