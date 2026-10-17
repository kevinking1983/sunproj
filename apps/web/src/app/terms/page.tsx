import type { Metadata } from "next";

import { COMPANY } from "@ration/shared";

export const metadata: Metadata = { title: "Terms of service" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">Terms of service</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>RATION is a quick-commerce grocery service operated by {COMPANY.legalName} (&quot;we&quot;, &quot;us&quot;). By placing an order you agree to these terms.</p>
      <p>Orders are fulfilled from the dark store serving your address. Prices, availability and delivery times are shown at checkout and may change between sessions.</p>
      <p>You must be 18 or older to order. Age-restricted items, where offered, require ID at delivery.</p>
      <p>We may cancel an order if an item is unavailable, the address is unreachable, or we suspect misuse. Any payment made will be refunded.</p>
      <p>These terms are governed by the laws of India. Disputes are subject to the courts of the city where {COMPANY.legalName} is registered.</p>
    </article>
  );
}
