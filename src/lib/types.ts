export type TxnType = "debit" | "credit";
export type TxnSource = "manual" | "csv" | "pdf";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  category_id: string;
}

export interface Transaction {
  id: string;
  occurred_on: string; // YYYY-MM-DD
  amount: number;
  type: TxnType;
  description: string;
  category_id: string | null;
  source: TxnSource;
  note: string | null;
}

/** A row read from a statement, before it is saved. */
export interface ParsedTxn {
  occurred_on: string;
  amount: number;
  type: TxnType;
  description: string;
}

export interface ParseResult {
  rows: ParsedTxn[];
  skipped: number;
  error?: string;
  /** Set when a PDF is locked: "required" means no password was given, "wrong" means it did not fit. */
  password?: "required" | "wrong";
}
