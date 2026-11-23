import { useTranslation } from 'react-i18next';
import { BottomSheet } from './ui';
export function ScoringSheet({open,onClose}:{open:boolean;onClose:()=>void}) {
 const {t}=useTranslation();
 return <BottomSheet open={open} onClose={onClose} title={t('socialDesign.scoringTitle')}><div className="space-y-4 text-[15px] font-semibold">{(['scoreHabits','scoreStacks','scoreStreak','scoreShield','scoreTotal'] as const).map(key=><p key={key}>{t(`socialDesign.${key}`)}</p>)}</div></BottomSheet>;
}
