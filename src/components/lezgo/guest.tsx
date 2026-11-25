import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { enterDemo } from "@/lib/admin.functions";
import { installGuestFetch, onGuestSheet, setGuestMode } from "@/lib/guest";
import { BottomSheet, StickerButton } from "./ui";
import { useBase } from "@/lib/data";
import i18n, { type Lang } from "@/lib/i18n";

/** One tap into the read-only sample world. */
export function useEnterGuest() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const fn = useServerFn(enterDemo);
  const [busy, setBusy] = useState(false);
  async function enter() {
    setBusy(true);
    try {
      const session = await fn();
      await qc.cancelQueries();
      qc.clear();
      installGuestFetch();
      setGuestMode(true);
      const { error } = await supabase.auth.setSession(session);
      if (error) throw error;
      await nav({ to: "/today" });
    } catch (error) {
      setGuestMode(false);
      toast.error(t((error as { message?: string }).message?.includes("demo_rate_limit") ? "batch7.demoLimit" : "batch7.demoUnavailable"));
    } finally {
      setBusy(false);
    }
  }
  return { enter, busy };
}

export function ExploreAsGuest({ className = "", lang }: { className?: string; lang?: Lang }) {
  const { t: translate } = useTranslation();
  const t = lang ? i18n.getFixedT(lang) : translate;
  const { enter, busy } = useEnterGuest();
  return (
    <StickerButton block variant="secondary" className={`guest-entry ${className}`} disabled={busy} onClick={() => void enter()}>
      {t(busy ? "guest.entering" : "guest.explore")}
    </StickerButton>
  );
}

/** Leave the sample account; language stays (saved locally) and the new account starts empty. */
export function useLeaveGuest() {
  const nav = useNavigate();
  const qc = useQueryClient();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setGuestMode(false);
    await nav({ to: "/auth", replace: true });
  };
}

export function GuestChrome({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const leave = useLeaveGuest();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active) return;
    installGuestFetch();
    setGuestMode(true);
    return onGuestSheet(() => setOpen(true));
  }, [active]);
  if (!active) return null;
  return (
    <>
      <div className="guest-banner" role="status">
        <span>{t("guest.banner")}</span>
        <button type="button" className="guest-banner-link" onClick={() => void leave()}>{t("guest.signUp")}</button>
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("guest.sheetTitle")}>
        <p className="mb-4 text-[16px] font-semibold leading-[1.5]">{t("guest.sheetBody")}</p>
        <div className="flex flex-col gap-3">
          <StickerButton block onClick={() => { setOpen(false); void leave(); }}>{t("guest.create")}</StickerButton>
          <StickerButton block variant="secondary" onClick={() => setOpen(false)}>{t("guest.keep")}</StickerButton>
        </div>
      </BottomSheet>
    </>
  );
}

/** Banner + sheet for screens that don't use AppShell. */
export function GuestChromeAuto() {
  const { profile } = useBase();
  return <GuestChrome active={!!profile?.is_demo} />;
}
