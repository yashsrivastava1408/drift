import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("allows calls up to the limit", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("a1", 5, 1000)).toBe(true);
  });
  it("blocks the call after the limit", () => {
    for (let i = 0; i < 3; i++) rateLimit("a2", 3, 1000);
    expect(rateLimit("a2", 3, 1000)).toBe(false);
    expect(rateLimit("a2", 3, 1000)).toBe(false);
  });
  it("lets calls through again after the window", () => {
    for (let i = 0; i < 3; i++) rateLimit("a3", 3, 1000);
    expect(rateLimit("a3", 3, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("a3", 3, 1000)).toBe(true);
  });
  it("counts each key separately", () => {
    for (let i = 0; i < 3; i++) rateLimit("a4", 3, 1000);
    expect(rateLimit("a4", 3, 1000)).toBe(false);
    expect(rateLimit("a5", 3, 1000)).toBe(true);
  });
  it("uses a sliding window", () => {
    rateLimit("a6", 2, 1000);
    vi.advanceTimersByTime(600);
    rateLimit("a6", 2, 1000);
    expect(rateLimit("a6", 2, 1000)).toBe(false);
    vi.advanceTimersByTime(500);
    expect(rateLimit("a6", 2, 1000)).toBe(true);
  });
  it("does not count blocked calls against you forever", () => {
    for (let i = 0; i < 10; i++) rateLimit("a7", 2, 1000);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("a7", 2, 1000)).toBe(true);
  });
  it("defaults to 12 calls a minute", () => {
    for (let i = 0; i < 12; i++) expect(rateLimit("a8")).toBe(true);
    expect(rateLimit("a8")).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rateLimit("a8")).toBe(true);
  });
});
