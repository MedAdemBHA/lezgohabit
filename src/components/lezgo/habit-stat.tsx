import { useTranslation } from 'react-i18next';
import { loc } from '@/lib/i18n';
import type { HabitStat } from '@/lib/community-data';
export function useHabitStatLabel(stat:HabitStat|null|undefined) {
 const {t,i18n}=useTranslation();
 return stat?.kind==='salat'?t('socialDesign.prayerStat'):stat?loc(stat.name,i18n.language):t('socialDesign.noStats');
}
