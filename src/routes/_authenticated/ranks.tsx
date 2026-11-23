import { pageHead } from '@/lib/page-head';
import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState,useRef,useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight,Crown,Ghost } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/lezgo/app-shell';
import { Avatar,BottomSheet,Num,StickerButton } from '@/components/lezgo/ui';
import { FitHeading } from '@/components/lezgo/fit-heading';
import { ScoringSheet } from '@/components/lezgo/scoring-sheet';
import { useHabitStatLabel } from '@/components/lezgo/habit-stat';
import { useBase } from '@/lib/data';
import { countryName,summaryQuery,type RankRowData } from '@/lib/community-data';
import { movement,seasonWeek } from '@/lib/community-rules';
import { daysBetween } from '@/lib/time';
import { cn } from '@/lib/utils';
export const Route=createFileRoute('/_authenticated/ranks')({head:()=>pageHead('Scoreboard — lezgo','Your country, World and Crew scores, podium and solo ghost.'),component:Ranks});
type Scope='country'|'world'|'crews';type Period='today'|'week'|'season';
function Ranks(){
 const {t,i18n}=useTranslation();const {season,profile,uid,today}=useBase();
 const [scope,setScope]=useState<Scope>('country');const [period,setPeriod]=useState<Period>('season');const [sel,setSel]=useState<RankRowData|null>(null);const [explain,setExplain]=useState(false);const [ghost,setGhost]=useState(false);
 const myAnchor=useRef<HTMLDivElement>(null);const [selfVisible,setSelfVisible]=useState(true);
 const q=useQuery({queryKey:['scoreboard',uid,season?.id,scope,period,profile?.country_code],enabled:!!season&&!!profile,queryFn:async()=>{if(!season||!profile)throw Error('missing season');const {data,error}=await supabase.rpc('scoreboard',{_season_id:season.id,_scope:scope,_period:period,_country_code:profile.country_code});if(error)throw error;return data as unknown as {rows:RankRowData[];me:RankRowData|null};},refetchInterval:30_000});
 const summary=useQuery({...summaryQuery(uid,season?.id??''),enabled:!!uid&&!!season});
 const g=useQuery({queryKey:['ghost',uid,season?.id],enabled:!!season&&ghost,queryFn:async()=>{if(!season)throw Error('missing season');const {data,error}=await supabase.rpc('solo_ghost',{_season_id:season.id});if(error)throw error;return data as unknown as {points:number|null;starts_on:string|null;current:number};}});
 const rows=q.data?.rows??[];const me=q.data?.me;
 useEffect(()=>{const target=myAnchor.current;if(!target){setSelfVisible(!me);return;}const obs=new IntersectionObserver(([entry])=>setSelfVisible(entry?.isIntersecting??false),{rootMargin:'0px 0px -96px 0px'});obs.observe(target);return()=>obs.disconnect();},[q.data,me]);
 const pinned=!!me&&!selfVisible;
 const top=[rows[1],rows[0],rows[2]];
 return <AppShell todayLayout><div className="board-header"><FitHeading text={t('socialDesign.scoreboard')} requestedSize={56} className="board-title"/><span className="week-sticker num">{t('socialDesign.seasonWeek',{n:seasonWeek(season?daysBetween(season.starts_on,today)+1:1)})}</span></div>
 <div className="board-segments" role="group" aria-label={t('socialDesign.scoreboard')}>{(['country','world','crews'] as const).map(s=><StickerButton key={s} variant="ghost" aria-pressed={scope===s} className={scope===s?'bg-ink text-lime':'text-ink'} onClick={()=>{setScope(s);setGhost(false);}}>{s==='country'?countryName(profile?.country_code??'TN',i18n.language):t(`ranks.${s}`)}</StickerButton>)}</div>
 <div className="flex flex-wrap gap-2">{(['today','week','season'] as const).map(p=><StickerButton key={p} size="sm" variant="secondary" className={cn('period-chip',period===p?'bg-lime shadow-hard-sm':'shadow-none')} aria-pressed={period===p} onClick={()=>setPeriod(p)}>{t(`ranks.${p}`)}</StickerButton>)}</div>
 {summary.data?.mode==='solo'&&scope!=='crews'&&<StickerButton variant="secondary" size="sm" className={cn('self-start rounded-full',ghost&&'bg-lime')} aria-pressed={ghost} onClick={()=>setGhost(!ghost)}><Ghost size={18}/>{t('socialDesign.ghostToggle')}</StickerButton>}
 {q.isPending?<p className="py-8 text-center">{t('common.loading')}</p>:q.isError?<StickerButton variant="secondary" onClick={()=>void q.refetch()}>{t('common.error')}</StickerButton>:rows.length===0?<p className="py-8 text-center font-bold">{t('ranks.empty')}</p>:<>
 <div className="podium">{top.map((row,i)=>row?<div key={row.user_id??row.crew_id??i} className="podium-player">{row.rank===1&&<Crown className="podium-crown fill-yellow" size={34} strokeWidth={2.5}/>}<StickerButton variant="ghost" className="min-h-11 border-0 p-0 shadow-none" aria-label={row.display_name} onClick={()=>setSel(row)}><Avatar id={row.user_id??row.crew_id??''} name={row.display_name} url={row.avatar_url} size={52} className={row.rank===1?'bg-yellow':''}/></StickerButton><bdi className="podium-handle" dir="ltr">{row.handle?`@${row.handle}`:row.display_name}</bdi><StickerButton variant="ghost" className={cn('podium-block p-0 text-ink',row.rank===1?'h-[148px] bg-yellow':row.rank===2?'h-[112px] bg-blue':'h-[88px] bg-pink')} onClick={()=>setSel(row)}><strong>{row.rank}</strong><Num>{row.points.toLocaleString('en-US')}</Num></StickerButton></div>:<span key={i}/>)}</div>
 <div className="mt-3">{me&&me.rank<=3&&<div ref={myAnchor} className="mb-3"><RankRow row={me} onClick={()=>setSel(me)}/></div>}{rows.slice(3).map(row=><div key={row.user_id??row.crew_id??row.rank} ref={row.is_me?myAnchor:undefined} className="mb-3"><RankRow row={row} onClick={()=>setSel(row)}/></div>)}</div></>}
 {ghost&&<div className="dashed-ink flex min-h-[68px] items-center gap-3 rounded-[18px] p-3"><Ghost size={32}/><div className="min-w-0 flex-1"><p className="font-extrabold">{t('socialDesign.ghost')}</p><p className="text-[13px] font-semibold">{g.data?.points===null?t('socialDesign.ghostEmpty'):t('socialDesign.ghostWindow')}</p>{g.data?.points!=null&&<p className="text-[13px]">{t('socialDesign.currentRun')}: <Num>{g.data.current}</Num></p>}</div><Num className="text-[20px] font-bold">{g.data?.points??'—'}</Num></div>}
 <div className={cn('mt-2 -rotate-1 rounded-[18px] bg-lime px-[18px] py-[14px] sticker-border',pinned&&'mb-[76px]')}><p className="text-[15px] font-bold">{t('socialDesign.note')}</p><StickerButton variant="ghost" className="scoring-link min-h-11 text-[15px] font-extrabold" onClick={()=>setExplain(true)}>{t('socialDesign.scoring')}<ArrowRight size={18} className="rtl:-scale-x-100"/></StickerButton></div>
 {pinned&&me&&<div className="pinned-rank"><RankRow row={me} onClick={()=>setSel(me)}/></div>}
 <ScoringSheet open={explain} onClose={()=>setExplain(false)}/><BottomSheet open={!!sel} onClose={()=>setSel(null)} title={sel?.display_name}>{sel&&<div className="space-y-3"><div className="flex items-center gap-4"><Avatar id={sel.user_id??sel.crew_id??''} name={sel.display_name} url={sel.avatar_url} size={72}/><div><p><Num>#{sel.rank} · {sel.points}</Num> {t('common.pts')}</p><p>{t('socialDesign.streakStat',{n:sel.streak})}</p></div></div>{sel.is_me&&<Link to={sel.crew_id?'/crew-details':'/profile'} className="block"><StickerButton block variant="lime">{sel.crew_id?t('socialDesign.yourCrew'):t('common.profile')}</StickerButton></Link>}</div>}</BottomSheet>
 </AppShell>;
}
function RankRow({row,onClick}:{row:RankRowData;onClick:()=>void}){const {t}=useTranslation();const stat=useHabitStatLabel(row.stat);const delta=movement(row.previous_rank,row.rank);return <StickerButton variant="secondary" className={cn('rank-row',row.is_me&&'bg-lime')} onClick={onClick}><Num className="w-5 shrink-0 text-center text-[16px]">{row.rank}</Num><Avatar id={row.user_id??row.crew_id??''} name={row.display_name} url={row.avatar_url} size={34}/><span className="min-w-0 flex-1"><span className="rank-name block truncate">{row.display_name}</span><span className="rank-sub block truncate">{row.members!=null?t('ranks.members',{n:row.members}):`${t('socialDesign.streakStat',{n:row.streak})}${row.stat?` · ${t('socialDesign.habitStat',{value:row.stat.value,name:stat})}`:''}`}</span></span><span className={cn('rank-movement shrink-0',delta>0?'bg-lime':delta<0?'bg-pink':'bg-card')}><Num>{delta>0?`▲${delta}`:delta<0?`▼${-delta}`:'–'}</Num></span><Num className="shrink-0 text-[18px] font-bold">{row.points.toLocaleString('en-US')}</Num></StickerButton>}
