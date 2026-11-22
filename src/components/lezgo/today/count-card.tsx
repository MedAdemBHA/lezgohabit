import { useTranslation } from 'react-i18next';
import type { UserHabit } from '@/lib/data';
import { fmtVal } from '@/lib/habits';
import { loc } from '@/lib/i18n';
import { CupIcon } from '@/components/icons/tab-icons';
import { Num, StickerButton } from '../ui';
export function CountCard({ habit, value, onIncrement, onEdit, disabled }: { habit: UserHabit; value: number; onIncrement: () => void; onEdit: () => void; disabled: boolean }) {
 const { t, i18n } = useTranslation(); const coffee = habit.template?.key === 'coffee' || habit.unit === 'cups';
 return <section className="count-card"><div className="min-w-0 flex-1"><h2>{coffee ? t('todayDesign.coffee') : habit.custom_name ?? loc(habit.template?.name,i18n.language)}</h2><div className="count-indicators" aria-hidden>{Array.from({ length: 5 },(_,i) => coffee ? <CupIcon key={i} filled={value > i}/> : <span key={i} className={`count-indicator ${value / Math.max(1,Number(habit.target)) >= (i+1)/5 ? 'is-filled' : ''}`} />)}</div><StickerButton variant="ghost" className="count-value" onClick={onEdit}><Num>{coffee ? t('todayDesign.sugar',{ n: fmtVal(value) }) : t('todayDesign.count',{ value: fmtVal(value), target: fmtVal(Number(habit.target)), unit: habit.unit ?? '' })}</Num></StickerButton></div><StickerButton variant="secondary" className="count-add" onClick={onIncrement} disabled={disabled}>{coffee ? t('todayDesign.cup') : t('todayDesign.increment', { unit: habit.unit ?? '' })}</StickerButton></section>;
}
