import { useEffect, useRef, useState } from "react";
/** Shrink only overflowing designed lines; keep their explicit line breaks in every language. */
export function FitHeading({
  text,
  requestedSize,
  className,
  id,
  useCssInitialSize = false,
}: {
  text: string;
  requestedSize: number;
  className: string;
  id?: string;
  useCssInitialSize?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [size, setSize] = useState<number>();
  useEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    let disposed = false;
    const fit = () => {
      if (disposed) return;
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = `800 ${requestedSize}px ${getComputedStyle(heading).fontFamily}`;
      const widest = Math.max(...text.split("\n").map((line) => context.measureText(line).width));
      setSize(
        widest > heading.clientWidth
          ? Math.floor((requestedSize * heading.clientWidth) / widest)
          : requestedSize,
      );
    };
    const observer = new ResizeObserver(fit);
    observer.observe(heading);
    void document.fonts.ready.then(fit);
    fit();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [text, requestedSize]);
  return (
    <h1
      id={id}
      ref={ref}
      className={className}
      data-fitted={size !== undefined || undefined}
      style={{ fontSize: size ?? (useCssInitialSize ? undefined : requestedSize) }}
    >
      {text.split("\n").map((line, i) => (
        <span className="block whitespace-nowrap" key={i}>
          {line}
        </span>
      ))}
    </h1>
  );
}
