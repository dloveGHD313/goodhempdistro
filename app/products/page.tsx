import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Products | Good Hemp Distro",
  description: "Browse our premium hemp products",
};

export default function ProductsPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Products</h1>
        <p className="text-xl text-gray-300 mb-12">
          Browse our curated selection of premium hemp products.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Product cards will be populated from Supabase */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="aspect-square bg-gray-700 rounded-lg mb-4" />
            <h3 className="text-xl font-semibold mb-2">Premium CBD Oil</h3>
            <p className="text-gray-400 mb-4">Full-spectrum CBD oil extracted from organic hemp</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-500">$49.99</span>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
                Add to Cart
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="aspect-square bg-gray-700 rounded-lg mb-4" />
            <h3 className="text-xl font-semibold mb-2">Hemp Flower - Indoor</h3>
            <p className="text-gray-400 mb-4">Hand-trimmed indoor hemp flower</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-500">$29.99</span>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
                Add to Cart
              </button>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="aspect-square bg-gray-700 rounded-lg mb-4" />
            <h3 className="text-xl font-semibold mb-2">CBD Gummies</h3>
            <p className="text-gray-400 mb-4">25mg CBD per gummy, 30 count</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-500">$34.99</span>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
                Add to Cart
              </button>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-gray-400">
            More products coming soon. Check back regularly for new additions.
          </p>
        </div>
      </div>
    </main>
  );
}
