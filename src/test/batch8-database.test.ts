import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadEnv} from 'vite';
import {beforeAll,describe,it,expect} from 'vitest';
import type {Database} from '@/integrations/supabase/types';
import type {Signature,Capsule} from '@/lib/signature-data';
const dir=process.env['LEZGO_BATCH8_SESSIONS'];
let player:SupabaseClient<Database>;let other:SupabaseClient<Database>;let anon:SupabaseClient<Database>;let sid='';let uid='';let audioPath='';
function bearer(path:string){const state=JSON.parse(readFileSync(path,'utf8')) as {origins:{localStorage:{name:string;value:string}[]}[]};for(const o of state.origins)for(const v of o.localStorage)if(v.name.includes('auth-token')){const s=JSON.parse(v.value) as {access_token?:string;user?:{id:string}};if(s.access_token&&s.user)return {token:s.access_token,id:s.user.id};}throw Error('fixture absent');}
describe.skipIf(!dir)('signature live privacy',()=>{
 beforeAll(async()=>{if(!dir)return;const env=loadEnv('test',process.cwd(),'');const url=env['VITE_SUPABASE_URL'];const key=env['VITE_SUPABASE_PUBLISHABLE_KEY'];if(!url||!key)throw Error('settings absent');const p=bearer(join(dir,'player-storage.json'));const d=bearer('/tmp/browser/batch7/demo-storage.json');uid=p.id;const options=(token:string)=>({auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}});player=createClient<Database>(url,key,options(p.token));other=createClient<Database>(url,key,options(d.token));anon=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const s=await player.rpc('active_season');expect(s.error).toBeNull();sid=(s.data as unknown as {id:string}).id;const sig=await player.rpc('signature_overview',{_season_id:sid});expect(sig.error).toBeNull();expect((sig.data as unknown as Signature).closed).toBe(true);});
 it('saved private mood reads back as proud with tomorrow intention',async()=>{const r=await player.from('day_closes').select('mood,tomorrow').eq('user_id',uid);expect(r.data?.[0]).toMatchObject({mood:'proud',tomorrow:'run before work'});});
 it('another player cannot read private moods',async()=>expect((await other.from('day_closes').select('*').eq('user_id',uid)).data).toEqual([]));
 it('day closing adds no score points',async()=>{const before=await player.from('daily_scores').select('total').eq('user_id',uid).eq('season_id',sid);expect((await player.rpc('close_my_day',{_mood:'proud',_tomorrow:'run before work'})).error).toBeNull();expect((await player.from('daily_scores').select('total').eq('user_id',uid).eq('season_id',sid)).data).toEqual(before.data);});
 it('tomorrow rejects more than 120 characters',async()=>expect((await player.rpc('close_my_day',{_mood:'proud',_tomorrow:'a'.repeat(121)})).error).not.toBeNull());
 it('invalid mood is rejected',async()=>expect((await player.rpc('close_my_day',{_mood:'happy'})).error).not.toBeNull());
 it('sealed note hides body and audio path before Dec 31',async()=>{const r=await player.rpc('capsule_read',{_season_id:sid});expect(r.error).toBeNull();expect(r.data).toEqual({sealed:true,locked:true,opens_on:'2026-12-31'});});
 it('capsule rows cannot be fetched directly even by the owner',async()=>expect((await player.from('capsules').select('*')).data).toEqual([]));
 it('sealed capsules cannot be edited or resealed',async()=>expect((await player.rpc('seal_capsule',{_season_id:sid,_body:'replace'})).error).not.toBeNull());
 it('capsule body rejects more than 1000 characters',async()=>expect((await player.rpc('seal_capsule',{_season_id:sid,_body:'a'.repeat(1001)})).error?.message).toContain('invalid_note'));
 it('anonymous readers cannot call capsule RPC',async()=>expect((await anon.rpc('capsule_read',{_season_id:sid})).error).not.toBeNull());
 it('other owners never receive the first player body',async()=>{const r=await other.rpc('capsule_read',{_season_id:sid});expect((r.data as unknown as Capsule|null)?.body).toBeUndefined();});
 it('Wrapped cannot bypass the capsule lock',async()=>{const r=await player.rpc('wrapped_summary',{_season_id:sid});expect(r.error).toBeNull();expect((r.data as unknown as {capsule?:string}).capsule).toBeUndefined();});
 it('completed first check-in moment cannot be claimed twice',async()=>expect((await player.rpc('claim_moment',{_season_id:sid,_key:'first'})).data).toBe(false));
 it('unearned trophy moment is refused',async()=>expect((await player.rpc('claim_moment',{_season_id:sid,_key:'trophy'})).data).toBe(false));
 it('Lights out prompt is refused before 21:00',async()=>{const r=await player.rpc('signature_overview',{_season_id:sid});const d=r.data as unknown as Signature;expect(d.hour).toBeLessThan(21);expect((await player.rpc('claim_moment',{_season_id:sid,_key:`lights:${d.today}`})).data).toBe(false);});
 it('private audio cannot be signed before the opening date',async()=>{const state=JSON.parse(readFileSync(join(dir??'','audio-path.json'),'utf8')) as {path:string};audioPath=state.path;expect((await player.storage.from('capsule-audio').createSignedUrl(audioPath,60)).error).not.toBeNull();expect((await other.storage.from('capsule-audio').createSignedUrl(audioPath,60)).error).not.toBeNull();});
});
