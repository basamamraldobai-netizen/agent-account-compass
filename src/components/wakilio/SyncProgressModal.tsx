import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Cloud, Database, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SyncProgress } from "./useWakilioStore";

const fmt = (n: number) => n.toLocaleString("en-US");

function duration(ms: number) {
  const sec = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s} ثانية`;
  return s ? `${m} دقيقة و ${s} ثانية` : `${m} دقيقة`;
}

/** Estimated remaining time from the average speed of the batches saved so far. */
function remaining(p: SyncProgress, now: number) {
  if (p.saved <= 0) return null;
  const elapsed = now - p.startedAt;
  return ((p.total - p.saved) * elapsed) / p.saved;
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return online;
}

export function SyncProgressModal({ progress, onClose }: { progress: SyncProgress | null; onClose: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const online = useOnline();
  const saving = progress?.status === "saving";

  useEffect(() => {
    if (!saving) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [saving]);

  if (!progress) return null;
  const { file, total, saved, agents, status } = progress;
  const pct = total ? Math.min(100, Math.round((saved / total) * 100)) : 100;
  const left = remaining(progress, now);
  const done = status === "done";
  const failed = status === "error";

  return (
    <div className="sync-overlay" role="dialog" aria-modal="true" aria-labelledby="sync-title" dir="rtl">
      <div className="sync-card">
        <div className={`sync-emblem ${saving ? "" : "is-still"}`} aria-hidden>
          <span className="sync-orbit sync-orbit--outer" />
          <span className="sync-orbit sync-orbit--mid" />
          <span className="sync-orbit sync-orbit--inner" />
          <span className={`sync-core ${failed ? "is-error" : ""}`}>
            {done ? <CheckCircle2 className="h-9 w-9" /> : failed ? <XCircle className="h-9 w-9" /> : <Cloud className="h-9 w-9" />}
          </span>
        </div>

        <h2 id="sync-title" className="mt-6 text-center font-display text-xl font-bold">
          {done ? "اكتملت المزامنة بنجاح" : failed ? "توقفت المزامنة" : "جاري حفظ ومزامنة الحركات"}
        </h2>
        <p className="file-name mt-1.5 text-center text-xs text-muted-foreground" dir="auto">{file}</p>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{done ? "تم حفظ جميع الحركات" : "نسبة الإنجاز"}</span>
            <span className="num text-base font-bold text-primary">{pct}%</span>
          </div>
          <div className="sync-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className={`sync-fill ${failed ? "is-error" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2.5">
          <div className="sync-stat">
            <Database className="h-4 w-4 text-primary" />
            <div className="text-[11px] text-muted-foreground">السجلات المحفوظة</div>
            <div className="num text-sm font-bold" dir="ltr">{fmt(saved)} / {fmt(total)}</div>
          </div>
          <div className="sync-stat">
            <Users className="h-4 w-4 text-accent" />
            <div className="text-[11px] text-muted-foreground">عدد الوكلاء</div>
            <div className="num text-sm font-bold">{fmt(agents)}</div>
          </div>
          <div className="sync-stat">
            <Clock3 className="h-4 w-4 text-warning" />
            <div className="text-[11px] text-muted-foreground">{saving ? "الوقت المتبقي" : "المدة المستغرقة"}</div>
            <div className="text-sm font-bold">
              {saving ? (left === null ? "جاري الحساب…" : left < 1000 ? "لحظات" : `≈ ${duration(left)}`) : duration((progress.finishedAt ?? now) - progress.startedAt)}
            </div>
          </div>
        </div>

        {saving && (
          <div className="sync-notice mt-5">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>يرجى إبقاء هذه الصفحة مفتوحة حتى اكتمال المزامنة السحابية.</span>
          </div>
        )}
        {failed && (
          <div className="sync-notice is-error mt-5">
            <XCircle className="h-4 w-4 shrink-0" />
            <span>تم حفظ {fmt(saved)} حركة فقط. أعد رفع نفس الملف لإكمال الباقي دون تكرار.</span>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`sync-dot ${online ? "" : "is-offline"}`} />
            {online ? "متصل بالسحابة" : "انقطع الاتصال بالإنترنت…"}
          </div>
          {!saving && (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} className="rounded-[11px] border border-border px-4 text-sm">إغلاق</Button>
              {done && (
                <Button asChild variant="wakilio" className="rounded-[11px] px-4 text-sm font-bold">
                  <Link to="/agents" onClick={onClose}>كشوفات الوكلاء</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
