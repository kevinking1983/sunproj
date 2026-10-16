"use client";

import type { Address } from "@ration/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { create } from "zustand";

import { addressesApi, queryKeys } from "@/lib/api";
import { maps, type PlaceSuggestion, type ResolvedAddress } from "@/lib/maps";
import { useAuth } from "@/stores/auth";
import { useLocation } from "@/stores/location";

import { Button, Spinner, TextField } from "@/components/ui";

interface ModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useLocationModal = create<ModalState>((set) => ({ isOpen: false, open: () => set({ isOpen: true }), close: () => set({ isOpen: false }) }));

type Step = "pick" | "confirm" | "save";

export function LocationModal() {
  const { isOpen, close } = useLocationModal();
  const { location, store, status, error, detectLocation, setLocation, selectSavedAddress } = useLocation();
  const userId = useAuth((s) => s.session?.user.id ?? "");
  const profile = useAuth((s) => s.profile);
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ line1: "", landmark: "", label: "home" as Address["label"], recipient_name: "", recipient_phone: "" });

  const addresses = useQuery({ queryKey: queryKeys.addresses(userId), queryFn: addressesApi.list, enabled: !!userId && isOpen });

  useEffect(() => {
    if (query.trim().length < 3) return;
    let cancelled = false;
    const t = setTimeout(() => {
      maps.autocomplete(query, location ?? undefined).then((r) => !cancelled && setSuggestions(r)).catch(() => undefined);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, location]);

  const save = useMutation({
    mutationFn: async () => {
      if (!location) throw new Error("Pick a location first");
      return addressesApi.create(userId, {
        label: form.label,
        recipient_name: form.recipient_name || profile?.full_name || null,
        recipient_phone: form.recipient_phone || profile?.phone || null,
        line1: form.line1,
        line2: location.line1,
        landmark: form.landmark || null,
        city: location.city,
        state: location.state,
        pincode: location.pincode,
        lat: location.lat,
        lng: location.lng,
        is_default: (addresses.data?.length ?? 0) === 0,
      });
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: queryKeys.addresses(userId) });
      await selectSavedAddress(saved);
      finish();
    },
  });

  const finish = () => {
    setStep("pick");
    setQuery("");
    setSuggestions([]);
    close();
  };

  const resolved = async (r: ResolvedAddress) => {
    setBusy(true);
    await setLocation(r);
    setBusy(false);
    setStep("confirm");
  };

  if (!isOpen) return null;
  const serviceable = status === "ready" && !!store;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-primary-dark/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Set delivery location">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-ivory p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{step === "pick" ? "Set delivery location" : step === "confirm" ? "Confirm location" : "Save address"}</h2>
          <button type="button" onClick={finish} disabled={!location} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Close">✕</button>
        </div>

        {step === "pick" ? (
          <div className="space-y-3">
            <TextField placeholder="Search for area, street name…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            {suggestions.length > 0 && query.trim().length >= 3 ? (
              <ul className="divide-y divide-divider rounded-xl border border-border bg-surface">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => maps.placeDetails(s.id).then(resolved)} className="w-full px-3 py-2 text-left hover:bg-surface-muted">
                      <span className="block font-medium">{s.title}</span>
                      <span className="block truncate text-xs text-muted">{s.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <button type="button" onClick={() => detectLocation().then((ok) => ok && setStep("confirm"))} disabled={busy || status === "resolving"} className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left hover:bg-primary-tint">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-tint text-primary">{status === "resolving" ? <Spinner className="h-4 w-4" /> : "➤"}</span>
                  <span>
                    <span className="block font-semibold text-primary">Use my current location</span>
                    <span className="block text-xs text-muted">Using the browser location</span>
                  </span>
                </button>
                {error ? <p className="text-xs text-danger">{error}</p> : null}
                {addresses.data?.length ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted">SAVED ADDRESSES</p>
                    <ul className="divide-y divide-divider rounded-xl border border-border bg-surface">
                      {addresses.data.map((a) => (
                        <li key={a.id}>
                          <button type="button" onClick={() => selectSavedAddress(a).then(finish)} className="w-full px-3 py-2 text-left hover:bg-surface-muted">
                            <span className="block font-medium capitalize">{a.label === "other" ? a.line1 : a.label}</span>
                            <span className="block text-xs text-muted">{[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(", ")}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!userId ? <p className="text-xs text-muted">Log in to save addresses for faster checkout.</p> : null}
              </>
            )}
          </div>
        ) : null}

        {step === "confirm" && location ? (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{location.label}</p>
              <p className="text-sm text-muted">{location.line1}</p>
            </div>
            <div className={`rounded-xl p-3 text-sm ${serviceable ? "bg-success-tint" : "bg-danger-tint"}`}>
              {status === "resolving" ? "Checking if we deliver here…" : serviceable ? <><b className="text-success">We deliver here.</b> {store.name} · about {store.promised_minutes} minutes</> : <><b className="text-danger">Not serviceable yet.</b> Try another location.</>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" full disabled={!serviceable || !userId} onClick={() => setStep("save")}>Save as address</Button>
              <Button variant="accent" full disabled={!serviceable} onClick={finish}>Deliver here</Button>
            </div>
            <Button variant="ghost" full onClick={() => setStep("pick")}>Change location</Button>
          </div>
        ) : null}

        {step === "save" && location ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.line1.trim()) save.mutate();
            }}
          >
            <p className="text-sm text-muted">{location.line1}</p>
            <TextField label="House / Flat / Building" name="line1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} required autoFocus />
            <TextField label="Landmark (optional)" name="landmark" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
            <TextField label="Receiver name" name="recipient_name" value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} placeholder={profile?.full_name ?? ""} />
            <TextField label="Receiver phone" name="recipient_phone" value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} placeholder={profile?.phone ?? ""} />
            <div className="flex gap-2">
              {(["home", "work", "other"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setForm({ ...form, label: l })} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${form.label === l ? "border-primary bg-primary text-white" : "border-border bg-surface"}`}>{l}</button>
              ))}
            </div>
            {save.isError ? <p className="text-xs text-danger">{(save.error as Error).message}</p> : null}
            <Button type="submit" variant="accent" full loading={save.isPending}>Save and deliver here</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
