"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { useData } from "@/components/data-provider";
import { CategoryDot, EmptyState, PageHeader } from "@/components/ui";
import { CategoryDonut, MonthlyBars } from "@/components/charts";
import { TxnForm } from "@/components/txn-form";
import { formatDate, money, monthKey, monthLabel, shortMonth, todayISO } from "@/lib/format";

const UNCATEGORIZED = { name: "Uncategorized", color: "#94a3b8" };

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const { transactions, categoryById } = useData();
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const inMonth = transactions.filter((t) => monthKey(t.occurred_on) === month);
    const spent = inMonth.filter((t) => t.type === "debit");
    const income = inMonth.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const totalSpent = spent.reduce((s, t) => s + t.amount, 0);

    const byCat = new Map<string, { name: string; color: string; value: number }>();
    for (const t of spent) {
      const c = t.category_id ? categoryById.get(t.category_id) : null;
      const key = c?.id ?? "none";
      const row = byCat.get(key) ?? { name: c?.name ?? UNCATEGORIZED.name, color: c?.color ?? UNCATEGORIZED.color, value: 0 };
      row.value += t.amount;
      byCat.set(key, row);
    }
    const slices = [...byCat.values()].sort((a, b) => b.value - a.value);

    const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((k) => ({
      label: shortMonth(k),
      spent: transactions.filter((t) => t.type === "debit" && monthKey(t.occurred_on) === k).reduce((s, t) => s + t.amount, 0),
      current: k === month,
    }));

    return { inMonth, income, totalSpent, slices, months, recent: inMonth.slice(0, 6) };
  }, [transactions, categoryById, month]);

  const isCurrent = month === monthKey(todayISO());

  if (transactions.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <EmptyState
          title="No transactions yet"
          text="Import a statement from your bank or PhonePe, or add an expense by hand to get started."
          action={
            <div className="flex gap-2">
              <Link href="/import" className="btn-primary">Import statement</Link>
              <button className="btn-ghost" onClick={() => setAdding(true)}>Add expense</button>
            </div>
          }
        />
        <TxnForm open={adding} onClose={() => setAdding(false)} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={monthLabel(month)}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-line bg-surface">
              <button aria-label="Previous month" className="grid size-10 place-items-center text-muted hover:text-ink" onClick={() => setMonth(shiftMonth(month, -1))}>
                <ChevronLeft size={18} />
              </button>
              <button aria-label="Next month" disabled={isCurrent} className="grid size-10 place-items-center text-muted hover:text-ink disabled:opacity-30" onClick={() => setMonth(shiftMonth(month, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden /> Add
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        <Stat icon={<ArrowUpRight size={16} />} label="Spent" value={money(stats.totalSpent)} tone="bad" />
        <Stat icon={<ArrowDownLeft size={16} />} label="Income" value={money(stats.income)} tone="good" />
        <Stat icon={<Wallet size={16} />} label="Net" value={money(stats.income - stats.totalSpent)} tone={stats.income - stats.totalSpent >= 0 ? "good" : "bad"} />
        <Stat label="Transactions" value={String(stats.inMonth.length)} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-5" aria-label="By category">
          <h2 className="mb-4 text-sm font-semibold">Where it went</h2>
          {stats.slices.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted">No spending this month.</p>
          ) : (
            <>
              <CategoryDonut data={stats.slices} total={stats.totalSpent} />
              <ul className="mt-5 space-y-3">
                {stats.slices.map((s) => (
                  <li key={s.name}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2"><CategoryDot color={s.color} />{s.name}</span>
                      <span className="tabular-nums">
                        {money(s.value)} <span className="text-muted">({Math.round((s.value / stats.totalSpent) * 100)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full" style={{ width: `${(s.value / stats.totalSpent) * 100}%`, background: s.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="space-y-4">
          <section className="card p-5" aria-label="Monthly trend">
            <h2 className="mb-2 text-sm font-semibold">Last 6 months</h2>
            <MonthlyBars data={stats.months} />
          </section>

          <section className="card p-5" aria-label="Recent">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent</h2>
              <Link href="/transactions" className="text-sm text-accent hover:underline">See all</Link>
            </div>
            {stats.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nothing this month.</p>
            ) : (
              <ul className="divide-y divide-line">
                {stats.recent.map((t) => {
                  const c = t.category_id ? categoryById.get(t.category_id) : null;
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.description}</p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <CategoryDot color={c?.color ?? UNCATEGORIZED.color} />
                          {c?.name ?? UNCATEGORIZED.name} / {formatDate(t.occurred_on)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.type === "credit" ? "text-good" : ""}`}>
                        {t.type === "credit" ? "+" : "-"}{money(t.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <TxnForm open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className={tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}>{icon}</span>
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-semibold tabular-nums md:text-2xl">{value}</p>
    </div>
  );
}
