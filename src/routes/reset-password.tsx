import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "WAKILIO | تعيين كلمة مرور جديدة" }, { name: "description", content: "عيّن كلمة مرور جديدة لحسابك في وكيليو." },
    { property: "og:title", content: "WAKILIO | تعيين كلمة مرور جديدة" }, { property: "og:description", content: "استعادة الوصول إلى حساب وكيليو." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error("تعذر تحديث كلمة المرور، اطلب رابطاً جديداً"); return; }
    toast.success("تم تحديث كلمة المرور");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="summary-panel w-full max-w-sm space-y-4">
        <h1 className="font-display text-xl font-extrabold">كلمة مرور جديدة</h1>
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور الجديدة" aria-label="كلمة المرور الجديدة" className="w-full rounded-[11px] border border-input bg-card px-3 py-2.5 text-sm outline-none" dir="ltr" />
        <Button type="submit" variant="wakilio" className="w-full" disabled={busy}>حفظ</Button>
      </form>
    </div>
  );
}
