import { useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, FileUp, Sparkles, PanelRightClose, Menu, X, Cloud, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/wakilio-logo.asset.json";

const navigation = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/agents", label: "حسابات الوكلاء", icon: Users },
  { to: "/imports", label: "استيراد الملفات", icon: FileUp },
  { to: "/suggestions", label: "صندوق الاقتراحات", icon: Sparkles },
] as const;

export function Workspace({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  return (
    <div className={`workspace ${collapsed ? "sidebar-collapsed" : ""}`}>
      <header className="workspace-topbar">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="hidden md:inline-flex" title="طي أو توسيع القائمة" aria-label="طي أو توسيع القائمة" onClick={() => setCollapsed(!collapsed)}><PanelRightClose /></Button>
          <Button variant="outline" size="icon" className="md:hidden" title={open ? "إغلاق القائمة" : "فتح القائمة"} aria-label={open ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
          <Link to="/dashboard" className="workspace-brand" aria-label="وكيليو — لوحة التحكم">
            <img src={logo.url} alt="شعار وكيليو" className="brand-mark" />
            <span><strong className="font-display block text-lg font-extrabold">وكــيليـو</strong><span className="num block text-[8px] text-muted-foreground" dir="ltr">WAKILIO</span></span>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" /><span>مساحة العمل</span><Button variant="outline" size="icon" title="تسجيل الخروج" aria-label="تسجيل الخروج" onClick={() => supabase.auth.signOut()}><LogOut /></Button></div>
      </header>
      <div className="workspace-layout">
        {open && <div className="sidebar-backdrop md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
        <aside className={`workspace-sidebar ${open ? "is-open" : ""}`}>
          <div className="sidebar-caption">مساحة العمل</div>
          <nav aria-label="القائمة الرئيسية" className="space-y-2">
            {navigation.map(({ to, label, icon: Icon }) => (
              <Button key={to} asChild variant="ghost" className={`sidebar-link ${location.pathname === to ? "is-active" : ""}`} title={collapsed ? label : undefined}>
                <Link to={to} onClick={() => setOpen(false)} aria-current={location.pathname === to ? "page" : undefined}><span className="nav-icon"><Icon /></span><span className="nav-label">{label}</span></Link>
              </Button>
            ))}
          </nav>
          <div className="sidebar-footer"><Cloud className="h-4 w-4 shrink-0" /><span className="nav-label text-xs">البيانات محفوظة سحابياً</span></div>
        </aside>
        <main className="workspace-main">{children}</main>
      </div>
    </div>
  );
}