import { describe, expect, it } from "vitest";
import { csvSafe, formatDate, money, moneyExact, monthKey, monthLabel, shortMonth, toISO } from "@/lib/format";

describe("money", () => {
  it("formats rupees with Indian grouping", () => {
    expect(money(0)).toBe("₹0");
    expect(money(250)).toBe("₹250");
    expect(money(1234)).toBe("₹1,234");
    expect(money(123456)).toBe("₹1,23,456");
    expect(money(12345678)).toBe("₹1,23,45,678");
  });
  it("rounds to whole rupees", () => {
    expect(money(249.6)).toBe("₹250");
    expect(money(249.4)).toBe("₹249");
  });
  it("handles negatives", () => {
    expect(money(-500)).toContain("500");
    expect(money(-500)).toMatch(/-/);
  });
  it("shows paise in the exact form", () => {
    expect(moneyExact(250)).toBe("₹250.00");
    expect(moneyExact(1234.5)).toBe("₹1,234.50");
    expect(moneyExact(0.05)).toBe("₹0.05");
  });
});

describe("dates", () => {
  it("toISO pads month and day", () => {
    expect(toISO(new Date(2025, 0, 5))).toBe("2025-01-05");
    expect(toISO(new Date(2025, 11, 31))).toBe("2025-12-31");
  });
  it("monthKey takes the year and month", () => {
    expect(monthKey("2025-10-12")).toBe("2025-10");
    expect(monthKey("2025-01-01")).toBe("2025-01");
  });
  it("formatDate reads like 12 Oct 2025", () => {
    expect(formatDate("2025-10-12")).toMatch(/12/);
    expect(formatDate("2025-10-12")).toMatch(/Oct/);
    expect(formatDate("2025-10-12")).toMatch(/2025/);
  });
  it("formatDate does not slip a day with time zones", () => {
    expect(formatDate("2025-03-01")).toMatch(/^1 Mar/);
    expect(formatDate("2025-12-31")).toMatch(/^31 Dec/);
    expect(formatDate("2025-01-01")).toMatch(/^1 Jan/);
  });
  it("monthLabel and shortMonth", () => {
    expect(monthLabel("2025-10")).toMatch(/October/);
    expect(monthLabel("2025-10")).toMatch(/2025/);
    expect(shortMonth("2025-10")).toBe("Oct");
    expect(shortMonth("2025-01")).toBe("Jan");
    expect(shortMonth("2025-12")).toBe("Dec");
  });
});

describe("csvSafe", () => {
  it("wraps every value in quotes", () => {
    expect(csvSafe("hello")).toBe('"hello"');
    expect(csvSafe("")).toBe('""');
  });
  it("doubles quotes inside", () => {
    expect(csvSafe('say "hi"')).toBe('"say ""hi"""');
  });
  it("keeps commas and newlines inside the quotes", () => {
    expect(csvSafe("a,b")).toBe('"a,b"');
    expect(csvSafe("a\nb")).toBe('"a\nb"');
  });
  it.each(["=SUM(A1)", "+1+1", "-1+1", "@SUM(A1)", "\t=1", "\r=1", "=HYPERLINK(\"http://x\")", "=cmd|' /C calc'!A0"])(
    "neutralises the formula %j",
    (input) => {
      expect(csvSafe(input).startsWith(`"'`)).toBe(true);
    },
  );
  it("leaves normal text alone", () => {
    expect(csvSafe("Swiggy order")).toBe('"Swiggy order"');
    expect(csvSafe("250.00")).toBe('"250.00"');
    expect(csvSafe("a=b")).toBe('"a=b"');
  });
});
