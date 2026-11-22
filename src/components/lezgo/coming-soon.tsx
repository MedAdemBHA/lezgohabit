import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AppShell } from './app-shell';
import { BossIcon, TrainIcon } from '@/components/icons';
export function ComingSoon({ kind }: { kind: 'lift' | 'boss' }) {
 const { t } = useTranslation(); const Icon = kind === 'lift' ? TrainIcon : BossIcon;
 return <AppShell><div className="flex flex-1 flex-col items-center gap-5 py-16"><Icon size={80} /><h1 className="text-[32px] font-extrabold">{t(`design.${kind}`)}</h1><p className="font-semibold text-muted-foreground">{t('design.soon')}</p><Link to="/today" className="mt-6 rounded-[18px] bg-ink px-6 py-4 font-extrabold text-lime sticker-border shadow-hard-orange">{t('profile.next')}</Link></div></AppShell>;
}
