import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Static-analysis tests guarding the USD currency policy.
 *
 * Prices are stored in USD in the database (see the CRC → USD reversion
 * migration). Every UI/email that renders a total must go through the
 * shared `formatCRC` / `formatUsd` helpers so a raw dollar template
 * (`$${price}`) cannot silently ship the wrong value.
 */

const root = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const TOTAL_RENDERING_FILES = [
  "src/pages/Booking.tsx",
  "src/pages/ClassBooking.tsx",
  "src/pages/ExperienceBooking.tsx",
  "src/components/booking/PackageDetailView.tsx",
  "src/components/ServiceCard.tsx",
  "src/components/SpaPackagesSection.tsx",
  "src/components/OfferingsPurchaseSection.tsx",
  "src/components/WellnessSection.tsx",
];

describe("Currency usage in confirmation/total UIs", () => {
  for (const file of TOTAL_RENDERING_FILES) {
    describe(file, () => {
      const src = read(file);

      it("imports a currency formatter from @/lib/currency", () => {
        expect(src).toMatch(/from\s+["']@\/lib\/currency["']/);
        expect(src).toMatch(/\b(formatCRC|formatCRCWithUsd|formatUsd)\b/);
      });

      it("does not render raw `$${...price}` template totals", () => {
        const lines = src.split("\n");
        const offenders = lines
          .map((l, i) => ({ l, i: i + 1 }))
          .filter(({ l }) => /\$\$\{[^}]*(price|total|amount)[^}]*\}/i.test(l));

        expect(
          offenders,
          `Raw $ template price found:\n${offenders.map((o) => `  L${o.i}: ${o.l.trim()}`).join("\n")}`,
        ).toEqual([]);
      });
    });
  }
});

describe("Booking notification email uses USD formatting", () => {
  const src = read("supabase/functions/send-booking-notification/index.ts");

  it("defines a USD formatter", () => {
    expect(src).toMatch(/formatCRC\s*=/);
    // Must render dollars, not colones. The `₡` glyph is a currency-drift
    // guard: reject any resurrection of the CRC branch.
    expect(src).not.toMatch(/₡/);
  });

  it("renders total via formatCRC, not raw template", () => {
    expect(src).toMatch(/formatCRC\(/);
  });

  it("does not divide by 530 or reference a CRC exchange rate", () => {
    expect(src).not.toMatch(/USD_RATE\s*=\s*530/);
    expect(src).not.toMatch(/\/\s*530\b/);
  });

  it("does not render totals via raw `$${...total...}` template", () => {
    const offenders = src
      .split("\n")
      .map((l, i) => ({ l, i: i + 1 }))
      .filter(({ l }) => /\$\$\{[^}]*total[^}]*\}/i.test(l));
    expect(offenders).toEqual([]);
  });
});

describe("No lingering Colones exchange-rate math", () => {
  const filesToScan = [
    "src/lib/currency.ts",
    "src/pages/PrivateClasses.tsx",
    "supabase/functions/paypal-create-order/index.ts",
    "supabase/functions/send-booking-notification/index.ts",
    "src/components/booking/ContactToPayNotice.tsx",
  ];

  for (const file of filesToScan) {
    it(`${file} does not divide or multiply by 530`, () => {
      const src = read(file);
      // Allow the number 530 to appear only in comments (e.g. historical
      // context). Reject actual arithmetic like `/ 530` or `* 530`.
      expect(src).not.toMatch(/[/*]\s*530\b/);
    });
  }
});

/**
 * Regression guard: classes and PayPal code must stay USD-native.
 * These paths handle money at booking and capture time — any reintroduction
 * of CRC arithmetic, `/530`-style conversions, or the ₡ glyph would silently
 * charge customers the wrong amount. Scan every file under those paths.
 */
describe("Class + PayPal code must not reintroduce CRC arithmetic", () => {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");

  const roots = [
    "supabase/functions/paypal-create-order",
    "supabase/functions/paypal-capture-order",
    "src/pages/ClassBooking.tsx",
    "src/pages/Classes.tsx",
    "src/pages/ClassesCalendar.tsx",
    "src/pages/PrivateClasses.tsx",
    "src/hooks/useClasses.ts",
    "supabase/functions/create-booking/index.ts",
    "supabase/functions/finalize-booking/index.ts",
  ];

  const walk = (rel: string): string[] => {
    const abs = path.resolve(root, rel);
    let st;
    try { st = statSync(abs); } catch { return []; }
    if (st.isFile()) return [rel];
    return readdirSync(abs).flatMap((name) => {
      if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) return [];
      return walk(path.join(rel, name));
    });
  };

  const files = roots.flatMap(walk).filter((f) => /\.(ts|tsx)$/.test(f));

  // Sanity check — if globbing breaks, we should hear about it loudly instead
  // of the suite silently passing with zero assertions.
  it("discovers class + PayPal source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const FORBIDDEN: Array<{ name: string; re: RegExp }> = [
    { name: "arithmetic by 530 (e.g. `/ 530` or `* 530`)", re: /[/*]\s*530\b/ },
    { name: "USD_RATE = 530 assignment", re: /USD_RATE\s*=\s*530/ },
    { name: "colones symbol ₡", re: /₡/ },
    { name: "CRC currency_code literal", re: /currency_code["'\s:]+["']CRC["']/i },
    { name: "'CRC' string in a price/amount context", re: /(amount|price|total|currency)[^\n]{0,40}["']CRC["']/i },
    { name: "colones/colon word in code", re: /\b(colones|colón|colon)\b/i },
    { name: "crcToUsd() call (should be gone from money paths)", re: /\bcrcToUsd\s*\(/ },
  ];

  for (const file of files) {
    describe(file, () => {
      const src = read(file);
      for (const { name, re } of FORBIDDEN) {
        it(`does not contain: ${name}`, () => {
          const offenders = src
            .split("\n")
            .map((l, i) => ({ l, i: i + 1 }))
            // Ignore single-line `//` comments — historical notes are OK,
            // real arithmetic/strings in code are not.
            .filter(({ l }) => !/^\s*\/\//.test(l) && re.test(l));
          expect(
            offenders,
            `Forbidden pattern in ${file}:\n${offenders.map((o) => `  L${o.i}: ${o.l.trim()}`).join("\n")}`,
          ).toEqual([]);
        });
      }
    });
  }
});

describe("PayPal edge functions charge in USD only", () => {
  const paypalFiles = [
    "supabase/functions/paypal-create-order/index.ts",
    "supabase/functions/paypal-capture-order/index.ts",
  ];

  for (const file of paypalFiles) {
    it(`${file} uses currency_code "USD"`, () => {
      const src = read(file);
      // Either it references USD explicitly, or it doesn't build an amount
      // payload at all (capture side just reads the created order).
      const buildsAmount = /currency_code/.test(src);
      if (buildsAmount) {
        expect(src).toMatch(/currency_code["'\s:]+["']USD["']/);
      }
      expect(src).not.toMatch(/["']CRC["']/);
    });
  }
});

