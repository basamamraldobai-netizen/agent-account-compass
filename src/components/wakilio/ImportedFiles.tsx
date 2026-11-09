import { useState } from "react";
import { AlertTriangle, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useWakilio } from "./WakilioContext";

export function ImportedFiles() {
  const [state, setState] = useWakilio();
  const [target, setTarget] = useState<string | null>(null);
  const counts = new Map<string, number>();
  for (const r of state.records) counts.set(r.file, (counts.get(r.file) ?? 0) + 1);
  const files = [...counts.keys()];
  const confirm = () => {
    if (!target) return;
    const n = counts.get(target) ?? 0;
    setState((s) => ({ ...s, records: s.records.filter((r) => r.file !== target) }));
    toast.success(`تم حذف الملف «${target}» و ${n.toLocaleString("en")} حركة مرتبطة به`);
    setTarget(null);
  };
  return <section className="mt-7"><div className="section-heading"><h2>الملفات المستوردة</h2><span className="num text-xs text-muted-foreground">{files.length}</span></div>
    <div className="table-wrap"><table className="wakilio-table"><thead><tr><th>اسم الملف</th><th>الحركات</th><th className="w-16">حذف</th></tr></thead><tbody>{files.map((file) => <tr key={file}><td><span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" /><span className="file-name">{file}</span></span></td><td className="num">{counts.get(file)}</td><td><Button variant="ghost" size="icon" title={`حذف ${file}`} aria-label={`حذف ${file}`} className="text-muted-foreground hover:text-destructive" onClick={() => setTarget(file)}><Trash2 /></Button></td></tr>)}</tbody></table>{files.length === 0 && <div className="empty-state"><FileSpreadsheet /><p>لا توجد ملفات مستوردة بعد</p></div>}</div>
    <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
      <AlertDialogContent dir="rtl" className="max-w-md rounded-2xl">
        <AlertDialogHeader className="text-right sm:text-right">
          <AlertDialogTitle className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></span>حذف الملف نهائياً</AlertDialogTitle>
          <AlertDialogDescription className="text-right">سيتم حذف الملف وجميع الحركات المرتبطة به من كل كشوفات الوكلاء ولوحة التحكم.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-xl border bg-muted/40 p-3 text-sm">
          <div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" /><span className="file-name font-medium">{target}</span></div>
          <div className="mt-2 text-muted-foreground">عدد الحركات التي ستُحذف: <span className="num font-semibold text-destructive">{(target ? counts.get(target) ?? 0 : 0).toLocaleString("en")}</span></div>
        </div>
        <p className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4" />لا يمكن التراجع عن هذه العملية.</p>
        <AlertDialogFooter className="gap-2 sm:justify-start">
          <Button variant="destructive" onClick={confirm}><Trash2 />تأكيد الحذف</Button>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
