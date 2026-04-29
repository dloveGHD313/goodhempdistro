"use client";

export default function AddToCartStub({ productId }: { productId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        // TODO: Wire to cart state/store.
        console.log("Add to cart", productId);
      }}
      className="rounded-md px-4 py-2 text-white"
      style={{ backgroundColor: "#3CB97A" }}
    >
      Add to Cart
    </button>
  );
}
