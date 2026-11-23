import { useTranslation } from "react-i18next";
import { BottomSheet, StickerButton } from "./ui";

/** One confirm step for every irreversible action (close day, seal, level up…). */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <p className="text-[16px] font-semibold">{body}</p>
      <div className="mt-5 flex gap-3">
        <StickerButton variant="secondary" className="flex-1" onClick={onClose}>
          {t("integrity.cancel")}
        </StickerButton>
        <StickerButton className="flex-1" disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </StickerButton>
      </div>
    </BottomSheet>
  );
}
