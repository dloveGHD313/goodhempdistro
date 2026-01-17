import Link from "next/link";
import { Twitter, Instagram, MessageCircle, Mail } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

const footerLinks = {
  marketplace: [
    { label: "Browse Products", href: "/products" },
    { label: "Top Vendors", href: "/vendors" },
    { label: "New Arrivals", href: "/products" },
    { label: "Best Sellers", href: "/products" },
  ],
  vendors: [
    { label: "Start Selling", href: "/vendor-registration" },
    { label: "Seller Dashboard", href: "/dashboard" },
    { label: "Vendor Resources", href: "/vendors" },
    { label: "Success Stories", href: "/blog" },
  ],
  company: [
    { label: "About Us", href: "/about" },
    { label: "Careers", href: "/contact" },
    { label: "Press Kit", href: "/brand-check" },
    { label: "Contact", href: "/contact" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/about" },
    { label: "Terms of Service", href: "/about" },
    { label: "Compliance", href: "/about" },
    { label: "Accessibility", href: "/contact" },
  ],
};

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Instagram, href: "#", label: "Instagram" },
  { icon: MessageCircle, href: "#", label: "Discord" },
  { icon: Mail, href: "#", label: "Newsletter" },
];

export default function Footer() {
  return (
    <footer className="relative pt-20 pb-8 border-t border-border/30">
      <div className="absolute inset-0 bg-gradient-to-t from-muted/20 to-transparent" />

      <div className="section-shell section-shell--tight relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10 mb-16">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BrandLogo size={40} />
              </div>
              <span className="text-xl font-bold text-foreground">Good Hemp Distros</span>
            </div>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              The premium marketplace for verified hemp products. Lab-tested, secure, and
              community-driven.
            </p>

            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 rounded-lg glass-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Marketplace</h4>
            <ul className="space-y-3">
              {footerLinks.marketplace.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Vendors</h4>
            <ul className="space-y-3">
              {footerLinks.vendors.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <Link
                    href={link.href}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 Good Hemp Distros. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Made with love for the hemp community
          </p>
        </div>
      </div>
    </footer>
  );
}
