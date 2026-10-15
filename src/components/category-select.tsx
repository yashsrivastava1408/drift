"use client";

import { useData } from "./data-provider";

export function CategorySelect({
  value,
  onChange,
  id,
  className = "input",
  allowNone = true,
  noneLabel = "Uncategorized",
  label,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
  className?: string;
  allowNone?: boolean;
  noneLabel?: string;
  label?: string;
}) {
  const { categories } = useData();
  return (
    <select
      id={id}
      aria-label={label}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowNone && <option value="">{noneLabel}</option>}
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
