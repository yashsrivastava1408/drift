import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/parsers/csv";
import { parseAmount, parseDate } from "@/lib/parsers/dates";
import { categorize } from "@/lib/categorize";
import { csvSafe } from "@/lib/format";
import { cleanText } from "@/lib/sanitize";
import { fingerprintAll } from "@/lib/fingerprint";

describe("parseDate", () => {
  it("reads common Indian formats", () => {
    expect(parseDate("12/10/2025")).toBe("2025-10-12");
    expect(parseDate("12-10-25")).toBe("2025-10-12");
    expect(parseDate("12 Oct 2025")).toBe("2025-10-12");
    expect(parseDate("12-Oct-25")).toBe("2025-10-12");
    expect(parseDate("Oct 12, 2025")).toBe("2025-10-12");
    expect(parseDate("2025-10-12")).toBe("2025-10-12");
  });
  it("rejects nonsense", () => {
    expect(parseDate("31/02/2025")).toBeNull();
    expect(parseDate("hello")).toBeNull();
  });
});

describe("parseAmount", () => {
  it("handles symbols and commas", () => {
    expect(parseAmount("Rs. 1,234.50")?.value).toBe(1234.5);
    expect(parseAmount("250 Dr")?.hint).toBe("debit");
    expect(parseAmount("-80")?.negative).toBe(true);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("0")).toBeNull();
  });
});

describe("parseCsv", () => {
  it("reads a bank file with separate debit and credit columns and a preamble", () => {
    const csv = [
      "Account Statement",
      "Name,Someone",
      "Date,Narration,Withdrawal Amt.,Deposit Amt.,Balance",
      '12/10/25,UPI-SWIGGY-123,"1,250.00",,5000',
      "13/10/25,SALARY,,50000.00,55000",
      "bad,row,1,2,3",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ occurred_on: "2025-10-12", amount: 1250, type: "debit" });
    expect(r.rows[1]).toMatchObject({ amount: 50000, type: "credit" });
    expect(r.skipped).toBe(1);
  });
  it("reads a single amount column with a type column", () => {
    const r = parseCsv("Date,Description,Amount,Type\n2025-10-01,Uber,200,Debit\n2025-10-02,Refund,50,Credit");
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "credit"]);
  });
  it("explains a file it cannot read", () => {
    expect(parseCsv("a,b\n1,2").error).toBeTruthy();
  });
});

describe("categorize", () => {
  const rules = [
    { id: "1", keyword: "ola", category_id: "transport" },
    { id: "2", keyword: "swiggy", category_id: "food" },
    { id: "3", keyword: "swiggy instamart", category_id: "groceries" },
  ];
  it("matches whole word starts and prefers the longest keyword", () => {
    expect(categorize("UPI/OLA CABS/123", rules)).toBe("transport");
    expect(categorize("Paid to SWIGGY", rules)).toBe("food");
    expect(categorize("Paid to SWIGGY INSTAMART", rules)).toBe("groceries");
  });
  it("does not match the middle of a word", () => {
    expect(categorize("Coca COLA store", rules)).toBeNull();
  });
});

describe("safety helpers", () => {
  it("neutralises spreadsheet formulas", () => {
    expect(csvSafe("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvSafe('say "hi"')).toBe(`"say ""hi"""`);
  });
  it("strips control characters", () => {
    expect(cleanText("a\u0000b‮c  d")).toBe("a b c d");
  });
});

describe("fingerprintAll", () => {
  it("separates identical rows on the same day but is stable between runs", async () => {
    const row = { occurred_on: "2025-10-12", amount: 10, type: "debit" as const, description: "Tea" };
    const a = await fingerprintAll([row, row]);
    const b = await fingerprintAll([row, row]);
    expect(a[0]).not.toBe(a[1]);
    expect(a).toEqual(b);
  });
});
