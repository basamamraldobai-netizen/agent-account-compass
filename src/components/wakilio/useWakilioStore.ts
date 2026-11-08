import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TxRecord } from "@/lib/wakilio/engine";

export type State = { records: TxRecord[]; aliases: Record<string, string>; dismissed: string[] };
const empty: State = { records: [], aliases: {}, dismissed: [] };

async function fetchAll<T>(table: "transactions", select: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(select).order("created_at").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

type Row = { client_id: string; sheet: string; agent_raw: string; passport: string; receipt: string; paid: number; remaining: number; tx_date: string; status: string; destination: string; profession: string; notes: string; import_files: { name: string } | null };

async function load(): Promise<State> {
  const [rows, aliases, dismissed] = await Promise.all([
    fetchAll<Row>("transactions", "client_id, sheet, agent_raw, passport, receipt, paid, remaining, tx_date, status, destination, profession, notes, import_files(name)"),
    supabase.from("agent_aliases").select("alias, target"),
    supabase.from("dismissed_suggestions").select("key"),
  ]);
  if (aliases.error) throw aliases.error;
  if (dismissed.error) throw dismissed.error;
  return {
    records: rows.map((r) => ({ id: r.client_id, file: r.import_files?.name ?? "", sheet: r.sheet, agentRaw: r.agent_raw, passport: r.passport, receipt: r.receipt, paid: Number(r.paid), remaining: Number(r.remaining), date: r.tx_date, status: r.status, destination: r.destination, profession: r.profession, notes: r.notes })),
    aliases: Object.fromEntries((aliases.data ?? []).map((a) => [a.alias, a.target])),
    dismissed: (dismissed.data ?? []).map((d) => d.key),
  };
}

const chunks = <T,>(a: T[], n = 500) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Persists the difference between two states to Lovable Cloud. */
async function persist(prev: State, next: State) {
  const nextIds = new Set(next.records.map((r) => r.id));
  const prevById = new Map(prev.records.map((r) => [r.id, r]));
  const removed = prev.records.filter((r) => !nextIds.has(r.id)).map((r) => r.id);
  const upserts = next.records.filter((r) => prevById.get(r.id) !== r);
  for (const ids of chunks(removed, 200)) {
    const { error } = await supabase.from("transactions").delete().in("client_id", ids);
    if (error) throw error;
  }
  if (upserts.length) {
    const names = [...new Set(upserts.map((r) => r.file))];
    const { data: files, error: fe } = await supabase.from("import_files").upsert(names.map((name) => ({ name })), { onConflict: "user_id,name" }).select("id, name");
    if (fe) throw fe;
    const agentNames = [...new Set(upserts.map((r) => r.agentRaw).filter(Boolean))];
    const { data: agents, error: ae } = agentNames.length ? await supabase.from("agents").upsert(agentNames.map((name) => ({ name })), { onConflict: "user_id,name" }).select("id, name") : { data: [], error: null };
    if (ae) throw ae;
    const fileId = new Map(files!.map((f) => [f.name, f.id]));
    const agentId = new Map((agents ?? []).map((a) => [a.name, a.id]));
    for (const part of chunks(upserts)) {
      const { error } = await supabase.from("transactions").upsert(part.map((r) => ({
        client_id: r.id, file_id: fileId.get(r.file)!, agent_id: agentId.get(r.agentRaw) ?? null, sheet: r.sheet, agent_raw: r.agentRaw, passport: r.passport, receipt: r.receipt,
        paid: r.paid, remaining: r.remaining, tx_date: r.date, status: r.status, destination: r.destination, profession: r.profession, notes: r.notes,
      })), { onConflict: "user_id,client_id" });
      if (error) throw error;
    }
  }
  // Files with no remaining transactions are removed.
  const nextFiles = new Set(next.records.map((r) => r.file));
  const goneFiles = [...new Set(prev.records.map((r) => r.file))].filter((f) => !nextFiles.has(f));
  if (goneFiles.length) {
    const { error } = await supabase.from("import_files").delete().in("name", goneFiles);
    if (error) throw error;
  }
  const goneAliases = Object.keys(prev.aliases).filter((k) => !(k in next.aliases));
  if (goneAliases.length) {
    const { error } = await supabase.from("agent_aliases").delete().in("alias", goneAliases);
    if (error) throw error;
  }
  const changedAliases = Object.entries(next.aliases).filter(([k, v]) => prev.aliases[k] !== v);
  if (changedAliases.length) {
    const { error } = await supabase.from("agent_aliases").upsert(changedAliases.map(([alias, target]) => ({ alias, target })), { onConflict: "user_id,alias" });
    if (error) throw error;
  }
  const newDismissed = next.dismissed.filter((k) => !prev.dismissed.includes(k));
  if (newDismissed.length) {
    const { error } = await supabase.from("dismissed_suggestions").upsert(newDismissed.map((key) => ({ key })), { onConflict: "user_id,key" });
    if (error) throw error;
  }
}

export function useWakilioStore() {
  const [state, setLocal] = useState<State>(empty);
  const [loading, setLoading] = useState(true);
  const stateRef = useRef(state);
  const queue = useRef(Promise.resolve());

  const reload = useCallback(async () => {
    try {
      const s = await load();
      stateRef.current = s;
      setLocal(s);
    } catch (e) {
      console.error(e);
      toast.error("تعذر تحميل البيانات من السحابة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const setState = useCallback((updater: State | ((s: State) => State)) => {
    const prev = stateRef.current;
    const next = typeof updater === "function" ? updater(prev) : updater;
    stateRef.current = next;
    setLocal(next);
    queue.current = queue.current.then(() => persist(prev, next)).catch(async (e) => {
      console.error(e);
      toast.error("تعذر حفظ التغييرات في السحابة، تمت إعادة تحميل البيانات");
      await reload();
    });
  }, [reload]);

  return [state, setState, { loading }] as const;
}
