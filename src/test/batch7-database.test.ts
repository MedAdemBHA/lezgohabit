/** Live tests use scoped administrator/demo sessions and never log credentials. */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {loadEnv} from 'vite';
import {beforeAll,describe,it,expect} from 'vitest';
import type {Database} from '@/integrations/supabase/types';
import type {AdminDashboard} from '@/lib/admin-data';
const dir=process.env['LEZGO_BATCH7_SESSIONS'];let admin:SupabaseClient<Database>;let demo:SupabaseClient<Database>;let anon:SupabaseClient<Database>;let demoId='';let demoSid='';let adminId='';
function token(name:string){if(!dir)throw Error('missing fixture');const state=JSON.parse(readFileSync(join(dir,name),'utf8')) as {origins:{localStorage:{name:string;value:string}[]}[]};for(const origin of state.origins){for(const item of origin.localStorage){if(!item.name.includes('auth-token'))continue;const session=JSON.parse(item.value) as {access_token?:string;refresh_token?:string;user?:{id:string}};if(session.access_token&&session.refresh_token&&session.user)return {token:session.access_token,refresh:session.refresh_token,id:session.user.id};}}throw Error('missing fixture');}
describe.skipIf(!dir)('batch 7 live database protections',()=>{
 beforeAll(async()=>{const env=loadEnv('test',process.cwd(),'');const url=env['VITE_SUPABASE_URL'];const key=env['VITE_SUPABASE_PUBLISHABLE_KEY'];if(!url||!key)throw Error('missing settings');const a=token('admin-storage.json');const d=token('demo-storage.json');adminId=a.id;demoId=d.id;const options=(bearer:string)=>({auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${bearer}`}}});admin=createClient<Database>(url,key,options(a.token));demo=createClient<Database>(url,key,options(d.token));anon=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false}});expect((await demo.auth.setSession({access_token:d.token,refresh_token:d.refresh})).error).toBeNull();const s=await demo.rpc('active_season');expect(s.error).toBeNull();demoSid=(s.data as unknown as {id:string}).id;});
 it('only the requested administrator can open the dashboard',async()=>{expect((await admin.rpc('admin_authorized')).data).toBe(true);expect((await demo.rpc('admin_authorized')).error?.message).toContain('forbidden');});
 it('anonymous users cannot call admin writes',async()=>expect((await anon.rpc('admin_action',{_action:'flag',_payload:{key:'bosses',enabled:false}})).error).not.toBeNull());
 it('seed contains exactly 40 demo profiles',async()=>{const r=await admin.rpc('admin_dashboard',{_section:'demo'});expect((r.data as unknown as AdminDashboard).demo_counts.profiles).toBe(40);});
 it('seed contains 60 feed posts',async()=>{const r=await admin.rpc('admin_dashboard',{_section:'demo'});expect((r.data as unknown as AdminDashboard).demo_counts.posts).toBe(60);});
 it('seed contains exactly 6 crews',async()=>{const r=await admin.rpc('admin_dashboard',{_section:'demo'});expect((r.data as unknown as AdminDashboard).demo_counts.crews).toBe(6);});
 it('shared demo has all 5 requested habits',async()=>{const r=await demo.from('user_habits').select('template:habit_templates(key)').eq('season_id',demoSid).eq('active',true);expect(r.data?.map(h=>h.template?.key).sort()).toEqual(['learn','no_sugar','salat','sleep','train']);});
 it('demo history spans 14 days',async()=>{const r=await demo.from('daily_scores').select('day').eq('season_id',demoSid);expect(r.data?.length).toBe(14);});
 it('shared demo has a 9-day streak computed by the server',async()=>{const r=await demo.from('daily_scores').select('streak').eq('season_id',demoSid).order('day',{ascending:false}).limit(1);expect(r.data?.[0]?.streak).toBe(9);});
 it('demo cannot promote itself through editable profiles',async()=>expect((await demo.from('profiles').update({is_admin:true}).eq('id',demoId)).error).not.toBeNull());
 it('demo cannot promote itself through roles',async()=>expect((await demo.from('user_roles').insert({user_id:demoId,role:'admin'})).error).not.toBeNull());
 it('demo cannot delete its account',async()=>expect((await demo.rpc('delete_my_account')).error?.message).toContain('demo_protected'));
 it('demo cannot change its password without the hidden current password',async()=>{expect((await demo.auth.updateUser({password:'NotTheCurrentPassword#2026'})).error).not.toBeNull();});
 it('real administrator cannot be self-demoted',async()=>expect((await admin.rpc('admin_action',{_action:'role',_target:adminId,_payload:{role:'user'}})).error?.message).toContain('self_protected'));
 it('reset day requires a saved reason',async()=>expect((await admin.rpc('admin_action',{_action:'reset_day',_target:demoId,_payload:{day:'2026-12-05'}})).error?.message).toContain('reason_required'));
 it('all admin writes create audit entries',async()=>{const r=await admin.rpc('admin_action',{_action:'flag',_payload:{key:'bosses',enabled:true}});expect(r.error).toBeNull();const logs=await admin.from('admin_audit_log').select('action,payload').eq('admin_id',adminId).eq('action','flag').order('created_at',{ascending:false}).limit(1);expect(logs.data?.[0]).toMatchObject({action:'flag',payload:{key:'bosses',enabled:true}});});
 it('private faith wins remain excluded from public shares',async()=>expect((await demo.rpc('post_small_wins',{_season_id:demoSid,_wins:['fajr'],_language:'en',_caption:''})).error?.message).toContain('private_faith'));
});
