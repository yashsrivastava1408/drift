import { readFileSync } from "fs";
import { describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES, parseStatement } from "@/lib/parsers";

vi.mock("pdfjs-dist", async () => await import("pdfjs-dist/legacy/build/pdf.mjs"));

const csvFile = (text: string, name = "s.csv", type = "text/csv") => new File([text], name, { type });
const GOOD = "Date,Description,Debit\n01/10/2025,TEA,20";

describe("parseStatement: choosing a reader", () => {
  it("reads a .csv", async () => {
    const r = await parseStatement(csvFile(GOOD));
    expect(r.source).toBe("csv");
    expect(r.rows).toHaveLength(1);
  });
  it("reads a .CSV in capitals", async () => {
    expect((await parseStatement(csvFile(GOOD, "STATEMENT.CSV"))).rows).toHaveLength(1);
  });
  it("reads a .txt export", async () => {
    expect((await parseStatement(csvFile(GOOD, "export.txt", "text/plain"))).rows).toHaveLength(1);
  });
  it("accepts a csv with a blank file type", async () => {
    expect((await parseStatement(csvFile(GOOD, "x.csv", ""))).rows).toHaveLength(1);
  });
  it("reads a PDF", async () => {
    const f = new File([readFileSync(`${__dirname}/fixtures/plain.pdf`)], "s.pdf", { type: "application/pdf" });
    const r = await parseStatement(f);
    expect(r.source).toBe("pdf");
    expect(r.rows).toHaveLength(3);
  });
  it("reads a PDF with a blank file type", async () => {
    const f = new File([readFileSync(`${__dirname}/fixtures/plain.pdf`)], "s.pdf", { type: "" });
    expect((await parseStatement(f)).rows).toHaveLength(3);
  });
  it("passes the password to the PDF reader", async () => {
    const f = new File([readFileSync(`${__dirname}/fixtures/locked.pdf`)], "l.pdf", { type: "application/pdf" });
    expect((await parseStatement(f)).password).toBe("required");
    expect((await parseStatement(f, "bad")).password).toBe("wrong");
    expect((await parseStatement(f, "secret123")).rows).toHaveLength(3);
  });
});

describe("parseStatement: rejecting files", () => {
  it.each(["a.exe", "a.zip", "a.png", "a.xlsx", "a.docx", "a.html", "a.js", "noextension", "a.csv.exe"])("rejects %s", async (name) => {
    const r = await parseStatement(csvFile(GOOD, name, "application/octet-stream"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/csv or .pdf/i);
  });

  it("rejects a file named .pdf whose type says it is something else", async () => {
    const r = await parseStatement(new File(["MZ binary"], "evil.pdf", { type: "application/x-msdownload" }));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });

  it("rejects a file over the size limit before reading it", async () => {
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.csv", { type: "text/csv" });
    const r = await parseStatement(big);
    expect(r.rows).toHaveLength(0);
    expect(r.error).toMatch(/8 MB/);
  });

  it("accepts a file exactly at the limit", async () => {
    const f = new File([GOOD.padEnd(MAX_FILE_BYTES, " ")], "edge.csv", { type: "text/csv" });
    expect((await parseStatement(f)).rows).toHaveLength(1);
  });

  it("passes parse errors back", async () => {
    const r = await parseStatement(csvFile("nothing useful"));
    expect(r.rows).toHaveLength(0);
    expect(r.error).toBeTruthy();
  });
});
