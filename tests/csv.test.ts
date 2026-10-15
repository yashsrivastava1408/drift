import { describe, expect, it } from "vitest";
import { MAX_ROWS, parseCsv } from "@/lib/parsers/csv";

describe("parseCsv: separate debit and credit columns", () => {
  const head = "Date,Narration,Withdrawal Amt.,Deposit Amt.,Balance";

  it("reads debits and credits", () => {
    const r = parseCsv([head, '12/10/25,UPI-SWIGGY-1,"1,250.00",,5000', "13/10/25,SALARY,,50000.00,55000"].join("\n"));
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([
      { occurred_on: "2025-10-12", amount: 1250, type: "debit", description: "UPI-SWIGGY-1" },
      { occurred_on: "2025-10-13", amount: 50000, type: "credit", description: "SALARY" },
    ]);
  });

  it("skips bank account details above the header", () => {
    const csv = ["Account Statement", "Name,Someone", "Account No,12345", "", head, "01/10/25,TEA,20,,100"].join("\n");
    expect(parseCsv(csv).rows).toHaveLength(1);
  });

  it("counts unreadable rows as skipped", () => {
    const r = parseCsv([head, "bad,row,1,2,3", "01/10/25,TEA,20,,100", "Closing balance,,,,", ",,,,"].join("\n"));
    expect(r.rows).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it("skips rows with a date but no amount", () => {
    const r = parseCsv([head, "01/10/25,NOTHING,,,100"].join("\n"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });

  it("handles quoted descriptions with commas", () => {
    const r = parseCsv([head, '01/10/25,"UPI-AMAZON, PAY-9",499,,100'].join("\n"));
    expect(r.rows[0].description).toBe("UPI-AMAZON, PAY-9");
  });

  it("handles Windows line endings", () => {
    const r = parseCsv([head, "01/10/25,TEA,20,,100", "02/10/25,COFFEE,40,,60"].join("\r\n"));
    expect(r.rows).toHaveLength(2);
  });

  it("handles a byte order mark at the start", () => {
    expect(parseCsv("﻿" + [head, "01/10/25,TEA,20,,100"].join("\n")).rows).toHaveLength(1);
  });

  it("ignores blank lines", () => {
    expect(parseCsv([head, "", "01/10/25,TEA,20,,100", "", "", "02/10/25,COFFEE,40,,60", ""].join("\n")).rows).toHaveLength(2);
  });

  it("falls back to a generic description", () => {
    const r = parseCsv([head, "01/10/25,,20,,100"].join("\n"));
    expect(r.rows[0].description).toBe("Transaction");
  });

  it("prefers debit when both columns hold a value", () => {
    const r = parseCsv([head, "01/10/25,ODD,30,40,100"].join("\n"));
    expect(r.rows[0].type).toBe("debit");
    expect(r.rows[0].amount).toBe(30);
  });
});

describe("parseCsv: header name variations", () => {
  it.each([
    ["Txn Date,Description,Debit,Credit"],
    ["Transaction Date,Particulars,Dr,Cr"],
    ["Value Date,Remarks,Withdrawal,Deposit"],
    ["Date,Transaction Details,Debit Amount,Credit Amount"],
    ["DATE,NARRATION,WITHDRAWAL AMT.,DEPOSIT AMT."],
    ["date,details,paid out,paid in"],
  ])("accepts %s", (head) => {
    const r = parseCsv([head, "01/10/25,TEA,20,", "02/10/25,PAY,,500"].join("\n"));
    expect(r.error).toBeUndefined();
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "credit"]);
    expect(r.rows.map((x) => x.amount)).toEqual([20, 500]);
  });
});

describe("parseCsv: single amount column", () => {
  it("uses a type column", () => {
    const r = parseCsv("Date,Description,Amount,Type\n2025-10-01,Uber,200,Debit\n2025-10-02,Refund,50,Credit");
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "credit"]);
  });

  it.each([
    ["Dr", "debit"],
    ["DR", "debit"],
    ["Debit", "debit"],
    ["Withdrawal", "debit"],
    ["Cr", "credit"],
    ["CR", "credit"],
    ["Credit", "credit"],
    ["Deposit", "credit"],
  ])("type %s means %s", (t, expected) => {
    const r = parseCsv(`Date,Description,Amount,Type\n01/10/2025,X,100,${t}`);
    expect(r.rows[0].type).toBe(expected);
  });

  it("reads Dr and Cr written after the amount", () => {
    const r = parseCsv("Date,Description,Amount\n01/10/2025,A,100 Dr\n02/10/2025,B,200 Cr");
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "credit"]);
  });

  it("treats negative amounts as money out", () => {
    const r = parseCsv("Date,Description,Amount\n01/10/2025,A,-100\n02/10/2025,B,(50)");
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "debit"]);
    expect(r.rows.map((x) => x.amount)).toEqual([100, 50]);
  });

  it("treats a plain positive amount with no type as an expense", () => {
    const r = parseCsv("Date,Description,Amount\n01/10/2025,A,100");
    expect(r.rows[0].type).toBe("debit");
  });

  it("handles currency symbols and commas", () => {
    const r = parseCsv('Date,Description,Amount\n01/10/2025,A,"₹1,250.50"');
    expect(r.rows[0].amount).toBe(1250.5);
  });
});

describe("parseCsv: errors", () => {
  it("rejects an empty file", () => {
    expect(parseCsv("").error).toBeTruthy();
  });
  it("rejects a header only file", () => {
    expect(parseCsv("Date,Narration,Debit,Credit").error).toBeTruthy();
  });
  it("explains a file with no date column", () => {
    const r = parseCsv("Name,Amount\nBob,10\nAnn,20");
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/Date/);
  });
  it("explains a file with no amount column", () => {
    const r = parseCsv("Date,Name\n01/10/2025,Bob\n02/10/2025,Ann");
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });
  it("reports when no row is valid", () => {
    const r = parseCsv("Date,Description,Debit\nnot a date,X,10\nalso bad,Y,20");
    expect(r.rows).toHaveLength(0);
    expect(r.skipped).toBe(2);
    expect(r.error).toBeTruthy();
  });
});

describe("parseCsv: safety", () => {
  it("cleans control characters out of descriptions", () => {
    const r = parseCsv("Date,Description,Debit\n01/10/2025,\"A\u0000B‮C\",10");
    expect(r.rows[0].description).toBe("A B C");
  });

  it("limits description length to 200", () => {
    const r = parseCsv(`Date,Description,Debit\n01/10/2025,${"x".repeat(500)},10`);
    expect(r.rows[0].description).toHaveLength(200);
  });

  it("keeps formula-looking text as plain text", () => {
    const r = parseCsv("Date,Description,Debit\n01/10/2025,=HYPERLINK(\"http://evil\"),10");
    expect(r.rows[0].description.startsWith("=")).toBe(true);
  });

  it("stops at the row limit and says so", () => {
    const lines = ["Date,Description,Debit"];
    for (let i = 0; i < MAX_ROWS + 50; i++) lines.push("01/10/2025,ITEM,1");
    const r = parseCsv(lines.join("\n"));
    expect(r.rows).toHaveLength(MAX_ROWS);
    expect(r.error).toMatch(String(MAX_ROWS));
  });

  it("never throws on odd input", () => {
    for (const junk of ['"unterminated', "\u0000\u0001\u0002", ",,,,,\n,,,,,", "Date\n", "a,b,c\n1", "{}", "[1,2,3]"]) {
      expect(() => parseCsv(junk)).not.toThrow();
    }
  });
});

describe("parseCsv: realistic bank layouts", () => {
  it("reads an HDFC style statement", () => {
    const csv = [
      "Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance",
      "01/10/25,UPI-ZOMATO-ZOMATO@HDFC-123,0000123,01/10/25,450.00,,24550.00",
      "02/10/25,NEFT CR-ACME CORP-SALARY,N123,02/10/25,,60000.00,84550.00",
      "03/10/25,UPI-UBER INDIA-UBER@AXIS-456,0000456,03/10/25,312.50,,84237.50",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[2]).toMatchObject({ occurred_on: "2025-10-03", amount: 312.5, type: "debit" });
  });

  it("reads an SBI style statement", () => {
    const csv = [
      "Txn Date,Value Date,Description,Ref No./Cheque No.,Debit,Credit,Balance",
      "01 Oct 2025,01 Oct 2025,UPI/DR/123/SWIGGY,,280.00,,9720.00",
      "05 Oct 2025,05 Oct 2025,UPI/CR/456/FRIEND,,,1000.00,10720.00",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows.map((x) => [x.occurred_on, x.amount, x.type])).toEqual([
      ["2025-10-01", 280, "debit"],
      ["2025-10-05", 1000, "credit"],
    ]);
  });

  it("reads an ICICI style statement with a single amount and Cr/Dr", () => {
    const csv = [
      "Transaction Date,Transaction Remarks,Transaction Amount,Cr/Dr",
      "01-10-2025,UPI/AMAZON PAY/789,1299.00,DR",
      "02-10-2025,UPI/REFUND/AMAZON/790,1299.00,CR",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.rows.map((x) => x.type)).toEqual(["debit", "credit"]);
  });
});
