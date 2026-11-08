import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Sparkles, GitMerge, X, Search } from "lucide-react";
import { suggestMerges, type AgentSummary } from "@/lib/wakilio/engine";

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

export function MergeSuggestions({
  agents,
  dismissed,
  onMerge,
  onDismiss,
}: {
  agents: AgentSummary[];
  dismissed: string[];
  onMerge: (from: string, into: string) => void;
  onDismiss: (key: string) => void;
}) {
  const [threshold, setThreshold] = useState(0.8);
  const [query, setQuery] = useState("");
  const all = useMemo(
    () =>
      suggestMerges(agents.map((a) => a.name), threshold).filter((s) => !dismissed.includes(`${s.a}|${s.b}`)),
    [agents, threshold, dismissed],
  );
  const q = norm(query);
  const sugg = useMemo(
    () => (q ? all.filter((s) => norm(s.a).includes(q) || norm(s.b).includes(q)) : all),
    [all, q],
  );
  const count = (n: string) => agents.find((a) => a.name === n)?.passports ?? 0;

  return (
    <div className="suggestions-panel">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-chart-3/15 text-chart-3">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display font-bold">صندوق الاقتراحات</div>
            <div className="text-xs text-muted-foreground">مراجعة المطابقات</div>
          </div>
        </div>
        <span className="num rounded-[11px] bg-chart-3/15 px-2.5 py-1 text-xs font-bold text-chart-3">
          {q ? `${sugg.length}/${all.length}` : sugg.length}
        </span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
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
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <label className="flex flex-1 items-center gap-3 text-xs text-muted-foreground">
          دقة التشابه
          <input type="range" min={0.6} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
          <span className="num">{Math.round(threshold * 100)}%</span>
        </label>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {sugg.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {q ? "لا توجد نتائج مطابقة للبحث" : "لا توجد اقتراحات حالياً"}
          </p>
        )}
        {sugg.map((s) => {
          const [keep, drop] = count(s.a) >= count(s.b) ? [s.a, s.b] : [s.b, s.a];
          return (
            <div key={s.a + s.b} className="rounded-[13px] border border-border bg-secondary/60 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{drop}</span>
                <span className="num text-xs text-chart-3">{Math.round(s.score * 100)}%</span>
                <span className="font-semibold">{keep}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button variant="ghost" onClick={() => onMerge(drop, keep)} className="flex flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-primary/15 py-1.5 text-xs font-bold text-primary hover:bg-primary/25">
                  <GitMerge className="h-3.5 w-3.5" /> دمج في «{keep}»
                </Button>
                <Button variant="ghost" onClick={() => onMerge(keep, drop)} className="rounded-[11px] border border-border px-3 py-1.5 text-xs hover:border-primary/50">
                  العكس
                </Button>
                <Button variant="ghost" onClick={() => onDismiss(`${s.a}|${s.b}`)} aria-label="تجاهل" className="rounded-[11px] border border-border px-2.5 hover:border-destructive/60">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
