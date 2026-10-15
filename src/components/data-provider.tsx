"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { cleanText } from "@/lib/sanitize";
import type { Category, CategoryRule, ParsedTxn, Transaction, TxnSource } from "@/lib/types";

export interface TxnInput {
  occurred_on: string;
  amount: number;
  type: "debit" | "credit";
  description: string;
  category_id: string | null;
  note?: string | null;
}

export interface ImportRow extends ParsedTxn {
  category_id: string | null;
  fingerprint: string;
}

interface DataState {
  categories: Category[];
  rules: CategoryRule[];
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  categoryById: Map<string, Category>;
  refresh: () => Promise<void>;
  addTransaction: (t: TxnInput) => Promise<string | null>;
  updateTransaction: (id: string, t: Partial<TxnInput>) => Promise<string | null>;
  deleteTransaction: (id: string) => Promise<string | null>;
  importRows: (rows: ImportRow[], source: TxnSource) => Promise<{ added: number; error: string | null }>;
  addCategory: (name: string, color: string) => Promise<string | null>;
  updateCategory: (id: string, patch: Partial<Pick<Category, "name" | "color">>) => Promise<string | null>;
  deleteCategory: (id: string) => Promise<string | null>;
  addRule: (keyword: string, categoryId: string) => Promise<string | null>;
  deleteRule: (id: string) => Promise<string | null>;
}

const Ctx = createContext<DataState | null>(null);

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside DataProvider");
  return v;
}

const TXN_COLUMNS = "id, occurred_on, amount, type, description, category_id, source, note";
const friendly = (m: string) => (m.includes("duplicate") ? "That already exists." : "Something went wrong. Please try again.");

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    // Accounts made before the schema was installed get their default categories here.
    await sb.rpc("ensure_my_defaults");
    const [c, r, t] = await Promise.all([
      sb.from("categories").select("id, name, color").order("name"),
      sb.from("category_rules").select("id, keyword, category_id").order("keyword"),
      sb.from("transactions").select(TXN_COLUMNS).order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(10000),
    ]);
    if (c.error || r.error || t.error) {
      setError("Could not load your data. Check that the database script has been run.");
    } else {
      setError(null);
      setCategories(c.data as Category[]);
      setRules(r.data as CategoryRule[]);
      setTransactions((t.data as Transaction[]).map((x) => ({ ...x, amount: Number(x.amount) })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const run = useCallback(
    async (op: PromiseLike<{ error: { message: string } | null }>): Promise<string | null> => {
      const { error } = await op;
      if (error) return friendly(error.message);
      await refresh();
      return null;
    },
    [refresh],
  );

  const value: DataState = {
    categories,
    rules,
    transactions,
    loading,
    error,
    categoryById,
    refresh,
    addTransaction: (t) =>
      run(
        getSupabase().from("transactions").insert({
          ...t,
          description: cleanText(t.description),
          note: t.note ? cleanText(t.note, 300) : null,
          source: "manual",
        }),
      ),
    updateTransaction: (id, t) =>
      run(
        getSupabase()
          .from("transactions")
          .update({
            ...t,
            ...(t.description !== undefined ? { description: cleanText(t.description) } : {}),
            ...(t.note ? { note: cleanText(t.note, 300) } : {}),
          })
          .eq("id", id),
      ),
    deleteTransaction: (id) => run(getSupabase().from("transactions").delete().eq("id", id)),
    importRows: async (rows, source) => {
      const sb = getSupabase();
      let added = 0;
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500).map((r) => ({
          occurred_on: r.occurred_on,
          amount: r.amount,
          type: r.type,
          description: cleanText(r.description),
          category_id: r.category_id,
          fingerprint: r.fingerprint,
          source,
        }));
        const { data, error } = await sb
          .from("transactions")
          .upsert(chunk, { onConflict: "user_id,fingerprint", ignoreDuplicates: true })
          .select("id");
        if (error) return { added, error: friendly(error.message) };
        added += data?.length ?? 0;
      }
      await refresh();
      return { added, error: null };
    },
    addCategory: (name, color) =>
      run(getSupabase().from("categories").insert({ name: cleanText(name, 40), color })),
    updateCategory: (id, patch) =>
      run(getSupabase().from("categories").update({ ...patch, ...(patch.name ? { name: cleanText(patch.name, 40) } : {}) }).eq("id", id)),
    deleteCategory: (id) => run(getSupabase().from("categories").delete().eq("id", id)),
    addRule: (keyword, categoryId) =>
      run(getSupabase().from("category_rules").insert({ keyword: cleanText(keyword, 60).toLowerCase(), category_id: categoryId })),
    deleteRule: (id) => run(getSupabase().from("category_rules").delete().eq("id", id)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
