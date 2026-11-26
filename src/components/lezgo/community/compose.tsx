import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fingerprintProof } from "@/lib/admin.functions";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { habitsQuery, myCrewQuery, useBase } from "@/lib/data";
import { compressProof, MAX_NOTE, noteLength } from "@/lib/feed-data";
import { loc } from "@/lib/i18n";
import { habitColor } from "@/lib/today-rules";
import { cn } from "@/lib/utils";
import { StickerButton, Num, Segmented } from "../ui";
export function Compose({
  open,
  onClose,
  initialType = "proof",
  initialBody = "",
  initialAudience = "everyone",
}: {
  open: boolean;
  onClose: () => void;
  initialType?: "proof" | "thought" | "win";
  initialBody?: string;
  initialAudience?: "crew" | "everyone";
}) {
  const { t, i18n } = useTranslation();
  const { uid, season } = useBase();
  const qc = useQueryClient();
  const proofFingerprint = useServerFn(fingerprintProof);
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const habits = useQuery({
    ...habitsQuery(uid, season?.id ?? ""),
    enabled: open && !!uid && !!season,
  });
  const crew = useQuery({
    ...myCrewQuery(uid, season?.id ?? ""),
    enabled: open && !!uid && !!season,
  });
  const [type, setType] = useState<"proof" | "thought" | "win">(initialType);
  const [key, setKey] = useState<string | null>(null);
  const [body, setBody] = useState(initialBody);
  const [visibility, setVisibility] = useState("everyone");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    if (open) {
      setType(initialType);
      setBody(initialBody);
      setKey(null);
      setPhoto(null);
      setVisibility(initialAudience);
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const old = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      setTimeout(() => root.current?.querySelector<HTMLElement>("button")?.focus(), 0);
      return () => {
        document.body.style.overflow = old;
        previousFocus.current?.focus();
      };
    }
    return undefined;
  }, [open, initialType, initialBody, initialAudience]);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  if (!open || typeof document === "undefined") return null;
  const count = noteLength(body);
  const canPost =
    !!season && !busy && !processing && count <= MAX_NOTE && (body.trim().length > 0 || !!photo);
  async function choose(file: File | undefined) {
    if (!file) return;
    setProcessing(true);
    try {
      setPhoto(await compressProof(file));
    } catch {
      toast(t("batch4.photoError"));
    } finally {
      setProcessing(false);
    }
  }
  async function post() {
    if (!canPost || !season) return;
    setBusy(true);
    let path: string | null = null;
    try {
      if (photo) {
        path = `${uid}/${crypto.randomUUID()}.jpg`;
        const uploaded = await supabase.storage
          .from("proofs")
          .upload(path, photo, { contentType: "image/jpeg" });
        if (uploaded.error) throw uploaded.error;
        await proofFingerprint({ data: { path } });
      }
      const { error } = await supabase.rpc("create_post", {
        _season_id: season.id,
        _type: type,
        ...(key ? { _habit_key: key } : {}),
        _body: body,
        ...(path ? { _image_url: path } : {}),
        _visibility: visibility,
      });
      if (error) throw error;
      await Promise.all(
        ["feed", "day", "scores", "scoreboard", "profileSummary", "crewToday"].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
      toast(t("batch4.posted"));
      onClose();
    } catch (error) {
      if (path) await supabase.storage.from("proofs").remove([path]);
      const message = (error as Error)?.message ?? "";
      toast(t(message.includes("moderation_mute") ? "moderation.mutedPost" : message.includes("no_crew") ? "moderation.noCrew" : "common.error"));
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="compose-overlay" dir={document.documentElement.dir}>
      <div
        className="compose-screen"
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={t("batch4.newPost")}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const controls = Array.from(
              root.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input,textarea,[tabindex="0"]',
              ) ?? [],
            );
            const first = controls[0];
            const last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="compose-header">
          <StickerButton
            variant="secondary"
            className="icon-control"
            disabled={busy}
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X />
          </StickerButton>
          <h1>{t("batch4.newPost")}</h1>
          <StickerButton
            className={cn("compose-post", !canPost && "compose-disabled")}
            disabled={!canPost}
            onClick={() => void post()}
          >
            {t("batch4.post")}
          </StickerButton>
        </div>
        {type !== "win" && (
          <div className="compose-types">
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: "proof", label: t("batch4.proof") },
                { value: "thought", label: t("batch4.thought") },
              ]}
            />
          </div>
        )}
        <div>
          <h2 className="section-label mb-2">{t("batch4.what")}</h2>
          <div className="flex flex-wrap gap-2">
            {(habits.data ?? []).map((h) => (
              <StickerButton
                variant="secondary"
                size="sm"
                className={cn(
                  "feed-chip",
                  key === h.template?.key && h.template
                    ? `bg-${habitColor(h.template.key, h.template.category)} shadow-hard-sm`
                    : "",
                )}
                aria-pressed={key === h.template?.key && !!h.template}
                key={h.id}
                onClick={() => setKey(h.template?.key ?? null)}
              >
                {h.custom_name ?? loc(h.template?.name, i18n.language)}
              </StickerButton>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="section-label mb-2 block">{t("batch4.note")}</span>
          <textarea
            className="compose-note"
            value={body}
            placeholder={t("batch4.notePh")}
            onChange={(e) => {
              if (noteLength(e.target.value) <= MAX_NOTE) setBody(e.target.value);
            }}
          />
          <span className="mt-2 block text-end">
            <Num className="text-[13px] font-bold">{count}/280</Num>
          </span>
        </label>
        {preview ? (
          <div className="relative">
            <img src={preview} className="compose-preview" alt={t("todayDesign.preview")} />
            <StickerButton
              variant="secondary"
              className="icon-control absolute end-2 top-2"
              aria-label={t("batch4.removePhoto")}
              onClick={() => setPhoto(null)}
            >
              <X size={20} />
            </StickerButton>
          </div>
        ) : (
          <label className="photo-drop">
            <Camera className="text-yellow" size={30} />
            <span>{processing ? t("common.loading") : t("batch4.addPhoto")}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={t("batch4.addPhoto")}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
        )}
        <div className="space-y-2">
          <h2 className="text-[15px] font-extrabold">{t("batch4.audience")}</h2>
          <div className="audience-control">
            <Segmented
              value={visibility}
              onChange={(v) => {
                if (v === "crew" && !crew.data) {
                  toast(t("batch4.needCrew"));
                  return;
                }
                setVisibility(v);
              }}
              options={[
                { value: "everyone", label: t("batch4.everyone") },
                { value: "crew", label: t("batch4.myCrew") },
              ]}
            />
          </div>
        </div>
        <div className="proof-info">
          <Num>+10</Num>
          <p>{t("batch4.proofInfo")}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
