import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState } from 'react';
import { useHydrated } from '@/hooks/use-hydrated';
import { applyLang, LANGS } from '@/lib/i18n';
import { BottomSheet, StickerButton } from './ui';
const labels = { en: 'EN', fr: 'FR', ar: 'ع', aeb: 'تو' };
export function DesignLanguage({ segmented = false }: { segmented?: boolean }) {
 const { t: tLive, i18n } = useTranslation(); const [open, setOpen] = useState(false);
 // The server always renders English; match it during hydration, then show the saved language.
 const hydrated = useHydrated();
 const current = hydrated ? i18n.language : 'en'; const t = hydrated ? tLive : i18n.getFixedT('en');
 const control = <div role="group" aria-label={t('common.language')} className="design-language" dir="ltr">{LANGS.map(l => <StickerButton key={l} variant="ghost" aria-pressed={current === l} onClick={() => { applyLang(l); setOpen(false); }} className={`language-option ${current === l ? 'bg-ink text-lime' : 'bg-card text-ink'} ${l === 'en' || l === 'fr' ? 'num' : 'font-arabic'}`}>{labels[l]}</StickerButton>)}</div>;
 if (segmented) return control;
 return <><StickerButton variant="secondary" className="join-language" aria-label={t('common.language')} onClick={() => setOpen(true)}><Globe size={16} strokeWidth={2.4} />{labels[current as keyof typeof labels] ?? 'EN'}</StickerButton><BottomSheet open={open} onClose={() => setOpen(false)} title={t('common.language')}>{control}</BottomSheet></>;
}
