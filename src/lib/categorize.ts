import type { CategoryRule } from "./types";

function normalize(text: string): string {
  return " " + text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
}

/**
 * Finds the category for a description using the user's keyword rules.
 * A keyword has to start a word, so "ola" matches "OLA CABS" but not "COLA".
 * When several keywords match, the longest one wins.
 */
export function categorize(description: string, rules: CategoryRule[]): string | null {
  const text = normalize(description);
  let best: CategoryRule | null = null;
  for (const rule of rules) {
    const kw = normalize(rule.keyword).trimEnd();
    if (kw.trim().length < 2) continue;
    if (text.includes(kw) && (!best || rule.keyword.length > best.keyword.length)) {
      best = rule;
    }
  }
  return best ? best.category_id : null;
}

/** Picks a short, stable keyword from a description so a correction can become a rule. */
export function keywordFromDescription(description: string): string {
  const words = description
    .toLowerCase()
    .replace(/\b(upi|paid|to|payment|received|from|debit|credit|txn|ref|no|the|for|via)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return (words[0] ?? "").slice(0, 40);
}
