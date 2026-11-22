import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { CrewIcon, ThoughtIcon } from '@/components/icons';
import { AppShell } from '@/components/lezgo/app-shell';
import { StickerButton } from '@/components/lezgo/ui';
export const Route = createFileRoute('/_authenticated/community')({ head: () => ({ meta: [{ title: 'Community — lezgo' }, { name: 'description', content: 'Your crew and buddies on lezgo.' }, { property: 'og:title', content: 'Community — lezgo' }, { property: 'og:description', content: 'Your crew and buddies on lezgo.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Community });
function Community() {
 const { t } = useTranslation(); const [view, setView] = useState<'feed' | 'buddies'>('feed');
 return <AppShell><h1 className="mb-5 text-[30px] font-extrabold">{t('design.community')}</h1><div className="flex flex-wrap gap-2"><StickerButton variant={view === 'feed' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('feed')}>{t('design.feed')}</StickerButton><Link to="/crew" className="flex min-h-11 items-center gap-2 rounded-[16px] bg-card px-3 font-bold sticker-border"><CrewIcon size={22} />{t('crew.title')}</Link><StickerButton variant={view === 'buddies' ? 'primary' : 'secondary'} size="sm" onClick={() => setView('buddies')}>{t('design.buddies')}</StickerButton></div><div className="flex flex-col items-center gap-4 py-16"><ThoughtIcon size={72} /><h2 className="text-[24px] font-extrabold">{t(`design.${view}`)}</h2><p>{t('design.soon')}</p><Link to="/today" className="mt-5 font-extrabold underline">{t('profile.next')}</Link></div></AppShell>;
}
