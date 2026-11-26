import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Mic, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SignatureFrame } from "@/components/lezgo/signature/frame";
import { Num, StickerButton } from "@/components/lezgo/ui";
import { FitHeading } from "@/components/lezgo/fit-heading";
import { useBase } from "@/lib/data";
import { signatureQuery } from "@/lib/signature-data";
import { CAPSULE_MAX, RECORDING_SECONDS } from "@/lib/signature-rules";
import { formatDayMonth } from "@/lib/i18n";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import { ConfirmSheet } from "@/components/lezgo/confirm-sheet";
import { isSeasonId, seasonSearch } from "@/lib/season-id";
export const Route = createFileRoute("/_authenticated/capsule")({
  validateSearch: (search: Record<string, unknown>): { season?: string } =>
    search["season"] === undefined ? {} : { season: seasonSearch(search["season"]) },
  head: () =>
    pageHead("Time capsule · lezgo", "Seal a private note or recording for your season-end self."),
  component: CapsulePage,
});
function CapsulePage() {
  const { season } = Route.useSearch();
  return <CapsuleForSeason key={season} requestedSeason={season} />;
}

function CapsuleForSeason({ requestedSeason }: { requestedSeason: string | undefined }) {
  const { t, i18n } = useTranslation();
  const { uid, season, loading } = useBase();
  const sid = requestedSeason || season?.id || "";
  const valid = isSeasonId(sid);
  const qc = useQueryClient();
  const q = useQuery({ ...signatureQuery(uid, sid), enabled: !!uid && valid });
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [openedAudio, setOpenedAudio] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timeout.current) clearTimeout(timeout.current);
      if (rec.current?.state === "recording") rec.current.stop();
      stream.current?.getTracks().forEach((x) => x.stop());
    };
  }, []);
  useEffect(() => {
    if (!audio) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(audio);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  useEffect(() => {
    if (!recording) return;
    const i = setInterval(() => setSeconds((s) => Math.min(RECORDING_SECONDS, s + 1)), 1000);
    return () => clearInterval(i);
  }, [recording]);
  const c = q.data?.capsule;
  useEffect(() => {
    setOpenedAudio("");
    if (c?.locked || !c?.audio_url) return;
    let active = true;
    void supabase.storage
      .from("capsule-audio")
      .createSignedUrl(c.audio_url, 60)
      .then((r) => {
        if (active && r.data) setOpenedAudio(r.data.signedUrl);
      });
    return () => {
      active = false;
    };
  }, [c?.locked, c?.audio_url]);
  async function record() {
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") throw Error();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((x) =>
        MediaRecorder.isTypeSupported(x),
      );
      if (!type) throw Error();
      const recorder = new MediaRecorder(stream.current, { mimeType: type });
      rec.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.current?.getTracks().forEach((x) => x.stop());
        if (timeout.current) clearTimeout(timeout.current);
        if (alive.current) {
          setAudio(new Blob(chunks, { type }));
          setRecording(false);
        }
      };
      setAudio(null);
      setSeconds(0);
      setRecording(true);
      recorder.start();
      timeout.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, RECORDING_SECONDS * 1000);
    } catch {
      stream.current?.getTracks().forEach((x) => x.stop());
      toast.error(t("batch8.micError"));
    }
  }
  async function seal() {
    if (!valid || !q.data || recording) return;
    setConfirmOpen(false);
    setBusy(true);
    let path: string | null = null;
    try {
      if (audio) {
        if (audio.size > 2 * 1024 * 1024) throw Error();
        path = `${uid}/${sid}/${crypto.randomUUID()}.${audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm"}`;
        const upload = await supabase.storage
          .from("capsule-audio")
          .upload(path, audio, { contentType: audio.type, upsert: false });
        if (upload.error) throw upload.error;
      }
      const r = await supabase.rpc("seal_capsule", {
        _season_id: sid,
        _body: body,
        ...(path ? { _audio_path: path } : {}),
      });
      if (r.error) throw r.error;
      setBody("");
      setAudio(null);
      await qc.invalidateQueries({ queryKey: ["signature"] });
      await qc.invalidateQueries({ queryKey: ["wrapped"] });
    } catch {
      if (path) await supabase.storage.from("capsule-audio").remove([path]);
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }
  const opensOn = c?.opens_on ?? (season?.id === sid ? season?.ends_on : undefined);
  const date = opensOn ? formatDayMonth(opensOn, i18n.language) : "";
  return (
    <SignatureFrame>
      {requestedSeason ? (
        <Link className="wrapped-text-link" to="/wrapped" search={{ season: requestedSeason }}>{t("batch6.wrapped")}</Link>
      ) : (
        <Link to="/today"><StickerButton block variant="ghost">{t("batch9.skip")}</StickerButton></Link>
      )}
      {valid && (loading && !uid || q.isPending) ? (
        <p role="status">{t("common.loading")}</p>
      ) : !c ? (
        <p>{t("wrapped.capsuleUnavailable")}</p>
      ) : c.sealed ? (
        <section className="capsule-sealed">
          <Lock size={88} className="seal-pop" />
          <FitHeading
            className="signature-heading"
            requestedSize={40}
            text={c.locked ? t("batch8.sealed", { date }) : t("batch8.openNote")}
          />
          {!c.locked && (
            <>
              <p className="capsule-open-body">{c.body}</p>
              {openedAudio && <audio controls src={openedAudio} aria-label={t("batch8.audio")} />}
            </>
          )}
        </section>
      ) : (
        <>
          <FitHeading className="signature-heading" requestedSize={48} text={t("batch8.write")} />
          <p className="signature-sub">{t("batch8.writeSub")}</p>
          <label className="capsule-label">
            {t("batch8.note")}
            <textarea
              maxLength={CAPSULE_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={date ? t("batch8.dear", { date }) : t("batch8.note")}
            />
            <Num className="block text-end text-[13px] mt-2">
              {body.length}/{CAPSULE_MAX}
            </Num>
          </label>
          <div className="capsule-prompts">
            {["why", "scares", "want"].map((k) => (
              <StickerButton
                variant="secondary"
                size="sm"
                key={k}
                onClick={() =>
                  setBody((b) =>
                    (b + (b ? "\n" : "") + t(`batch8.${k}Starter`)).slice(0, CAPSULE_MAX),
                  )
                }
              >
                {t(`batch8.${k}`)}
              </StickerButton>
            ))}
          </div>
          <StickerButton
            block
            variant="ghost"
            className="capsule-record"
            disabled={busy}
            onClick={() => (recording ? rec.current?.stop() : void record())}
          >
            {recording ? <Square /> : <Mic />}
            {recording ? (
              <>
                <span>{t("batch8.stop")}</span>
                <Num>{seconds}/30</Num>
              </>
            ) : (
              t("batch8.record")
            )}
          </StickerButton>
          {preview && (
            <div className="capsule-audio">
              <audio controls src={preview} aria-label={t("batch8.audioReady")} />
              <StickerButton
                variant="ghost"
                className="icon-control"
                aria-label={t("batch8.removeAudio")}
                onClick={() => setAudio(null)}
              >
                <Trash2 />
              </StickerButton>
            </div>
          )}
          <StickerButton
            block
            disabled={busy || recording || (!body.trim() && !audio) || !q.data}
            onClick={() => setConfirmOpen(true)}
          >
            {t("batch8.seal")}
          </StickerButton>
          <ConfirmSheet open={confirmOpen} title={t("integrity.sealTitle")} body={t("integrity.sealBody")} confirmLabel={t("integrity.sealConfirm")} busy={busy} onConfirm={() => void seal()} onClose={() => setConfirmOpen(false)} />
        </>
      )}
    </SignatureFrame>
  );
}
