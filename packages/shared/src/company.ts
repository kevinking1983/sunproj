/**
 * The legal entity behind the RATION brand, shown on the website, in the apps and on invoices.
 * Razorpay, Meta and the app stores check these against the company's KYC documents, so keep
 * them exactly as registered. null = not provided yet; screens show "to be added".
 */
export const COMPANY = {
  brand: "RATION",
  legalName: "Z Rainbow Pride Private Limited",
  domain: "zrainbowpride.com",
  website: "https://ration.zrainbowpride.com",
  supportEmail: "ration.support@zrainbowpride.com",
  /** Support WhatsApp/phone in E.164 without "+", e.g. "919876543210". */
  supportPhone: null as string | null,
  registeredAddress: null as string | null,
  cin: null as string | null,
  gstin: null as string | null,
  /** Grievance officer required by the Consumer Protection (E-Commerce) Rules, 2020. */
  grievanceOfficer: null as { name: string; email: string; phone: string } | null,
} as const;

export const companyLine = `${COMPANY.brand} is a brand of ${COMPANY.legalName}.`;
export const formatSupportPhone = (p: string) => `+${p.slice(0, 2)} ${p.slice(2, 7)} ${p.slice(7)}`;
