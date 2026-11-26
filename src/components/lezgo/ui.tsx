import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/community-rules";

export function StickerCard({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("sticker p-4", className)} {...p} />;
}

const btn = cva(
  "press inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] px-5 text-[17px] font-extrabold sticker-border disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-ink text-lime shadow-hard-orange press-orange",
        secondary: "bg-card text-ink shadow-hard",
        lime: "bg-lime text-ink shadow-hard",
        yellow: "bg-yellow text-ink shadow-hard-sm min-h-[44px] px-4 text-[15px]",
        ghost: "border-transparent bg-transparent shadow-none text-ink",
        danger: "bg-card text-destructive shadow-hard",
      },
      block: { true: "w-full" },
      size: { lg: "min-h-[56px] text-[19px]", md: "", sm: "min-h-[44px] px-4 text-[15px]" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);
export type StickerButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof btn>;
export const StickerButton = React.forwardRef<HTMLButtonElement, StickerButtonProps>(function StickerButton(
  { className, variant, block, size, type = "button", ...p }, ref,
) {
  return <button ref={ref} type={type} className={cn(btn({ variant, block, size }), className)} {...p} />;
});

export function Chip({ active, className, as = "button", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; as?: "button" | "span" }) {
  const cls = cn(
    "inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[14px] font-bold sticker-border",
    active ? "bg-lime shadow-hard-sm" : "bg-card",
    as === "button" && "press min-h-[44px]",
    className,
  );
  if (as === "span") return <span className={cls}>{p.children}</span>;
  return <button type="button" className={cls} {...p} />;
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-[16px] bg-card p-1 sticker-border shadow-hard-sm">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("min-h-[44px] flex-1 rounded-[12px] px-2 text-[15px] font-extrabold transition-colors",
            value === o.value ? "bg-ink text-lime" : "text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tile({ selected, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button type="button"
      className={cn("press relative flex h-[92px] min-w-0 flex-col justify-between overflow-hidden rounded-[18px] p-3 text-start sticker-border shadow-hard",
        selected ? "bg-lime" : "bg-card", className)} {...p} />
  );
}

export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useTranslation();
  const closeButton = React.useRef<HTMLButtonElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/50 motion-safe:animate-fade" />
        <Dialog.Content
          ref={panel}
          aria-modal="true"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            event.preventDefault();
            (panel.current?.querySelector<HTMLElement>("[data-sheet-focus]") ?? closeButton.current)?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
          }}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-t-[26px] bg-cream p-5 pb-[max(2rem,env(safe-area-inset-bottom))] sticker-border border-b-0 motion-safe:animate-sheet"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className={title ? "min-w-0 break-words text-[22px] font-extrabold" : "sr-only"}>
              {title ?? t("common.close")}
            </Dialog.Title>
            <Dialog.Close ref={closeButton} type="button" aria-label={t("common.close")} className="press ms-auto grid size-11 shrink-0 place-items-center rounded-full bg-card sticker-border shadow-hard-sm">
              <X strokeWidth={2.5} className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Num({ children, className }: { children: React.ReactNode; className?: string }) {
  return <bdi dir="ltr" className={cn("num", className)}>{children}</bdi>;
}

const AV_COLORS = ["bg-lime", "bg-yellow", "bg-blue", "bg-pink", "bg-purple", "bg-teal"];
export function colorFor(id: string) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length] ?? "bg-lime";
}
export function Avatar({ id, name, url, size = 40, className }: { id: string; name: string; url?: string | null | undefined; size?: number; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full font-extrabold sticker-border", colorFor(id), className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {url ? <img src={url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : initials(name)}
    </span>
  );
}

export function Flag({ code }: { code: string }) {
  return <span dir="ltr" className="num rounded-md bg-card px-1.5 text-[12px] font-bold sticker-border [border-width:1.5px]">{code}</span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode }) {
  return (
    <label className="flex min-h-[56px] cursor-pointer items-center justify-between gap-4">
      <span className="text-[16px] font-bold">{label}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn("relative h-8 w-14 shrink-0 rounded-full sticker-border transition-colors", checked ? "bg-lime" : "bg-muted")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-ink transition-all", checked ? "end-0.5" : "start-0.5")} />
      </button>
    </label>
  );
}

export function Field({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-extrabold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full min-h-[50px] rounded-[14px] bg-card px-4 text-[17px] font-semibold sticker-border outline-none focus:shadow-hard-sm";
