import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { nameKey, normalizeText } from "@/lib/wakilio/engine";

/** Agent title with a small pencil: inline edit, then a confirmation window before anything changes. */
export function RenameAgent({ name, otherNames, onRename }: { name: string; otherNames: string[]; onRename: (to: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setValue(name); setEditing(false); }, [name]);
  useEffect(() => { if (editing) input.current?.select(); }, [editing]);

  const next = normalizeText(value);
  const clash = otherNames.find((n) => n !== name && nameKey(n) === nameKey(next));
  const cancel = () => { setValue(name); setEditing(false); setConfirm(false); };
  const ask = () => { if (!next || next === name) return cancel(); setConfirm(true); };

  return (
    <>
      {editing ? (
        <div className="mt-1 flex max-w-xl items-center gap-2">
          <input
            ref={input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // preventDefault stops the same Enter press from activating the dialog's focused button.
              if (e.key === "Enter") { e.preventDefault(); ask(); }
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
            aria-label="اسم الوكيل الجديد"
            className="font-display min-w-0 flex-1 rounded-[11px] border border-primary/50 bg-card px-3 py-1.5 text-xl font-bold outline-none ring-2 ring-primary/15 focus:border-primary"
          />
          <Button size="icon" onClick={ask} disabled={!next} aria-label="حفظ الاسم" className="h-9 w-9 shrink-0 rounded-[10px]"><Check className="h-4 w-4" /></Button>
          <Button size="icon" variant="outline" onClick={cancel} aria-label="إلغاء التعديل" className="h-9 w-9 shrink-0 rounded-[10px]"><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <div className="group/name mt-1 flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold">{name}</h2>
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="تعديل اسم الوكيل"
            aria-label="تعديل اسم الوكيل"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-50 transition hover:bg-secondary hover:text-primary hover:opacity-100 focus-visible:opacity-100 group-hover/name:opacity-90 print:hidden"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={(o) => !o && setConfirm(false)}>
        <AlertDialogContent dir="rtl" className="max-w-md gap-5 rounded-2xl border-border bg-card p-6 text-card-foreground shadow-2xl">
          <AlertDialogHeader className="space-y-2 text-right sm:text-right">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/12 text-primary ring-1 ring-primary/25"><Pencil className="h-5 w-5" /></div>
            <AlertDialogTitle className="font-display text-center text-lg">تأكيد تعديل اسم الوكيل</AlertDialogTitle>
            <AlertDialogDescription className="text-center">سيظهر الاسم الجديد في كل الكشوفات والتقارير، وتبقى ملفات الإكسل الأصلية كما هي.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <div className="rounded-xl border border-border bg-secondary/60 px-4 py-3">
              <div className="text-[11px] text-muted-foreground">الاسم الحالي</div>
              <div className="mt-0.5 font-semibold text-muted-foreground line-through decoration-destructive/60">{name}</div>
            </div>
            <div className="flex justify-center text-muted-foreground"><ArrowDown className="h-4 w-4" /></div>
            <div className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
              <div className="text-[11px] text-primary">الاسم الجديد</div>
              <div className="mt-0.5 font-bold text-foreground">{next}</div>
            </div>
            {clash && (
              <div className="flex items-start gap-2 rounded-xl bg-warning/12 p-3 text-xs text-warning ring-1 ring-inset ring-warning/30">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>يوجد وكيل آخر بنفس الاسم «{clash}». عند التأكيد سيُدمج الحسابان معاً، ويمكنك فك الدمج لاحقاً.</span>
              </div>
            )}
          </div>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
            <Button onClick={() => { onRename(next); setConfirm(false); setEditing(false); }} className="flex-1 gap-1.5 rounded-[11px]"><Check className="h-4 w-4" /> تأكيد التعديل</Button>
            <AlertDialogCancel onClick={cancel} className="mt-0 flex-1 rounded-[11px] hover:bg-muted">إلغاء والرجوع</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
