import type { Metadata } from "next";

import { COMPANY, companyLine, formatSupportPhone } from "@ration/shared";

export const metadata: Metadata = { title: "Contact and support" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">Contact and support</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>Need help with an order? Open the order from your account for its live status, or reach us on the channels below.</p>
      <p>WhatsApp and phone: {COMPANY.supportPhone ? formatSupportPhone(COMPANY.supportPhone) : "to be added before launch"}</p>
      <p>Email: <a href={`mailto:${COMPANY.supportEmail}`} className="text-primary underline">{COMPANY.supportEmail}</a></p>
      <p>
        Grievance officer (as required by the Consumer Protection (E-Commerce) Rules, 2020):{" "}
        {COMPANY.grievanceOfficer ? `${COMPANY.grievanceOfficer.name}, ${COMPANY.grievanceOfficer.email}, ${COMPANY.grievanceOfficer.phone}` : "name and contact to be added before launch."}
      </p>
      <p className="text-sm text-muted">{companyLine}{COMPANY.registeredAddress ? ` Registered office: ${COMPANY.registeredAddress}.` : ""}</p>
    </article>
  );
}
