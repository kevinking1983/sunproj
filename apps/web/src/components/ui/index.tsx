"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  accent: "bg-accent text-ink hover:brightness-95",
  secondary: "bg-surface text-primary border border-primary hover:bg-primary-tint",
  ghost: "bg-transparent text-primary hover:bg-primary-tint",
  danger: "bg-danger text-white hover:brightness-95",
};
const sizeClass: Record<Size, string> = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-13 px-5 text-base" };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, full, className = "", children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantClass[variant]} ${sizeClass[size]} ${full ? "w-full" : ""} ${className}`}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string | null;
  hint?: string;
  prefix?: ReactNode;
}

export function TextField({ label, error, hint, prefix, className = "", id, ...rest }: FieldProps) {
  const inputId = id ?? rest.name ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={inputId} className="block space-y-1">
      {label ? <span className="text-sm font-medium text-ink">{label}</span> : null}
      <span className={`flex items-center gap-2 rounded-xl border bg-surface px-3 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary ${error ? "border-danger" : "border-border"}`}>
        {prefix ? <span className="text-ink font-semibold">{prefix}</span> : null}
        <input id={inputId} {...rest} className={`h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-muted ${className}`} />
      </span>
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-border bg-surface p-4 ${className}`}>{children}</div>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent ${className}`} role="status" aria-label="Loading" />;
}

export function Empty({ title, body, action, href }: { title: string; body?: string; action?: string; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      {body ? <p className="max-w-sm text-muted">{body}</p> : null}
      {action && href ? (
        <Link href={href} className="rounded-xl bg-primary px-4 py-2 font-semibold text-white">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
