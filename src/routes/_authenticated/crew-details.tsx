import { createFileRoute,Link,useNavigate } from '@tanstack/react-router';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft,Copy,MoreHorizontal,Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/lezgo/app-shell';
import { Avatar,BottomSheet,Num,StickerButton } from '@/components/lezgo/ui';
import { myCrewQuery,useBase } from '@/lib/data';
import { countryName,crewDetailsQuery } from '@/lib/community-data';
import { pageHead } from '@/lib/page-head';
import { cn } from '@/lib/utils';
export const Route=createFileRoute('/_authenticated/crew-details')({head:()=>pageHead('Your crew — lezgo','Crew sync, member results and your invitation code.'),component:CrewDetailsPage});
function CrewDetailsPage(){
 const {t,i18n}=useTranslation();const {uid,season}=useBase();const qc=useQueryClient();const navigate=useNavigate();
 const [menu,setMenu]=useState(false);const [confirm,setConfirm]=useState(false);const [busy,setBusy]=useState(false);const [nudging,setNudging]=useState<string|null>(null);
 const mine=useQuery({...myCrewQuery(uid,season?.id??''),enabled:!!uid&&!!season});const id=mine.data??'';
 const q=useQuery({...crewDetailsQuery(id),enabled:!!id});const data=q.data;
 const done=data?.members.filter(m=>m.perfect||(m.total>0&&m.done>=m.total)).length??0;
 const allDone=!!data&&data.members.length>=2&&done===data.members.length;
 async function leave(){setBusy(true);const {error}=await supabase.rpc('leave_crew',{_crew_id:id});setBusy(false);if(error){toast(t('common.error'));return;}setConfirm(false);await qc.invalidateQueries();await navigate({to:'/crew'});}
 async function nudge(target:string){setNudging(target);const {error}=await supabase.rpc('send_nudge',{_to_user:target});setNudging(null);if(error)toast(t('common.error'));else await Promise.all([qc.invalidateQueries({queryKey:['crewDetails',id]}),qc.invalidateQueries({queryKey:['crewToday',id]})]);}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);toast(t('crew.copied'));}catch{toast(t('common.error'));}}
 return <AppShell todayLayout><div className="flex items-center gap-3"><Link to="/crew"><StickerButton variant="secondary" className="habit-back" aria-label={t('common.back')}><ArrowLeft size={22} className="rtl:-scale-x-100"/></StickerButton></Link><span className="flex-1 text-[13px] font-extrabold">{t('socialDesign.yourCrew')}</span><StickerButton variant="ghost" className="size-11 p-0" onClick={()=>setMenu(true)} aria-label={t('socialDesign.menu')}><MoreHorizontal/></StickerButton></div>
 {!id&&!mine.isPending?<Link to="/crew"><StickerButton block>{t('crew.noneTitle')}</StickerButton></Link>:!data?<p className="py-10 text-center">{q.isError?t('common.error'):t('common.loading')}</p>:<>
 <h1 className="crew-name">{data.crew.name}</h1><div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue px-3 py-1.5 text-[13px] font-extrabold sticker-border">{t('socialDesign.countryRank',{rank:data.country_rank,country:countryName(data.country_code,i18n.language)})}</span><span className="rounded-full bg-card px-3 py-1.5 text-[13px] font-extrabold sticker-border">{t('socialDesign.seasonPoints',{n:data.season_points.toLocaleString('en-US')})}</span></div>
 <div className="crew-sync mt-1"><div className="flex items-center justify-between gap-3"><h2 className="text-[13px] font-extrabold text-lime">{t('socialDesign.sync')}</h2><Num className="text-[18px] font-bold">{done}/{data.members.length}</Num></div><div className="mt-3 flex gap-1.5">{data.members.map(m=><span key={m.user_id} className={cn('sync-segment',m.perfect||(m.total>0&&m.done>=m.total)?'bg-lime':'bg-ink')}/>)}</div><p className="mt-3 text-[14px] font-semibold">{allDone?t('socialDesign.syncDone'):data.members.length>1?t('socialDesign.syncMore',{n:data.members.length-done}):t('crew.shareBody')}</p></div>
 <div className="mt-2 space-y-3">{data.members.map(m=>{const checked=m.perfect||(m.total>0&&m.done>=m.total);const me=m.user_id===uid;return <div key={m.user_id} className={cn('detail-member',me?'bg-lime sticker-border shadow-hard':checked?'bg-card sticker-border':'dashed-ink bg-transparent')}><Avatar id={m.user_id} name={m.display_name} url={m.avatar_url} size={40}/><div className="min-w-0 flex-1"><p className="member-name truncate">{m.display_name}</p><p className="text-[14px] font-semibold">{checked?t('socialDesign.checked'):t('socialDesign.notChecked')}</p></div>{checked||me?<Num className="text-[18px] font-bold">{m.points}</Num>:<StickerButton variant="yellow" className="rounded-[12px] px-3" disabled={m.nudged||nudging===m.user_id} onClick={()=>void nudge(m.user_id)}>{t(m.nudged?'crew.nudged':'crew.nudge')}</StickerButton>}</div>;})}</div>
 <div className="mt-3 rounded-[20px] bg-card px-[18px] py-4 sticker-border shadow-hard-lg"><p className="text-[13px] font-extrabold">{t('socialDesign.inviteCode',{n:Math.max(0,data.crew.max_members-data.members.length)})}</p><div className="mt-3 flex items-center justify-between gap-2"><Num className="text-[30px] font-bold">{data.crew.code}</Num><StickerButton variant="yellow" className="min-h-[56px] rounded-[14px] px-3" onClick={()=>void copy(data.crew.code)}><Copy size={18}/>{t('socialDesign.copy')}</StickerButton></div><StickerButton variant="ghost" className="crew-share-link mt-3 w-full min-w-0 text-[14px]" onClick={async()=>{const url=`https://joinlezgo.com/c/${data.crew.code}`;try{if(navigator.share)await navigator.share({text:t('crew.inviteText',{code:data.crew.code}),url});else await copy(url);}catch{/* cancelled */}}}><Share2 size={18}/><bdi dir="ltr" className="truncate">https://joinlezgo.com/c/{data.crew.code}</bdi></StickerButton></div></>}
 <BottomSheet open={menu} onClose={()=>setMenu(false)} title={t('socialDesign.menu')}><StickerButton block variant="danger" disabled={!id} onClick={()=>{setMenu(false);setConfirm(true);}}>{t('socialDesign.leave')}</StickerButton></BottomSheet><BottomSheet open={confirm} onClose={()=>setConfirm(false)} title={t('socialDesign.leaveConfirm')}><StickerButton block variant="danger" disabled={busy} onClick={()=>void leave()}>{t('socialDesign.leave')}</StickerButton></BottomSheet>
 </AppShell>;
}
