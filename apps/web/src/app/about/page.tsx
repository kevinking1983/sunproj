import type { Metadata } from "next";

export const metadata: Metadata = { title: "About RATION" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">About RATION</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>RATION is a quick-commerce grocery company delivering fresh produce, dairy, snacks and household essentials from neighbourhood dark stores in minutes.</p>
      <p>We work directly with local suppliers and keep stock close to customers so your order reaches you fast and fresh.</p>
      <p>RATION Private Limited. Registered office address, CIN and GSTIN to be added before launch.</p>
    </article>
  );
}
