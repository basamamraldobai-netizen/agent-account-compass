import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Floating glass button that appears after scrolling down and smoothly returns to the top. */
export function ScrollToTop({ threshold = 500 }: { threshold?: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return (
    <Button type="button" variant="ghost" size="icon" className={`scroll-top-btn ${visible ? "is-visible" : ""}`} title="الصعود للأعلى" aria-label="الصعود للأعلى" aria-hidden={!visible} tabIndex={visible ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
      <ArrowUp />
    </Button>
  );
}
