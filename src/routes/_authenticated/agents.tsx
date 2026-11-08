import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Users, FileUp, ChevronLeft } from "lucide-react";
import { summarize } from "@/lib/wakilio/engine";
import { useWakilio } from "@/components/wakilio/WakilioContext";
import { AgentStatement, Stat, fmt } from "@/components/wakilio/AgentStatement";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/agents")({
  validateSearch: (search: Record<string, unknown>): { agent?: string } => typeof search["agent"] === "string" ? { agent: search["agent"] } : {},
  head: () => ({ meta: [
    { title: "WAKILIO | حسابات وكشوف الوكلاء" }, { name: "description", content: "حسابات الوكلاء وكشوف الجوازات والمهن والواصل والمتبقي والأسماء المدمجة." },
    { property: "og:title", content: "WAKILIO | حسابات وكشوف الوكلاء" }, { property: "og:description", content: "ملخص مالي وكشف حساب تفصيلي لكل وكيل." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Agents,
});
function Agents() {
  const [state, setState] = useWakilio();
  const [q, setQ] = useState("");
  const { agent } = Route.useSearch();
  const navigate = useNavigate();
  const agents = useMemo(() => summarize(state.records, state.aliases), [state.records, state.aliases]);
  const current = agents.find((a) => a.name === agent);
  const shown = agents.filter((a) => a.name.includes(q.trim()));
  const totals = agents.reduce((t, a) => ({ p: t.p + a.passports, paid: t.paid + a.paid, rem: t.rem + a.remaining }), { p: 0, paid: 0, rem: 0 });
  if (current) return <><header className="page-heading"><div><h1>كشف حساب الوكيل</h1><div className="page-kicker">حسابات الوكلاء / {current.name}</div></div></header><AgentStatement agent={current} onBack={() => navigate({ to: "/agents", search: {} })} onUnmerge={(alias) => setState((s) => { const aliases = { ...s.aliases }; delete aliases[alias]; return { ...s, aliases }; })} /></>;
  return <><header className="page-heading"><div><h1>حسابات الوكلاء</h1><div className="page-kicker">الحسابات / الملخص المالي</div></div><div className="flex max-w-full items-center gap-2 rounded-[11px] border border-input bg-card px-3 py-2.5"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث عن وكيل" placeholder="ابحث عن اسم وكيل..." className="min-w-0 w-48 bg-transparent text-xs outline-none" /></div></header>
    <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4"><Stat label="عدد الوكلاء" value={fmt(agents.length)} icon={Users} /><Stat label="إجمالي الجوازات" value={fmt(totals.p)} tone="text-accent" /><Stat label="إجمالي الواصل" value={fmt(totals.paid)} tone="text-primary" /><Stat label="إجمالي المتبقي" value={fmt(totals.rem)} tone="text-warning" /></div>
    <div className="table-wrap"><table className="wakilio-table min-w-[620px]"><thead><tr>{["الوكيل", "الجوازات", "الواصل", "المتبقي", "نسبة السداد", "الكشف"].map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{shown.map((a) => { const pct = a.total ? Math.round(a.paid / a.total * 100) : 100; return <tr key={a.name} onClick={() => navigate({ to: "/agents", search: { agent: a.name } })} className="group cursor-pointer transition-colors hover:bg-secondary/60"><td><Link to="/agents" search={{ agent: a.name }} className="font-semibold hover:text-primary">{a.name}</Link>{a.aliases.length > 0 && <span className="mr-2 rounded-full bg-chart-3/15 px-2 py-1 text-[10px] text-chart-3">+{a.aliases.length} مدمج</span>}</td><td className="num">{fmt(a.passports)}</td><td className="num text-primary">{fmt(a.paid)}</td><td className="num text-destructive">{fmt(a.remaining)}</td><td><span className="num text-xs text-muted-foreground">{pct}%</span></td><td><Button asChild variant="ghost" size="icon" title={`كشف حساب ${a.name}`}><Link to="/agents" search={{ agent: a.name }} aria-label={`كشف حساب ${a.name}`}><ChevronLeft /></Link></Button></td></tr>; })}</tbody></table>{!shown.length && <div className="empty-state"><Users /><p>{q ? "لا توجد نتائج مطابقة" : "لا توجد حسابات وكلاء بعد"}</p>{!agents.length && <Button asChild variant="wakilio"><Link to="/imports"><FileUp /> استيراد ملف</Link></Button>}</div>}</div></>;
}
