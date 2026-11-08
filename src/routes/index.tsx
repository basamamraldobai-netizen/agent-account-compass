import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import "@lovable.dev/cloud-auth-js/styles.css";
import landingCss from "../landing.css?url";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WAKILIO | إدارة أذكى. رؤية أوضح." },
      { name: "description", content: "WAKILIO — إدارة أذكى ورؤية أوضح لحسابات الوكلاء: استيراد ملفات الإكسل، كشوف الحسابات، والملخصات المالية." },
      { property: "og:title", content: "WAKILIO | إدارة أذكى. رؤية أوضح." },
      { property: "og:description", content: "حوّل ملفات الوكلاء إلى ملخصات وكشوف حساب واضحة من مكان واحد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: landingCss }],
  }),
  component: Landing,
});

const periods = {
  week: { agents: "06", paid: "248K", remaining: "82K", title: "نشاط الحسابات خلال الأسبوع" },
  month: { agents: "18", paid: "842K", remaining: "196K", title: "نشاط الحسابات خلال الشهر" },
  year: { agents: "42", paid: "3.8M", remaining: "610K", title: "نشاط الحسابات خلال السنة" },
} as const;
const details = {
  agents: "يعرض هذا المؤشر عدد الوكلاء في بيانات العرض التجريبية.",
  paid: "يعرض هذا المؤشر إجمالي المدفوعات التوضيحية للفترة المحددة.",
  remaining: "يعرض هذا المؤشر قيمة متبقية توضيحية للمراجعة فقط.",
} as const;
const features = [
  ["▤", "تحليل الملفات", "استيراد الملفات وقراءة البيانات وتجهيزها للمراجعة ضمن مسار عمل واضح."],
  ["◫", "حسابات الوكلاء", "عرض مستقل لكل وكيل مع إمكانية الوصول إلى تفاصيل الحساب والبيانات المرتبطة به."],
  ["⌁", "ملخصات مالية", "تنظيم الإجماليات والمدفوعات والمتبقي وفق الحقول التي تتم مراجعتها."],
  ["✧", "توحيد الأسماء", "إظهار الأسماء المتشابهة للمراجعة، مع إبقاء قرار التوحيد بيد المستخدم."],
  ["▥", "تقارير واضحة", "تحويل البيانات إلى مؤشرات وجداول تساعد على متابعة الحسابات وفهم الحركة."],
  ["⟲", "مراجعة وتدقيق", "مسار منظم لمراجعة النتائج قبل اعتمادها، مع تتبع التعديلات والقرارات."],
];

function Brand() {
  return <a className="brand" href="#home" aria-label="WAKILIO"><span className="brand-mark">W</span><span className="brand-name"><span className="brand-ar">وكــيليـو</span><span className="brand-en">WAKILIO</span></span></a>;
}

function Landing() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  const [menu, setMenu] = useState(false);
  const [period, setPeriod] = useState<keyof typeof periods>("week");
  const [detail, setDetail] = useState<keyof typeof details | null>(null);
  const [top, setTop] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard", replace: true }); });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    setLight(localStorage.getItem("wakilio-theme") === "light");
    const onScroll = () => setTop(window.scrollY > 480);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { data.subscription.unsubscribe(); window.removeEventListener("scroll", onScroll); document.body.classList.remove("light-theme"); };
  }, [navigate]);

  useEffect(() => {
    document.body.classList.toggle("light-theme", light);
    localStorage.setItem("wakilio-theme", light ? "light" : "dark");
  }, [light]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else setMsg("تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده ثم سجّل الدخول.");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      setMsg(m.includes("Invalid login") ? "البريد الإلكتروني أو كلمة المرور غير صحيحة." : m.includes("not confirmed") ? "يرجى تأكيد بريدك الإلكتروني أولاً." : m.includes("already") ? "هذا البريد مسجل مسبقاً، سجّل الدخول." : m || "حدث خطأ، حاول مرة أخرى.");
    } finally { setBusy(false); }
  }

  async function forgot(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) { setMsg("اكتب بريدك الإلكتروني أولاً ثم اضغط نسيت كلمة المرور."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setMsg(error ? "تعذر إرسال رابط الاستعادة." : "أرسلنا رابط استعادة كلمة المرور إلى بريدك.");
  }

  async function social(provider: "google" | "lovable") {
    setMsg(null);
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) { setMsg("تعذر تسجيل الدخول عبر هذا المزود."); return; }
    if (r.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  const d = periods[period];
  return (
    <>
      <header className="container nav">
        <Brand />
        <nav className="nav-links" aria-label="التنقل الرئيسي" style={menu ? { display: "flex", position: "absolute", top: 72, right: 14, left: 14, padding: 16, flexDirection: "column", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, zIndex: 20 } : undefined}>
          <a href="#features" onClick={() => setMenu(false)}>المميزات</a><a href="#about" onClick={() => setMenu(false)}>عن المنصة</a><a href="#contact-us" onClick={() => setMenu(false)}>الدعم</a>
        </nav>
        <div className="nav-actions">
          <button className="theme-toggle" type="button" onClick={() => setLight(!light)} aria-label={light ? "التبديل إلى الوضع الليلي" : "التبديل إلى الوضع النهاري"}><span className="theme-icon">{light ? "☀" : "☾"}</span><span className="theme-text">{light ? "نهاري" : "ليلي"}</span></button>
          <button className="menu" type="button" aria-label="فتح القائمة" onClick={() => setMenu(!menu)}>☰</button>
        </div>
      </header>

      <main id="home">
        <section className="container hero">
          <aside className="login-card" id="login" aria-label="بطاقة تسجيل الدخول">
            <div className="login-top"><span className="login-badge">⌑</span><span className="demo-label">SECURE ACCESS</span></div>
            <div className="login-tabs" role="tablist" aria-label="نوع العملية">
              <button className={`login-tab ${mode === "in" ? "active" : ""}`} type="button" role="tab" aria-selected={mode === "in"} onClick={() => { setMode("in"); setMsg(null); }}>تسجيل الدخول</button>
              <button className={`login-tab ${mode === "up" ? "active" : ""}`} type="button" role="tab" aria-selected={mode === "up"} onClick={() => { setMode("up"); setMsg(null); }}>إنشاء حساب</button>
            </div>
            <h2>{mode === "in" ? "مرحباً بعودتك" : "أنشئ حسابك"}</h2>
            <p>{mode === "in" ? "سجّل الدخول للوصول إلى مساحة عمل WAKILIO وإدارة بياناتك من مكان واحد." : "أنشئ حساباً جديداً لحفظ بيانات وكلائك سحابياً والوصول إليها من أي جهاز."}</p>
            <form onSubmit={submit}>
              <div className="field"><label htmlFor="email">البريد الإلكتروني</label><div className="input-wrap"><span>◎</span><input id="email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} /></div></div>
              <div className="field"><label htmlFor="password">كلمة المرور</label><div className="input-wrap"><span>◇</span><input id="password" type={showPass ? "text" : "password"} dir="ltr" minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="اكتب كلمة المرور" required value={password} onChange={(e) => setPassword(e.target.value)} /><button type="button" className="toggle-pass" aria-label="إظهار كلمة المرور" onClick={() => setShowPass(!showPass)}>{showPass ? "◌" : "◉"}</button></div></div>
              {mode === "in" && <div className="login-options"><span /><a href="#" onClick={forgot}>نسيت كلمة المرور؟</a></div>}
              <button className="btn btn-primary login-submit" type="submit" disabled={busy}><span>{busy ? "جارٍ التحقق..." : mode === "in" ? "تسجيل الدخول" : "إنشاء الحساب"}</span><span>←</span></button>
            </form>
            <div className="biometric-divider"><span>أو المتابعة عبر</span></div>
            <div className="biometric-actions">
              <button className="biometric-btn" type="button" onClick={() => social("google")}><span className="bio-icon">G</span><span>Google</span></button>
              <button className="biometric-btn" type="button" onClick={() => social("lovable")}><span className="bio-icon">♥</span><span>Lovable</span></button>
            </div>
            <div className={`login-message ${msg ? "show" : ""}`} role="status">{msg}</div>
          </aside>

          <div className="hero-copy">
            <span className="eyebrow"><i className="pulse" /> وضوح أكبر. قرارات أسرع.</span>
            <h1>إدارة أذكى لوكالتك،<br /><span className="accent">ورؤية أوضح</span><br />لبياناتك.</h1>
            <p className="lead">حوّل الملفات إلى ملخصات مفهومة ورؤية أوضح لحسابات الوكلاء. نظّم بياناتك، راجع التفاصيل، وتابع النتائج من مكان واحد.</p>
            <div className="hero-actions"><a className="btn btn-primary" href="#features">استكشف المنصة <span>↙</span></a><a className="text-link" href="#about">كيف يعمل النظام <span>←</span></a></div>
            <div className="trust"><span className="avatars"><i /><i /><i /></span><span>واجهة موحدة لإدارة البيانات ومتابعة الحسابات</span></div>
            <div className="mini-dashboard" aria-label="لوحة تحكم توضيحية تفاعلية">
              <div className="dash-head"><div><span className="dash-kicker">WAKILIO INSIGHTS</span><strong>ملخص أداء الوكلاء</strong></div><span className="demo-label">عرض فقط</span></div>
              <div className="dash-controls">{(["week", "month", "year"] as const).map((p) => <button key={p} type="button" className={`period ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>{p === "week" ? "أسبوعي" : p === "month" ? "شهري" : "سنوي"}</button>)}</div>
              <div className="dash-metrics">
                {([["agents", "عدد الوكلاء", d.agents, "بيانات توضيحية"], ["paid", "إجمالي المدفوع", d.paid, "ريال توضيحي"], ["remaining", "المتبقي", d.remaining, "ريال توضيحي"]] as const).map(([k, l, v, s]) =>
                  <button key={k} type="button" className={`dash-metric ${(detail ?? "agents") === k ? "active" : ""}`} onClick={() => setDetail(k)}><span>{l}</span><strong>{v}</strong><small>{s}</small></button>)}
              </div>
              <div className="dash-chart"><div className="chart-title"><span>{d.title}</span><span>↗ 8.4%</span></div><div className="chart-bars" aria-hidden="true" key={period}>{[42, 64, 51, 78, 59, 91, 70].map((h, i) => <i key={i} style={{ ["--h" as string]: `${h}%`, animationDelay: `${i * 0.06}s` }} />)}</div><div className="chart-labels">{["س", "ح", "ن", "ث", "ر", "خ", "ج"].map((x) => <span key={x}>{x}</span>)}</div></div>
              <div className="dash-detail">{detail ? details[detail] : "اختر أحد المؤشرات لاستعراض وصف توضيحي مختصر."}</div>
            </div>
          </div>
        </section>

        <section className="section" id="features"><div className="container"><div className="section-head"><div className="kicker">إمكانات WAKILIO</div><h2>كل تفاصيل حساباتك في رؤية واحدة</h2><p>أدوات عملية تساعد فريق العمل على تنظيم الملفات، فهم الأرقام، والوصول إلى تفاصيل الحسابات بسهولة.</p></div>
          <div className="features">{features.map(([i, t, p]) => <article className="feature" key={t}><div className="feature-icon">{i}</div><h3>{t}</h3><p>{p}</p></article>)}</div>
        </div></section>

        <section className="section" id="about"><div className="container"><div className="section-head"><div className="kicker">لماذا WAKILIO؟</div><h2>من ملف بيانات إلى صورة أوضح</h2><p>تجربة مركّزة تختصر الوقت وتمنح فريقك أساساً أفضل لاتخاذ القرار.</p></div>
          <div className="stats">{["استيراد وتنظيم الملفات", "تحليل ومراجعة البيانات", "اعتماد النتائج", "عرض التقارير"].map((s, i) => <div className="stat" key={s}><strong>0{i + 1}</strong><span>{s}</span></div>)}</div>
        </div></section>

        <section className="contact-section" id="contact-us"><div className="container contact-card"><div className="contact-copy"><span className="kicker">نحن هنا لمساعدتك</span><h2>للاستفسار أو التواصل</h2><p>يسعد فريق WAKILIO بالإجابة عن استفساراتك ومساعدتك في معرفة المزيد عن المنصة.</p></div>
          <a className="contact-phone" href="tel:+967780008778" aria-label="الاتصال على الرقم +967 78 000 8778"><span className="phone-icon">⌕</span><span><small>تواصل معنا على الرقم</small><strong><b dir="ltr">+967</b> <b dir="ltr">78 000 8778</b></strong></span><span className="phone-arrow">↗</span></a>
        </div></section>
      </main>

      <footer className="footer" id="contact"><div className="container footer-inner"><Brand /><span>جميع الحقوق محفوظة © {new Date().getFullYear()} WAKILIO</span><span>إدارة أذكى. رؤية أوضح.</span></div></footer>
      <button className={`back-to-top ${top ? "visible" : ""}`} type="button" aria-label="العودة إلى بداية الواجهة" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><span>↑</span></button>
    </>
  );
}
