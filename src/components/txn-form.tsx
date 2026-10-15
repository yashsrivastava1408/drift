"use client";

import { useState } from "react";
import { z } from "zod";
import { useData } from "./data-provider";
import { Modal } from "./ui";
import { CategorySelect } from "./category-select";
import { categorize } from "@/lib/categorize";
import { todayISO } from "@/lib/format";
import type { Transaction } from "@/lib/types";

const Schema = z.object({
  amount: z.number().positive("Enter an amount above zero.").max(99_999_999, "That amount is too large."),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  description: z.string().trim().min(1, "Add a short description.").max(200),
  note: z.string().max(300).optional(),
});

export function TxnForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Transaction | null }) {
  // The form remounts each time it opens, so every opening starts fresh.
  return (
    <Modal open={open} title={initial ? "Edit transaction" : "Add transaction"} onClose={onClose}>
      <FormBody key={initial?.id ?? "new"} onClose={onClose} initial={initial ?? null} />
    </Modal>
  );
}

function FormBody({ onClose, initial }: { onClose: () => void; initial: Transaction | null }) {
  const { rules, addTransaction, updateTransaction } = useData();
  const [type, setType] = useState<"debit" | "credit">(initial?.type ?? "debit");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.occurred_on ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [touchedCategory, setTouchedCategory] = useState(Boolean(initial));
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onDescription(v: string) {
    setDescription(v);
    if (!touchedCategory) setCategoryId(categorize(v, rules));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Schema.safeParse({ amount: Number(amount), occurred_on: date, description, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const payload = {
      type,
      amount: Math.round(parsed.data.amount * 100) / 100,
      occurred_on: parsed.data.occurred_on,
      description: parsed.data.description,
      category_id: categoryId,
      note: parsed.data.note || null,
    };
    const err = initial ? await updateTransaction(initial.id, payload) : await addTransaction(payload);
    setBusy(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-bg p-1" role="group" aria-label="Type">
        {(["debit", "credit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
            className={`min-h-9 rounded-lg text-sm font-medium transition ${
              type === t ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            {t === "debit" ? "Expense" : "Income"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="amount" className="label">Amount (INR)</label>
          <input id="amount" inputMode="decimal" type="number" step="0.01" min="0" required className="input" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label htmlFor="date" className="label">Date</label>
          <input id="date" type="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="desc" className="label">Description</label>
        <input id="desc" required maxLength={200} className="input" value={description}
          onChange={(e) => onDescription(e.target.value)} placeholder="Where was it spent?" />
      </div>

      <div>
        <label htmlFor="cat" className="label">Category</label>
        <CategorySelect id="cat" value={categoryId} onChange={(v) => { setCategoryId(v); setTouchedCategory(true); }} />
      </div>

      <div>
        <label htmlFor="note" className="label">Note (optional)</label>
        <input id="note" maxLength={300} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving..." : "Save"}</button>
      </div>
    </form>
  );
}
