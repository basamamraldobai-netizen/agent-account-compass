import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { mergeAgents, resolveAgent, summarize } from "@/lib/wakilio/engine";
import { useWakilio, useWakilioSummary } from "@/components/wakilio/WakilioContext";
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
  const { agents } = useWakilioSummary();
  return <><header className="page-heading"><div><h1>صندوق الاقتراحات</h1><div className="page-kicker">الوكلاء / مطابقة الأسماء</div></div></header><MergeSuggestions
    agents={agents}
    dismissed={state.dismissed}
    onMerge={(from, into) => {
      const aliases = mergeAgents(state.aliases, from, into);
      setState((s) => ({ ...s, aliases: mergeAgents(s.aliases, from, into) }));
      toast.success(`تم دمج ${from.length} أسماء في «${resolveAgent(into, aliases)}»`);
    }}
    onMergeMany={(groups) => {
      setState((s) => ({ ...s, aliases: groups.reduce((acc, g) => mergeAgents(acc, g.from, g.into), s.aliases) }));
      toast.success(`تم دمج ${groups.length} مجموعات إملائية`);
    }}
    onDismiss={(keys) => setState((s) => ({ ...s, dismissed: [...new Set([...s.dismissed, ...keys])] }))}
    onUnmerge={(alias) => {
      setState((s) => { const aliases = { ...s.aliases }; delete aliases[alias]; return { ...s, aliases }; });
      toast.success(`تم فك دمج «${alias}»`);
    }}
  /></>;
}
