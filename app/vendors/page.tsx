import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendors | Good Hemp Distro",
  description: "Meet our trusted hemp product vendors",
};

export default function VendorsPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Our Vendors</h1>
        <p className="text-xl text-gray-300 mb-12">
          We partner with trusted vendors to bring you the highest quality hemp products.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <div className="w-24 h-24 bg-gray-700 rounded-full mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Premium Hemp Co.</h3>
            <p className="text-gray-400 mb-4">
              Family-owned farm specializing in organic CBD oils and tinctures. 
              Operating since 2015 with a commitment to sustainable farming practices.
            </p>
            <div className="flex gap-2">
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">CBD Oils</span>
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Tinctures</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <div className="w-24 h-24 bg-gray-700 rounded-full mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Green Valley Farms</h3>
            <p className="text-gray-400 mb-4">
              Premium indoor flower cultivation with lab-tested products. 
              Every batch is third-party tested for quality and compliance.
            </p>
            <div className="flex gap-2">
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Flower</span>
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Pre-rolls</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <div className="w-24 h-24 bg-gray-700 rounded-full mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Nature's Remedy</h3>
            <p className="text-gray-400 mb-4">
              Artisan edibles and wellness products crafted with care. 
              All products are vegan-friendly and made with natural ingredients.
            </p>
            <div className="flex gap-2">
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Edibles</span>
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Topicals</span>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <div className="w-24 h-24 bg-gray-700 rounded-full mb-4" />
            <h3 className="text-2xl font-semibold mb-2">Hemp Wellness Labs</h3>
            <p className="text-gray-400 mb-4">
              Science-backed formulations and innovative delivery methods. 
              Research-driven approach to hemp wellness products.
            </p>
            <div className="flex gap-2">
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Capsules</span>
              <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">Tinctures</span>
            </div>
          </div>
        </div>

        <div className="mt-16 bg-gray-800 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Become a Vendor</h2>
          <p className="text-gray-300 mb-6">
            Interested in partnering with Good Hemp Distro? We're always looking for 
            high-quality vendors who share our commitment to excellence.
          </p>
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition">
            Apply Now
          </button>
        </div>
      </div>
    </main>
  );
}
