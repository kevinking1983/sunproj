import type { Metadata } from "next";

export const metadata: Metadata = { title: "Delivery policy" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">Delivery policy</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>RATION delivers from the dark store nearest to your address. The promised delivery time is shown before you place the order.</p>
      <p>Delivery is available within the service area of each store during its opening hours. Outside those hours, orders are not accepted.</p>
      <p>A delivery fee applies to orders below the free-delivery threshold shown at checkout. A small-order fee applies below the store minimum.</p>
      <p>If the delivery partner cannot reach you after two attempts, the order may be cancelled and perishable items may not be refundable.</p>
    </article>
  );
}
