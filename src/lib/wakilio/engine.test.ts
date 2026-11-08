import { describe, it, expect } from "vitest";
import { parseAmount, detectHeaderRow, detectTitleAgent, buildRecords, guessRole, suggestMerges, summarize, splitPassportNames, processSharedReceipts, type TxRecord } from "./engine";

describe("engine", () => {
  it("treats لاشي as zero", () => {
    expect(parseAmount("لاشي")).toBe(0);
    expect(parseAmount("لا شيء")).toBe(0);
    expect(parseAmount("3,800")).toBe(3800);
    expect(parseAmount("٢٥٠٠")).toBe(2500);
  });

  it("applies merged title agent to all rows", () => {
    const grid = [
      ["خالـــــد عباس"],
      ["اسم الجواز", "الجهه", "تاريخ الاستلام", "الواصل", "المتبقي", "ملاحظات"],
      ["علاء عبدالله", "عدن", "07/22/2025", 0, 3100, "تم"],
      ["اشرف محسن", "صنعاء", "07/31/2025", 2000, 1100, ""],
    ];
    const h = detectHeaderRow(grid);
    expect(h).toBe(1);
    expect(detectTitleAgent(grid, h)).toBe("خالد عباس");
    const roles = grid[h]!.map((c) => guessRole(String(c)));
    const recs = buildRecords({ grid, headerRow: h, roles, fixedAgent: "خالد عباس", file: "f", sheet: "s" });
    expect(recs.every((r) => r.agentRaw === "خالد عباس")).toBe(true);
    const s = summarize(recs, {})[0]!;
    expect(s.passports).toBe(2);
    expect(s.paid).toBe(2000);
    expect(s.remaining).toBe(4200);
  });

  it("suggests similar agent names", () => {
    const s = suggestMerges(["ابو همام العجيري", "ابو  همام العجيري", "علي منيع"]);
    expect(s).toHaveLength(1);
  });

  it("accumulates repeated passports instead of doubling debt", () => {
    const base = { file: "f", sheet: "s", agentRaw: "أحمد", receipt: "", date: "", status: "", destination: "", profession: "", notes: "" };
    const recs = [
      { ...base, id: "1", passport: "خيرالله محمد صادق", paid: 0, remaining: 3300 },
      { ...base, id: "2", passport: "خير الله  محمد صادق", paid: 3000, remaining: 500 },
      { ...base, id: "3", passport: "علي", paid: 100, remaining: 200 },
    ];
    const s = summarize(recs, {})[0]!;
    expect(s.passports).toBe(2);
    const acc = s.accounts.find((a) => a.records.length === 2)!;
    expect(acc.remaining).toBe(300);
    expect(acc.diff).toBe(200);
    expect(s.remaining).toBe(500);
    expect(s.paid).toBe(3100);
  });

  it("maps المهنة column to profession, not destination", () => {
    expect(guessRole("المهنه")).toBe("profession");
    expect(guessRole("مهنة")).toBe("profession");
    expect(guessRole("الجهه")).toBe("destination");
    const grid = [
      ["اسم الجواز", "المهنه", "الجهه", "الواصل", "المتبقي"],
      ["علاء عبدالله", "سائق", "عدن", 0, 3100],
    ];
    const h = detectHeaderRow(grid);
    const roles = grid[h]!.map((c) => guessRole(String(c)));
    const recs = buildRecords({ grid, headerRow: h, roles, fixedAgent: "", file: "f", sheet: "s" });
    expect(recs[0]!.profession).toBe("سائق");
    expect(recs[0]!.destination).toBe("عدن");
  });
});

describe("shared receipts", () => {
  const receipt = (id: string, passport: string, paid: number, remaining: number): TxRecord => ({
    id, passport, paid, remaining, agentRaw: "خالد عباس", file: "shared.csv", sheet: "s",
    receipt: "16988", date: "", profession: "سائق", status: "تم", destination: "عدن", notes: "ملاحظة",
  });
  const names = "نزار امين + عاهد فاهم + فارس نصر";

  it("splits the initial 10,800 due into three independent 3,600 balances", () => {
    const source = receipt("1", names, 0, 10800);
    const summary = summarize([source], {})[0];
    expect(summary?.passports).toBe(3);
    expect(summary?.accounts.map((account) => account.due)).toEqual([3600, 3600, 3600]);
    expect(summary?.remaining).toBe(10800);
    expect(summary?.accounts.map((account) => account.name)).toEqual(["نزار امين", "عاهد فاهم", "فارس نصر"]);
    expect(summary?.accounts[0]?.records[0]).toMatchObject({ receipt: "16988", profession: "سائق", status: "تم", destination: "عدن", notes: "ملاحظة" });
    expect(source.passport).toBe(names);
  });

  it("divides an initial payment equally and preserves the full amount", () => {
    const summary = summarize([receipt("1", names, 10800, 0)], {})[0];
    expect(summary?.accounts.map((account) => account.paid)).toEqual([3600, 3600, 3600]);
    expect(summary?.paid).toBe(10800);
  });

  it("matches later shared equal payments with normalized prior names", () => {
    const summary = summarize([receipt("1", names, 0, 10800), receipt("2", "نزار أمين + عاهد فاهم + فارس نصر", 9000, 1800)], {})[0];
    expect(summary?.accounts.map((account) => account.remaining)).toEqual([600, 600, 600]);
    expect(summary?.paid).toBe(9000);
    expect(summary?.accounts.every((account) => account.records[1]?.sharedReceipt?.needsReview === false)).toBe(true);
  });

  it("matches a subsequent individual payment without doubling the original debt", () => {
    const summary = summarize([receipt("1", names, 0, 10800), receipt("2", "نزار أمين", 3000, 500)], {})[0];
    expect(summary?.accounts[0]?.remaining).toBe(600);
    expect(summary?.total).toBe(10800);
    expect(summary?.passports).toBe(3);
  });

  it("does not guess allocations when previous balances differ and counts receipt once", () => {
    const summary = summarize([receipt("1", names, 0, 10800), receipt("2", "نزار امين", 1000, 2600), receipt("3", names, 6000, 3800)], {})[0];
    expect(summary?.accounts.map((account) => account.remaining)).toEqual([2600, 3600, 3600]);
    expect(summary?.accounts.every((account) => account.records.at(-1)?.sharedReceipt?.needsReview)).toBe(true);
    expect(summary?.pendingPaid).toBe(6000);
    expect(summary?.paid).toBe(7000);
    expect(summary?.remaining).toBe(3800);
    expect(summary?.total).toBe(10800);
  });

  it("flags missing previous participants without assigning the shared payment", () => {
    const summary = summarize([receipt("1", "نزار امين", 0, 3600), receipt("2", names, 3000, 600)], {})[0];
    expect(summary?.pendingPaid).toBe(3000);
    expect(summary?.accounts.map((account) => account.paid)).toEqual([0, 0, 0]);
  });

  it("flags inconsistent later receipt totals even if earlier balances are equal", () => {
    const summary = summarize([receipt("1", names, 0, 10800), receipt("2", names, 9000, 500)], {})[0];
    expect(summary?.pendingPaid).toBe(9000);
    expect(summary?.accounts.map((account) => account.remaining)).toEqual([3600, 3600, 3600]);
  });

  it("recognizes explicit separators without breaking ordinary compound names", () => {
    expect(splitPassportNames("خير الله محمد صادق")).toEqual(["خير الله محمد صادق"]);
    expect(splitPassportNames("نزار امين، عاهد فاهم, فارس نصر")).toHaveLength(3);
    expect(splitPassportNames("خيرالله محمد + خير الله محمد")).toHaveLength(1);
  });

  it("preserves cents and does not split derived records twice", () => {
    const rows = processSharedReceipts([receipt("1", names, 100, 0)]);
    expect(rows.map((row) => row.paid)).toEqual([33.34, 33.33, 33.33]);
    expect(processSharedReceipts(rows)).toEqual(rows);
  });

  it("keeps different agents independent", () => {
    const summary = summarize([receipt("1", names, 0, 10800), { ...receipt("2", names, 0, 6000), agentRaw: "علي" }], {});
    expect(summary.map((agent) => agent.accounts[0]?.remaining)).toEqual([3600, 2000]);
  });

  it("retains uncertainty on later receipts until prior allocation is reviewed", () => {
    const summary = summarize([receipt("1", names, 0, 10800), receipt("2", names, 9000, 500), receipt("3", names, 1800, 9000)], {})[0];
    expect(summary?.pendingPaid).toBe(10800);
    expect(summary?.accounts.every((account) => account.records.at(-1)?.sharedReceipt?.needsReview)).toBe(true);
  });

  it("processes unambiguous dated receipts chronologically", () => {
    const summary = summarize([
      { ...receipt("2", names, 9000, 1800), date: "2024-02-01" },
      { ...receipt("1", names, 0, 10800), date: "2024-01-01" },
    ], {})[0];
    expect(summary?.pendingPaid).toBe(0);
    expect(summary?.accounts.map((account) => account.remaining)).toEqual([600, 600, 600]);
  });
});
