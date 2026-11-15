import type { Trip } from "./budget";

const KEY = "buddybudget.trip";

export function loadTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Trip) : null;
  } catch {
    return null;
  }
}

export function saveTrip(trip: Trip | null): void {
  if (trip) localStorage.setItem(KEY, JSON.stringify(trip));
  else localStorage.removeItem(KEY);
}
