import { describe, expect, it } from "vitest";
import { parseAmount, parseDate } from "@/lib/parsers/dates";

describe("parseDate: numeric formats (day first)", () => {
  it.each([
    ["12/10/2025", "2025-10-12"],
    ["12-10-2025", "2025-10-12"],
    ["12.10.2025", "2025-10-12"],
    ["12/10/25", "2025-10-12"],
    ["12-10-25", "2025-10-12"],
    ["1/2/2025", "2025-02-01"],
    ["01/02/2025", "2025-02-01"],
    ["31/12/2025", "2025-12-31"],
    ["29/02/2024", "2024-02-29"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("reads day first, never month first", () => {
    expect(parseDate("03/04/2025")).toBe("2025-04-03");
    expect(parseDate("13/01/2025")).toBe("2025-01-13");
  });
});

describe("parseDate: year first", () => {
  it.each([
    ["2025-10-12", "2025-10-12"],
    ["2025/10/12", "2025-10-12"],
    ["2025.10.12", "2025-10-12"],
    ["2025-1-2", "2025-01-02"],
    ["2025-10-12 10:23:45", "2025-10-12"],
    ["2025-10-12T10:23:45", "2025-10-12"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });
});

describe("parseDate: month names", () => {
  it.each([
    ["12 Oct 2025", "2025-10-12"],
    ["12 October 2025", "2025-10-12"],
    ["12-Oct-2025", "2025-10-12"],
    ["12-Oct-25", "2025-10-12"],
    ["12/Oct/2025", "2025-10-12"],
    ["12 oct 2025", "2025-10-12"],
    ["12 OCT 2025", "2025-10-12"],
    ["5 Sep 2025", "2025-09-05"],
    ["5 Sept 2025", "2025-09-05"],
    ["Oct 12, 2025", "2025-10-12"],
    ["October 12, 2025", "2025-10-12"],
    ["Oct 12 2025", "2025-10-12"],
    ["Oct. 12, 2025", "2025-10-12"],
    ["Oct 1st, 2025", "2025-10-01"],
    ["Oct 2nd, 2025", "2025-10-02"],
    ["Oct 3rd, 2025", "2025-10-03"],
    ["Oct 12th, 2025", "2025-10-12"],
    ["Jan 31, 2025", "2025-01-31"],
    ["Dec 25, 2025", "2025-12-25"],
    ["12 Oct 2025 10:23 AM", "2025-10-12"],
  ])("%s -> %s", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("knows all twelve months", () => {
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    names.forEach((m, i) => {
      expect(parseDate(`10 ${m} 2025`)).toBe(`2025-${String(i + 1).padStart(2, "0")}-10`);
    });
  });
});

describe("parseDate: rejects bad input", () => {
  it.each([
    "", " ", "hello", "Date", "12", "12/10", "32/01/2025", "00/01/2025", "12/13/2025", "12/00/2025",
    "31/02/2025", "29/02/2025", "31/04/2025", "2025-02-30", "2025-13-01", "12 Foo 2025", "Foo 12, 2025",
    "1999-01-01", "12/10/1999", "2101-01-01", "₹250.00", "UPI-SWIGGY",
  ])("%j -> null", (input) => {
    expect(parseDate(input)).toBeNull();
  });

  it("allows leap days only in leap years", () => {
    expect(parseDate("29/02/2024")).toBe("2024-02-29");
    expect(parseDate("29/02/2025")).toBeNull();
    expect(parseDate("29/02/2100")).toBeNull();
  });

  it("trims and collapses whitespace", () => {
    expect(parseDate("   12/10/2025   ")).toBe("2025-10-12");
    expect(parseDate("12   Oct    2025")).toBe("2025-10-12");
  });

  it("treats two digit years as 20xx", () => {
    expect(parseDate("01/01/00")).toBe("2000-01-01");
    expect(parseDate("01/01/99")).toBe("2099-01-01");
  });
});

describe("parseAmount", () => {
  it.each([
    ["250", 250],
    ["250.00", 250],
    ["250.5", 250.5],
    ["1,234.50", 1234.5],
    ["1,23,456.78", 123456.78],
    ["Rs. 1,234.50", 1234.5],
    ["Rs 500", 500],
    ["INR 99.99", 99.99],
    ["₹250", 250],
    ["₹ 1,250.00", 1250],
    ["  75  ", 75],
    ["0.5", 0.5],
    [".75", 0.75],
    ["100000000", 100000000],
  ])("%s -> %s", (input, value) => {
    expect(parseAmount(input)?.value).toBe(value);
  });

  it("rounds to two decimals", () => {
    expect(parseAmount("10.126")?.value).toBe(10.13);
    expect(parseAmount("10.124")?.value).toBe(10.12);
  });

  it("reads Dr and Cr hints", () => {
    expect(parseAmount("250 Dr")?.hint).toBe("debit");
    expect(parseAmount("250 DR")?.hint).toBe("debit");
    expect(parseAmount("250 Dr.")?.hint).toBe("debit");
    expect(parseAmount("250 Cr")?.hint).toBe("credit");
    expect(parseAmount("250 CR.")?.hint).toBe("credit");
    expect(parseAmount("250")?.hint).toBeNull();
  });

  it("reads negative amounts", () => {
    expect(parseAmount("-80")?.negative).toBe(true);
    expect(parseAmount("-80")?.value).toBe(80);
    expect(parseAmount("(500.00)")?.negative).toBe(true);
    expect(parseAmount("(500.00)")?.value).toBe(500);
    expect(parseAmount("−80")?.negative).toBe(true);
    expect(parseAmount("80")?.negative).toBe(false);
  });

  it.each(["", "   ", "abc", "-", ".", "0", "0.00", "-0", "Rs.", "Dr", "N/A", "--"])("%j -> null", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});
