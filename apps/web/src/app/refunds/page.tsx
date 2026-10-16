import type { Metadata } from "next";

export const metadata: Metadata = { title: "Refund and cancellation policy" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">Refund and cancellation policy</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>You can cancel an order from the order page until the store starts packing it. The full amount is refunded.</p>
      <p>Missing, damaged or incorrect items reported within 24 hours of delivery are refunded to your RATION wallet immediately.</p>
      <p>Refunds to the original payment method take 5 to 7 working days depending on your bank. Cash on delivery orders are refunded to the wallet.</p>
      <p>Perishable items are not eligible for return once accepted at the door unless they are damaged or expired.</p>
    </article>
  );
}
