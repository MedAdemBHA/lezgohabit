import { useEffect, useRef, useState } from "react";

export function CountUp({ value, className }: { value: number; className?: string }) {
  const [shown, setShown] = useState(Math.round(value));
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setShown(Math.round(value)); from.current = value; return; }
    const start = performance.now(); const a = from.current; let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 700);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (value - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <bdi dir="ltr" className={`num ${className ?? ""}`}>{shown}</bdi>;
}
