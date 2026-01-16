import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Good Hemp Distro",
  description: "Learn about Good Hemp Distro's mission and values",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">About Good Hemp Distro</h1>
        
        <div className="max-w-3xl">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-green-500">Our Mission</h2>
            <p className="text-gray-300 text-lg leading-relaxed">
              Good Hemp Distro is dedicated to connecting customers with premium hemp products 
              from trusted vendors. We believe in transparency, quality, and education in the 
              rapidly evolving hemp industry.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-green-500">Our Story</h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              Founded in 2023, Good Hemp Distro emerged from a passion for wellness and a 
              recognition that consumers deserved better access to high-quality hemp products. 
              We started with a simple goal: create a trusted marketplace where quality and 
              transparency come first.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              Today, we work with carefully selected vendors who share our commitment to 
              excellence. Every product on our platform meets strict quality standards and 
              is backed by third-party lab testing.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-green-500">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-2">Quality First</h3>
                <p className="text-gray-400">
                  We only partner with vendors who meet our rigorous quality standards 
                  and provide third-party lab testing.
                </p>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-2">Transparency</h3>
                <p className="text-gray-400">
                  Full disclosure of product origins, ingredients, and lab results 
                  for every item we carry.
                </p>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-2">Education</h3>
                <p className="text-gray-400">
                  Empowering customers with knowledge about hemp products and 
                  their potential benefits.
                </p>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-2">Sustainability</h3>
                <p className="text-gray-400">
                  Supporting environmentally conscious farming practices and 
                  sustainable business operations.
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 text-green-500">Why Choose Us</h2>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Curated selection of premium hemp products</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Verified vendor partnerships with quality guarantees</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Third-party lab testing for all products</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Secure payment processing and fast shipping</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Responsive customer support team</span>
              </li>
            </ul>
          </section>

          <section className="bg-gray-800 border border-gray-700 rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-4">Get in Touch</h2>
            <p className="text-gray-300 mb-4">
              Have questions or want to learn more? We'd love to hear from you.
            </p>
            <a 
              href="/contact" 
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
            >
              Contact Us
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
