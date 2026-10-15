import type { ParseResult } from "../types";
import { parseCsv } from "./csv";
import { parsePdf } from "./pdf";

export const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function parseStatement(file: File, password?: string): Promise<ParseResult & { source: "csv" | "pdf" }> {
  if (file.size > MAX_FILE_BYTES) {
    return { rows: [], skipped: 0, error: "That file is larger than 8 MB.", source: "csv" };
  }
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") && (file.type === "application/pdf" || file.type === "")) {
    return { ...(await parsePdf(file, password)), source: "pdf" };
  }
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return { ...parseCsv(await file.text()), source: "csv" };
  }
  return { rows: [], skipped: 0, error: "Please choose a .csv or .pdf file.", source: "csv" };
}
