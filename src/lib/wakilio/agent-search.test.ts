import { describe, expect, it } from "vitest";
import { summarize, type TxRecord } from "./engine";
import { buildAgentIndex, dateVariants, matchLabel, searchAgents } from "./agent-search";

const rec = (id: string, agentRaw: string, passport: string, receipt: string, date: string, notes = "", paid = 100): TxRecord => ({
  id, file: "f.xlsx", sheet: "s", agentRaw, passport, receipt, paid, remaining: 0, date, status: "", destination: "", profession: "", notes,
});
const records = [
  rec("1", "ابو شهاب", "أحمد علي", "13934", "19/10/2023", "حواله-9963779106"),
  rec("2", "ابو شهاب", "سالم محمد", "14777", "2023-12-18", "كاش 1700"),
  rec("3", "مكتب الامل", "خالد صالح", "500", "2022-01-05", ""),
  rec("4", "شهاب الدين", "ناصر", "600", "2022-02-02"),
];
const index = buildAgentIndex(summarize(records, {}));
const find = (q: string) => searchAgents(index, q).map((h) => [h.agent.name, h.match.kind]);

describe("agents smart search", () => {
  it("matches the agent's own name first with no reason badge", () => {
    expect(find("شهاب")).toEqual([["ابو شهاب", "name"], ["شهاب الدين", "name"]]);
    expect(matchLabel(searchAgents(index, "شهاب")[0]!.match)).toBeNull();
  });
  it("finds an agent by a passport name, ignoring hamza forms", () => {
    const [hit] = searchAgents(index, "احمد");
    expect(hit!.agent.name).toBe("ابو شهاب");
    expect(matchLabel(hit!.match)).toBe("مطابقة في جواز: أحمد علي");
  });
  it("finds an agent by exact receipt number, including Arabic digits", () => {
    expect(find("١٤٧٧٧")).toEqual([["ابو شهاب", "receipt"]]);
    expect(matchLabel(searchAgents(index, "14777")[0]!.match)).toBe("سند رقم: 14777");
  });
  it("matches dates whether stored as day/month/year or year-month-day", () => {
    expect(find("2023-10-19")).toEqual([["ابو شهاب", "date"]]);
    expect(find("18/12/2023")).toEqual([["ابو شهاب", "date"]]);
    expect(dateVariants("2022-01-05")).toContain("5/1/2022");
  });
  it("finds an agent by text in the notes", () => {
    expect(find("9963779106")).toEqual([["ابو شهاب", "notes"]]);
  });
  it("returns no agents when nothing matches and everyone for an empty query", () => {
    expect(find("غير موجود")).toEqual([]);
    expect(searchAgents(index, "  ")).toHaveLength(3);
  });
});
