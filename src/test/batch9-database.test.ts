import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {loadEnv} from 'vite';
import {describe,it,expect} from 'vitest';
import type {Database} from '@/integrations/supabase/types';
const path=process.env['LEZGO_BATCH9_SESSION'];
describe.skipIf(!path)('launch saved-data safeguards',()=>{
const env=loadEnv('test',process.cwd(),'');
function client(){const state=JSON.parse(readFileSync(path??'','utf8')) as {origins:{localStorage:{name:string;value:string}[]}[]};for(const origin of state.origins)for(const entry of origin.localStorage){if(!entry.name.includes('auth-token'))continue;const session=JSON.parse(entry.value) as {access_token:string;user:{id:string}};const url=env['VITE_SUPABASE_URL'];const key=env['VITE_SUPABASE_PUBLISHABLE_KEY'];if(!url||!key)throw Error('config');return {uid:session.user.id,db:createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${session.access_token}`}}})};}throw Error('session');}
it('crew sync is unavailable on participation day one',async()=>{const {db,uid}=client();const s=await db.rpc('active_season');const sid=(s.data as unknown as {id:string}).id;const r=await db.from('daily_scores').select('crew_sync').eq('user_id',uid).eq('season_id',sid).order('day').limit(1);expect(r.error).toBeNull();expect(r.data?.[0]?.crew_sync).toBe(false);});
it('inbox messages are owner-only',async()=>{const {db,uid}=client();const r=await db.from('notifications').select('user_id');expect(r.error).toBeNull();expect(r.data?.length).toBeGreaterThan(0);expect(r.data?.every(row=>row.user_id===uid)).toBe(true);});
it('players cannot forge inbox rewards or alerts',async()=>{const {db,uid}=client();expect((await db.from('notifications').insert({user_id:uid,type:'crew',event_key:'forged-test'})).error).not.toBeNull();});
it('demo cannot register public push delivery',async()=>{const {db}=client();expect((await db.rpc('register_push',{_endpoint:'https://fcm.googleapis.com/send/test',_p256dh:'a'.repeat(87),_auth:'a'.repeat(22)})).error).not.toBeNull();});
it('private network push endpoints are rejected',async()=>{const {db}=client();expect((await db.rpc('register_push',{_endpoint:'https://127.0.0.1/secret',_p256dh:'a'.repeat(87),_auth:'a'.repeat(22)})).error).not.toBeNull();});
});
