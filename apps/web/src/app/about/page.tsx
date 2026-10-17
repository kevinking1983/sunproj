import type { Metadata } from "next";

import { COMPANY, companyLine } from "@ration/shared";

export const metadata: Metadata = { title: "About RATION" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">About RATION</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>RATION is a quick-commerce grocery company delivering fresh produce, dairy, snacks and household essentials from neighbourhood dark stores in minutes.</p>
      <p>We work directly with local suppliers and keep stock close to customers so your order reaches you fast and fresh.</p>
      <section className="rounded-card border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">Company details</h2>
        <p className="mt-1">{companyLine}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-muted">
          <dt>Registered office</dt><dd>{COMPANY.registeredAddress ?? "To be added before launch"}</dd>
          <dt>CIN</dt><dd>{COMPANY.cin ?? "To be added before launch"}</dd>
          <dt>GSTIN</dt><dd>{COMPANY.gstin ?? "To be added before launch"}</dd>
          <dt>Email</dt><dd>{COMPANY.supportEmail}</dd>
        </dl>
      </section>
    </article>
  );
}
