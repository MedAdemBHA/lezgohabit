import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { fingerprintProof } from '@/lib/admin.functions';
import { StickerButton } from '../ui';
import { compressProof } from '@/lib/proof-image';
export function ProofCompose({ uid, seasonId, day, existingPath, onSaved }: { uid: string; seasonId: string; day: string; existingPath: string | null; onSaved: () => Promise<void> }) {
 const { t } = useTranslation(); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState(''); const [busy, setBusy] = useState(false); const proofFingerprint = useServerFn(fingerprintProof);
 useEffect(() => {
  if (file) { const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }
  let alive = true;
  if (existingPath) void supabase.storage.from('habit-proofs').createSignedUrl(existingPath,600).then(({ data }) => { if (alive) setPreview(data?.signedUrl ?? ''); });
  return () => { alive = false; };
 }, [file, existingPath]);
 async function post() {
  if (!file) return; setBusy(true); let path = '';
  try {
   // Same path as feed photos: re-encoded JPEG, max 1280px, no EXIF/GPS metadata.
   const photo = await compressProof(file);
   path = `${uid}/${day}/${crypto.randomUUID()}.jpg`;
   const uploaded = await supabase.storage.from('habit-proofs').upload(path,photo,{ contentType: 'image/jpeg' });
   if (uploaded.error) throw uploaded.error;
   await proofFingerprint({ data: { path, bucket: 'habit-proofs' } });
   const posted = await supabase.rpc('post_daily_proof',{ _season_id: seasonId, _path: path });
   if (posted.error) { await supabase.storage.from('habit-proofs').remove([path]); if (posted.error.message.includes('duplicate_proof')) { toast(t('integrity.duplicateProof')); return; } if (posted.error.message.includes('day_final')) { toast(t('integrity.dayFinal')); return; } throw posted.error; }
   toast(t('todayDesign.proofPosted')); await onSaved();
  } catch { toast(t('common.error')); } finally { setBusy(false); }
 }
 return <div className="space-y-4">
  {preview && <img src={preview} alt={t('todayDesign.preview')} className="max-h-72 w-full rounded-[18px] object-contain sticker-border bg-card" />}
  <label className="flex min-h-[80px] cursor-pointer items-center justify-center gap-3 rounded-[18px] bg-card p-4 font-extrabold dashed-ink"><Camera className="size-6" strokeWidth={2.5}/>{t('todayDesign.choosePhoto')}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={e => { const photo = e.target.files?.[0]; if (!photo) return; if (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 10 * 1024 * 1024) { toast(t('todayDesign.photoError')); return; } setFile(photo); }}/></label>
  <p className="text-[13px] font-semibold text-design-muted">{t('todayDesign.proofPrivate')}</p>
  <StickerButton block disabled={!file || busy} onClick={post}>{t('todayDesign.postProof')}</StickerButton>
 </div>;
}
