import { createContext, useContext, useMemo, type ReactNode } from "react";
import { listSharedReceipts, summarize, type AgentSummary, type SharedReceiptInfo } from "@/lib/wakilio/engine";
import { useWakilioStore } from "./useWakilioStore";

const WakilioContext = createContext<ReturnType<typeof useWakilioStore> | null>(null);
const SummaryContext = createContext<{ agents: AgentSummary[]; shared: SharedReceiptInfo[] } | null>(null);

export function WakilioProvider({ children }: { children: ReactNode }) {
  const store = useWakilioStore();
  const [state] = store;
  const summary = useMemo(() => {
    const agents = summarize(state.records, state.aliases, state.allocations);
    return { agents, shared: listSharedReceipts(agents) };
  }, [state.records, state.aliases, state.allocations]);
  return <WakilioContext.Provider value={store}><SummaryContext.Provider value={summary}>{children}</SummaryContext.Provider></WakilioContext.Provider>;
}

export function useWakilio() {
  const store = useContext(WakilioContext);
  if (!store) throw new Error("WakilioProvider is required");
  return store;
}

/** Agent summaries and shared receipts, computed once for every page (includes saved allocations). */
export function useWakilioSummary() {
  const summary = useContext(SummaryContext);
  if (!summary) throw new Error("WakilioProvider is required");
  return summary;
}
