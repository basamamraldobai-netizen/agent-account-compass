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
  };
};

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
export function processSharedReceipts(records: TxRecord[]): TxRecord[] {
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
    const needsReview = !first && !(existing && equalBalances && consistentTotal && previous.every((balance) => !balance?.uncertain));
    participants.forEach((passport, index) => track({
      ...record,
      id: `${record.id}|person:${passportKey(passport)}`,
      passport,
      paid: needsReview ? 0 : divide(record.paid, participants.length, index),
      remaining: needsReview ? remaining[index] ?? 0 : divide(record.remaining, participants.length, index),
      sharedReceipt: {
        sourceId: record.id, participants, originalPaid: record.paid,
        originalRemaining: record.remaining, needsReview,
      },
    }));
  }
  return result;
}

/** Groups an agent's rows by passport and computes the cumulative real balance. */
export function groupPassports(records: TxRecord[]): PassportAccount[] {
  const map = new Map<string, TxRecord[]>();
  for (const r of processSharedReceipts(records)) {
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

export function summarize(records: TxRecord[], aliases: Record<string, string>): AgentSummary[] {
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
    s.accounts = groupPassports(s.records);
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
