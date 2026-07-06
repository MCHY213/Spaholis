import { describe, it, expect } from "vitest";
import { formatCRC, crcToUsd, formatUsdRef, USD_RATE, formatUsd } from "@/lib/currency";

/**
 * Currency policy is USD end-to-end. The `CRC` / `USD_RATE` names are kept
 * for backwards compatibility but must behave as pure USD helpers — no
 * multiplication or division by an exchange rate.
 */
describe("currency utilities (USD)", () => {
  describe("formatCRC", () => {
    it("formats a USD amount with $ symbol", () => {
      expect(formatCRC(45)).toBe("$45");
    });

    it("rounds to the nearest whole dollar for compact display", () => {
      expect(formatCRC(45.7)).toBe("$46");
    });

    it("handles null/undefined as $0", () => {
      expect(formatCRC(null)).toBe("$0");
      expect(formatCRC(undefined)).toBe("$0");
    });

    it("handles string numeric input", () => {
      expect(formatCRC("125")).toBe("$125");
    });

    it("returns $0 for non-finite values", () => {
      expect(formatCRC("not-a-number")).toBe("$0");
    });
  });

  describe("formatUsd", () => {
    it("formats with two decimals for checkout totals", () => {
      expect(formatUsd(23)).toBe("$23.00");
      expect(formatUsd(23.5)).toBe("$23.50");
    });
  });

  describe("crcToUsd (deprecated identity)", () => {
    it("returns the input unchanged (values are already USD)", () => {
      expect(crcToUsd(23)).toBe(23);
      expect(crcToUsd(100)).toBe(100);
    });

    it("returns 0 for invalid or non-positive amounts", () => {
      expect(crcToUsd(0)).toBe(0);
      expect(crcToUsd(null)).toBe(0);
      expect(crcToUsd(-100)).toBe(0);
    });
  });

  describe("formatUsdRef (deprecated)", () => {
    it("returns empty — no CRC ↔ USD hint is rendered anymore", () => {
      expect(formatUsdRef(23)).toBe("");
    });
  });

  describe("USD_RATE (deprecated)", () => {
    it("is 1 so leftover multiplications become no-ops", () => {
      expect(USD_RATE).toBe(1);
    });
  });
});
