import Papa from "papaparse";
import { cleanText } from "../sanitize";
import type { ParsedTxn, ParseResult } from "../types";
import { parseAmount, parseDate } from "./dates";

export const MAX_ROWS = 5000;

const HEADER_WORDS = {
  date: ["date", "txn date", "transaction date", "value date", "posting date", "tran date"],
  desc: ["narration", "description", "particulars", "details", "remarks", "transaction details", "transaction remarks"],
  debit: ["debit", "withdrawal", "withdrawal amt", "withdrawal amount", "dr", "debit amount", "paid out"],
  credit: ["credit", "deposit", "deposit amt", "deposit amount", "cr", "credit amount", "paid in"],
  amount: ["amount", "transaction amount", "txn amount"],
  type: ["type", "dr/cr", "cr/dr", "transaction type", "debit/credit"],
};

const norm = (s: string) => s.toLowerCase().replace(/[().*_]/g, " ").replace(/\s+/g, " ").trim();

function findCol(header: string[], words: string[]): number {
  const h = header.map(norm);
  for (const w of words) {
    const exact = h.indexOf(w);
    if (exact !== -1) return exact;
  }
  for (const w of words) {
    const part = h.findIndex((c) => c.includes(w));
    if (part !== -1) return part;
  }
  return -1;
}

export function parseCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const rows = parsed.data;
  if (rows.length < 2) return { rows: [], skipped: 0, error: "The file has no rows." };

  // Bank files often start with account details. The header is the first row with a date column and an amount column.
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i];
    if (findCol(r, HEADER_WORDS.date) !== -1 && (findCol(r, HEADER_WORDS.debit) !== -1 || findCol(r, HEADER_WORDS.amount) !== -1)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    return { rows: [], skipped: 0, error: "Could not find the column names. The file needs a Date column and an Amount (or Debit/Credit) column." };
  }

  const header = rows[headerIdx];
  const cDate = findCol(header, HEADER_WORDS.date);
  const cDesc = findCol(header, HEADER_WORDS.desc);
  const cDebit = findCol(header, HEADER_WORDS.debit);
  const cCredit = findCol(header, HEADER_WORDS.credit);
  const cAmount = findCol(header, HEADER_WORDS.amount);
  const cType = findCol(header, HEADER_WORDS.type);

  const out: ParsedTxn[] = [];
  let skipped = 0;

  for (const r of rows.slice(headerIdx + 1)) {
    if (out.length >= MAX_ROWS) {
      return { rows: out, skipped, error: `Only the first ${MAX_ROWS} rows were read.` };
    }
    const date = parseDate(r[cDate] ?? "");
    if (!date) {
      skipped++;
      continue;
    }
    const description = cleanText(cDesc >= 0 ? (r[cDesc] ?? "") : "") || "Transaction";

    let amount: number | null = null;
    let type: "debit" | "credit" | null = null;

    if (cDebit >= 0 && cCredit >= 0 && cDebit !== cCredit) {
      const d = parseAmount(r[cDebit] ?? "");
      const c = parseAmount(r[cCredit] ?? "");
      if (d) {
        amount = d.value;
        type = "debit";
      } else if (c) {
        amount = c.value;
        type = "credit";
      }
    } else if (cAmount >= 0) {
      const a = parseAmount(r[cAmount] ?? "");
      if (a) {
        amount = a.value;
        const t = cType >= 0 ? norm(r[cType] ?? "") : "";
        if (/^(cr|credit|deposit)/.test(t)) type = "credit";
        else if (/^(dr|debit|withdraw)/.test(t)) type = "debit";
        else type = a.hint ?? (a.negative ? "debit" : "credit");
        // A file with a single signed amount column and no type: negative is money out.
        if (!t && !a.hint && !a.negative) type = "debit";
      }
    }

    if (amount === null || type === null) {
      skipped++;
      continue;
    }
    out.push({ occurred_on: date, amount, type, description });
  }

  if (out.length === 0) return { rows: [], skipped, error: "No valid transactions were found in the file." };
  return { rows: out, skipped };
}
