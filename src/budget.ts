export const CURRENCIES = ["CAD", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Taux : unités de devise étrangère pour 1 unité de devise locale. */
export interface Rate {
  value: number;
  fetchedAt: string;
  manual: boolean;
}

export interface Entry {
  id: string;
  kind: "purchase" | "topup";
  amount: number;
  currency: Currency;
  /** Taux figé au moment de la saisie. */
  rate: number;
  note: string;
  date: string;
}

export interface Trip {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  initialBudget: number; // devise locale
  local: Currency;
  foreign: Currency;
  rate: Rate;
  entries: Entry[];
}

export type Phase = "before" | "during" | "after";

export interface Summary {
  phase: Phase;
  days: number;
  remainingDays: number;
  balanceLocal: number;
  balanceForeign: number;
  plannedPerDayLocal: number;
  remainingPerDayLocal: number | null;
}

const DAY_MS = 86_400_000;
const dayIndex = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);

export function toLocal(
  trip: Pick<Trip, "local">,
  entry: Pick<Entry, "amount" | "currency" | "rate">,
): number {
  return entry.currency === trip.local ? entry.amount : entry.amount / entry.rate;
}

export function summarize(trip: Trip, today: string): Summary {
  const start = dayIndex(trip.start);
  const end = dayIndex(trip.end);
  const now = dayIndex(today);
  const days = end - start + 1;

  let topups = 0;
  let purchases = 0;
  for (const e of trip.entries) {
    if (e.kind === "topup") topups += toLocal(trip, e);
    else purchases += toLocal(trip, e);
  }

  const phase: Phase = now < start ? "before" : now > end ? "after" : "during";
  const remainingDays = phase === "before" ? days : phase === "after" ? 0 : end - now + 1;
  const balanceLocal = trip.initialBudget + topups - purchases;

  return {
    phase,
    days,
    remainingDays,
    balanceLocal,
    balanceForeign: balanceLocal * trip.rate.value,
    plannedPerDayLocal: (trip.initialBudget + topups) / days,
    remainingPerDayLocal: remainingDays > 0 ? balanceLocal / remainingDays : null,
  };
}
