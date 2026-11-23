import {createFileRoute,Link,useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {queryOptions,useSuspenseQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {LezgoMark} from '@/components/lezgo/brand';
import {StickerButton,Num} from '@/components/lezgo/ui';
import {useUser} from '@/lib/data';
import {pageHead} from '@/lib/page-head';
import {challengePreview} from '@/lib/challenge-preview.functions';
import {supabase} from '@/integrations/supabase/client';
const preview=(code:string)=>queryOptions({queryKey:['challengeInvite',code],queryFn:async()=>{const data=await challengePreview({data:code});return data as unknown as {name:string;days:number;audience:string;starts_on:string;members:number;full:boolean;ended:boolean}|null;}});
export const Route=createFileRoute('/c/$code')({loader:({context,params})=>context.queryClient.ensureQueryData(preview(params.code)),head:()=>pageHead('Join a challenge — lezgo','Join your people’s lezgo challenge with your invitation.'),component:Invite});
function Invite(){const {code}=Route.useParams();const q=useSuspenseQuery(preview(code));const user=useUser();const {t}=useTranslation();const qc=useQueryClient();const nav=useNavigate();const [busy,setBusy]=useState(false);async function join(){setBusy(true);const r=q.data?await supabase.rpc('join_challenge',{_code:code}):await supabase.rpc('join_crew',{_code:code});setBusy(false);if(r.error)toast(t('batch6.full'));else{await qc.invalidateQueries();void nav({to:'/today'});}}
return <main className="challenge-public"><LezgoMark size={64}/>{q.data?<><h1>{q.data.name}</h1><p>{t('batch6.days',{n:q.data.days})} · {t(`batch6.${q.data.audience}`)}</p><Num>{code}</Num><p>{t('batch6.members',{n:q.data.members})}</p>{q.data.full||q.data.ended?<p>{t('batch6.full')}</p>:user?<StickerButton block disabled={busy} onClick={()=>void join()}>{t('batch6.join')}</StickerButton>:<Link to="/auth"><StickerButton block onClick={()=>sessionStorage.setItem('lezgo_challenge_invite',code)}>{t('batch6.signIn')}</StickerButton></Link>}</>:<><h1>{t('crew.shareTitle')}</h1><Num>{code}</Num>{user?<StickerButton block disabled={busy} onClick={()=>void join()}>{t('crew.joinBtn')}</StickerButton>:<Link to="/auth"><StickerButton block onClick={()=>{sessionStorage.setItem('lezgo_pending_code',code);sessionStorage.setItem('lezgo_challenge_invite',code);}}>{t('batch6.signIn')}</StickerButton></Link>}</>}</main>;
}
