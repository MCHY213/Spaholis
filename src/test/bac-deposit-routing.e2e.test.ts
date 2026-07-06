/**
 * End-to-end BAC deposit routing test.
 *
 * For every treatment category that the public booking flow actually offers
 * (Massage Therapy, Organic Facials, Body Treatments, Holistic Therapy —
 * plus the Cosmolifting facial variant), this test simulates the redirect
 * decision the Booking page makes at the details step and asserts that the
 * customer would be sent to the correct BAC CompraClick deposit link:
 *
 *   - $10  →  Organic Facials & Cosmolifting
 *   - $20  →  Massage Therapy, Body Treatments, Holistic Therapy
 *
 * The routing is deliberately isolated in `@/lib/bacLinks` and consumed by
 * `src/pages/Booking.tsx`, so exercising the helpers here is equivalent to
 * exercising the redirect the customer actually experiences.
 */

import { describe, it, expect } from "vitest";
import {
  BAC_LINK_10,
  BAC_LINK_20,
  getBacCompraClickLink,
  getBacDepositAmount,
} from "@/lib/bacLinks";

type TreatmentFixture = {
  label: string;
  service: { title: string; category: string };
  expectedAmount: 10 | 20;
  expectedLink: string;
};

const TREATMENTS: TreatmentFixture[] = [
  {
    label: "Massage Therapy → $20 link",
    service: { title: "Swedish Massage", category: "Massage Therapy" },
    expectedAmount: 20,
    expectedLink: BAC_LINK_20,
  },
  {
    label: "Organic Facial → $10 link",
    service: { title: "Signature Organic Facial", category: "Organic Facials" },
    expectedAmount: 10,
    expectedLink: BAC_LINK_10,
  },
  {
    label: "Cosmolifting facial → $10 link",
    service: { title: "Cosmolifting", category: "Organic Facials" },
    expectedAmount: 10,
    expectedLink: BAC_LINK_10,
  },
  {
    label: "Body Treatment → $20 link",
    service: { title: "Detox Body Wrap", category: "Body Treatments" },
    expectedAmount: 20,
    expectedLink: BAC_LINK_20,
  },
  {
    label: "Holistic Therapy → $20 link",
    service: { title: "Reiki Session", category: "Holistic Therapy" },
    expectedAmount: 20,
    expectedLink: BAC_LINK_20,
  },
];

/**
 * Mirrors the redirect branch in `src/pages/Booking.tsx` (see comment "BAC
 * CompraClick deposit link that matches the service ($10 facials / $20
 * other)"). Given a booked service, returns the URL the browser would be
 * sent to and the deposit amount rendered in the summary sidebar.
 */
function simulateBookingRedirect(service: TreatmentFixture["service"]) {
  return {
    url: getBacCompraClickLink(service),
    amount: getBacDepositAmount(service),
  };
}

describe("E2E: BAC deposit link per treatment type", () => {
  it.each(TREATMENTS)(
    "$label",
    ({ service, expectedAmount, expectedLink }) => {
      const { url, amount } = simulateBookingRedirect(service);
      expect(amount).toBe(expectedAmount);
      expect(url).toBe(expectedLink);
      expect(url).toMatch(/^https:\/\/checkout\.baccredomatic\.com\//);
    },
  );

  it("only ever routes to the two whitelisted BAC links", () => {
    const urls = new Set(
      TREATMENTS.map((t) => getBacCompraClickLink(t.service)),
    );
    for (const url of urls) {
      expect([BAC_LINK_10, BAC_LINK_20]).toContain(url);
    }
  });

  it("categorises facials by title even when the category is generic", () => {
    // Defensive check for legacy rows whose category was never set.
    const legacyFacial = { title: "Anti-Aging Facial", category: "" };
    expect(getBacDepositAmount(legacyFacial)).toBe(10);
    expect(getBacCompraClickLink(legacyFacial)).toBe(BAC_LINK_10);
  });
});
