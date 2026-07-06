// Regression tests: same-day booking behaviour for regular TREATMENT/service
// bookings (non-class). Mirrors `booking-slots-timezone.test.ts` but drives
// the same code path the treatment booking calendar uses
// (`generateSpaSlotsForCalendarDate`, called from
// `src/hooks/useRoomAvailability.ts`) with every real active treatment
// duration in production. If a spa staffer edits a duration in the admin and
// we accidentally break the lead-time or timezone math for it, this fails.

import { describe, expect, it, afterEach } from "vitest";
import {
  generateSpaSlots,
  generateSpaSlotsForCalendarDate,
  spaLocalParts,
  spaLocalToInstant,
  checkBusinessHours,
  SAME_DAY_LEAD_MINUTES,
  SLOT_INTERVAL_MINUTES,
} from "@/lib/businessHours";

// Every real active treatment duration in production
// (`SELECT DISTINCT duration_minutes FROM services WHERE is_active AND
//   category IN ('Body Treatments','Holistic Therapy','Massage Therapy','Organic Facials')`).
// Includes 50 which is treatment-only (classes don't use it).
const TREATMENT_DURATIONS = [30, 45, 50, 60, 75, 90, 120];

const BROWSER_OFFSETS_MIN = [0, -300, -240, -360, -480, 60, 330, 540];

function withBrowserOffset<T>(offsetMin: number, fn: () => T): T {
  const original = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function () { return offsetMin; };
  try { return fn(); } finally {
    Date.prototype.getTimezoneOffset = original;
  }
}

afterEach(() => {
  // no timers used
});

describe("treatment same-day slots are timezone-independent (via useRoomAvailability entry point)", () => {
  // Wed 2026-07-08 10:00 spa-local. Business hours default: 09:00–19:00.
  const nowUtc = new Date(Date.UTC(2026, 6, 8, 16, 0, 0));

  for (const offset of BROWSER_OFFSETS_MIN) {
    for (const duration of TREATMENT_DURATIONS) {
      it(`offset ${offset}min · ${duration}min treatment → hook wrapper matches raw generator`, () => {
        // Build a browser-local Date pointing at spa-local Jul 8. The hook
        // takes a Date from a calendar picker, so it must not depend on tz.
        const [rawSlots, wrapperSlots] = withBrowserOffset(offset, () => {
          const raw = generateSpaSlots(2026, 6, 8, duration, nowUtc);
          // The wrapper reads `date.getFullYear()/getMonth()/getDate()`,
          // which use *browser-local* fields. To feed it a Date whose
          // browser-local wall clock is Jul 8, we construct it from the
          // stubbed offset. Simplest safe way: use a Date whose UTC parts
          // are Jul 8 and rely on the stub keeping tz math consistent.
          const cal = new Date(Date.UTC(2026, 6, 8, 12, 0));
          const wrap = generateSpaSlotsForCalendarDate(cal, duration, nowUtc);
          return [raw, wrap];
        });

        // At minimum, wrapper must produce a superset/equal list for the
        // same spa-local day it targets — same length, same instants, same
        // order. We only assert equality when the browser-local calendar
        // parts of `cal` land on the same spa-local day (which is true for
        // every offset in our matrix because 12:00 UTC on Jul 8 sits on
        // Jul 8 spa-local and Jul 8/9 browser-local, and getters use the
        // stubbed offset consistently).
        expect(wrapperSlots.length).toBe(rawSlots.length);
        for (let i = 0; i < rawSlots.length; i++) {
          expect(wrapperSlots[i].getTime()).toBe(rawSlots[i].getTime());
        }

        // Same guarantees as the class test: first slot ≥ now+15min, then
        // strict 30-min spacing, and each slot end ≤ 19:00 spa-local close.
        expect(rawSlots.length).toBeGreaterThan(0);
        const first = spaLocalParts(rawSlots[0]);
        expect(first.hhmm).toBe("10:30");
        for (let i = 1; i < rawSlots.length; i++) {
          expect(rawSlots[i].getTime() - rawSlots[i - 1].getTime())
            .toBe(SLOT_INTERVAL_MINUTES * 60_000);
        }
        const last = rawSlots[rawSlots.length - 1];
        const close = spaLocalToInstant(2026, 6, 8, 19, 0);
        expect(last.getTime() + duration * 60_000).toBeLessThanOrEqual(close.getTime());

        // Backend validator agrees on every slot.
        for (const s of rawSlots) {
          expect(checkBusinessHours(s, new Date(s.getTime() + duration * 60_000)).ok).toBe(true);
        }
      });
    }
  }
});

describe("treatment SAME_DAY_LEAD_MINUTES cutoff — every duration", () => {
  it("lead-time constant is 15 (contract with create-booking backend)", () => {
    expect(SAME_DAY_LEAD_MINUTES).toBe(15);
  });

  for (const duration of TREATMENT_DURATIONS) {
    it(`${duration}min · slot exactly 15 min out is allowed`, () => {
      const now = spaLocalToInstant(2026, 6, 8, 10, 15);
      const slots = generateSpaSlots(2026, 6, 8, duration, now);
      expect(spaLocalParts(slots[0]).hhmm).toBe("10:30");
    });

    it(`${duration}min · slot 14 min out is dropped`, () => {
      // now = 10:16 → 10:30 is 14 min away → must be dropped, next is 11:00.
      const now = spaLocalToInstant(2026, 6, 8, 10, 16);
      const slots = generateSpaSlots(2026, 6, 8, duration, now);
      expect(spaLocalParts(slots[0]).hhmm).toBe("11:00");
    });

    it(`${duration}min · after close returns no slots`, () => {
      // now such that no slot of `duration` fits before 19:00.
      const now = spaLocalToInstant(2026, 6, 8, 19, 0);
      expect(generateSpaSlots(2026, 6, 8, duration, now).length).toBe(0);
    });
  }
});

describe("treatment slots on late spa-evening bookings across UTC-day boundary", () => {
  // 22:30 UTC on Jul 8 = 16:30 spa-local Jul 8, but +9h browser is Jul 9 07:30.
  // Whichever tz the customer's browser is in, they must see the spa-day's
  // remaining slots for every treatment duration.
  const nowUtc = new Date(Date.UTC(2026, 6, 8, 22, 30));
  for (const duration of TREATMENT_DURATIONS) {
    it(`${duration}min from JST browser at spa-16:30 → first slot 17:00 spa-local`, () => {
      const slots = withBrowserOffset(540, () =>
        generateSpaSlots(2026, 6, 8, duration, nowUtc),
      );
      expect(spaLocalParts(slots[0]).hhmm).toBe("17:00");
    });
  }
});

describe("Sunday shorter hours (close 17:30) trim per-duration", () => {
  // Sun Jul 5, 2026 in CR → default hours 09:00–17:30.
  const nowUtc = spaLocalToInstant(2026, 6, 5, 9, 0); // spa-open time
  for (const duration of TREATMENT_DURATIONS) {
    it(`${duration}min on Sunday · last slot end ≤ 17:30`, () => {
      const slots = generateSpaSlots(2026, 6, 5, duration, nowUtc);
      const close = spaLocalToInstant(2026, 6, 5, 17, 30);
      expect(slots.length).toBeGreaterThan(0);
      const last = slots[slots.length - 1];
      expect(last.getTime() + duration * 60_000).toBeLessThanOrEqual(close.getTime());
      // And every slot passes the backend validator on Sunday's shorter window.
      for (const s of slots) {
        expect(checkBusinessHours(s, new Date(s.getTime() + duration * 60_000)).ok).toBe(true);
      }
    });
  }
});
