import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Good Hemp Distro",
  description: "Your account dashboard",
};

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Total Orders</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Active Orders</h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">Total Spent</h3>
            <p className="text-3xl font-bold">$0.00</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h2 className="text-2xl font-semibold mb-6">Recent Orders</h2>
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No orders yet</p>
                <a 
                  href="/products" 
                  className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition"
                >
                  Start Shopping
                </a>
              </div>
            </section>

            <section className="bg-gray-800 border border-gray-700 rounded-lg p-8">
              <h2 className="text-2xl font-semibold mb-6">Order History</h2>
              <div className="text-center py-8">
                <p className="text-gray-400">Your order history will appear here</p>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Account</h3>
              <ul className="space-y-3">
                <li>
                  <a href="/account/profile" className="text-gray-300 hover:text-green-500 transition">
                    Profile Settings
                  </a>
                </li>
                <li>
                  <a href="/account/addresses" className="text-gray-300 hover:text-green-500 transition">
                    Shipping Addresses
                  </a>
                </li>
                <li>
                  <a href="/account/payment" className="text-gray-300 hover:text-green-500 transition">
                    Payment Methods
                  </a>
                </li>
              </ul>
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <a href="/products" className="text-gray-300 hover:text-green-500 transition">
                    Browse Products
                  </a>
                </li>
                <li>
                  <a href="/vendors" className="text-gray-300 hover:text-green-500 transition">
                    View Vendors
                  </a>
                </li>
                <li>
                  <a href="/contact" className="text-gray-300 hover:text-green-500 transition">
                    Contact Support
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
