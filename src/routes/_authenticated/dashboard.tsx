import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Users, Wallet, CircleCheck, Clock, FileUp, Sparkles, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { summarize } from "@/lib/wakilio/engine";
import { useWakilio } from "@/components/wakilio/WakilioContext";
import { Stat, fmt } from "@/components/wakilio/AgentStatement";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "WAKILIO | لوحة التحكم" },
    { name: "description", content: "لوحة التحكم في حسابات الوكلاء والمستحقات والواصل والمتبقي في وكيليو." },
    { property: "og:title", content: "WAKILIO | لوحة التحكم" },
    { property: "og:description", content: "ملخص حسابات الوكلاء والحركة المالية من ملفات الإكسل المستوردة." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Dashboard,
});

function Dashboard() {
  const [state] = useWakilio();
  const agents = useMemo(() => summarize(state.records, state.aliases), [state.records, state.aliases]);
  const totals = agents.reduce((t, a) => ({ total: t.total + a.total, paid: t.paid + a.paid, rem: t.rem + a.remaining, passports: t.passports + a.passports }), { total: 0, paid: 0, rem: 0, passports: 0 });
  const files = new Set(state.records.map((r) => r.file)).size;
  const percent = totals.total ? Math.round(totals.paid / totals.total * 100) : 0;
  return <>
    <header className="page-heading"><div><h1>لوحة التحكم</h1><div className="page-kicker">حسابات الوكلاء / نظرة عامة</div></div><Button asChild variant="wakilio"><Link to="/imports"><FileUp /> استيراد ملف</Link></Button></header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat label="إجمالي الوكلاء" value={fmt(agents.length)} icon={Users} />
      <Stat label="إجمالي المستحقات" value={fmt(totals.total)} icon={Wallet} tone="text-accent" />
      <Stat label="إجمالي الواصل" value={fmt(totals.paid)} icon={CircleCheck} tone="text-primary" />
      <Stat label="إجمالي المتبقي" value={fmt(totals.rem)} icon={Clock} tone="text-warning" />
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
      <section className="summary-panel"><div className="section-heading"><h2>ملخص الحركة المالية</h2><Wallet className="h-4 w-4 text-accent" /></div>
        {agents.length ? <div className="space-y-6 pt-5"><div className="flex items-end justify-between"><span className="text-sm text-muted-foreground">نسبة السداد</span><strong className="num text-3xl text-primary">{percent}%</strong></div><div className="finance-track"><progress max={100} value={Math.max(0, Math.min(100, percent))} aria-label="نسبة السداد" /></div><div className="flex flex-wrap justify-between gap-3 text-xs"><span className="text-primary">الواصل <b className="num mr-2">{fmt(totals.paid)}</b></span><span className="text-destructive">المتبقي <b className="num mr-2">{fmt(totals.rem)}</b></span></div></div> : <div className="empty-state"><Wallet /><p>لا توجد بيانات مالية بعد</p></div>}
      </section>
      <section className="summary-panel"><div className="section-heading"><h2>حالة مساحة العمل</h2><CircleCheck className="h-4 w-4 text-primary" /></div><dl className="divide-y divide-border text-sm">{[["الملفات المستوردة", files], ["إجمالي الجوازات", totals.passports], ["الأسماء المدمجة", Object.keys(state.aliases).length]].map(([label, value]) => <div key={label} className="flex items-center justify-between py-4"><dt className="text-muted-foreground">{label}</dt><dd className="num font-bold">{value}</dd></div>)}</dl></section>
    </div>
    <section className="mt-7"><div className="section-heading"><h2>إجراءات سريعة</h2></div><div className="quick-actions">{[{ to: "/imports", label: "استيراد ملف جديد", icon: FileUp }, { to: "/agents", label: "حسابات الوكلاء", icon: Users }, { to: "/suggestions", label: "مراجعة الاقتراحات", icon: Sparkles }].map(({ to, label, icon: Icon }) => <Button asChild variant="outline" key={to}><Link to={to}><span className="nav-icon"><Icon className="text-primary" /></span>{label}</Link></Button>)}</div></section>
    <section className="mt-7"><div className="section-heading"><h2>حسابات الوكلاء</h2><Button asChild variant="link" size="sm"><Link to="/agents">عرض الكل</Link></Button></div><div className="table-wrap"><table className="wakilio-table"><thead><tr><th>الوكيل</th><th>الجوازات</th><th>الواصل</th><th>المتبقي</th></tr></thead><tbody>{agents.slice(0, 5).map((a) => <tr key={a.name}><td><Link to="/agents" search={{ agent: a.name }} className="font-semibold hover:text-primary">{a.name}</Link></td><td className="num">{fmt(a.passports)}</td><td className="num text-primary">{fmt(a.paid)}</td><td className="num text-destructive">{fmt(a.remaining)}</td></tr>)}</tbody></table>{!agents.length && <div className="empty-state"><FileSpreadsheet /><p>لا توجد حسابات وكلاء بعد</p><Button asChild variant="wakilio"><Link to="/imports"><FileUp /> استيراد ملف</Link></Button></div>}</div></section>
  </>;
}
