import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery,useSuspenseQuery,useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft,ArrowRight,Snowflake,Trophy,Bell,Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/lezgo/app-shell';
import { FitHeading } from '@/components/lezgo/fit-heading';
import { Num,StickerButton } from '@/components/lezgo/ui';
import {challengesQuery} from '@/lib/batch6-data';
import { seasonsHubQuery } from '@/lib/batch5-data';
import { useBase } from '@/lib/data';
import { summaryQuery,countryName } from '@/lib/community-data';
import { daysBetween } from '@/lib/time';
import { pageHead } from '@/lib/page-head';
import { loc,formatDayMonth } from '@/lib/i18n';
export const Route=createFileRoute('/_authenticated/seasons')({head:()=>pageHead('Seasons — lezgo','Winter Arc, upcoming challenges, your reminders and earned season trophies.'),loader:({context})=>context.queryClient.ensureQueryData(seasonsHubQuery(context.user.id)),component:Seasons});
function Seasons(){const {t,i18n}=useTranslation();const {profile,today,season:activeSeason}=useBase();const uid=Route.useRouteContext().user.id;const qc=useQueryClient();const q=useSuspenseQuery(seasonsHubQuery(uid));const challenges=useQuery(challengesQuery(uid));const current=profile?.is_demo?activeSeason:q.data.seasons.find(s=>s.status==='live'&&!s.challenge_owned&&!s.archived);const summary=useQuery({...summaryQuery(uid,current?.id??''),enabled:!!current});const [busy,setBusy]=useState<string|null>(null);
 const count=current?daysBetween(current.starts_on,current.ends_on)+1:1;const day=current?Math.min(count,Math.max(1,daysBetween(current.starts_on,today)+1)):0;
 const dates=(start:string,end:string)=>`${formatDayMonth(start,i18n.language)} – ${formatDayMonth(end,i18n.language)}`;
 async function remind(slug:string,on:boolean){setBusy(slug);const r=await supabase.rpc('set_season_reminder',{_slug:slug,_on:on});setBusy(null);if(r.error)toast(t('common.error'));else await qc.invalidateQueries({queryKey:['seasonsHub',uid]});}
 return <AppShell todayLayout><Link to="/profile" className="self-start"><StickerButton variant="secondary" className="icon-control" aria-label={t('common.back')}><ArrowLeft className="rtl:-scale-x-100"/></StickerButton></Link><FitHeading requestedSize={52} className="batch5-title" text={t('batch5.seasons')}/>
 {current&&<section className="season-current" data-color="blue"><div className="flex items-center justify-between"><span className="season-now">{t('batch5.nowSeason',{n:profile?.is_demo?1:q.data.seasons.filter(s=>s.starts_on<=current.starts_on&&!s.challenge_owned&&!s.archived).length})}</span><Snowflake size={32}/></div><h2 className="season-name">{current.slug.includes('winter')?t('batch5.winterArc'):loc(current.name,i18n.language)}</h2><p className="batch5-sub">{t('batch5.winterSub',{dates:dates(current.starts_on,current.ends_on)})}</p><div className="season-stats"><span>{t('batch5.dayOf',{n:day,total:count})}</span><span>{summary.data?.rank?t('batch5.rankCountry',{rank:summary.data.rank,country:countryName(profile?.country_code??'TN',i18n.language)}):'—'}</span></div><progress className="season-progress" value={day} max={count} aria-label={t('batch5.dayOf',{n:day,total:count})}/><Link to="/today"><StickerButton block size="lg">{t('batch5.openSeason')}<ArrowRight className="rtl:-scale-x-100"/></StickerButton></Link></section>}
 <Link to="/wrapped" search={{season:current?.id??''}}><StickerButton block variant="secondary">{t('batch6.wrapped')}</StickerButton></Link>
 <h2 className="section-label">{t('batch6.mine')}</h2>{challenges.data?.map(c=><div className="challenge-list-row" key={c.id}><div><h3>{c.name}</h3><p>{t('batch6.days',{n:c.days})} · {t(`batch6.${c.audience}`)}</p><Num>{c.code}</Num></div><StickerButton size="sm" variant="lime" onClick={async()=>{const r=await supabase.rpc('activate_challenge',{_id:c.id});if(r.error)toast(t('common.error'));else{await qc.invalidateQueries();window.location.assign('/today');}}}>{t('batch6.open')}</StickerButton></div>)}<StickerButton variant="secondary" onClick={async()=>{await supabase.rpc('activate_challenge',{});await qc.invalidateQueries();window.location.assign('/today');}}>{t('batch6.official')}</StickerButton>
 <h2 className="section-label mt-3">{t('batch5.comingUp')}</h2>
 {q.data.seasons.filter(s=>s.status==='upcoming').map(s=>{const on=q.data.reminders.some(r=>r.season_slug===s.slug);return <article className="season-upcoming" key={s.id}><span className="season-color" data-color={s.slug.startsWith('ramadan')?'purple':s.slug.startsWith('summer')?'orange':s.slug.startsWith('comeback')?'teal':'lime'}/><div className="season-row-copy"><h3>{loc(s.name,i18n.language)}</h3><p>{s.slug.startsWith('ramadan')?t('batch5.ramadanDates'):s.slug.startsWith('comeback')?t('batch5.septemberDates',{year:s.starts_on.slice(0,4)}):dates(s.starts_on,s.ends_on)}</p></div><StickerButton variant="secondary" size="sm" className={`season-reminder ${on?'bg-teal':''}`} aria-pressed={on} disabled={busy===s.slug} onClick={()=>void remind(s.slug,!on)}>{on?<Check size={16}/>:<Bell size={16}/>}<span>{t(on?'batch5.reminderOn':'batch5.remind')}</span></StickerButton></article>;})}
 <section className="trophy-shelf"><Trophy size={32}/><div><h2>{t('batch5.trophyShelf')}</h2><p>{t('batch5.trophyRule',{n:Math.ceil(count*0.75)})}</p>{q.data.trophies.map(tr=><p className="mt-2 font-bold" key={tr.season_id}>{t('batch5.earned')} · {loc(q.data.seasons.find(s=>s.id===tr.season_id)?.name,i18n.language)}</p>)}</div></section>
 </AppShell>;
}
