import { describe, expect, it } from "vitest";
import { fingerprint, fingerprintAll } from "@/lib/fingerprint";
import type { ParsedTxn } from "@/lib/types";

const base: ParsedTxn = { occurred_on: "2025-10-12", amount: 250, type: "debit", description: "Swiggy" };

describe("fingerprint", () => {
  it("is a 64 character hex string", async () => {
    expect(await fingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("is stable", async () => {
    expect(await fingerprint(base)).toBe(await fingerprint({ ...base }));
  });
  it("changes with each field", async () => {
    const f = await fingerprint(base);
    expect(await fingerprint({ ...base, occurred_on: "2025-10-13" })).not.toBe(f);
    expect(await fingerprint({ ...base, amount: 251 })).not.toBe(f);
    expect(await fingerprint({ ...base, type: "credit" })).not.toBe(f);
    expect(await fingerprint({ ...base, description: "Zomato" })).not.toBe(f);
    expect(await fingerprint(base, 1)).not.toBe(f);
  });
  it("ignores description case", async () => {
    expect(await fingerprint({ ...base, description: "SWIGGY" })).toBe(await fingerprint({ ...base, description: "swiggy" }));
  });
  it("treats 250 and 250.00 as the same", async () => {
    expect(await fingerprint({ ...base, amount: 250 })).toBe(await fingerprint({ ...base, amount: 250.0 }));
  });
});

describe("fingerprintAll", () => {
  it("returns one per row", async () => {
    expect(await fingerprintAll([])).toEqual([]);
    expect(await fingerprintAll([base, { ...base, amount: 1 }])).toHaveLength(2);
  });
  it("separates identical rows on the same day", async () => {
    const a = await fingerprintAll([base, base, base]);
    expect(new Set(a).size).toBe(3);
  });
  it("gives the same answer when run twice", async () => {
    const rows = [base, base, { ...base, amount: 5 }];
    expect(await fingerprintAll(rows)).toEqual(await fingerprintAll(rows));
  });
  it("matches when a statement is re-imported", async () => {
    const first = await fingerprintAll([base, base]);
    const again = await fingerprintAll([base, base]);
    expect(first).toEqual(again);
  });
  it("does not collide across different rows", async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ ...base, amount: i + 1 }));
    expect(new Set(await fingerprintAll(rows)).size).toBe(200);
  });
});
