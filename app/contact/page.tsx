import { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | Good Hemp Distro",
  description: "Get in touch with Good Hemp Distro",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Contact Us</h1>
        <p className="text-xl text-gray-300 mb-12">
          Have questions? We're here to help. Reach out to our team.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
            <h2 className="text-2xl font-semibold mb-6">Send us a message</h2>
            <ContactForm />
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h3 className="text-xl font-semibold mb-4">Email</h3>
              <p className="text-gray-300 mb-2">For general inquiries:</p>
              <a 
                href="mailto:info@goodhempdistro.com" 
                className="text-green-500 hover:text-green-400 transition"
              >
                info@goodhempdistro.com
              </a>
              <p className="text-gray-300 mt-4 mb-2">For vendor partnerships:</p>
              <a 
                href="mailto:vendors@goodhempdistro.com" 
                className="text-green-500 hover:text-green-400 transition"
              >
                vendors@goodhempdistro.com
              </a>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h3 className="text-xl font-semibold mb-4">Response Time</h3>
              <p className="text-gray-300">
                We typically respond to all inquiries within 24-48 hours during business days.
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h3 className="text-xl font-semibold mb-4">Business Hours</h3>
              <p className="text-gray-300">
                Monday - Friday: 9:00 AM - 6:00 PM EST<br />
                Saturday - Sunday: Closed
              </p>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h3 className="text-xl font-semibold mb-4">FAQ</h3>
              <p className="text-gray-300 mb-4">
                Before reaching out, check our FAQ section for quick answers to common questions 
                about products, shipping, and returns.
              </p>
              <a 
                href="/faq" 
                className="text-green-500 hover:text-green-400 transition"
              >
                View FAQ →
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
