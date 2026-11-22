import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getPrayerTimes } from '@/lib/prayer-times.functions';
import { PRAYERS, fmtVal, type PrayerState } from '@/lib/habits';
import { cyclePrayer } from '@/lib/today-rules';
import type { HabitPoints } from '@/lib/data';
import { SalatIcon } from '@/components/icons';
import { StickerButton, Num } from '../ui';
export function SalatCard({ day, uid, city, country, prayers, points, onChange, onCity, disabled }: { day: string; uid: string; city: string | null; country: string; prayers: Record<string, PrayerState>; points: HabitPoints | undefined; onChange: (prayers: Record<string, PrayerState>) => void; onCity: () => void; disabled: boolean }) {
 const { t } = useTranslation(); const fetchTimes = useServerFn(getPrayerTimes);
 const times = useQuery({ queryKey: ['prayer-times',uid,day,city,country], queryFn: () => fetchTimes({ data: { day } }), staleTime: 60*60_000, enabled: !!city });
 return <section className="salat-card">
  <div className="salat-heading"><div className="flex min-w-0 items-center gap-1.5"><SalatIcon size={22}/><h2>{t('todayDesign.salat')}</h2></div><div className="flex shrink-0 items-center gap-2"><Num>+{fmtVal(points?.earned ?? 0)}/{fmtVal(points?.share ?? 0)}</Num><Link to="/habits">{t('todayDesign.edit')}</Link></div></div>
  {!city && <StickerButton variant="ghost" className="prayer-location" onClick={onCity}>{t('todayDesign.cityMissing')}</StickerButton>}
  {city && times.data?.status === 'unavailable' && <StickerButton variant="ghost" className="prayer-location" onClick={() => void times.refetch()}>{t('todayDesign.timesUnavailable')} · {t('todayDesign.retry')}</StickerButton>}
  <div className="prayers-grid">{PRAYERS.map(name => { const state = prayers[name]; return <StickerButton variant="secondary" key={name} disabled={disabled} aria-label={`${t(`today.${name}`)} · ${state === 'on_time' ? t('todayDesign.onTime') : state === 'late' ? t('todayDesign.late') : times.data?.times?.[name] ?? '—'}`} className={`prayer-button ${state === 'on_time' ? 'on-time' : state === 'late' ? 'late' : ''}`} onClick={() => { const next = { ...prayers }; const value = cyclePrayer(state); if (value) next[name] = value; else delete next[name]; onChange(next); }}><span>{t(`today.${name}`)}</span><span className="prayer-status" dir={state ? undefined : 'ltr'}>{state === 'on_time' ? t('todayDesign.onTime') : state === 'late' ? t('todayDesign.late') : times.data?.times?.[name] ?? '—'}</span></StickerButton>; })}</div>
 </section>;
}
