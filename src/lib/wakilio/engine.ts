// Pure parsing / matching logic for agent Excel imports (no DOM, testable).

export type ColumnRole =
  | "ignore"
  | "passport"
  | "receipt"
  | "agent"
  | "paid"
  | "remaining"
  | "date"
  | "status"
  | "destination"
  | "profession"
  | "notes";

export const ROLE_LABELS: Record<ColumnRole, string> = {
  ignore: "تجاهل",
  passport: "اسم الجواز",
  receipt: "رقم السند",
  agent: "الوكيل",
  paid: "المدفوع / الواصل",
  remaining: "المتبقي",
  date: "التاريخ",
  status: "الحالة",
  destination: "الجهة",
  profession: "المهنة",
  notes: "ملاحظات",
};

const ROLE_KEYWORDS: [ColumnRole, string[]][] = [
  ["remaining", ["متبقي", "المتبقى", "متبقى", "باقي", "الباقي"]],
  ["paid", ["مدفوع", "واصل", "الواصل", "مستلم المبلغ"]],
  ["agent", ["وكيل", "الوكيل", "المندوب"]],
  ["passport", ["اسم الجواز", "الجواز", "الاسم", "اسم"]],
  ["receipt", ["سند", "رقم"]],
  ["date", ["تاريخ"]],
  ["status", ["حاله", "حالة", "بالنظام"]],
  ["profession", ["مهنه", "مهنة", "المهنة", "وظيفه", "وظيفة"]],
  ["destination", ["جهه", "جهة"]],
  ["notes", ["ملاحظ"]],
];

export function normalizeText(s: unknown): string {
  return String(s ?? "")
    .replace(/\u0640/g, "") // kashida ـ
    .replace(/[\u064B-\u0652]/g, "") // harakat
    .replace(/\s+/g, " ")
    .trim();
}

/** Aggressive normalization for name matching. */
export function nameKey(s: unknown): string {
  return normalizeText(s)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const ZERO_WORDS = ["لاشي", "لاشيء", "لا شي", "لا شيء", "لايوجد", "لا يوجد", "-", "—", "صفر", "خالص"];

/** Parses amounts; text like "لاشي" counts as 0. Returns null when non-numeric text. */
export function parseAmount(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = normalizeText(v);
  if (!s) return 0;
  if (ZERO_WORDS.some((w) => s.replace(/\s/g, "") === w.replace(/\s/g, ""))) return 0;
  s = s
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[٬,\s]/g, "")
    .replace(/٫/g, ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export function guessRole(header: string): ColumnRole {
  const h = normalizeText(header);
  if (!h) return "ignore";
  for (const [role, kws] of ROLE_KEYWORDS) if (kws.some((k) => h.includes(k))) return role;
  return "ignore";
}

export type Grid = unknown[][];

/** Finds the header row: the row (among the first 15) with most recognized column names. */
export function detectHeaderRow(grid: Grid): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(15, grid.length); i++) {
    const score = (grid[i] ?? []).filter((c) => guessRole(String(c ?? "")) !== "ignore").length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Agent name from a merged title row above the header (e.g. "خالـــــد عباس"). */
export function detectTitleAgent(grid: Grid, headerRow: number): string {
  for (let i = headerRow - 1; i >= 0; i--) {
    const cells = (grid[i] ?? []).map(normalizeText).filter(Boolean);
    if (cells.length === 1 && isNaN(Number(cells[0]))) return cells[0]!;
  }
  return "";
}

export type TxRecord = {
  id: string;
  file: string;
  sheet: string;
  agentRaw: string;
  passport: string;
  receipt: string;
  paid: number;
  remaining: number;
  date: string;
  status: string;
  destination: string;
  profession: string;
  notes: string;
  sharedReceipt?: {
    sourceId: string;
    participants: string[];
    originalPaid: number;
    originalRemaining: number;
    needsReview: boolean;
    /** This passport's balance before the receipt (null = no earlier record). */
    priorBalance?: number | null;
    /** True when the shares come from a saved manual allocation. */
    allocated?: boolean;
  };
};

/** One passport's manual share of a shared receipt. */
export type ReceiptShare = { key: string; name: string; paid: number; remaining: number };
/** Saved manual allocations keyed by the original (source) transaction id. */
export type Allocations = Record<string, ReceiptShare[]>;

function formatDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return normalizeText(v);
}

export function buildRecords(opts: {
  grid: Grid;
  headerRow: number;
  roles: ColumnRole[];
  fixedAgent: string; // used when no agent column, or when column cell empty
  file: string;
  sheet: string;
}): TxRecord[] {
  const { grid, headerRow, roles, fixedAgent, file, sheet } = opts;
  const col = (r: ColumnRole) => roles.indexOf(r);
  const idx = {
    passport: col("passport"),
    receipt: col("receipt"),
    agent: col("agent"),
    paid: col("paid"),
    remaining: col("remaining"),
    date: col("date"),
    status: col("status"),
    destination: col("destination"),
    profession: col("profession"),
    notes: col("notes"),
  };
  const get = (row: unknown[], i: number) => (i >= 0 ? row[i] : "");
  const out: TxRecord[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    const passport = normalizeText(get(row, idx.passport));
    if (!passport) continue;
    if (/^(المجموع|الاجمالي|الإجمالي|اجمالي|إجمالي)/.test(passport)) continue;
    const agentRaw = normalizeText(get(row, idx.agent)) || normalizeText(fixedAgent) || "بدون وكيل";
    out.push({
      id: `${file}|${sheet}|${r}`,
      file,
      sheet,
      agentRaw,
      passport,
      receipt: normalizeText(get(row, idx.receipt)),
      paid: parseAmount(get(row, idx.paid)),
      remaining: parseAmount(get(row, idx.remaining)),
      date: formatDate(get(row, idx.date)),
      status: normalizeText(get(row, idx.status)),
      destination: normalizeText(get(row, idx.destination)),
      profession: normalizeText(get(row, idx.profession)),
      notes: normalizeText(get(row, idx.notes)),
    });
  }
  return out;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

export function similarity(a: string, b: string): number {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export type MergeSuggestion = { a: string; b: string; score: number };

/** Suggest pairs of agent names that are probably the same person. */
export function suggestMerges(names: string[], threshold = 0.8): MergeSuggestion[] {
  const out: MergeSuggestion[] = [];
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]!, b = names[j]!;
      const s = similarity(a, b);
      if (s >= threshold) out.push({ a, b, score: s });
    }
  return out.sort((p, q) => q.score - p.score);
}

export type MergeCluster = { names: string[]; score: number; exact: boolean };

/** Name similarity that also catches one spelling contained in a longer one ("الامل" ⊂ "وكالة الأمل"). */
export function agentSimilarity(a: string, b: string): number {
  const base = similarity(a, b);
  const x = nameKey(a), y = nameKey(b);
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 4 && long.includes(short)) return Math.max(base, 0.75 + 0.2 * (short.length / long.length));
  return base;
}

/** Groups every spelling of the same agent into one cluster (3, 4, 5+ names), skipping dismissed pairs. */
export function suggestClusters(names: string[], threshold = 0.8, dismissed: string[] = []): MergeCluster[] {
  const skip = new Set(dismissed);
  const parent = names.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const best = new Map<number, number>();
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i]!, b = names[j]!;
      if (skip.has(`${a}|${b}`) || skip.has(`${b}|${a}`)) continue;
      const s = agentSimilarity(a, b);
      if (s < threshold) continue;
      const ra = find(i), rb = find(j);
      const prev = Math.max(best.get(ra) ?? 0, best.get(rb) ?? 0, s);
      parent[ra] = rb;
      best.set(rb, prev);
    }
  const groups = new Map<number, string[]>();
  names.forEach((n, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), n]); });
  return [...groups.entries()].filter(([, g]) => g.length > 1).map(([r, g]) => ({
    names: g,
    score: best.get(r) ?? threshold,
    exact: g.every((n) => nameKey(n) === nameKey(g[0]!)),
  })).sort((p, q) => Number(q.exact) - Number(p.exact) || q.names.length - p.names.length || q.score - p.score);
}

/** Renames (or merges) agent `from` into `to`; every alias pointing at `from` follows, with no cycles. */
export function renameAgent(aliases: Record<string, string>, from: string, to: string): Record<string, string> {
  const name = normalizeText(to);
  if (!name || name === from) return aliases;
  // Renaming to a spelling owned by another agent merges into that agent.
  const owner = resolveAgent(name, aliases);
  const target = owner !== name && owner !== from ? owner : name;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(aliases)) {
    const t = v === from ? target : v;
    if (k === target || k === t) continue;
    next[k] = t;
  }
  if (from !== target) next[from] = target;
  return next;
}

export function mergeAgents(aliases: Record<string, string>, from: string[], into: string): Record<string, string> {
  return from.filter((f) => f !== into).reduce((acc, f) => renameAgent(acc, f, into), aliases);
}

export type PassportAccount = {
  key: string;
  name: string;
  variants: string[];
  records: TxRecord[];
  due: number; // original amount owed (first row: paid + remaining)
  paid: number; // cumulative payments across all rows
  remaining: number; // actual balance = due - paid
  recordedRemaining: number; // remaining written on the latest row
  diff: number; // recordedRemaining - remaining (audit gap)
};

/** Passport-name key: ignores spaces, hamza forms, diacritics, ta marbuta. */
export const passportKey = (s: string) => nameKey(s);

/** Explicit separators only: ordinary spaces and the Arabic conjunction are names, not delimiters. */
export function splitPassportNames(value: string): string[] {
  return [...new Map(value.split(/[+＋،,;؛\n]+/u)
    .map(normalizeText).filter(Boolean).map((name) => [passportKey(name), name])).values()];
}

function receiptDate(value: string): number | undefined {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const local = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!local) return undefined;
  const a = Number(local[1]), b = Number(local[2]);
  if (a <= 12 && b <= 12) return undefined;
  return Date.UTC(Number(local[3]), (b > 12 ? a : b) - 1, b > 12 ? b : a);
}

/** Derived rows leave persisted source receipts untouched, so reloading/importing never splits twice. */
const cents = (n: number) => Math.round(n * 100);

/** Splits an amount by weights to the cent; the parts always add up to the exact amount. */
export function splitByWeights(amount: number, weights: number[]): number[] {
  const n = weights.length;
  if (!n) return [];
  const clean = weights.map((w) => (isFinite(w) && w > 0 ? w : 0));
  const sum = clean.reduce((t, w) => t + w, 0);
  const use = sum > 0 ? clean : clean.map(() => 1);
  const total = use.reduce((t, w) => t + w, 0);
  const target = cents(amount);
  const raw = use.map((w) => (target * w) / total);
  const base = raw.map((x) => Math.trunc(x));
  let left = target - base.reduce((t, x) => t + x, 0);
  const order = raw.map((x, i) => ({ i, f: Math.abs(x - Math.trunc(x)) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; left !== 0 && n > 0; k++) {
    const i = order[k % n]!.i;
    base[i] = base[i]! + Math.sign(left);
    left -= Math.sign(left);
  }
  return base.map((c) => c / 100);
}

export type AllocationCheck = { valid: boolean; paidDiff: number; remainingDiff: number; issues: string[] };

/** Accounting check: every participant exactly once, valid amounts, and shares adding up to the receipt. */
export function checkAllocation(receipt: { paid: number; remaining: number; participants: string[] }, shares: ReceiptShare[]): AllocationCheck {
  const issues: string[] = [];
  const keys = receipt.participants.map(passportKey);
  const shareKeys = shares.map((s) => s.key);
  if (shares.length !== keys.length || new Set(shareKeys).size !== shareKeys.length || keys.some((k) => !shareKeys.includes(k))) issues.push("الحصص لا تطابق جوازات السند");
  if (shares.some((s) => !isFinite(s.paid) || !isFinite(s.remaining))) issues.push("يوجد مبلغ غير صالح");
  if (receipt.paid >= 0 && shares.some((s) => s.paid < 0)) issues.push("لا يمكن أن تكون حصة المدفوع بالسالب");
  const paidDiff = (cents(receipt.paid) - shares.reduce((t, s) => t + cents(s.paid || 0), 0)) / 100;
  const remainingDiff = (cents(receipt.remaining) - shares.reduce((t, s) => t + cents(s.remaining || 0), 0)) / 100;
  if (paidDiff !== 0) issues.push("مجموع حصص المدفوع لا يساوي مدفوع السند");
  if (remainingDiff !== 0) issues.push("مجموع حصص المتبقي لا يساوي متبقي السند");
  return { valid: issues.length === 0, paidDiff, remainingDiff, issues };
}

export function processSharedReceipts(records: TxRecord[], allocations: Allocations = {}): TxRecord[] {
  const dated = records.map((record) => receiptDate(record.date));
  // Only reorder when every date can be interpreted; otherwise retain source order.
  const ordered = dated.every((date) => date !== undefined)
    ? records.map((record, index) => ({ record, index, date: dated[index] ?? 0 }))
      .sort((a, b) => a.date - b.date || a.index - b.index).map(({ record }) => record)
    : records;
  const balances = new Map<string, { due: number; paid: number; uncertain: boolean }>();
  const result: TxRecord[] = [];
  const track = (record: TxRecord) => {
    const key = passportKey(record.passport);
    const previous = balances.get(key);
    balances.set(key, previous
      ? { due: previous.due || record.paid + record.remaining, paid: previous.paid + record.paid, uncertain: previous.uncertain || !!record.sharedReceipt?.needsReview }
      : { due: record.paid + record.remaining, paid: record.paid, uncertain: !!record.sharedReceipt?.needsReview });
    result.push(record);
  };
  // Preserve totals to the cent, including amounts not exactly divisible by the participant count.
  const divide = (amount: number, count: number, index: number) => {
    const cents = Math.round(amount * 100);
    const base = Math.trunc(cents / count);
    const remainder = cents - base * count;
    return (base + (index < Math.abs(remainder) ? Math.sign(remainder) : 0)) / 100;
  };
  for (const record of ordered) {
    if (record.sharedReceipt) { track(record); continue; }
    const participants = splitPassportNames(record.passport);
    if (participants.length < 2) { track({ ...record, passport: participants[0] ?? record.passport }); continue; }
    const previous = participants.map((name) => balances.get(passportKey(name)));
    const first = previous.every((balance) => !balance);
    const existing = previous.every((balance) => balance !== undefined);
    const remaining = previous.map((balance) => balance ? balance.due - balance.paid : 0);
    const equalBalances = remaining.every((value) => Math.abs(value - (remaining[0] ?? 0)) < 0.005);
    const totalBalance = remaining.reduce((total, amount) => total + amount, 0);
    const consistentTotal = Math.abs(totalBalance - record.paid - record.remaining) < 0.015;
    const saved = allocations[record.id];
    const manual = saved && checkAllocation({ paid: record.paid, remaining: record.remaining, participants }, saved).valid
      ? new Map(saved.map((share) => [share.key, share])) : null;
    const needsReview = !manual && !first && !(existing && equalBalances && consistentTotal && previous.every((balance) => !balance?.uncertain));
    participants.forEach((passport, index) => {
      const share = manual?.get(passportKey(passport));
      track({
        ...record,
        id: `${record.id}|person:${passportKey(passport)}`,
        passport,
        paid: share ? share.paid : needsReview ? 0 : divide(record.paid, participants.length, index),
        remaining: share ? share.remaining : needsReview ? remaining[index] ?? 0 : divide(record.remaining, participants.length, index),
        sharedReceipt: {
          sourceId: record.id, participants, originalPaid: record.paid,
          originalRemaining: record.remaining, needsReview,
          priorBalance: previous[index] ? remaining[index] ?? 0 : null,
          allocated: !!share,
        },
      });
    });
  }
  return result;
}

/** Groups an agent's rows by passport and computes the cumulative real balance. */
export function groupPassports(records: TxRecord[], allocations: Allocations = {}): PassportAccount[] {
  const map = new Map<string, TxRecord[]>();
  for (const r of processSharedReceipts(records, allocations)) {
    const k = passportKey(r.passport) || r.passport;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()].map(([key, recs]) => {
    const first = recs.find((r) => r.paid + r.remaining > 0) ?? recs[0]!;
    const due = first.paid + first.remaining;
    const paid = recs.reduce((t, r) => t + r.paid, 0);
    const remaining = recs.length === 1 ? recs[0]!.remaining : due - paid;
    const recordedRemaining = recs[recs.length - 1]!.remaining;
    return {
      key,
      name: recs[0]!.passport,
      variants: [...new Set(recs.map((r) => r.passport))],
      records: recs,
      due: recs.length === 1 ? recs[0]!.paid + recs[0]!.remaining : due,
      paid,
      remaining,
      recordedRemaining,
      diff: recordedRemaining - remaining,
    };
  });
}

export type AgentSummary = {
  name: string;
  aliases: string[];
  passports: number;
  paid: number;
  remaining: number;
  total: number;
  records: TxRecord[];
  accounts: PassportAccount[];
  pendingPaid: number; // received on shared receipts but not assigned to individual passports
};

export function resolveAgent(raw: string, aliases: Record<string, string>): string {
  let n = raw;
  const seen = new Set<string>();
  while (aliases[n] && !seen.has(n)) {
    seen.add(n);
    n = aliases[n]!;
  }
  return n;
}

export function summarize(records: TxRecord[], aliases: Record<string, string>, allocations: Allocations = {}): AgentSummary[] {
  const map = new Map<string, AgentSummary>();
  for (const r of records) {
    const name = resolveAgent(r.agentRaw, aliases);
    let s = map.get(name);
    if (!s) {
      s = { name, aliases: [], passports: 0, paid: 0, remaining: 0, total: 0, records: [], accounts: [], pendingPaid: 0 };
      map.set(name, s);
    }
    if (r.agentRaw !== name && !s.aliases.includes(r.agentRaw)) s.aliases.push(r.agentRaw);
    s.records.push(r);
  }
  for (const s of map.values()) {
    s.accounts = groupPassports(s.records, allocations);
    s.passports = s.accounts.length;
    const pending = new Map<string, number>();
    for (const account of s.accounts) for (const record of account.records) {
      if (record.sharedReceipt?.needsReview) pending.set(record.sharedReceipt.sourceId, record.sharedReceipt.originalPaid);
    }
    s.pendingPaid = [...pending.values()].reduce((total, amount) => total + amount, 0);
    s.paid = s.accounts.reduce((t, a) => t + a.paid, 0) + s.pendingPaid;
    s.remaining = s.accounts.reduce((t, a) => t + a.remaining, 0) - s.pendingPaid;
    s.total = s.paid + s.remaining;
  }
  return [...map.values()].sort((a, b) => b.remaining - a.remaining);
}

export type SharedParticipant = { key: string; name: string; prior: number | null; paid: number; remaining: number };
export type SharedReceiptInfo = {
  sourceId: string;
  agent: string;
  receipt: string;
  date: string;
  paid: number;
  remaining: number;
  participants: SharedParticipant[];
  needsReview: boolean;
  allocated: boolean;
};

/** Every shared receipt (one entry per original Excel row) with each passport's current share. */
export function listSharedReceipts(agents: AgentSummary[]): SharedReceiptInfo[] {
  const out = new Map<string, SharedReceiptInfo>();
  const orders = new Map<string, string[]>();
  for (const agent of agents) for (const account of agent.accounts) for (const r of account.records) {
    const sr = r.sharedReceipt;
    if (!sr) continue;
    let info = out.get(sr.sourceId);
    if (!info) {
      info = { sourceId: sr.sourceId, agent: agent.name, receipt: r.receipt, date: r.date, paid: sr.originalPaid, remaining: sr.originalRemaining, participants: [], needsReview: sr.needsReview, allocated: !!sr.allocated };
      out.set(sr.sourceId, info);
      orders.set(sr.sourceId, sr.participants.map(passportKey));
    }
    info.participants.push({ key: passportKey(r.passport), name: r.passport, prior: sr.priorBalance ?? null, paid: sr.needsReview ? 0 : r.paid, remaining: sr.needsReview ? 0 : r.remaining });
  }
  for (const info of out.values()) {
    const order = orders.get(info.sourceId) ?? [];
    info.participants.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  }
  return [...out.values()];
}

/** Helper suggestions for the allocation window: equal split, or proportional to each passport's prior debt. */
export function suggestShares(receipt: SharedReceiptInfo, mode: "equal" | "debt"): ReceiptShare[] {
  const weights = receipt.participants.map((p) => (mode === "debt" ? Math.max(0, p.prior ?? 0) : 1));
  const paid = splitByWeights(receipt.paid, weights);
  const remaining = splitByWeights(receipt.remaining, weights);
  return receipt.participants.map((p, i) => ({ key: p.key, name: p.name, paid: paid[i]!, remaining: remaining[i]! }));
}
