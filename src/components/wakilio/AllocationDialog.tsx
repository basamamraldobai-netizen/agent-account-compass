import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Equal, Percent, RotateCcw, Save, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkAllocation, parseAmount, suggestShares, type ReceiptShare, type SharedReceiptInfo } from "@/lib/wakilio/engine";
import { useWakilio } from "./WakilioContext";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
type Draft = { key: string; name: string; prior: number | null; paid: string; remaining: string };

function initial(receipt: SharedReceiptInfo): Draft[] {
  const base: ReceiptShare[] = receipt.needsReview
    ? suggestShares(receipt, receipt.participants.every((p) => p.prior !== null) ? "debt" : "equal")
    : receipt.participants.map((p) => ({ key: p.key, name: p.name, paid: p.paid, remaining: p.remaining }));
  return receipt.participants.map((p, i) => ({ key: p.key, name: p.name, prior: p.prior, paid: String(base[i]?.paid ?? 0), remaining: String(base[i]?.remaining ?? 0) }));
}

/** Smart allocation window: edit each passport's share of a shared receipt with a live accounting check. */
export function AllocationDialog({ receipt, onClose, showAgentLink = false }: { receipt: SharedReceiptInfo | null; onClose: () => void; showAgentLink?: boolean }) {
  const [, setState] = useWakilio();
  const [rows, setRows] = useState<Draft[]>([]);
  useEffect(() => { if (receipt) setRows(initial(receipt)); }, [receipt]);
  const shares: ReceiptShare[] = rows.map((r) => ({ key: r.key, name: r.name, paid: r.paid.trim() ? parseAmount(r.paid) : 0, remaining: r.remaining.trim() ? parseAmount(r.remaining) : 0 }));
  const check = useMemo(() => receipt ? checkAllocation({ paid: receipt.paid, remaining: receipt.remaining, participants: receipt.participants.map((p) => p.name) }, shares) : null, [receipt, rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasPrior = receipt?.participants.some((p) => (p.prior ?? 0) > 0) ?? false;
  const apply = (mode: "equal" | "debt") => {
    if (!receipt) return;
    const s = suggestShares(receipt, mode);
    setRows((rs) => rs.map((r, i) => ({ ...r, paid: String(s[i]!.paid), remaining: String(s[i]!.remaining) })));
  };
  const edit = (i: number, field: "paid" | "remaining", value: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const save = () => {
    if (!receipt || !check?.valid) return;
    const clean = shares.map((s) => ({ ...s, paid: Math.round(s.paid * 100) / 100, remaining: Math.round(s.remaining * 100) / 100 }));
    setState((s) => ({ ...s, allocations: { ...s.allocations, [receipt.sourceId]: clean } }));
    toast.success(`تم حفظ تخصيص السند ${receipt.receipt || ""} وتحديث كشوف الجوازات`);
    onClose();
  };
  const reset = () => {
    if (!receipt) return;
    setState((s) => { const allocations = { ...s.allocations }; delete allocations[receipt.sourceId]; return { ...s, allocations }; });
    toast.success("تم إلغاء التخصيص اليدوي والعودة للتوزيع التلقائي");
    onClose();
  };
  const sumPaid = shares.reduce((t, s) => t + s.paid, 0);
  const sumRem = shares.reduce((t, s) => t + s.remaining, 0);

  return (
    <Dialog open={!!receipt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-2xl gap-4 [&>button.absolute]:left-4 [&>button.absolute]:right-auto overflow-y-auto rounded-2xl border-border bg-card p-5 text-card-foreground sm:p-6">
        {receipt && check && <>
          <DialogHeader className="space-y-2 pl-8 text-right sm:text-right">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-chart-3/15 text-chart-3 ring-1 ring-chart-3/30"><Split className="h-5 w-5" /></span>
              <div className="min-w-0">
                <DialogTitle className="font-display text-lg">تخصيص حصص السند المشترك <span className="num">#{receipt.receipt || "—"}</span></DialogTitle>
                <DialogDescription className="text-xs">
                  {showAgentLink ? <Link to="/agents" search={{ agent: receipt.agent }} onClick={onClose} className="font-semibold text-primary hover:underline">{receipt.agent}</Link> : <span className="font-semibold text-foreground">{receipt.agent}</span>}
                  {receipt.date && <> · <span className="num">{receipt.date}</span></>} · <span className="num">{receipt.participants.length}</span> جوازات
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-xl bg-secondary p-3"><div className="text-muted-foreground">مدفوع السند</div><div className="num mt-1 text-base font-bold text-primary">{fmt(receipt.paid)}</div></div>
            <div className="rounded-xl bg-secondary p-3"><div className="text-muted-foreground">متبقي السند</div><div className="num mt-1 text-base font-bold text-destructive">{fmt(receipt.remaining)}</div></div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => apply("equal")} className="rounded-full"><Equal /> توزيع بالتساوي</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => apply("debt")} disabled={!hasPrior} title={hasPrior ? undefined : "لا توجد أرصدة سابقة لهذه الجوازات"} className="rounded-full"><Percent /> توزيع بنسبة المديونية</Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-2 bg-secondary px-3 py-2 text-[11px] font-semibold text-muted-foreground sm:grid">
              <span>الجواز</span><span>الرصيد قبل السند</span><span>حصة المدفوع</span><span>حصة المتبقي</span><span>الرصيد بعد</span>
            </div>
            {rows.map((r, i) => {
              const s = shares[i]!;
              const after = r.prior !== null ? r.prior - s.paid : s.remaining;
              return (
                <div key={r.key} className="grid grid-cols-2 items-center gap-2 border-t border-border px-3 py-3 first:border-t-0 sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
                  <div className="col-span-2 font-semibold sm:col-span-1">{r.name}</div>
                  <div className="text-xs"><span className="text-muted-foreground sm:hidden">قبل: </span>{r.prior === null ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">جواز جديد</span> : <span className="num">{fmt(r.prior)}</span>}</div>
                  <div className="text-xs sm:hidden"><span className="text-muted-foreground">بعد: </span><span className="num font-semibold text-destructive">{fmt(after)}</span></div>
                  <label className="block"><span className="mb-1 block text-[10px] text-muted-foreground sm:hidden">حصة المدفوع</span>
                    <input inputMode="decimal" dir="ltr" value={r.paid} onChange={(e) => edit(i, "paid", e.target.value)} aria-label={`حصة المدفوع لـ ${r.name}`} className="num w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
                  <label className="block"><span className="mb-1 block text-[10px] text-muted-foreground sm:hidden">حصة المتبقي</span>
                    <input inputMode="decimal" dir="ltr" value={r.remaining} onChange={(e) => edit(i, "remaining", e.target.value)} aria-label={`حصة المتبقي لـ ${r.name}`} className="num w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
                  <div className="num hidden text-sm font-semibold text-destructive sm:block">{fmt(after)}</div>
                </div>
              );
            })}
            <div className="grid grid-cols-2 gap-2 border-t-2 border-border bg-secondary/70 px-3 py-2 text-xs sm:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
              <span className="col-span-2 font-bold sm:col-span-2">مجموع الحصص</span>
              <span className={`num font-bold ${check.paidDiff === 0 ? "text-primary" : "text-warning"}`}>{fmt(sumPaid)}</span>
              <span className={`num font-bold ${check.remainingDiff === 0 ? "text-foreground" : "text-warning"}`}>{fmt(sumRem)}</span>
            </div>
          </div>

          {check.valid
            ? <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-xs text-primary ring-1 ring-inset ring-primary/25"><CheckCircle2 className="h-4 w-4 shrink-0" /> الحصص مطابقة تماماً لإجمالي السند — جاهزة للحفظ.</div>
            : <div className="space-y-1 rounded-xl bg-warning/12 p-3 text-xs text-warning ring-1 ring-inset ring-warning/30">
                <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 shrink-0" /> لا يمكن الحفظ قبل تطابق الحصص</div>
                {check.paidDiff !== 0 && <div>فرق المدفوع: <span className="num font-bold">{fmt(check.paidDiff)}</span> {check.paidDiff > 0 ? "(غير موزع)" : "(زيادة)"}</div>}
                {check.remainingDiff !== 0 && <div>فرق المتبقي: <span className="num font-bold">{fmt(check.remainingDiff)}</span> {check.remainingDiff > 0 ? "(غير موزع)" : "(زيادة)"}</div>}
                {check.issues.filter((m) => !m.startsWith("مجموع")).map((m) => <div key={m}>{m}</div>)}
              </div>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 rounded-[11px]">إلغاء</Button>
              {receipt.allocated && <Button type="button" variant="ghost" onClick={reset} className="flex-1 rounded-[11px] text-muted-foreground hover:text-destructive"><RotateCcw /> إلغاء التخصيص</Button>}
            </div>
            <Button type="button" onClick={save} disabled={!check.valid} className="rounded-[11px]"><Save /> حفظ التخصيص</Button>
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}
