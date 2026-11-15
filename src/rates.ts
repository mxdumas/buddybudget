import type { Currency } from "./budget";

/** Unités de `foreign` pour 1 unité de `local`, via Frankfurter (taux BCE). */
export async function fetchRate(local: Currency, foreign: Currency): Promise<number> {
  if (local === foreign) return 1;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${local}&symbols=${foreign}`,
      { signal: ctrl.signal, cache: "no-store" },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { rates: Record<string, number> };
    const rate = data.rates[foreign];
    if (!(rate > 0)) throw new Error("Taux absent");
    return rate;
  } finally {
    clearTimeout(timer);
  }
}
