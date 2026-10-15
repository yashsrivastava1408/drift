import { describe, expect, it } from "vitest";
import { categorize, keywordFromDescription } from "@/lib/categorize";
import type { CategoryRule } from "@/lib/types";

const rule = (keyword: string, category_id: string, id = keyword): CategoryRule => ({ id, keyword, category_id });

const rules = [
  rule("swiggy", "food"),
  rule("zomato", "food"),
  rule("swiggy instamart", "groceries"),
  rule("ola", "transport"),
  rule("uber", "transport"),
  rule("amazon", "shopping"),
  rule("jio", "bills"),
  rule("rent", "rent"),
];

describe("categorize: matching", () => {
  it.each([
    ["Paid to SWIGGY", "food"],
    ["UPI-ZOMATO-ZOMATO@HDFC-123", "food"],
    ["upi/uber india/uber@axis", "transport"],
    ["AMAZON PAY INDIA", "shopping"],
    ["AMAZONPAY", "shopping"],
    ["Jio recharge 749", "bills"],
    ["SWIGGY*ORDER 1234", "food"],
    ["swiggy.in", "food"],
  ])("%s -> %s", (text, expected) => {
    expect(categorize(text, rules)).toBe(expected);
  });

  it("ignores case", () => {
    expect(categorize("sWiGgY", rules)).toBe("food");
    expect(categorize("SWIGGY", rules)).toBe("food");
  });

  it("ignores punctuation between words", () => {
    expect(categorize("SWIGGY---INSTAMART", rules)).toBe("groceries");
    expect(categorize("swiggy_instamart", rules)).toBe("groceries");
    expect(categorize("swiggy   instamart", rules)).toBe("groceries");
  });

  it("prefers the longest matching keyword", () => {
    expect(categorize("Paid to SWIGGY INSTAMART", rules)).toBe("groceries");
    expect(categorize("Paid to SWIGGY", rules)).toBe("food");
  });

  it("returns null when nothing matches", () => {
    expect(categorize("Random shop", rules)).toBeNull();
    expect(categorize("", rules)).toBeNull();
    expect(categorize("   ", rules)).toBeNull();
  });

  it("returns null with no rules", () => {
    expect(categorize("SWIGGY", [])).toBeNull();
  });
});

describe("categorize: word boundaries", () => {
  it("matches a keyword at the start of a word", () => {
    expect(categorize("OLA CABS", rules)).toBe("transport");
    expect(categorize("olacabs", rules)).toBe("transport");
  });

  it("does not match in the middle of a word", () => {
    expect(categorize("Coca COLA store", rules)).toBeNull();
    expect(categorize("GRANOLA BARS", rules)).toBeNull();
    expect(categorize("Cajio", rules)).toBeNull();
  });

  it("does not let a long keyword match a fragment", () => {
    expect(categorize("swig", rules)).toBeNull();
  });
});

describe("categorize: odd rules", () => {
  it("ignores keywords that are too short", () => {
    expect(categorize("A BIG SHOP", [rule("a", "x")])).toBeNull();
    expect(categorize("anything", [rule("", "x")])).toBeNull();
    expect(categorize("anything", [rule("  ", "x")])).toBeNull();
  });

  it("matches keywords that contain digits", () => {
    expect(categorize("PHARMACY 1MG ORDER", [rule("1mg", "health")])).toBe("health");
  });

  it("matches multi word keywords", () => {
    expect(categorize("Big Bazaar Store", [rule("big bazaar", "groceries")])).toBe("groceries");
  });

  it("copes with keywords written with capitals or symbols", () => {
    expect(categorize("zomato order", [rule("ZOMATO", "food")])).toBe("food");
    expect(categorize("zomato order", [rule("zomato!", "food")])).toBe("food");
  });

  it("picks the first when two keywords tie", () => {
    const r = [rule("abcd", "one", "1"), rule("wxyz", "two", "2")];
    expect(categorize("abcd wxyz", r)).toBe("one");
  });

  it("handles a very long description quickly", () => {
    const text = "x ".repeat(50000) + "swiggy";
    const t0 = Date.now();
    expect(categorize(text, rules)).toBe("food");
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe("keywordFromDescription", () => {
  it.each([
    ["Paid to SWIGGY", "swiggy"],
    ["UPI Payment to ZOMATO", "zomato"],
    ["Received from RAHUL", "rahul"],
    ["DEBIT Dominos Pizza", "dominos"],
    ["swiggy", "swiggy"],
  ])("%s -> %s", (input, expected) => {
    expect(keywordFromDescription(input)).toBe(expected);
  });

  it("drops filler words, numbers and short words", () => {
    expect(keywordFromDescription("UPI TO 12345 AB")).toBe("");
    expect(keywordFromDescription("paid to the")).toBe("");
    expect(keywordFromDescription("")).toBe("");
  });

  it("keeps at most 40 characters", () => {
    expect(keywordFromDescription("a".repeat(100)).length).toBeLessThanOrEqual(40);
  });

  it("returns lowercase", () => {
    expect(keywordFromDescription("NETFLIX")).toBe("netflix");
  });
});
