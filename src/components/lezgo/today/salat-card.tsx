import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getPrayerTimes } from '@/lib/prayer-times.functions';
import { PRAYERS, fmtPts, fmtVal, type PrayerState } from '@/lib/habits';
import type { HabitPoints } from '@/lib/data';
import { SalatIcon } from '@/components/icons';
import { StickerButton, Num } from '../ui';
// A marked prayer can be undone for 10 minutes; after that the server locks it.
const isLocked = (at: string | undefined) => !at || Date.now() - new Date(at).getTime() > 10 * 60_000;
export function SalatCard({ day, uid, city, country, prayers, markedAt, points, onMark, onCity, disabled }: { day: string; uid: string; city: string | null; country: string; prayers: Record<string, PrayerState>; markedAt: Record<string, string>; points: HabitPoints | undefined; onMark: (prayer: string) => void; onCity: () => void; disabled: boolean }) {
 const { t } = useTranslation(); const fetchTimes = useServerFn(getPrayerTimes);
 const times = useQuery({ queryKey: ['prayer-times',uid,day,city,country], queryFn: () => fetchTimes({ data: { day } }), staleTime: 60*60_000, enabled: !!uid });
 return <section className="salat-card">
  <div className="salat-heading"><div className="flex min-w-0 items-center gap-1.5"><SalatIcon size={22}/><h2>{t('todayDesign.salat')}</h2></div><div className="flex shrink-0 items-center gap-2"><Num>+{fmtPts(points?.earned)}/{fmtPts(points?.share)}</Num><Link to="/habits">{t('todayDesign.edit')}</Link></div></div>
  {!city && <StickerButton variant="ghost" className="prayer-location" onClick={onCity}>{t('todayDesign.cityMissing')}</StickerButton>}
  <p className="text-[12px] font-semibold text-design-muted">{t('todayDesign.prayerRule')}</p>
  {times.data?.status === 'unavailable' && <StickerButton variant="ghost" className="prayer-location" onClick={() => void times.refetch()}>{t('todayDesign.timesUnavailable')} · {t('todayDesign.retry')}</StickerButton>}
  <div className="prayers-grid">{PRAYERS.map(name => { const state = prayers[name]; return <StickerButton variant="secondary" key={name} disabled={disabled || (!!state && isLocked(markedAt[name]))} aria-label={`${t(`today.${name}`)} · ${state === 'on_time' ? t('todayDesign.onTime') : state === 'late' ? t('todayDesign.late') : times.data?.times?.[name] ?? '—'}`} className={`prayer-button ${state === 'on_time' ? 'on-time' : state === 'late' ? 'late' : ''}`} onClick={() => onMark(name)}><span>{t(`today.${name}`)}</span><span className="prayer-status" dir={state ? undefined : 'ltr'}>{state === 'on_time' ? t('todayDesign.onTime') : state === 'late' ? t('todayDesign.late') : times.data?.times?.[name] ?? '—'}</span></StickerButton>; })}</div>
 </section>;
}
