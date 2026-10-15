"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileUp, Sparkles } from "lucide-react";
import { useData } from "@/components/data-provider";
import { CategorySelect } from "@/components/category-select";
import { PageHeader } from "@/components/ui";
import { categorize } from "@/lib/categorize";
import { fingerprintAll } from "@/lib/fingerprint";
import { formatDate, money } from "@/lib/format";
import { parseStatement } from "@/lib/parsers";
import type { ParsedTxn } from "@/lib/types";

interface Row extends ParsedTxn {
  category_id: string | null;
  fingerprint: string;
  keep: boolean;
}

export default function ImportPage() {
  const { rules, categories, importRows } = useData();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [source, setSource] = useState<"csv" | "pdf">("csv");
  const [fileName, setFileName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; total: number } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setNote(null);
      setResult(null);
      setBusy(true);
      const parsed = await parseStatement(file);
      if (parsed.rows.length === 0) {
        setRows(null);
        setError(parsed.error ?? "Nothing could be read from that file.");
        setBusy(false);
        return;
      }
      const prints = await fingerprintAll(parsed.rows);
      setRows(
        parsed.rows.map((r, i) => ({
          ...r,
          category_id: categorize(r.description, rules),
          fingerprint: prints[i],
          keep: true,
        })),
      );
      setSource(parsed.source);
      setFileName(file.name);
      const bits = [];
      if (parsed.skipped) bits.push(`${parsed.skipped} rows were skipped because they could not be read.`);
      if (parsed.error) bits.push(parsed.error);
      if (parsed.source === "pdf") bits.push("PDF reading is best effort. Check the list before importing.");
      setNote(bits.join(" ") || null);
      setBusy(false);
    },
    [rules],
  );

  const summary = useMemo(() => {
    if (!rows) return null;
    const kept = rows.filter((r) => r.keep);
    return {
      kept: kept.length,
      uncategorized: kept.filter((r) => !r.category_id).length,
      spent: kept.filter((r) => r.type === "debit").reduce((s, r) => s + r.amount, 0),
      income: kept.filter((r) => r.type === "credit").reduce((s, r) => s + r.amount, 0),
    };
  }, [rows]);

  async function askAi() {
    if (!rows) return;
    setAiBusy(true);
    setError(null);
    const targets = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.keep && !r.category_id).slice(0, 200);
    const byName = new Map(categories.map((c) => [c.name, c.id]));
    const next = [...rows];
    try {
      for (let s = 0; s < targets.length; s += 40) {
        const batch = targets.slice(s, s + 40);
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ descriptions: batch.map(({ r }) => r.description) }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "AI categorizing failed.");
          break;
        }
        (json.results as (string | null)[]).forEach((name, k) => {
          const id = name ? byName.get(name) : undefined;
          if (id) next[batch[k].i] = { ...next[batch[k].i], category_id: id };
        });
      }
      setRows(next);
    } catch {
      setError("Could not reach the AI service.");
    }
    setAiBusy(false);
  }

  async function save() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    const kept = rows.filter((r) => r.keep);
    const { added, error } = await importRows(
      kept.map(({ keep: _keep, ...r }) => r),
      source,
    );
    setBusy(false);
    if (error) return setError(error);
    setResult({ added, total: kept.length });
    setRows(null);
  }

  if (result) {
    return (
      <>
        <PageHeader title="Import" />
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <CheckCircle2 size={40} className="text-good" aria-hidden />
          <p className="mt-4 text-lg font-semibold">{result.added} transactions added</p>
          {result.total > result.added && (
            <p className="mt-1 text-sm text-muted">{result.total - result.added} were already saved, so they were skipped.</p>
          )}
          <div className="mt-6 flex gap-2">
            <Link href="/transactions" className="btn-primary">View transactions</Link>
            <button className="btn-ghost" onClick={() => setResult(null)}>Import another</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Import" subtitle="Upload a statement from your bank or UPI app. Files are read in your browser." />

      {!rows && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            className={`card flex flex-col items-center border-2 border-dashed px-6 py-14 text-center transition ${dragging ? "border-accent bg-accent/5" : ""}`}
          >
            <FileUp size={32} className="text-muted" aria-hidden />
            <p className="mt-3 font-medium">Drop a CSV or PDF here</p>
            <p className="mt-1 text-sm text-muted">Bank statements work best as CSV. PhonePe statements come as PDF.</p>
            <button className="btn-primary mt-5" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Reading..." : "Choose file"}
            </button>
            <input
              ref={input}
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              className="sr-only"
              aria-label="Statement file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-bad">{error}</p>}

          <section className="card mt-4 p-5 text-sm">
            <h2 className="font-semibold">Where to get a statement</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
              <li><strong className="text-ink">Bank (best):</strong> in net banking, open Account Statement and download as CSV or Excel. It covers every UPI app together.</li>
              <li><strong className="text-ink">PhonePe:</strong> History, then the statement download option, pick dates and save the PDF.</li>
              <li><strong className="text-ink">Google Pay:</strong> use your bank statement, or request your data from Google Takeout.</li>
            </ul>
          </section>
        </>
      )}

      {rows && summary && (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm">
              <p className="font-medium">{fileName}</p>
              <p className="text-muted">
                {summary.kept} selected / {money(summary.spent)} spent / {money(summary.income)} income / {summary.uncategorized} uncategorized
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setRows(null)}>Cancel</button>
              {summary.uncategorized > 0 && (
                <button className="btn-ghost" disabled={aiBusy} onClick={askAi}>
                  <Sparkles size={16} aria-hidden /> {aiBusy ? "Thinking..." : "Suggest with AI"}
                </button>
              )}
              <button className="btn-primary" disabled={busy || summary.kept === 0} onClick={save}>
                {busy ? "Saving..." : `Import ${summary.kept}`}
              </button>
            </div>
          </div>
          {note && <p className="mb-3 text-sm text-muted">{note}</p>}
          {error && <p role="alert" className="mb-3 text-sm text-bad">{error}</p>}

          <div className="card divide-y divide-line">
            {rows.slice(0, 500).map((r, i) => (
              <div key={r.fingerprint} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 ${r.keep ? "" : "opacity-45"}`}>
                <input
                  type="checkbox"
                  aria-label={`Include ${r.description}`}
                  checked={r.keep}
                  className="size-4 accent-[var(--accent)]"
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-muted">{formatDate(r.occurred_on)}</p>
                </div>
                <CategorySelect
                  label={`Category for ${r.description}`}
                  value={r.category_id}
                  onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, category_id: v } : x)))}
                  className="input min-h-9 w-44 py-1"
                />
                <span className={`w-28 text-right text-sm font-semibold tabular-nums ${r.type === "credit" ? "text-good" : ""}`}>
                  {r.type === "credit" ? "+" : "-"}{money(r.amount)}
                </span>
              </div>
            ))}
          </div>
          {rows.length > 500 && (
            <p className="mt-3 text-center text-sm text-muted">
              Showing the first 500 of {rows.length}. All selected rows will be imported.
            </p>
          )}
        </>
      )}
    </>
  );
}
