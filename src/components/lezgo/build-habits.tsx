import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Template } from '@/lib/data';
import { loc } from '@/lib/i18n';
import { canAddHabit, DESIGN_HABIT_GROUPS } from '@/lib/habit-selection';
import type { Pick } from './habit-picker';
import { StickerButton } from './ui';
export function BuildHabits({ templates, picks, onChange }: { templates: Template[]; picks: Pick[]; onChange: (p: Pick[]) => void }) {
 const { t, i18n } = useTranslation(); const [name, setName] = useState('');
 const labels: Record<string, string> = { train: t('design.train'), steps: t('design.steps'), salat: t('design.salat'), coffee: t('design.coffee'), water: t('design.water'), dhikr: t('design.dhikr') };
 function toggle(tpl: Template) {
  if (picks.some(p => p.id === tpl.key)) { onChange(picks.filter(p => p.id !== tpl.key)); return; }
  if (!canAddHabit(picks.length)) { toast(t('onb.max')); return; }
  onChange([...picks, { id: tpl.key, template: tpl, target: Number(tpl.default_target) }]);
 }
 function add() {
  const custom = templates.find(x => x.key === 'custom'); if (!custom || !name.trim()) return;
  if (!canAddHabit(picks.length)) { toast(t('onb.max')); return; }
  onChange([...picks, { id: `custom:${Date.now()}`, template: custom, customName: name.trim(), target: 1 }]); setName('');
 }
 return <>
  <div className="habit-groups">
   {DESIGN_HABIT_GROUPS.map(group => <section key={group.key}>
    <div className="mb-1.5 flex flex-wrap items-center gap-2"><span className={`habit-group-label ${group.color}`}>{t(`design.${group.key}`)}</span>{group.key === 'soul' && <span className="text-[11px] font-semibold text-design-muted">{t('onb.faithNote')}</span>}</div>
    <div className="flex flex-wrap gap-1.5">{group.habits.map(key => { const tpl = templates.find(x => x.key === key); if (!tpl) return null; const selected = picks.some(p => p.id === key); return <StickerButton key={key} variant="secondary" className={`habit-chip ${selected ? `${group.color} shadow-hard-sm` : 'bg-card'}`} aria-pressed={selected} onClick={() => toggle(tpl)}>{selected && <Check className="size-[13px] shrink-0" strokeWidth={3} />}{labels[key] ?? loc(tpl.name, i18n.language)}</StickerButton>; })}</div>
   </section>)}
   {picks.some(p => p.customName) && <section><span className="habit-group-label bg-yellow">{t('design.yours')}</span><div className="mt-1.5 flex flex-wrap gap-1.5">{picks.filter(p => p.customName).map(p => <StickerButton key={p.id} variant="yellow" className="habit-chip bg-yellow shadow-hard-sm" onClick={() => onChange(picks.filter(x => x.id !== p.id))}><Check className="size-[13px]" />{p.customName}</StickerButton>)}</div></section>}
  </div>
  <form className="create-habit sticker" onSubmit={e => { e.preventDefault(); add(); }}>
   <label htmlFor="custom-habit" className="mb-2 block text-[12px] font-extrabold">{t('design.create')}</label>
   <div className="flex gap-2"><input id="custom-habit" className="min-w-0 flex-1 rounded-xl border-2 bg-cream px-3 text-[13px] font-semibold outline-none" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder={t('design.customPh')} /><StickerButton type="submit" variant="yellow" disabled={!name.trim()} className="h-11 min-h-11 rounded-xl px-3 text-[14px] shadow-none">{t('design.add')}</StickerButton></div>
  </form>
 </>;
}
