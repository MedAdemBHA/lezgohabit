import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { adminProofPhoto } from "@/lib/admin.functions";
export function AdminProofThumbnail({ post }: { post: string }) {
  const { t } = useTranslation();
  const fetchPhoto = useServerFn(adminProofPhoto);
  const photo = useQuery({
    queryKey: ["adminProof", post],
    queryFn: () => fetchPhoto({ data: { post } }),
    staleTime: 120000,
  });
  return photo.data?.url ? (
    <img
      src={photo.data.url}
      alt={t("batch4.proofPhoto")}
      className="mb-5 aspect-video w-full rounded-xl border-2 border-ink object-cover"
    />
  ) : null;
}
