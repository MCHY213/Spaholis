// Regression tests: same-day booking slot generation is timezone-independent
// and respects the SAME_DAY_LEAD_MINUTES cutoff for every service duration
// we currently sell. If any of these fail, the booking UI will disagree with
// the create-booking backend and customers will see "invalid slot" errors.

import { describe, expect, it, afterEach, vi } from "vitest";
import {
  generateSpaSlots,
  spaLocalParts,
  spaLocalToInstant,
  SAME_DAY_LEAD_MINUTES,
  SLOT_INTERVAL_MINUTES,
  SPA_UTC_OFFSET_MIN,
  checkBusinessHours,
} from "@/lib/businessHours";

// Every treatment/class duration currently offered on the site.
const DURATIONS = [30, 45, 60, 75, 90, 120, 150, 180];

// Representative browser timezones we've seen in Analytics.
const BROWSER_OFFSETS_MIN = [
  0,      // UTC
  -300,   // EST (winter)
  -240,   // EDT / New York summer
  -360,   // CST — same as spa
  -480,   // PST
  60,     // CET
  330,    // IST
  540,    // JST
];

function withBrowserOffset<T>(offsetMin: number, fn: () => T): T {
  // Simulate a browser in a different tz by pinning Date#getTimezoneOffset.
  // spaLocalParts / spaLocalToInstant do NOT depend on the browser tz —
  // they use SPA_UTC_OFFSET_MIN directly — so these tests prove that
  // property. The stub is here to catch any future regression that
  // accidentally reintroduces browser-local math.
  const original = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function () { return offsetMin; };
  try { return fn(); } finally {
    Date.prototype.getTimezoneOffset = original;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("same-day slot generation is timezone-independent", () => {
  // Pick a mid-morning "now" on a Wednesday (open 9:00–19:00 in defaults).
  // Spa-local: 2026-07-08 10:00 → UTC 2026-07-08T16:00Z.
  const nowUtc = new Date(Date.UTC(2026, 6, 8, 16, 0, 0));

  for (const offset of BROWSER_OFFSETS_MIN) {
    for (const duration of DURATIONS) {
      it(`browser offset ${offset}min, duration ${duration}min → identical slots`, () => {
        const slots = withBrowserOffset(offset, () =>
          generateSpaSlots(2026, 6, 8, duration, nowUtc),
        );

        // 1. Every slot's spa-local hh:mm falls inside [10:15, close-duration].
        //    First eligible slot after the 15-min lead-time from 10:00 is 10:30.
        const first = slots[0];
        expect(first).toBeDefined();
        const firstLocal = spaLocalParts(first);
        expect(`${firstLocal.hour}:${String(firstLocal.minute).padStart(2, "0")}`)
          .toBe("10:30");

        // 2. Slots are strictly 30-min apart.
        for (let i = 1; i < slots.length; i++) {
          expect(slots[i].getTime() - slots[i - 1].getTime())
            .toBe(SLOT_INTERVAL_MINUTES * 60_000);
        }

        // 3. Last slot + duration never exceeds 19:00 spa-local close.
        const last = slots[slots.length - 1];
        const lastEnd = new Date(last.getTime() + duration * 60_000);
        const closeInstant = spaLocalToInstant(2026, 6, 8, 19, 0);
        expect(lastEnd.getTime()).toBeLessThanOrEqual(closeInstant.getTime());

        // 4. Backend validator agrees on every generated slot.
        for (const s of slots) {
          const end = new Date(s.getTime() + duration * 60_000);
          const check = checkBusinessHours(s, end);
          expect(check.ok).toBe(true);
        }
      });
    }
  }
});

describe("SAME_DAY_LEAD_MINUTES cutoff behaviour", () => {
  it("constant is documented as 15 minutes (contract with backend)", () => {
    expect(SAME_DAY_LEAD_MINUTES).toBe(15);
  });

  // "Now" at exactly 10:14 spa-local → 10:30 slot must appear (lead = 15 min,
  // cutoff = now + 15 = 10:29, and 10:30 >= 10:29).
  it("slot 15+ min in the future is offered", () => {
    const now = spaLocalToInstant(2026, 6, 8, 10, 14);
    const slots = generateSpaSlots(2026, 6, 8, 60, now);
    const first = spaLocalParts(slots[0]);
    expect(first.hhmm).toBe("10:30");
  });

  // "Now" at 10:16 → 10:30 is only 14 min away → must be dropped, first is 11:00.
  it("slot less than 15 min in the future is dropped", () => {
    const now = spaLocalToInstant(2026, 6, 8, 10, 16);
    const slots = generateSpaSlots(2026, 6, 8, 60, now);
    const first = spaLocalParts(slots[0]);
    expect(first.hhmm).toBe("11:00");
  });

  // Boundary: "now" exactly on a slot minus lead-time = allow.
  it("slot exactly at now + lead-time is allowed", () => {
    // slot 10:30, now = 10:15 → 10:30 - 10:15 = 15 min = lead exactly.
    const now = spaLocalToInstant(2026, 6, 8, 10, 15);
    const slots = generateSpaSlots(2026, 6, 8, 60, now);
    expect(spaLocalParts(slots[0]).hhmm).toBe("10:30");
  });

  // Same-day, past close: no slots.
  it("after close time returns no slots", () => {
    const now = spaLocalToInstant(2026, 6, 8, 20, 0);
    for (const d of DURATIONS) {
      const slots = generateSpaSlots(2026, 6, 8, d, now);
      expect(slots.length).toBe(0);
    }
  });

  // Same-day cutoff must also hold when the browser is in a different tz
  // and the SPA-local "today" straddles the UTC day boundary.
  it("late spa-evening booking on a browser one day ahead still counts as spa-today", () => {
    // 2026-07-08 22:30 UTC = 2026-07-08 16:30 spa-local.
    const nowUtc = new Date(Date.UTC(2026, 6, 8, 22, 30));
    withBrowserOffset(540 /* JST, +9h → 2026-07-09 07:30 tomorrow */, () => {
      const slots = generateSpaSlots(2026, 6, 8, 60, nowUtc);
      // First slot must respect same-day lead: 16:30 + 15min → first slot 17:00.
      expect(spaLocalParts(slots[0]).hhmm).toBe("17:00");
    });
  });
});

describe("timezone constant sanity", () => {
  it("SPA offset is Costa Rica fixed −6h (no DST)", () => {
    expect(SPA_UTC_OFFSET_MIN).toBe(-360);
  });
});
