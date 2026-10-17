import Link from "next/link";

import { COMPANY, companyLine } from "@ration/shared";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-extrabold text-primary">RATION</p>
          <p className="mt-2 text-sm text-muted">Fresh groceries and daily essentials, delivered in minutes from your nearest store.</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Company</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li><Link href="/about" className="hover:text-primary">About RATION</Link></li>
            <li><Link href="/contact" className="hover:text-primary">Contact and support</Link></li>
            <li><Link href="/account/orders" className="hover:text-primary">Track an order</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold">Legal</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li><Link href="/terms" className="hover:text-primary">Terms of service</Link></li>
            <li><Link href="/privacy" className="hover:text-primary">Privacy policy</Link></li>
            <li><Link href="/refunds" className="hover:text-primary">Refund and cancellation policy</Link></li>
            <li><Link href="/shipping" className="hover:text-primary">Delivery policy</Link></li>
          </ul>
        </div>
      </div>
      <p className="border-t border-divider py-4 text-center text-xs text-muted">© {new Date().getFullYear()} {COMPANY.legalName}. {companyLine}{COMPANY.cin ? ` CIN ${COMPANY.cin}.` : ""} All rights reserved.</p>
    </footer>
  );
}
