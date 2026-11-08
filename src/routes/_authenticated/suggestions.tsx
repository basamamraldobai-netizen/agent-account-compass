import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { summarize } from "@/lib/wakilio/engine";
import { useWakilio } from "@/components/wakilio/WakilioContext";
import { MergeSuggestions } from "@/components/wakilio/MergeSuggestions";
export const Route = createFileRoute("/_authenticated/suggestions")({
  head: () => ({ meta: [
    { title: "WAKILIO | صندوق الاقتراحات" }, { name: "description", content: "مراجعة أسماء الوكلاء المتشابهة ودمج الحسابات بعد التحقق من المطابقة." },
    { property: "og:title", content: "WAKILIO | صندوق الاقتراحات" }, { property: "og:description", content: "مطابقة مرنة لأسماء الوكلاء مع خيارات الدمج والتجاهل." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Suggestions,
});
function Suggestions() {
  const [state, setState] = useWakilio();
  const agents = useMemo(() => summarize(state.records, state.aliases), [state.records, state.aliases]);
  return <><header className="page-heading"><div><h1>صندوق الاقتراحات</h1><div className="page-kicker">الوكلاء / مطابقة الأسماء</div></div></header><MergeSuggestions agents={agents} dismissed={state.dismissed} onMerge={(from, into) => {
    setState((s) => ({ ...s, aliases: { ...Object.fromEntries(Object.entries(s.aliases).map(([k, v]) => [k, v === from ? into : v])), [from]: into } }));
    toast.success(`تم دمج «${from}» في «${into}»`);
  }} onDismiss={(k) => setState((s) => ({ ...s, dismissed: [...s.dismissed, k] }))} /></>;
}
