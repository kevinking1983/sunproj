import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

export default function Page() {
  return (
    <article className="max-w-3xl space-y-4 py-10 leading-7">
      <h1 className="text-3xl font-bold">Privacy policy</h1>
      <p className="text-sm text-muted">Last updated 16 October 2026. Draft for review by the RATION legal advisor before launch.</p>
      <p>We collect your phone number to log you in, your addresses and location to deliver, and your order history to serve you better.</p>
      <p>Payments are processed by Razorpay. We never see or store your card number, UPI PIN or bank credentials.</p>
      <p>We do not sell your personal data. We share it only with delivery partners, payment and SMS providers as needed to fulfil your order.</p>
      <p>You can ask us to delete your account and data from the contact page. We retain invoices as required by Indian tax law.</p>
    </article>
  );
}
