import { describe, it, expect } from "vitest";
import { pickLocalized, pickLocalizedJson } from "@/lib/i18n-field";
import { stripLangPrefix, withLangPrefix } from "@/i18n/LanguageProvider";

describe("pickLocalized", () => {
  const row = { title: "Yoga Class", title_es: "Clase de Yoga", description: "Hello", description_es: "" };

  it("returns Spanish field when present", () => {
    expect(pickLocalized(row, "title", "es")).toBe("Clase de Yoga");
  });

  it("falls back to English when Spanish is empty", () => {
    expect(pickLocalized(row, "description", "es")).toBe("Hello");
  });

  it("falls back to English when Spanish is missing", () => {
    expect(pickLocalized({ title: "Only EN" }, "title", "es")).toBe("Only EN");
  });

  it("returns English when language is en", () => {
    expect(pickLocalized(row, "title", "en")).toBe("Yoga Class");
  });

  it("returns empty string for null row", () => {
    expect(pickLocalized(null, "title", "es")).toBe("");
  });

  it("never throws on unexpected types", () => {
    expect(pickLocalized({ title: 123 } as never, "title", "es")).toBe("");
  });
});

describe("pickLocalizedJson", () => {
  it("prefers Spanish array when non-empty", () => {
    const row = { items: ["a"], items_es: ["b", "c"] };
    expect(pickLocalizedJson(row, "items", "es")).toEqual(["b", "c"]);
  });

  it("falls back to English when Spanish array is empty", () => {
    const row = { items: ["a"], items_es: [] };
    expect(pickLocalizedJson(row, "items", "es")).toEqual(["a"]);
  });
});

describe("URL language prefix helpers", () => {
  it("strips /es prefix", () => {
    expect(stripLangPrefix("/es/book")).toBe("/book");
    expect(stripLangPrefix("/es")).toBe("/");
    expect(stripLangPrefix("/book")).toBe("/book");
  });

  it("adds /es prefix for Spanish", () => {
    expect(withLangPrefix("/book", "es")).toBe("/es/book");
    expect(withLangPrefix("/", "es")).toBe("/es");
    expect(withLangPrefix("/es/book", "es")).toBe("/es/book"); // idempotent
  });

  it("strips prefix for English", () => {
    expect(withLangPrefix("/es/book", "en")).toBe("/book");
    expect(withLangPrefix("/book", "en")).toBe("/book");
  });
});
