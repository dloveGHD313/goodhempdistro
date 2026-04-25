import Link from "next/link";

const vendorLinks = [
  { href: "/vendor-registration", label: "Vendor Registration" },
  { href: "/vendors/dashboard", label: "Vendor Dashboard" },
  { href: "/wholesale", label: "Wholesale Inquiry" },
  { href: "/services", label: "Become a Service Provider" },
  { href: "/learning-with-jax", label: "Feature on Learning with Jax" },
];

const consumerLinks = [
  { href: "/products", label: "Shop Products" },
  { href: "/vendors", label: "Discover Vendors" },
  { href: "/education", label: "Education Hub" },
  { href: "/learning-with-jax", label: "Learning with Jax" },
  { href: "/delivery/request", label: "Request Delivery" },
];

const companyLinks = [
  { href: "/about", label: "About GHD" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "Compliance Info" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact" },
];

export default function MarketingFooter() {
  return (
    <footer className="px-6 py-16 bg-[#0D1512]">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <p className="text-lg text-[#F0EDE6] mb-3 font-serif">Good Hemp Distro</p>
            <p className="text-[#8A9E96] mb-5">The hemp industry platform.</p>
            <div className="flex gap-4 text-[#8A9E96] text-sm">
              <a href="#" aria-label="Instagram" className="hover:text-[#3CB97A]">Instagram</a>
              <a href="#" aria-label="LinkedIn" className="hover:text-[#3CB97A]">LinkedIn</a>
              <a href="#" aria-label="TikTok" className="hover:text-[#3CB97A]">TikTok</a>
            </div>
          </div>

          <div>
            <p className="text-[#F0EDE6] font-semibold mb-4">For Vendors</p>
            <ul className="space-y-2 text-[#8A9E96] text-sm">
              {vendorLinks.map((item) => (
                <li key={item.label}><Link href={item.href} className="hover:text-[#3CB97A]">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[#F0EDE6] font-semibold mb-4">For Consumers</p>
            <ul className="space-y-2 text-[#8A9E96] text-sm">
              {consumerLinks.map((item) => (
                <li key={item.label}><Link href={item.href} className="hover:text-[#3CB97A]">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[#F0EDE6] font-semibold mb-4">Company</p>
            <ul className="space-y-2 text-[#8A9E96] text-sm">
              {companyLinks.map((item) => (
                <li key={item.label}><Link href={item.href} className="hover:text-[#3CB97A]">{item.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row gap-3 justify-between text-sm">
          <p className="text-[#8A9E96]">© 2026 Good Hemp Distro. All rights reserved.</p>
          <p className="text-[#4A5E57]">Nashville, TN</p>
        </div>
      </div>
    </footer>
  );
}
