const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function valid(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/**
 * Reads the date formats Indian banks and UPI apps use. Day comes before month in numeric dates.
 * Returns YYYY-MM-DD, or null when the text is not a date.
 */
export function parseDate(input: string): string | null {
  const s = input.trim().replace(/\s+/g, " ");
  let m: RegExpMatchArray | null;

  // 2025-10-12 or 2025/10/12 (optionally followed by a time)
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/))) {
    return valid(+m[1], +m[2], +m[3]);
  }
  // 12/10/2025, 12-10-25, 12.10.2025
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[\s,].*)?$/))) {
    return valid(fullYear(+m[3]), +m[2], +m[1]);
  }
  // 12 Oct 2025, 12-Oct-25, 12/Oct/2025
  if ((m = s.match(/^(\d{1,2})[\s\-/.]([A-Za-z]{3,9})[\s\-/.,]*(\d{2,4})(?:[\s,].*)?$/))) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return mon ? valid(fullYear(+m[3]), mon, +m[1]) : null;
  }
  // Oct 12, 2025
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:[\s,].*)?$/))) {
    const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    return mon ? valid(+m[3], mon, +m[2]) : null;
  }
  return null;
}

/** Turns "Rs. 1,234.50", "(500.00)", "250 Dr" or "-80" into a number plus its sign hints. */
export function parseAmount(input: string): { value: number; negative: boolean; hint: "debit" | "credit" | null } | null {
  let s = input.trim();
  if (!s) return null;
  let hint: "debit" | "credit" | null = null;
  if (/\bdr\.?$/i.test(s)) hint = "debit";
  if (/\bcr\.?$/i.test(s)) hint = "credit";
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /^−/.test(s);
  const num = s.match(/\d[\d,]*(?:\.\d+)?|\.\d+/);
  if (!num) return null;
  const value = Number(num[0].replace(/,/g, ""));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value: Math.round(value * 100) / 100, negative, hint };
}
