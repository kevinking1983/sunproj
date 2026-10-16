"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  accent: "bg-accent text-ink hover:brightness-95",
  secondary: "bg-surface text-primary border border-primary hover:bg-primary-tint",
  ghost: "bg-transparent text-primary hover:bg-primary-tint",
  danger: "bg-danger text-white hover:brightness-95",
};

export function Button({ variant = "primary", size = "md", loading, className = "", children, disabled, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button {...rest} disabled={disabled || loading} className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass[variant]} ${size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm"} ${className}`}>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, error, className = "", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { label?: string; error?: string | null }) {
  return (
    <label className="block space-y-1 text-sm">
      {label ? <span className="font-medium">{label}</span> : null}
      <input {...rest} className={`h-10 w-full rounded-lg border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary ${error ? "border-danger" : "border-border"} ${className}`} />
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}

export function Select({ label, children, className = "", ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block space-y-1 text-sm">
      {label ? <span className="font-medium">{label}</span> : null}
      <select {...rest} className={`h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary ${className}`}>{children}</select>
    </label>
  );
}

export function Checkbox({ label, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...rest} className="h-4 w-4 accent-primary" />{label}</label>
  );
}

export function Card({ children, className = "", title, actions }: { children: ReactNode; className?: string; title?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-card border border-border bg-surface ${className}`}>
      {title ? <header className="flex items-center justify-between border-b border-divider px-4 py-3"><h2 className="font-semibold">{title}</h2>{actions}</header> : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-divider">{children}</tbody>
      </table>
    </div>
  );
}

const badgeTone: Record<string, string> = {
  pending_payment: "bg-surface-muted text-muted",
  placed: "bg-accent-tint text-gold-text",
  accepted: "bg-accent-tint text-gold-text",
  packing: "bg-accent-tint text-gold-text",
  ready: "bg-primary-tint text-primary",
  picked_up: "bg-primary-tint text-primary",
  out_for_delivery: "bg-primary-tint text-primary",
  delivered: "bg-success-tint text-success",
  cancelled: "bg-danger-tint text-danger",
  refunded: "bg-danger-tint text-danger",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone[value] ?? "bg-surface-muted text-muted"}`}>{label ?? value}</span>;
}

export function Spinner() {
  return <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" aria-label="Loading" />;
}

export const rupees = (paise: number | null | undefined) => ((paise ?? 0) / 100).toFixed(2);
export const toPaise = (rupeeString: string) => Math.round(Number(rupeeString || 0) * 100);
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
