import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CircleCheck, Clock, Layers, Search, Split, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWakilioSummary } from "@/components/wakilio/WakilioContext";
import { Stat, fmt } from "@/components/wakilio/AgentStatement";
import { AllocationDialog } from "@/components/wakilio/AllocationDialog";
import type { SharedReceiptInfo } from "@/lib/wakilio/engine";

export const Route = createFileRoute("/_authenticated/shared-receipts")({
  head: () => ({ meta: [
    { title: "WAKILIO | السندات المشتركة" }, { name: "description", content: "مراجعة السندات المشتركة بين عدة جوازات وتخصيص حصة كل جواز من المدفوع والمتبقي." },
    { property: "og:title", content: "WAKILIO | السندات المشتركة" }, { property: "og:description", content: "تخصيص ذكي لحصص السندات المشتركة مع فحص محاسبي لحظي." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: SharedReceipts,
});

type FilterId = "all" | "review" | "done";
const FILTERS: { id: FilterId; label: string; test: (r: SharedReceiptInfo) => boolean }[] = [
  { id: "all", label: "الكل", test: () => true },
  { id: "review", label: "تحتاج مراجعة أو تخصيص", test: (r) => r.needsReview },
  { id: "done", label: "موزعة", test: (r) => !r.needsReview },
];
const PAGE = 150;

function SharedReceipts() {
  const { shared } = useWakilioSummary();
  const [filter, setFilter] = useState<FilterId>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [active, setActive] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const test = FILTERS.find((f) => f.id === filter)!.test;
  const rows = shared
    .filter(test)
    .filter((r) => !term || r.receipt.toLowerCase().includes(term) || r.agent.toLowerCase().includes(term) || r.participants.some((p) => p.name.toLowerCase().includes(term)))
    .sort((a, b) => Number(b.needsReview) - Number(a.needsReview) || a.agent.localeCompare(b.agent, "ar") || a.receipt.localeCompare(b.receipt, "ar", { numeric: true }));
  const pending = shared.filter((r) => r.needsReview).length;
  const totalPaid = shared.reduce((t, r) => t + r.paid, 0);
  const current = shared.find((r) => r.sourceId === active) ?? null;

  return <>
    <header className="page-heading"><div><h1>السندات المشتركة</h1><div className="page-kicker">الحسابات / تخصيص حصص الجوازات</div></div></header>
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat label="إجمالي السندات المشتركة" value={fmt(shared.length)} icon={Layers} />
      <Stat label="سندات موزعة" value={fmt(shared.length - pending)} icon={CircleCheck} tone="text-primary" />
      <Stat label="بانتظار التخصيص / المراجعة" value={fmt(pending)} icon={Clock} tone="text-warning" />
      <Stat label="إجمالي المبالغ المدفوعة" value={fmt(totalPaid)} icon={Wallet} tone="text-accent" />
    </div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => { setFilter(f.id); setLimit(PAGE); }} className="rounded-full">
          {f.label} <span className="num mr-1 opacity-70">{shared.filter(f.test).length}</span>
        </Button>
      ))}
    </div>
    <div className="mb-4 flex items-center gap-2 rounded-[11px] border border-input bg-card px-3 py-2.5">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} aria-label="بحث في السندات المشتركة" placeholder="ابحث برقم السند، الوكيل، أو اسم الجواز..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      {q && <span className="num text-xs text-muted-foreground">{rows.length} نتيجة</span>}
    </div>
    <div className="table-wrap">
      <table className="wakilio-table min-w-[860px]">
        <thead><tr>{["رقم السند / التاريخ", "الوكيل", "الجوازات المشتركة", "المدفوع", "المتبقي", "حالة التوزيع", ""].map((h, i) => <th key={h || i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.sourceId} className="transition-colors hover:bg-secondary/60">
              <td><div className="num font-bold">#{r.receipt || "—"}</div><div className="num text-[11px] text-muted-foreground">{r.date || "بدون تاريخ"}</div></td>
              <td><Link to="/agents" search={{ agent: r.agent }} className="font-semibold hover:text-primary hover:underline">{r.agent}</Link></td>
              <td><div className="flex max-w-[320px] flex-wrap gap-1">{r.participants.map((p) => <span key={p.key} className="rounded-full bg-chart-3/15 px-2 py-0.5 text-[11px] ring-1 ring-inset ring-chart-3/30">{p.name}</span>)}</div></td>
              <td className="num text-primary">{fmt(r.paid)}</td>
              <td className="num text-destructive">{fmt(r.remaining)}</td>
              <td>{r.needsReview
                ? <span className="whitespace-nowrap rounded-full bg-warning/12 px-2 py-1 text-[11px] font-semibold text-warning ring-1 ring-inset ring-warning/30">تحتاج تخصيص</span>
                : r.allocated
                  ? <span className="whitespace-nowrap rounded-full bg-primary/12 px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/30">مخصص يدوياً</span>
                  : <span className="whitespace-nowrap rounded-full bg-accent/12 px-2 py-1 text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/30">موزع بالتساوي</span>}</td>
              <td><Button size="sm" variant={r.needsReview ? "default" : "outline"} onClick={() => setActive(r.sourceId)} className="whitespace-nowrap rounded-[10px]"><Split /> تخصيص الحصص</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty-state"><Layers /><p>{shared.length ? "لا توجد سندات مطابقة" : "لا توجد سندات مشتركة في البيانات المستوردة"}</p></div>}
    </div>
    {rows.length > limit && <div className="mt-4 text-center"><Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>عرض المزيد (<span className="num">{fmt(rows.length - limit)}</span> متبقية)</Button></div>}
    <AllocationDialog receipt={current} onClose={() => setActive(null)} showAgentLink />
  </>;
}
