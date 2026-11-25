import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserHabit, HabitPoints } from '@/lib/data';
import { habitColor } from '@/lib/today-rules';
import { loc } from '@/lib/i18n';
import { fmtVal } from '@/lib/habits';
import { HabitIcon } from '../habit-icon';
import { StickerButton, Num } from '../ui';
export function habitName(h: UserHabit, t: (key: string) => string, lang: string) {
 const key = h.template?.key;
 if (h.custom_name) return h.custom_name;
 if (key === 'train') return t('todayDesign.train');
 if (key === 'learn' || key === 'learn15') return t('todayDesign.learn');
 if (key === 'sleep' || key === 'sleep7') return t('todayDesign.sleep');
 if (key === 'no_sugar') return t('todayDesign.noSugar');
 const title = loc(h.template?.name,lang);
 const base = Number(h.template?.default_target);
 return (h.kind === 'count' || h.kind === 'timer') && base > 0 && base !== Number(h.target)
  ? title.replace(/\d+(?:[.,]\d+)?/g, part => Number(part.replace(',', '.')) === base
    ? fmtVal(Number(h.target)).replace('.', lang === 'fr' ? ',' : '.') : part)
  : title;
}
export function HabitTile({ habit, value, completion, points, pop, onTap, onStepper, disabled }: { habit: UserHabit; value: number; completion: number; points: HabitPoints | undefined; pop: boolean; onTap: () => void; onStepper: () => void; disabled: boolean }) {
 const { t, i18n } = useTranslation(); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const held = useRef(false);
 const done = completion >= 1; const color = habit.template?.color ?? habitColor(habit.template?.key ?? '', habit.template?.category ?? '');
 const key = habit.template?.key;
 const ruleData = habit.rule as { window_start?: string; window_end?: string } | null;
 const rule = key === 'train' ? (loc(habit.what_counts, i18n.language) || loc(habit.template?.what_counts, i18n.language) || t('todayDesign.trainRule')) : key === 'learn15' ? t('todayDesign.learnRule') : key === 'sleep7' && Number(habit.target) === 7 ? t('todayDesign.sleepRule') : key === 'no_sugar' ? t('todayDesign.sugarRule')
  : habit.kind === 'time_window' ? t('habitRules.outsideWindow', { start: ruleData?.window_start ?? '—', end: ruleData?.window_end ?? '—' })
  : habit.kind === 'quit' ? t('habitRules.quitRule')
  : habit.kind === 'timer' ? t('habitRules.timerVisible')
  : key === 'screen_limit' ? t('habitRules.screenLimitCount', { value: fmtVal(value), target: fmtVal(Number(habit.target)) })
  : habit.kind === 'count' ? t('todayDesign.count', { value: fmtVal(value), target: fmtVal(Number(habit.target)), unit: habit.unit ?? '' })
  : (loc(habit.what_counts,i18n.language) || loc(habit.template?.what_counts,i18n.language) || loc(habit.template?.description,i18n.language));
 function release() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
 return <StickerButton variant="secondary" data-habit-id={habit.id} className={`today-habit ${done ? 'is-done' : ''} ${pop ? 'animate-pop' : ''}`} data-color={color} aria-pressed={done} aria-label={habitName(habit,t,i18n.language)} disabled={disabled}
  onPointerDown={e => { if (e.button !== 0 || habit.kind !== 'count') return; held.current = false; timer.current = setTimeout(() => { held.current = true; onStepper(); },500); }} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
  onContextMenu={e => { if (habit.kind === 'count') { e.preventDefault(); release(); held.current = true; onStepper(); } }}
  onClick={() => { if (held.current) { held.current = false; return; } onTap(); }}>
  <span className="today-habit-top"><span className="habit-icon-box"><HabitIcon name={habit.template?.icon ?? null} className="size-9" /></span><span className="habit-top-end"><Num className="habit-points">+{fmtVal(points?.earned ?? 0)}</Num><span className={`habit-check ${done ? 'is-checked' : ''}`}>{done && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l5 5 9-10"/></svg>}</span></span></span>
  <span className="today-habit-bottom"><span className="habit-name">{habitName(habit,t,i18n.language)}</span><span className="habit-rule">{rule}</span></span>
 </StickerButton>;
}
