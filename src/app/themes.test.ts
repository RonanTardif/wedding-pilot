import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseTheme } from "./themes";

describe("parseTheme", () => {
  it("accepts known themes", () => {
    expect(parseTheme("halloween")).toBe("halloween");
    expect(parseTheme("standard")).toBe("standard");
  });

  it("falls back to the default theme", () => {
    expect(parseTheme("nope")).toBe(DEFAULT_THEME);
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
  });
});
