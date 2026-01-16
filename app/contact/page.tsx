import { Metadata } from "next";

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
            <form className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="How can we help?"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Your message..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition font-semibold"
              >
                Send Message
              </button>
            </form>
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
