import { FileSpreadsheet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWakilio } from "./WakilioContext";

export function ImportedFiles() {
  const [state, setState] = useWakilio();
  const files = [...new Set(state.records.map((r) => r.file))];
  return <section className="mt-7"><div className="section-heading"><h2>الملفات المستوردة</h2><span className="num text-xs text-muted-foreground">{files.length}</span></div>
    <div className="table-wrap"><table className="wakilio-table"><thead><tr><th>اسم الملف</th><th>الحركات</th><th className="w-16">حذف</th></tr></thead><tbody>{files.map((file) => <tr key={file}><td><span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" /><span className="file-name">{file}</span></span></td><td className="num">{state.records.filter((r) => r.file === file).length}</td><td><Button variant="ghost" size="icon" title={`حذف ${file}`} aria-label={`حذف ${file}`} className="text-muted-foreground hover:text-destructive" onClick={() => setState((s) => ({ ...s, records: s.records.filter((r) => r.file !== file) }))}><Trash2 /></Button></td></tr>)}</tbody></table>{files.length === 0 && <div className="empty-state"><FileSpreadsheet /><p>لا توجد ملفات مستوردة بعد</p></div>}</div>
  </section>;
}