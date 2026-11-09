import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, GitMerge, X, Search, Zap, Undo2, History, Crown, Check, AlertTriangle, Users } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nameKey, normalizeText, suggestClusters, type AgentSummary, type MergeCluster } from "@/lib/wakilio/engine";

const fmt = (n: number) => n.toLocaleString("en-US");

/** Arabic-aware normalization for search matching. */
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

type Totals = { p: number; due: number; paid: number; rem: number };

/** One-step merge confirmation: review chosen names and type the unified agent name. */
function MergeConfirmDialog({ open, names, suggested, totals, byName, onConfirm, onClose }: {
  open: boolean;
  names: string[];
  suggested: string;
  totals: Totals;
  byName: Map<string, AgentSummary>;
  onConfirm: (into: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(suggested);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setValue(suggested); requestAnimationFrame(() => input.current?.select()); } }, [open, suggested]);
  const next = normalizeText(value);
  // A typed name that matches another agent (outside this selection) joins that agent.
  const clash = next ? [...byName.keys()].find((n) => !names.includes(n) && nameKey(n) === nameKey(next)) : undefined;
  const into = clash ?? next;
  const confirm = () => { if (into) onConfirm(into); };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent dir="rtl" className="max-w-md gap-5 rounded-2xl border-border bg-card p-6 text-card-foreground shadow-2xl">
        <AlertDialogHeader className="space-y-2 text-right sm:text-right">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25"><GitMerge className="h-5 w-5" /></div>
          <AlertDialogTitle className="font-display text-center text-lg">تأكيد دمج أسماء الوكيل</AlertDialogTitle>
          <AlertDialogDescription className="text-center">ستُجمع كل عمليات هذه الأسماء في كشف واحد بالاسم الموحد، ويمكنك فك الدمج لاحقاً.</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-secondary/60 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="h-3.5 w-3.5" /> الأسماء المحددة (<span className="num">{names.length}</span>)</div>
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {names.map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-border">
                  {n}<span className="num text-[10px] font-normal text-muted-foreground">{fmt(byName.get(n)?.passports ?? 0)} جواز</span>
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-2 text-center text-[11px]">
              <div><div className="text-muted-foreground">الجوازات</div><div className="num font-bold text-foreground">{fmt(totals.p)}</div></div>
              <div><div className="text-muted-foreground">الواصل</div><div className="num font-bold text-primary">{fmt(totals.paid)}</div></div>
              <div><div className="text-muted-foreground">المتبقي</div><div className="num font-bold text-destructive">{fmt(totals.rem)}</div></div>
            </div>
          </div>

          <label className="block rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
            <span className="text-[11px] text-primary">الاسم الموحد للوكيل</span>
            <input
              ref={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } }}
              placeholder="اكتب اسم الوكيل المعتمد…"
              aria-label="الاسم الموحد للوكيل"
              className="font-display mt-1 w-full rounded-[10px] border border-border bg-card px-3 py-2 text-base font-bold text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <span className="mt-1.5 block text-[11px] text-muted-foreground">يمكنك تعديل الاسم المقترح أو كتابة اسم جديد بالكامل</span>
          </label>

          {clash && (
            <div className="flex items-start gap-2 rounded-xl bg-warning/12 p-3 text-xs text-warning ring-1 ring-inset ring-warning/30">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>يوجد وكيل آخر بنفس الاسم «{clash}». عند التأكيد ستُضم هذه الأسماء إلى حسابه.</span>
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
          <Button onClick={confirm} disabled={!into} className="flex-1 gap-1.5 rounded-[11px]"><Check className="h-4 w-4" /> تأكيد الدمج</Button>
          <AlertDialogCancel onClick={onClose} className="mt-0 flex-1 rounded-[11px] hover:bg-muted">إلغاء والرجوع</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const pairKeys = (names: string[]) => names.flatMap((a, i) => names.slice(i + 1).map((b) => `${a}|${b}`));

function ClusterCard({ cluster, byName, onMerge, onDismiss }: {
  cluster: MergeCluster;
  byName: Map<string, AgentSummary>;
  onMerge: (from: string[], into: string) => void;
  onDismiss: (keys: string[]) => void;
}) {
  const ordered = [...cluster.names].sort((a, b) => (byName.get(b)?.passports ?? 0) - (byName.get(a)?.passports ?? 0));
  const [picked, setPicked] = useState<string[]>(ordered);
  const [main, setMain] = useState(ordered[0]!);
  const [confirming, setConfirming] = useState(false);
  const chosen = ordered.filter((n) => picked.includes(n));
  const total = chosen.reduce((t, n) => {
    const a = byName.get(n);
    return { p: t.p + (a?.passports ?? 0), due: t.due + (a?.total ?? 0), paid: t.paid + (a?.paid ?? 0), rem: t.rem + (a?.remaining ?? 0) };
  }, { p: 0, due: 0, paid: 0, rem: 0 });
  const toggle = (n: string, on: boolean) => {
    setPicked((p) => (on ? [...p, n] : p.filter((x) => x !== n)));
    if (!on && n === main) setMain(ordered.find((x) => x !== n && picked.includes(x)) ?? main);
  };
  const canMerge = chosen.length >= 2 && chosen.includes(main);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-display font-bold">مجموعة <span className="num">{cluster.names.length}</span> أسماء</span>
          {cluster.exact
            ? <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-inset ring-primary/30">فروق إملائية فقط</span>
            : <span className="num rounded-full bg-chart-3/15 px-2 py-0.5 text-[10px] font-semibold text-chart-3 ring-1 ring-inset ring-chart-3/30">تشابه حتى {Math.round(cluster.score * 100)}%</span>}
        </div>
        <span className="text-[11px] text-muted-foreground">حدد الأسماء التي تريد دمجها</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-[11px] text-muted-foreground">
            <tr className="border-b border-border">
              <th className="w-8 p-2" />
              <th className="p-2 text-right font-semibold">الاسم</th>
              <th className="p-2 text-right font-semibold">الجوازات</th>
              <th className="p-2 text-right font-semibold">المستحق</th>
              <th className="p-2 text-right font-semibold">الواصل</th>
              <th className="p-2 text-right font-semibold">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((n) => {
              const a = byName.get(n);
              const on = picked.includes(n);
              const isMain = n === main && on;
              return (
                <tr key={n} className={`border-b border-border/60 transition-colors last:border-0 ${on ? "" : "opacity-45"}`}>
                  <td className="p-2"><Checkbox checked={on} onCheckedChange={(v) => toggle(n, v === true)} aria-label={`تضمين ${n}`} /></td>
                  <td className="p-2 font-semibold">{n}{a && a.aliases.length > 0 && <span className="num mr-1.5 text-[10px] font-normal text-muted-foreground">(+{a.aliases.length})</span>}</td>
                  <td className="num p-2">{fmt(a?.passports ?? 0)}</td>
                  <td className="num p-2 text-accent">{fmt(a?.total ?? 0)}</td>
                  <td className="num p-2 text-primary">{fmt(a?.paid ?? 0)}</td>
                  <td className="num p-2 text-destructive">{fmt(a?.remaining ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
        <span className="text-muted-foreground">بعد الدمج: <span className="num font-semibold text-foreground">{fmt(total.p)}</span> جواز · الواصل <span className="num font-semibold text-primary">{fmt(total.paid)}</span> · المتبقي <span className="num font-semibold text-destructive">{fmt(total.rem)}</span></span>
        <div className="flex gap-2">
          <Button size="sm" disabled={!canMerge} onClick={() => setConfirming(true)} className="gap-1.5 rounded-[11px]">
            <GitMerge className="h-3.5 w-3.5" /> دمج <span className="num">({chosen.length})</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDismiss(pairKeys(cluster.names))} aria-label="تجاهل المجموعة" title="ليست نفس الوكيل" className="rounded-[11px] hover:border-destructive/60">
            <X className="h-3.5 w-3.5" /> تجاهل
          </Button>
        </div>
      </div>

      <MergeConfirmDialog
        open={confirming}
        names={chosen}
        suggested={main}
        totals={total}
        byName={byName}
        onClose={() => setConfirming(false)}
        onConfirm={(into) => { setConfirming(false); onMerge(chosen, into); }}
      />
    </div>
  );
}

export function MergeSuggestions({
  agents,
  dismissed,
  onMerge,
  onMergeMany,
  onDismiss,
  onUnmerge,
}: {
  agents: AgentSummary[];
  dismissed: string[];
  onMerge: (from: string[], into: string) => void;
  onMergeMany: (groups: { from: string[]; into: string }[]) => void;
  onDismiss: (keys: string[]) => void;
  onUnmerge: (alias: string) => void;
}) {
  const [threshold, setThreshold] = useState(0.8);
  const [query, setQuery] = useState("");
  const byName = useMemo(() => new Map(agents.map((a) => [a.name, a])), [agents]);
  const all = useMemo(() => suggestClusters(agents.map((a) => a.name), threshold, dismissed), [agents, threshold, dismissed]);
  const q = norm(query);
  const clusters = useMemo(() => (q ? all.filter((c) => c.names.some((n) => norm(n).includes(q))) : all), [all, q]);
  const exact = all.filter((c) => c.exact);
  const history = agents.filter((a) => a.aliases.length > 0 && (!q || norm(a.name).includes(q) || a.aliases.some((x) => norm(x).includes(q))));
  const top = (names: string[]) => [...names].sort((a, b) => (byName.get(b)?.passports ?? 0) - (byName.get(a)?.passports ?? 0))[0]!;

  return (
    <div className="suggestions-panel space-y-6">
      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-chart-3/15 text-chart-3"><Sparkles className="h-4 w-4" /></div>
            <div>
              <div className="font-display font-bold">مجموعات الأسماء المتشابهة</div>
              <div className="text-xs text-muted-foreground">كل صيغ الوكيل الواحد في بطاقة واحدة</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {exact.length > 0 && (
              <Button size="sm" onClick={() => onMergeMany(exact.map((c) => ({ from: c.names, into: top(c.names) })))} className="gap-1.5 rounded-[11px]">
                <Zap className="h-3.5 w-3.5" /> دمج كل المطابقات الإملائية (<span className="num">{exact.length}</span>)
              </Button>
            )}
            <span className="num rounded-[11px] bg-chart-3/15 px-2.5 py-1 text-xs font-bold text-chart-3">{q ? `${clusters.length}/${all.length}` : all.length}</span>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-56">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="ابحث عن وكيل…"
              aria-label="بحث في الاقتراحات"
              className="h-8 w-full rounded-[10px] border border-border bg-secondary/40 pr-8 pl-7 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <label className="flex min-w-48 flex-1 items-center gap-3 text-xs text-muted-foreground">
            دقة التشابه
            <input type="range" min={0.6} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
            <span className="num">{Math.round(threshold * 100)}%</span>
          </label>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto">
          {clusters.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{q ? "لا توجد نتائج مطابقة للبحث" : "لا توجد اقتراحات حالياً"}</p>}
          {clusters.map((c) => <ClusterCard key={c.names.join("|")} cluster={c} byName={byName} onMerge={onMerge} onDismiss={onDismiss} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary"><History className="h-4 w-4" /></div>
          <div>
            <div className="font-display font-bold">سجل الأسماء المدمجة</div>
            <div className="text-xs text-muted-foreground">فك الدمج يعيد الاسم حساباً مستقلاً كما كان</div>
          </div>
        </div>
        {history.length === 0
          ? <p className="py-4 text-center text-sm text-muted-foreground">لا توجد أسماء مدمجة بعد</p>
          : <div className="space-y-2">
              {history.map((a) => (
                <div key={a.name} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-xs text-muted-foreground">←</span>
                  {a.aliases.map((x) => (
                    <span key={x} className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs ring-1 ring-inset ring-border">
                      {x}
                      <button type="button" onClick={() => onUnmerge(x)} title="فك الدمج" aria-label={`فك دمج ${x}`} className="inline-flex items-center gap-0.5 rounded-full px-1 text-muted-foreground hover:text-destructive">
                        <Undo2 className="h-3 w-3" /> فك
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}
