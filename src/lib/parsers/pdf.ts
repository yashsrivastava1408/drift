import { cleanText } from "../sanitize";
import type { ParsedTxn, ParseResult } from "../types";
import { parseDate } from "./dates";
import { MAX_ROWS } from "./csv";

const DATE_START =
  /^((?:[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(?:\d{1,2}[\s\-/.][A-Za-z]{3,9}[\s\-/.,]*\d{2,4})|(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(?:\d{4}-\d{2}-\d{2}))/;

/** Pulls the text out of a PDF page by page, keeping each visual line together. */
async function extractLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= Math.min(doc.numPages, 200); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      const list = byY.get(y) ?? [];
      list.push({ x: item.transform[4], str: item.str });
      byY.set(y, list);
    }
    [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, items]) => {
        lines.push(items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim());
      });
  }
  return lines;
}

function blockToTxn(block: string[]): ParsedTxn | null {
  const joined = block.join(" ").replace(/\s+/g, " ");
  const dm = joined.match(DATE_START);
  if (!dm) return null;
  const date = parseDate(dm[1]);
  if (!date) return null;
  let rest = joined.slice(dm[0].length);

  // Remove clock times such as "10:23 am".
  rest = rest.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?\b/gi, " ");

  const typeMatch = rest.match(/\b(DEBIT|CREDIT)\b/i);
  const paid = /\bpaid to\b|\bsent to\b|\bbill paid\b|\brecharge\b/i.test(rest);
  const received = /\breceived from\b|\brefund\b|\bcashback\b/i.test(rest);
  let type: "debit" | "credit" | null = null;
  if (typeMatch) type = typeMatch[1].toLowerCase() as "debit" | "credit";
  else if (paid) type = "debit";
  else if (received) type = "credit";
  if (!type) return null;

  // The amount is the money figure with a currency mark; fall back to the last number with decimals.
  const money = [...rest.matchAll(/(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/gi)];
  let amountText = money.length ? money[money.length - 1][1] : null;
  if (!amountText) {
    const nums = [...rest.matchAll(/\b(\d{1,3}(?:,\d{2,3})*\.\d{2})\b/g)];
    amountText = nums.length ? nums[nums.length - 1][1] : null;
  }
  if (!amountText) return null;
  const amount = Math.round(Number(amountText.replace(/,/g, "")) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const desc = rest
    .replace(/(?:INR|Rs\.?|₹)\s*[\d,]+(?:\.\d{1,2})?/gi, " ")
    .replace(/\b(DEBIT|CREDIT)\b/gi, " ")
    .replace(/\b(Transaction ID|UTR No|Paid by|Credited to|Debited from)\b[^A-Za-z]*\S*/gi, " ")
    .replace(/\bT\d{10,}\b/g, " ")
    .replace(/\b\d{9,}\b/g, " ");

  const description = cleanText(desc) || "Transaction";
  return { occurred_on: date, amount, type, description };
}

/**
 * Best-effort reader for UPI app statements (PhonePe style). Every transaction starts with a date,
 * so the text is cut into blocks at each date and each block is read on its own.
 * The import screen shows a preview so wrong rows can be removed before saving.
 */
export async function parsePdf(file: File): Promise<ParseResult> {
  let lines: string[];
  try {
    lines = await extractLines(file);
  } catch {
    return { rows: [], skipped: 0, error: "Could not read this PDF. If it has a password, remove it first." };
  }
  if (lines.join("").trim().length < 20) {
    return { rows: [], skipped: 0, error: "This PDF has no readable text (it may be a scanned image). Try the CSV from your bank instead." };
  }

  const blocks: string[][] = [];
  for (const line of lines) {
    if (DATE_START.test(line) && parseDate(line.match(DATE_START)![1])) blocks.push([line]);
    else if (blocks.length) blocks[blocks.length - 1].push(line);
  }

  const rows: ParsedTxn[] = [];
  let skipped = 0;
  for (const b of blocks) {
    if (rows.length >= MAX_ROWS) break;
    const t = blockToTxn(b);
    if (t) rows.push(t);
    else skipped++;
  }

  if (rows.length === 0) {
    return { rows: [], skipped, error: "No transactions could be read from this PDF. Try the CSV from your bank instead." };
  }
  return { rows, skipped };
}
