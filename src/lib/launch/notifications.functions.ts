import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
import {validPushEndpoint} from './rules';
export const pushConfiguration=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async()=>({publicKey:process.env['VAPID_PUBLIC_KEY']??null}));
export const savePush=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({endpoint:z.string().max(2048).refine(validPushEndpoint),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{20,30}$/)})}).parse(v)).handler(async({data,context})=>{const {error}=await context.supabase.rpc('register_push',{_endpoint:data.endpoint,_p256dh:data.keys.p256dh,_auth:data.keys.auth});if(error)throw new Error('push_unavailable');return {ok:true};});
