import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, Upload, Check } from "lucide-react";
import {
  ROLE_LABELS,
  buildRecords,
  detectHeaderRow,
  detectTitleAgent,
  guessRole,
  normalizeText,
  type ColumnRole,
  type Grid,
  type TxRecord,
} from "@/lib/wakilio/engine";

type Pending = {
  file: string;
  sheets: Record<string, Grid>;
  sheet: string;
  headerRow: number;
  roles: ColumnRole[];
  fixedAgent: string;
};

function prepare(file: string, sheets: Record<string, Grid>, sheet: string): Pending {
  const grid = sheets[sheet] ?? [];
  const headerRow = detectHeaderRow(grid);
  const header = grid[headerRow] ?? [];
  const width = Math.max(...grid.slice(headerRow, headerRow + 30).map((r) => r.length), header.length);
  const roles = Array.from({ length: width }, (_, i) => guessRole(String(header[i] ?? "")));
  // only one column per role
  const seen = new Set<ColumnRole>();
  roles.forEach((r, i) => {
    if (r !== "ignore" && seen.has(r)) roles[i] = "ignore";
    seen.add(r);
  });
  const title = detectTitleAgent(grid, headerRow);
  return { file, sheets, sheet, headerRow, roles, fixedAgent: roles.includes("agent") ? "" : title || sheet };
}

export function ImportPanel({ onImport }: { onImport: (recs: TxRecord[], file: string) => void }) {
  const [p, setP] = useState<Pending | null>(null);
  const [drag, setDrag] = useState(false);

  async function readFile(f: File) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    const sheets: Record<string, Grid> = {};
    for (const n of wb.SheetNames) {
      const sheet = wb.Sheets[n];
      if (sheet) sheets[n] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as Grid;
    }
    setP(prepare(f.name, sheets, wb.SheetNames[0] ?? ""));
  }

  if (!p)
    return (
      <label
        onDragOver={(e) => (e.preventDefault(), setDrag(true))}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) readFile(f).catch(() => toast.error("تعذر قراءة الملف"));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-[18px] border border-dashed px-5 py-12 text-center transition ${drag ? "border-primary bg-primary/10" : "border-primary/40 bg-primary/5 hover:border-primary/60"}`}
      >
        <div className="grid h-16 w-16 place-items-center rounded-[13px] bg-primary/10 text-primary">
          <Upload className="h-7 w-7" />
        </div>
        <div className="font-display text-lg font-bold">اسحب ملف الإكسل هنا أو اضغط للاختيار</div>
        <p className="text-xs text-muted-foreground num" dir="ltr">XLSX · XLS · CSV</p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f).catch(() => toast.error("تعذر قراءة الملف"));
            e.target.value = "";
          }}
        />
      </label>
    );

  const grid = p.sheets[p.sheet] ?? [];
  const preview = grid.slice(p.headerRow + 1, p.headerRow + 7);
  const hasAgentCol = p.roles.includes("agent");
  const records = buildRecords({ grid, headerRow: p.headerRow, roles: p.roles, fixedAgent: p.fixedAgent, file: p.file, sheet: p.sheet });

  return (
    <div className="space-y-5 import-mapping">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <div>
            <div className="font-display font-bold">{p.file}</div>
            <div className="text-xs text-muted-foreground">تعيين الأعمدة ومعاينة البيانات</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(p.sheets).length > 1 && (
            <select
              value={p.sheet}
              onChange={(e) => setP(prepare(p.file, p.sheets, e.target.value))}
              className="rounded-[11px] border border-input bg-secondary px-4 py-2 text-sm"
            >
              {Object.keys(p.sheets).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 rounded-[11px] border border-input bg-secondary px-4 py-2 text-sm">
            صف العناوين
            <input
              type="number"
              min={1}
              value={p.headerRow + 1}
              onChange={(e) => {
                const hr = Math.max(0, Number(e.target.value) - 1);
                const hdr = grid[hr] ?? [];
                setP({ ...p, headerRow: hr, roles: p.roles.map((_, i) => guessRole(String(hdr[i] ?? ""))) });
              }}
              className="num w-14 bg-transparent text-center outline-none"
            />
          </label>
        </div>
      </div>

      <div className="border-b border-border pb-5">
        <label className="block text-sm font-semibold">
          {hasAgentCol ? "وكيل افتراضي للصفوف الفارغة (اختياري)" : "اسم الوكيل لكل الحركات (من الترويسة)"}
        </label>
        <input
          value={p.fixedAgent}
          onChange={(e) => setP({ ...p, fixedAgent: e.target.value })}
          placeholder="مثال: خالد عباس"
          className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-2.5 outline-none focus:border-primary"
        />
        {!hasAgentCol && (
          <p className="mt-2 text-xs text-muted-foreground">لم يُعثر على عمود وكيل — سيتم تطبيق هذا الاسم على جميع الحركات.</p>
        )}
      </div>

      <div className="overflow-x-auto rounded-[13px] border border-border">
        <table className="wakilio-table mapping-table">
          <thead>
            <tr className="bg-secondary">
              {p.roles.map((role, i) => (
                <th key={i} className="min-w-36 p-2 text-right align-top">
                  <div className="mb-1.5 truncate text-xs font-normal text-muted-foreground">
                    {normalizeText(grid[p.headerRow]?.[i]) || `عمود ${i + 1}`}
                  </div>
                  <select
                    value={role}
                    onChange={(e) => {
                      const nr = e.target.value as ColumnRole;
                      setP({ ...p, roles: p.roles.map((r, j) => (j === i ? nr : r === nr && nr !== "ignore" ? "ignore" : r)) });
                    }}
                    className={`w-full rounded-lg border px-2 py-1.5 text-xs ${role === "ignore" ? "border-input bg-background text-muted-foreground" : "border-primary/50 bg-primary/10 text-primary"}`}
                  >
                    {(Object.keys(ROLE_LABELS) as ColumnRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, r) => (
              <tr key={r} className="border-t border-border">
                {p.roles.map((role, i) => (
                  <td key={i} className={`truncate p-2 ${role === "ignore" ? "text-muted-foreground/60" : ""}`}>
                    {row[i] instanceof Date ? (row[i] as Date).toISOString().slice(0, 10) : String(row[i] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          سيتم استيراد <span className="num font-bold text-foreground">{records.length}</span> حركة
          {!p.roles.includes("passport") && <span className="text-destructive"> — حدّد عمود اسم الجواز</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setP(null)} className="rounded-[11px] border border-border px-5 py-2.5 text-sm font-semibold hover:border-primary/50">
            إلغاء
          </Button>
          <Button variant="wakilio"
            disabled={!records.length}
            onClick={() => {
              onImport(records, p.file);
              setP(null);
            }}
            className="inline-flex items-center gap-2 rounded-[11px] px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--glow)] disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> اعتماد الاستيراد
          </Button>
        </div>
      </div>
    </div>
  );
}
