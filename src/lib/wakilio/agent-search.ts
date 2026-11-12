import { nameKey, type AgentSummary } from "./engine";

/** Why an agent appeared in a smart search (name = direct match on the agent's own name). */
export type MatchKind = "name" | "alias" | "passport" | "receipt" | "date" | "notes";
export type AgentMatch = { kind: MatchKind; value: string; count: number };
export type AgentHit = { agent: AgentSummary; match: AgentMatch };

const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
const textKey = (s: unknown) => nameKey(latinDigits(String(s ?? "")));
const dateQuery = (s: string) => latinDigits(s).trim().replace(/[-.\\]/g, "/").replace(/\s+/g, "");

/** All spellings of a stored date ("2023-10-19" or "19/10/2023") so either typed form finds it. */
export function dateVariants(raw: string): string[] {
  const s = dateQuery(raw);
  let m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  let y: string, mo: string, d: string;
  if (m) [, y, mo, d] = m as unknown as [string, string, string, string];
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) [, d, mo, y] = m as unknown as [string, string, string, string];
  else return s ? [s] : [];
  const p = (n: string) => n.padStart(2, "0");
  const un = (n: string) => String(Number(n));
  return [...new Set([`${y}/${p(mo)}/${p(d)}`, `${p(d)}/${p(mo)}/${y}`, `${un(d)}/${un(mo)}/${y}`])];
}

type Indexed = {
  agent: AgentSummary;
  names: string[];
  aliases: { raw: string; key: string }[];
  passports: { raw: string; key: string }[];
  records: { receipt: string; receiptKey: string; date: string; dates: string[]; notes: string; notesKey: string }[];
};

/** Pre-normalizes every searchable field once, so typing stays fast on large files. */
export function buildAgentIndex(agents: AgentSummary[]): Indexed[] {
  return agents.map((agent) => ({
    agent,
    names: [textKey(agent.name)],
    aliases: agent.aliases.map((raw) => ({ raw, key: textKey(raw) })),
    passports: agent.accounts.map((a) => ({ raw: a.name, key: textKey(a.name) })),
    records: agent.records.map((r) => ({ receipt: r.receipt, receiptKey: textKey(r.receipt), date: r.date, dates: dateVariants(r.date), notes: r.notes, notesKey: textKey(r.notes) })),
  }));
}

function matchOne(ix: Indexed, key: string, dq: string): AgentMatch | null {
  if (key && ix.names.some((n) => n.includes(key))) return { kind: "name", value: ix.agent.name, count: 1 };
  if (key) {
    const alias = ix.aliases.find((a) => a.key.includes(key));
    if (alias) return { kind: "alias", value: alias.raw, count: 1 };
    const passports = ix.passports.filter((p) => p.key.includes(key));
    if (passports.length) return { kind: "passport", value: passports[0]!.raw, count: passports.length };
    const exact = ix.records.filter((r) => r.receiptKey === key);
    if (exact.length) return { kind: "receipt", value: exact[0]!.receipt, count: exact.length };
    const receipts = ix.records.filter((r) => r.receiptKey.includes(key));
    if (receipts.length) return { kind: "receipt", value: receipts[0]!.receipt, count: receipts.length };
  }
  if (dq && /\d/.test(dq)) {
    const dates = ix.records.filter((r) => r.dates.some((d) => d.includes(dq)));
    if (dates.length) return { kind: "date", value: dates[0]!.date, count: dates.length };
  }
  if (key) {
    const notes = ix.records.filter((r) => r.notesKey.includes(key));
    if (notes.length) return { kind: "notes", value: notes[0]!.notes, count: notes.length };
  }
  return null;
}

/**
 * Smart search for the agents list: agent name, merged names, passport names, receipt number,
 * date and notes. Agents matched by their own name come first; original order is kept otherwise.
 */
export function searchAgents(index: Indexed[], query: string): AgentHit[] {
  const key = textKey(query);
  const dq = dateQuery(query);
  if (!key && !dq) return index.map((ix) => ({ agent: ix.agent, match: { kind: "name", value: ix.agent.name, count: 1 } }));
  const hits: AgentHit[] = [];
  for (const ix of index) {
    const match = matchOne(ix, key, dq);
    if (match) hits.push({ agent: ix.agent, match });
  }
  const direct = (h: AgentHit) => (h.match.kind === "name" || h.match.kind === "alias" ? 0 : 1);
  return hits.map((h, i) => [h, i] as const).sort((a, b) => direct(a[0]) - direct(b[0]) || a[1] - b[1]).map(([h]) => h);
}

const short = (s: string, n = 28) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Short Arabic reason shown on the agent row when the match is not the agent's own name. */
export function matchLabel(m: AgentMatch): string | null {
  const more = m.count > 1 ? ` (+${m.count - 1})` : "";
  switch (m.kind) {
    case "name": return null;
    case "alias": return `اسم مدمج: ${short(m.value)}`;
    case "passport": return `مطابقة في جواز: ${short(m.value)}${more}`;
    case "receipt": return `سند رقم: ${m.value}${more}`;
    case "date": return `التاريخ: ${m.value} (${m.count} حركة)`;
    case "notes": return `في البيان: ${short(m.value)}${more}`;
  }
}
