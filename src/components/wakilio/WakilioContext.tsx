import { createContext, useContext, type ReactNode } from "react";
import { useWakilioStore } from "./useWakilioStore";

const WakilioContext = createContext<ReturnType<typeof useWakilioStore> | null>(null);

export function WakilioProvider({ children }: { children: ReactNode }) {
  const store = useWakilioStore();
  return <WakilioContext.Provider value={store}>{children}</WakilioContext.Provider>;
}

export function useWakilio() {
  const store = useContext(WakilioContext);
  if (!store) throw new Error("WakilioProvider is required");
  return store;
}