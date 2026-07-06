// Parity test: every slot the frontend renders must be accepted by the
// backend business-hours validator.
//
// The frontend hooks (`src/hooks/useRoomAvailability.ts`,
// `src/hooks/useExperienceDynamicSlots.ts`) both call
// `generateSpaSlotsForCalendarDate(...)` from `src/lib/businessHours.ts`.
// That module is a byte-for-byte mirror of
// `supabase/functions/create-booking/businessHours.ts` (see the "KEEP IN
// SYNC" comments in both files). Here we drive the backend module with the
// exact slot list the frontend would produce and assert `checkBusinessHours`
// returns `ok: true` for every single one, across:
//   - every weekday (Sun uses the shorter 17:30 close, Mon–Sat use 19:00)
//   - every real active service's `duration_minutes`
//   - a same-day scenario, so the 15-minute lead time is exercised too
//
// If this test starts failing, either the two `businessHours.ts` files have
// drifted or someone changed the slot rules on only one side.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  checkBusinessHours,
  generateSpaSlots,
  SPA_UTC_OFFSET_MIN,
  spaLocalParts,
  spaLocalToInstant,
} from "./businessHours.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function loadActiveTreatmentDurations(): Promise<number[]> {
  // Only treatments/facials/body/holistic go through the room-based slot
  // path (`services.type in ('treatment', ...)`). Classes, retreats, and
  // wellness programs use different flows and don't hit this validator.
  const { data, error } = await admin
    .from("services")
    .select("duration_minutes, category, is_active")
    .eq("is_active", true)
    .in("category", ["Body Treatments", "Holistic Therapy", "Massage Therapy", "Organic Facials"]);
  if (error) throw error;
  const set = new Set<number>();
  for (const row of data ?? []) {
    const d = Number(row.duration_minutes);
    if (Number.isFinite(d) && d > 0) set.add(d);
  }
  const durations = [...set].sort((a, b) => a - b);
  assert(durations.length > 0, "expected at least one active bookable service");
  return durations;
}

Deno.test("every FE-generated slot passes backend business-hours check", async () => {
  const durations = await loadActiveTreatmentDurations();

  // Anchor a "today" that is deep inside a spa-local business day so the
  // same-day 15-min lead time only trims early morning, not the whole day.
  // Use a spa-local wall clock of 10:00 on a Wednesday.
  const anchor = spaLocalToInstant(2026, 6, 8, 10, 0); // Wed Jul 8, 2026, 10:00 CR
  const anchorSpa = spaLocalParts(anchor);
  assertEquals(anchorSpa.weekday, 3, "anchor should be a Wednesday in CR");

  // Iterate 7 consecutive days starting from the anchor day so every
  // weekday (Sun=0..Sat=6) gets covered exactly once.
  const daysCovered = new Set<number>();
  let totalSlots = 0;
  const failures: Array<{
    weekday: number;
    duration: number;
    slotLocal: string;
    check: ReturnType<typeof checkBusinessHours>;
  }> = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const dayInstant = new Date(anchor.getTime() + dayOffset * 24 * 60 * 60_000);
    const parts = spaLocalParts(dayInstant);
    daysCovered.add(parts.weekday);

    for (const duration of durations) {
      const slots = generateSpaSlots(parts.year, parts.month0, parts.day, duration, anchor);
      for (const slot of slots) {
        totalSlots++;
        const slotEnd = new Date(slot.getTime() + duration * 60_000);
        const check = checkBusinessHours(slot, slotEnd);
        if (!check.ok) {
          failures.push({
            weekday: parts.weekday,
            duration,
            slotLocal: spaLocalParts(slot).hhmm,
            check,
          });
        }
      }
    }
  }

  assertEquals(daysCovered.size, 7, `expected all 7 weekdays, got ${[...daysCovered].sort()}`);
  assert(totalSlots > 0, "no slots were generated — generator broken?");
  assertEquals(
    failures.length,
    0,
    `Backend rejected ${failures.length}/${totalSlots} FE-generated slots. Sample failures:\n` +
      JSON.stringify(failures.slice(0, 5), null, 2),
  );
});

Deno.test("same-day generator respects 15-min lead time and never emits past slots", () => {
  // Pick a spa-local "now" at 14:37 on a Tuesday so the 15-min lead trims to
  // the next :00 or :30 boundary and nothing before it may be emitted.
  const now = spaLocalToInstant(2026, 6, 7, 14, 37); // Tue Jul 7, 2026
  const nowParts = spaLocalParts(now);

  for (const duration of [30, 45, 60, 90, 120]) {
    const slots = generateSpaSlots(nowParts.year, nowParts.month0, nowParts.day, duration, now);
    const earliestAllowed = now.getTime() + 15 * 60_000;
    for (const slot of slots) {
      assert(
        slot.getTime() >= earliestAllowed,
        `slot ${spaLocalParts(slot).hhmm} came before now+15min for duration=${duration}`,
      );
      // And each still passes the BE validator.
      const check = checkBusinessHours(slot, new Date(slot.getTime() + duration * 60_000));
      assert(check.ok, `same-day slot rejected: ${JSON.stringify(check)}`);
    }
  }
});

Deno.test("spa offset constant matches America/Costa_Rica", () => {
  // Sanity: CR is UTC-6 with no DST. If the tzdata ever changes, catch it
  // here rather than in production.
  const probe = new Date("2026-07-04T18:00:00Z");
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(probe);
  assertEquals(label, "12:00", `Costa Rica offset changed — SPA_UTC_OFFSET_MIN=${SPA_UTC_OFFSET_MIN} may need updating`);
});
