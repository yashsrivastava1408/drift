import type { ParsedTxn } from "./types";

/** A stable ID for a transaction so importing the same statement twice adds nothing new. */
export async function fingerprint(t: ParsedTxn, occurrence = 0): Promise<string> {
  const raw = [t.occurred_on, t.amount.toFixed(2), t.type, t.description.toLowerCase(), occurrence].join("|");
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Fingerprints a whole batch. Two identical rows on one day get different occurrence numbers. */
export async function fingerprintAll(rows: ParsedTxn[]): Promise<string[]> {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const r of rows) {
    const key = [r.occurred_on, r.amount.toFixed(2), r.type, r.description.toLowerCase()].join("|");
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    out.push(await fingerprint(r, n));
  }
  return out;
}
