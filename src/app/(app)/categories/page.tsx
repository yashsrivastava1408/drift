"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useData } from "@/components/data-provider";
import { CategorySelect } from "@/components/category-select";
import { CategoryDot, Modal, PageHeader } from "@/components/ui";
import type { Category } from "@/lib/types";

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#ec4899", "#eab308", "#a855f7", "#ef4444", "#06b6d4", "#14b8a6", "#8b5cf6", "#64748b", "#10b981"];

export default function CategoriesPage() {
  const { categories, rules, transactions, addCategory, updateCategory, deleteCategory, addRule, deleteRule } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [keyword, setKeyword] = useState("");
  const [ruleCat, setRuleCat] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Category | null>(null);

  const counts = new Map<string, number>();
  transactions.forEach((t) => t.category_id && counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const err = await addCategory(name, color);
    setError(err);
    if (!err) setName("");
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    if (keyword.trim().length < 2 || !ruleCat) return setError("Enter a keyword and choose a category.");
    const err = await addRule(keyword, ruleCat);
    setError(err);
    if (!err) setKeyword("");
  }

  return (
    <>
      <PageHeader title="Categories" subtitle="Groups for your spending, and the keywords that sort transactions into them." />
      {error && <p role="alert" className="mb-4 text-sm text-bad">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-label="Categories">
          <h2 className="mb-4 text-sm font-semibold">Your categories</h2>
          <ul className="divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center">
                  <span className="size-6 rounded-full ring-2 ring-line" style={{ background: c.color }} />
                  <input type="color" aria-label={`Colour for ${c.name}`} value={c.color} className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => updateCategory(c.id, { color: e.target.value })} />
                </label>
                <input
                  aria-label="Category name"
                  defaultValue={c.name}
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm font-medium hover:bg-bg focus:bg-bg focus-visible:outline-2 focus-visible:outline-accent"
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (v && v !== c.name) setError(await updateCategory(c.id, { name: v }));
                    else e.target.value = c.name;
                  }}
                />
                <span className="text-xs text-muted tabular-nums">{counts.get(c.id) ?? 0}</span>
                <button aria-label={`Delete ${c.name}`} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-bg hover:text-bad" onClick={() => setRemoving(c)}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={create} className="mt-5 space-y-3 border-t border-line pt-5">
            <label htmlFor="newcat" className="label">New category</label>
            <div className="flex gap-2">
              <input id="newcat" className="input" maxLength={40} placeholder="e.g. Pets" value={name} onChange={(e) => setName(e.target.value)} />
              <button className="btn-primary shrink-0" type="submit"><Plus size={16} aria-hidden /> Add</button>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Colour">
              {COLORS.map((c) => (
                <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
                  className={`size-7 rounded-full ring-offset-2 ring-offset-surface ${color === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />
              ))}
            </div>
          </form>
        </section>

        <section className="card p-5" aria-label="Keyword rules">
          <h2 className="mb-1 text-sm font-semibold">Keyword rules</h2>
          <p className="mb-4 text-xs text-muted">If a description contains the keyword, it goes into that category.</p>

          <form onSubmit={createRule} className="mb-5 flex flex-wrap gap-2">
            <input aria-label="Keyword" className="input min-w-32 flex-1" maxLength={60} placeholder="Keyword, e.g. dominos" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <CategorySelect label="Category for rule" value={ruleCat} onChange={setRuleCat} allowNone noneLabel="Choose category" className="input w-44" />
            <button className="btn-primary" type="submit">Add rule</button>
          </form>

          <div className="max-h-[32rem] space-y-4 overflow-y-auto pr-1">
            {categories.map((c) => {
              const list = rules.filter((r) => r.category_id === c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted"><CategoryDot color={c.color} />{c.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-bg py-1 pl-3 pr-1 text-xs">
                        {r.keyword}
                        <button aria-label={`Remove rule ${r.keyword}`} className="grid size-5 place-items-center rounded-full text-muted hover:text-bad" onClick={async () => setError(await deleteRule(r.id))}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Modal open={removing !== null} title="Delete category" onClose={() => setRemoving(null)}>
        <p className="text-sm text-muted">
          Delete <strong className="text-ink">{removing?.name}</strong>? Its {removing ? (counts.get(removing.id) ?? 0) : 0} transactions
          become uncategorized and its keyword rules are removed.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setRemoving(null)}>Cancel</button>
          <button className="btn-primary !bg-bad" onClick={async () => { if (removing) setError(await deleteCategory(removing.id)); setRemoving(null); }}>Delete</button>
        </div>
      </Modal>
    </>
  );
}
