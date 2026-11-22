import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState } from 'react';
import { applyLang, LANGS } from '@/lib/i18n';
import { BottomSheet, StickerButton } from './ui';
const labels = { en: 'EN', fr: 'FR', ar: 'ع', aeb: 'تو' };
export function DesignLanguage({ segmented = false }: { segmented?: boolean }) {
 const { t, i18n } = useTranslation(); const [open, setOpen] = useState(false);
 const control = <div role="group" aria-label={t('common.language')} className="design-language" dir="ltr">{LANGS.map(l => <StickerButton key={l} variant="ghost" aria-pressed={i18n.language === l} onClick={() => { applyLang(l); setOpen(false); }} className={`language-option ${i18n.language === l ? 'bg-ink text-lime' : 'bg-card text-ink'} ${l === 'en' || l === 'fr' ? 'num' : 'font-arabic'}`}>{labels[l]}</StickerButton>)}</div>;
 if (segmented) return control;
 return <><StickerButton variant="secondary" className="join-language" aria-label={t('common.language')} onClick={() => setOpen(true)}><Globe size={16} strokeWidth={2.4} />{labels[i18n.language as keyof typeof labels] ?? 'EN'}</StickerButton><BottomSheet open={open} onClose={() => setOpen(false)} title={t('common.language')}>{control}</BottomSheet></>;
}
