import { describe, expect, it } from "vitest";
import { cleanText } from "@/lib/sanitize";

describe("cleanText", () => {
  it("leaves normal text alone", () => {
    expect(cleanText("Swiggy order 123")).toBe("Swiggy order 123");
    expect(cleanText("Café ₹250")).toBe("Café ₹250");
  });
  it("trims and collapses spaces", () => {
    expect(cleanText("   a    b   ")).toBe("a b");
    expect(cleanText("a\t\tb\n\nc")).toBe("a b c");
  });
  it("removes control characters", () => {
    expect(cleanText("a\u0000b")).toBe("a b");
    expect(cleanText("a\u001fb")).toBe("a b");
    expect(cleanText("a\u007fb")).toBe("a b");
    expect(cleanText("a\u0085b")).toBe("a b");
  });
  it("removes text direction tricks", () => {
    expect(cleanText("abc‮def")).toBe("abc def");
    expect(cleanText("abc⁦def⁩")).toBe("abc def");
    expect(cleanText("abc​def")).toBe("abc def");
  });
  it("limits the length", () => {
    expect(cleanText("x".repeat(500))).toHaveLength(200);
    expect(cleanText("x".repeat(500), 10)).toHaveLength(10);
    expect(cleanText("abc", 0)).toBe("");
  });
  it("trims after cutting", () => {
    expect(cleanText("abcd   efgh", 5)).toBe("abcd");
    expect(cleanText("abcd   efgh", 7)).toBe("abcd ef");
  });
  it("returns an empty string for blank input", () => {
    expect(cleanText("")).toBe("");
    expect(cleanText("   \n\t ")).toBe("");
  });
  it("keeps HTML as plain text, since React escapes it on display", () => {
    expect(cleanText("<script>alert(1)</script>")).toBe("<script>alert(1)</script>");
  });
});
