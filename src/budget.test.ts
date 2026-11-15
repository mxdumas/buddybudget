import { describe, expect, it } from "vitest";
import { summarize, toLocal, type Trip } from "./budget";

const trip = (over: Partial<Trip> = {}): Trip => ({
  start: "2026-07-01",
  end: "2026-07-10",
  initialBudget: 1000,
  local: "CAD",
  foreign: "EUR",
  rate: { value: 0.5, fetchedAt: "2026-07-01T00:00:00Z", manual: false },
  entries: [],
  ...over,
});

describe("toLocal", () => {
  it("keeps a local-currency amount as is", () => {
    expect(toLocal(trip(), { amount: 20, currency: "CAD", rate: 0.5 })).toBe(20);
  });
  it("converts a foreign amount with the entry's own rate", () => {
    expect(toLocal(trip(), { amount: 20, currency: "EUR", rate: 0.8 })).toBe(25);
  });
});

describe("summarize", () => {
  it("computes the plan for a fresh trip before departure", () => {
    const s = summarize(trip(), "2026-06-30");
    expect(s.phase).toBe("before");
    expect(s.days).toBe(10);
    expect(s.balanceLocal).toBe(1000);
    expect(s.balanceForeign).toBe(500);
    expect(s.plannedPerDayLocal).toBe(100);
    expect(s.remainingDays).toBe(10);
    expect(s.remainingPerDayLocal).toBe(100);
  });

  it("subtracts purchases at their frozen rate, even if the current rate changed", () => {
    const t = trip({
      rate: { value: 0.25, fetchedAt: "x", manual: true },
      entries: [
        { id: "1", kind: "purchase", amount: 50, currency: "EUR", rate: 0.5, note: "", date: "2026-07-02T10:00:00Z" },
      ],
    });
    const s = summarize(t, "2026-07-02");
    expect(s.balanceLocal).toBe(900);
    expect(s.balanceForeign).toBe(225);
  });

  it("adds top-ups to the balance and to the planned budget per day", () => {
    const t = trip({
      entries: [
        { id: "1", kind: "topup", amount: 200, currency: "CAD", rate: 0.5, note: "", date: "2026-07-03T10:00:00Z" },
      ],
    });
    const s = summarize(t, "2026-07-03");
    expect(s.balanceLocal).toBe(1200);
    expect(s.plannedPerDayLocal).toBe(120);
  });

  it("counts today in the remaining days during the trip", () => {
    const s = summarize(trip(), "2026-07-08");
    expect(s.phase).toBe("during");
    expect(s.remainingDays).toBe(3);
    expect(s.remainingPerDayLocal).toBeCloseTo(333.33, 2);
  });

  it("allows a negative balance", () => {
    const t = trip({
      entries: [
        { id: "1", kind: "purchase", amount: 1100, currency: "CAD", rate: 0.5, note: "", date: "2026-07-02T10:00:00Z" },
      ],
    });
    const s = summarize(t, "2026-07-05");
    expect(s.balanceLocal).toBe(-100);
    expect(s.remainingPerDayLocal).toBeCloseTo(-100 / 6, 5);
  });

  it("has no remaining per day after the trip", () => {
    const s = summarize(trip(), "2026-07-11");
    expect(s.phase).toBe("after");
    expect(s.remainingDays).toBe(0);
    expect(s.remainingPerDayLocal).toBeNull();
  });

  it("handles a single-day trip", () => {
    const s = summarize(trip({ end: "2026-07-01" }), "2026-07-01");
    expect(s.days).toBe(1);
    expect(s.remainingDays).toBe(1);
  });
});
