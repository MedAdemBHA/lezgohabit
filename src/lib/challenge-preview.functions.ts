import {createServerFn} from '@tanstack/react-start';
import {createClient} from '@supabase/supabase-js';
import type {Database} from '@/integrations/supabase/types';
export const challengePreview=createServerFn({method:'GET'}).inputValidator((code:string)=>{if(!/^[a-zA-Z0-9]{6}$/.test(code))throw Error('invalid_code');return code.toUpperCase();}).handler(async({data:code})=>{
 const url=process.env['SUPABASE_URL'];const key=process.env['SUPABASE_PUBLISHABLE_KEY'];if(!url||!key)throw Error('unavailable');
 const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith('sb_'))headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers});}}});
 const {data,error}=await client.rpc('challenge_preview',{_code:code});if(error)throw Error('unavailable');return data;
});
