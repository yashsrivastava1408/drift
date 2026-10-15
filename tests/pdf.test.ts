import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";
import { parsePdf } from "@/lib/parsers/pdf";

// Node needs PDF.js's legacy build; the browser uses the normal one.
vi.mock("pdfjs-dist", async () => await import("pdfjs-dist/legacy/build/pdf.mjs"));

const dir = `${__dirname}/fixtures`; // fake statements. locked.pdf uses "secret123", locked-bank.pdf uses "Dob#1990"
const load = (name: string) => new File([readFileSync(`${dir}/${name}`)], name, { type: "application/pdf" });

describe("parsePdf: UPI app layout", () => {
  it("reads date, type, amount and description", async () => {
    const r = await parsePdf(load("plain.pdf"));
    expect(r.error).toBeUndefined();
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ occurred_on: "2025-10-12", amount: 250, type: "debit" });
    expect(r.rows[0].description).toMatch(/SWIGGY/);
    expect(r.rows[1]).toMatchObject({ occurred_on: "2025-10-11", amount: 1500, type: "credit" });
    expect(r.rows[1].description).toMatch(/RAHUL SHARMA/);
    expect(r.rows[2]).toMatchObject({ amount: 312.5, type: "debit" });
  });

  it("keeps clock times and transaction IDs out of the description", async () => {
    const r = await parsePdf(load("plain.pdf"));
    for (const row of r.rows) {
      expect(row.description).not.toMatch(/\d{1,2}:\d{2}/);
      expect(row.description).not.toMatch(/T\d{10,}/);
      expect(row.description).not.toMatch(/INR/);
    }
  });

  it("does not report skipped rows for a clean file", async () => {
    expect((await parsePdf(load("plain.pdf"))).skipped).toBe(0);
  });
});

describe("parsePdf: bank layout", () => {
  it("reads dd-Mon-yyyy dates and Rs. amounts with lakh grouping", async () => {
    const r = await parsePdf(load("bank-style.pdf"));
    expect(r.error).toBeUndefined();
    expect(r.rows.map((x) => [x.occurred_on, x.amount, x.type])).toEqual([
      ["2025-10-12", 1250, "debit"],
      ["2025-10-13", 100000, "credit"],
      ["2025-10-14", 499, "debit"],
    ]);
  });

  it("does not take a long reference number for the amount", async () => {
    const r = await parsePdf(load("bank-style.pdf"));
    expect(r.rows.every((x) => x.amount < 1_000_000)).toBe(true);
  });
});

describe("parsePdf: bigger and messier files", () => {
  it("reads every row across several pages", async () => {
    const r = await parsePdf(load("multipage.pdf"));
    expect(r.rows).toHaveLength(40);
    expect(r.rows[0].amount).toBe(10);
    expect(r.rows[39].amount).toBe(49);
  });

  it("ignores header and footer text on each page", async () => {
    const r = await parsePdf(load("multipage.pdf"));
    expect(r.rows.some((x) => /footer|header/i.test(x.description))).toBe(false);
  });

  it("skips lines that are not transactions", async () => {
    const r = await parsePdf(load("noisy.pdf"));
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ occurred_on: "2025-10-12", amount: 120, type: "debit" });
    expect(r.rows[1]).toMatchObject({ occurred_on: "2025-10-13", amount: 300, type: "credit" });
  });

  it("keeps stray text lines out of the description of a neighbour", async () => {
    const r = await parsePdf(load("noisy.pdf"));
    expect(r.rows[0].description).toMatch(/CAFE/);
  });
});

describe("parsePdf: files it cannot read", () => {
  it("explains a scanned PDF with no text", async () => {
    const r = await parsePdf(load("scanned.pdf"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/no readable text|scanned/i);
    expect(r.password).toBeUndefined();
  });

  it("explains a PDF with text but no transactions", async () => {
    const r = await parsePdf(load("no-transactions.pdf"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });

  it("explains a file that is not really a PDF", async () => {
    const r = await parsePdf(load("garbage.pdf"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/Could not read/);
    expect(r.password).toBeUndefined();
  });

  it("never throws", async () => {
    await expect(parsePdf(new File([new Uint8Array(0)], "empty.pdf"))).resolves.toBeTruthy();
    await expect(parsePdf(new File([new Uint8Array([1, 2, 3])], "x.pdf"))).resolves.toBeTruthy();
  });
});

describe("parsePdf: locked files", () => {
  it("asks for a password when none is given", async () => {
    const r = await parsePdf(load("locked.pdf"));
    expect(r.password).toBe("required");
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/locked/i);
  });

  it("rejects a wrong password", async () => {
    const r = await parsePdf(load("locked.pdf"), "nope");
    expect(r.password).toBe("wrong");
    expect(r.rows).toHaveLength(0);
  });

  it("treats an empty password as not given", async () => {
    const r = await parsePdf(load("locked.pdf"), "");
    expect(r.password).toBe("required");
  });

  it("opens with the right password", async () => {
    const r = await parsePdf(load("locked.pdf"), "secret123");
    expect(r.password).toBeUndefined();
    expect(r.rows).toHaveLength(3);
    expect(r.rows[2]).toMatchObject({ amount: 312.5, type: "debit" });
  });

  it("is case sensitive about the password", async () => {
    expect((await parsePdf(load("locked.pdf"), "SECRET123")).password).toBe("wrong");
    expect((await parsePdf(load("locked.pdf"), "Secret123")).password).toBe("wrong");
  });

  it("does not trim the password", async () => {
    expect((await parsePdf(load("locked.pdf"), " secret123")).password).toBe("wrong");
  });

  it("handles passwords with symbols", async () => {
    const r = await parsePdf(load("locked-bank.pdf"), "Dob#1990");
    expect(r.password).toBeUndefined();
    expect(r.rows).toHaveLength(3);
    expect(r.rows[1].amount).toBe(100000);
  });

  it("can be tried again after a wrong guess", async () => {
    const f = load("locked.pdf");
    expect((await parsePdf(f, "bad")).password).toBe("wrong");
    expect((await parsePdf(f, "secret123")).rows).toHaveLength(3);
  });

  it("does not leak the password into the result", async () => {
    const r = await parsePdf(load("locked.pdf"), "secret123");
    expect(JSON.stringify(r)).not.toContain("secret123");
  });
});
