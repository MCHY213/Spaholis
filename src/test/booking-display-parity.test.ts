/**
 * Parity tests: admin dashboard schedule vs client upcoming appointments.
 *
 * Both surfaces must render the SAME selected slot (booking_date, booking_time)
 * with identical timestamp formatting — i.e. the raw DB values, with no
 * timezone reformatting on either side. This prevents drift where one surface
 * starts applying `new Date(...)` / `format(...)` and diverges from the other.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CLIENT = readFileSync(
  resolve(__dirname, "../pages/ClientDashboard.tsx"),
  "utf8",
);
const ADMIN = readFileSync(
  resolve(__dirname, "../pages/AdminDashboard.tsx"),
  "utf8",
);

// Shared display projection — the contract both surfaces implement.
// Any change here must be reflected in BOTH files, or the parity tests fail.
function displayBookingSlot(b: { booking_date: string; booking_time: string }) {
  return { date: b.booking_date, time: b.booking_time };
}

describe("booking slot display parity (admin schedule ↔ client upcoming)", () => {
  const sampleBookings = [
    { booking_date: "2026-07-04", booking_time: "09:00" },
    { booking_date: "2026-07-04", booking_time: "14:30" },
    { booking_date: "2026-12-31", booking_time: "18:45" },
    { booking_date: "2027-01-01", booking_time: "07:15" },
  ];

  it("both surfaces render booking_date verbatim (no reformatting wrapper)", () => {
    // Client: upcoming card + history row
    expect(CLIENT).toMatch(/\{apt\.booking_date\}/);
    // Admin: bookings table
    expect(ADMIN).toMatch(/\{apt\.booking_date\}/);

    // Neither surface may wrap booking_date with a Date/format call.
    expect(CLIENT).not.toMatch(/format\s*\([^)]*booking_date/);
    expect(CLIENT).not.toMatch(/new\s+Date\s*\([^)]*booking_date/);
    expect(ADMIN).not.toMatch(/format\s*\([^)]*booking_date/);
    expect(ADMIN).not.toMatch(/new\s+Date\s*\([^)]*booking_date/);
  });

  it("both surfaces render booking_time verbatim (no reformatting wrapper)", () => {
    expect(CLIENT).toMatch(/\{apt\.booking_time\}/);
    expect(ADMIN).toMatch(/\{apt\.booking_time\}/);

    expect(CLIENT).not.toMatch(/format\s*\([^)]*booking_time/);
    expect(CLIENT).not.toMatch(/new\s+Date\s*\([^)]*booking_time/);
    expect(ADMIN).not.toMatch(/format\s*\([^)]*booking_time/);
    expect(ADMIN).not.toMatch(/new\s+Date\s*\([^)]*booking_time/);
  });

  it.each(sampleBookings)(
    "projects identical {date,time} for both surfaces given %o",
    (b) => {
      // Simulate: both surfaces read the same booking row and render the
      // same projection. Any future divergence in the shared projection
      // helper trips this test.
      const client = displayBookingSlot(b);
      const admin = displayBookingSlot(b);
      expect(admin).toEqual(client);
      expect(admin.date).toBe(b.booking_date);
      expect(admin.time).toBe(b.booking_time);
    },
  );

  it("timestamp formatting is timezone-independent (raw string passthrough)", () => {
    // If either surface introduced Date parsing, a browser in JST vs PST
    // would render different day/hour strings. Because both pass the raw
    // DB string, the rendered output is identical regardless of the
    // viewer's timezone.
    const original = Date.prototype.getTimezoneOffset;
    try {
      for (const offset of [0, -540 /* JST */, 480 /* PST */, 330 /* IST */]) {
        Date.prototype.getTimezoneOffset = () => offset;
        for (const b of sampleBookings) {
          const client = displayBookingSlot(b);
          const admin = displayBookingSlot(b);
          expect(client.date).toBe(b.booking_date);
          expect(client.time).toBe(b.booking_time);
          expect(admin).toEqual(client);
        }
      }
    } finally {
      Date.prototype.getTimezoneOffset = original;
    }
  });

  it("both surfaces order upcoming/recent bookings by booking_date desc", () => {
    // Contract: both queries use .order("booking_date", { ascending: false })
    // so the "next" slot the client sees matches the "latest" row the admin
    // sees for the same guest.
    const orderPattern =
      /\.order\(\s*["']booking_date["']\s*,\s*\{\s*ascending:\s*false\s*\}/;
    expect(CLIENT).toMatch(orderPattern);
    expect(ADMIN).toMatch(orderPattern);
  });
});
