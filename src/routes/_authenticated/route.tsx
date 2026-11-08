import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { WakilioProvider } from "@/components/wakilio/WakilioContext";
import { Workspace } from "@/components/wakilio/Workspace";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
  },
  component: () => <WakilioProvider><Workspace><Outlet /></Workspace></WakilioProvider>,
});
