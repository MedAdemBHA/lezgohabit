import { createFileRoute,Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft,ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/lezgo/app-shell';
import { StickerButton } from '@/components/lezgo/ui';
import { pageHead } from '@/lib/page-head';
import { loc,formatDayMonth } from '@/lib/i18n';
export const Route=createFileRoute('/_authenticated/seasons')({head:()=>pageHead('Seasons — lezgo','Explore lezgo seasons and return to your daily challenge.'),component:Seasons});
function Seasons(){const {t,i18n}=useTranslation();const q=useQuery({queryKey:['seasons'],queryFn:async()=>{const {data,error}=await supabase.from('seasons').select('*').order('starts_on');if(error)throw error;return data;}});return <AppShell todayLayout><Link to="/profile" className="self-start"><StickerButton variant="secondary" className="habit-back" aria-label={t('common.back')}><ArrowLeft className="rtl:-scale-x-100"/></StickerButton></Link><h1 className="text-[40px] font-extrabold">{t('socialDesign.seasons')}</h1>{q.isPending?<p>{t('common.loading')}</p>:q.isError?<StickerButton variant="secondary" onClick={()=>void q.refetch()}>{t('common.error')}</StickerButton>:q.data?.map(s=><Link key={s.id} to="/today" className="flex items-center gap-3 rounded-[20px] bg-blue p-4 sticker-border shadow-hard-lg"><div className="min-w-0 flex-1"><h2 className="text-[22px] font-extrabold">{loc(s.name,i18n.language)}</h2><p className="font-bold">{t(s.status==='live'?'common.live':s.status==='upcoming'?'socialDesign.upcoming':'socialDesign.finished')}</p><p className="mt-2 text-[14px] font-semibold"><bdi dir="ltr">{formatDayMonth(s.starts_on,i18n.language)} {s.starts_on.slice(0,4)} — {formatDayMonth(s.ends_on,i18n.language)} {s.ends_on.slice(0,4)}</bdi></p></div><ChevronRight className="rtl:-scale-x-100"/></Link>)}</AppShell>}
