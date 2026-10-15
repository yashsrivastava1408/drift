"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useData } from "@/components/data-provider";
import { CategorySelect } from "@/components/category-select";
import { EmptyState, Modal, PageHeader } from "@/components/ui";
import { TxnForm } from "@/components/txn-form";
import { keywordFromDescription } from "@/lib/categorize";
import { csvSafe, formatDate, money, monthKey, monthLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export default function TransactionsPage() {
  const { transactions, categories, categoryById, rules, updateTransaction, deleteTransaction, addRule } = useData();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [kind, setKind] = useState<"all" | "debit" | "credit">("all");
  const [month, setMonth] = useState("all");
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [remember, setRemember] = useState<{ keyword: string; categoryId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const months = useMemo(() => [...new Set(transactions.map((t) => monthKey(t.occurred_on)))].sort().reverse(), [transactions]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (month === "all" || monthKey(t.occurred_on) === month) &&
        (kind === "all" || t.type === kind) &&
        (cat === "all" || (cat === "none" ? !t.category_id : t.category_id === cat)) &&
        (!q || t.description.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q)),
    );
  }, [transactions, query, cat, kind, month]);

  const totals = useMemo(
    () => ({
      spent: rows.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0),
      income: rows.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0),
    }),
    [rows],
  );

  async function changeCategory(t: Transaction, categoryId: string | null) {
    const err = await updateTransaction(t.id, { category_id: categoryId });
    if (err) return setMessage(err);
    const keyword = keywordFromDescription(t.description);
    const already = rules.some((r) => r.keyword === keyword);
    setRemember(categoryId && keyword.length >= 3 && !already ? { keyword, categoryId } : null);
  }

  async function saveRule() {
    if (!remember) return;
    const err = await addRule(remember.keyword, remember.categoryId);
    setMessage(err ?? `Done. "${remember.keyword}" will go to ${categoryById.get(remember.categoryId)?.name} from now on.`);
    setRemember(null);
  }

  function exportCsv() {
    const head = ["Date", "Type", "Amount", "Description", "Category", "Note"];
    const lines = rows.map((t) =>
      [t.occurred_on, t.type, t.amount.toFixed(2), t.description, categoryById.get(t.category_id ?? "")?.name ?? "", t.note ?? ""]
        .map((v) => csvSafe(String(v)))
        .join(","),
    );
    const blob = new Blob([[head.map(csvSafe).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={`${rows.length} shown / ${money(totals.spent)} spent / ${money(totals.income)} income`}
        action={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={16} aria-hidden /> Export
            </button>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden /> Add
            </button>
          </div>
        }
      />

      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input aria-label="Search" placeholder="Search" className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select aria-label="Month" className="input lg:w-44" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select aria-label="Category" className="input lg:w-44" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All categories</option>
          <option value="none">Uncategorized</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Type" className="input lg:w-36" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">All types</option>
          <option value="debit">Expenses</option>
          <option value="credit">Income</option>
        </select>
      </div>

      {(remember || message) && (
        <div role="status" className="card mb-4 flex flex-wrap items-center justify-between gap-3 border-accent/40 p-3 text-sm">
          {remember ? (
            <>
              <span>
                Always put <strong>{remember.keyword}</strong> in <strong>{categoryById.get(remember.categoryId)?.name}</strong>?
              </span>
              <span className="flex gap-2">
                <button className="btn-primary min-h-9" onClick={saveRule}>Yes, remember</button>
                <button className="btn-ghost min-h-9" onClick={() => setRemember(null)}>No</button>
              </span>
            </>
          ) : (
            <>
              <span>{message}</span>
              <button className="btn-ghost min-h-9" onClick={() => setMessage(null)}>Dismiss</button>
            </>
          )}
        </div>
      )}

      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" text="Add one by hand or import a statement." />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing matches" text="Try a different search or clear a filter." />
      ) : (
        <div className="card divide-y divide-line">
          {rows.slice(0, 300).map((t) => (
            <div key={t.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.description}</p>
                <p className="text-xs text-muted">
                  {formatDate(t.occurred_on)}
                  {t.note ? ` / ${t.note}` : ""}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <CategorySelect
                  label={`Category for ${t.description}`}
                  value={t.category_id}
                  onChange={(v) => changeCategory(t, v)}
                  className="input min-h-9 w-40 py-1"
                />
                <span className={`w-24 text-right text-sm font-semibold tabular-nums ${t.type === "credit" ? "text-good" : ""}`}>
                  {t.type === "credit" ? "+" : "-"}{money(t.amount)}
                </span>
                <button aria-label={`Edit ${t.description}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" onClick={() => setEditing(t)}>
                  <Pencil size={16} />
                </button>
                <button aria-label={`Delete ${t.description}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-bad" onClick={() => setDeleting(t)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {rows.length > 300 && (
            <p className="p-4 text-center text-sm text-muted">Showing the newest 300. Narrow the filters to see others.</p>
          )}
        </div>
      )}

      <TxnForm open={adding} onClose={() => setAdding(false)} />
      <TxnForm open={editing !== null} initial={editing} onClose={() => setEditing(null)} />

      <Modal open={deleting !== null} title="Delete transaction" onClose={() => setDeleting(null)}>
        <p className="text-sm text-muted">
          Delete <strong className="text-ink">{deleting?.description}</strong> ({deleting ? money(deleting.amount) : ""})? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
          <button
            className="btn-primary !bg-bad"
            onClick={async () => {
              if (deleting) {
                const err = await deleteTransaction(deleting.id);
                if (err) setMessage(err);
              }
              setDeleting(null);
            }}
          >
            Delete
          </button>
        </div>
      </Modal>
    </>
  );
}
