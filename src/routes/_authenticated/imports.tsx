import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImportPanel } from "@/components/wakilio/ImportPanel";
import { ImportedFiles } from "@/components/wakilio/ImportedFiles";
import { useWakilio } from "@/components/wakilio/WakilioContext";

export const Route = createFileRoute("/_authenticated/imports")({
  head: () => ({ meta: [
    { title: "WAKILIO | استيراد الملفات" }, { name: "description", content: "استيراد ملفات Excel وتعيين أعمدة الوكيل والجواز والمهنة والمبالغ بمرونة." },
    { property: "og:title", content: "WAKILIO | استيراد الملفات" }, { property: "og:description", content: "معاينة ومراجعة بيانات ملفات الوكلاء قبل اعتماد الاستيراد." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Imports,
});
function Imports() {
  const [, setState] = useWakilio();
  return <><header className="page-heading"><div><h1>استيراد الملفات</h1><div className="page-kicker">ملفات Excel / مراجعة البيانات</div></div></header>
    <ImportPanel onImport={(recs, file) => {
      setState((s) => ({ ...s, records: [...s.records.filter((r) => r.file !== file || !recs.some((x) => x.sheet === r.sheet)), ...recs] }));
      toast.success(`تم استيراد ${recs.length} حركة من ${file}`);
    }} /><ImportedFiles /></>;
}
