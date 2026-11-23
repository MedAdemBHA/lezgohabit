import {supabase} from '@/integrations/supabase/client';
import type {Json} from '@/integrations/supabase/types';
import {coalesce,offlineRefused} from './rules';
export type QueuedGo={uid:string;habit:string;day:string;value:number;detail:Json|null};
const KEY='lezgo_offline_goes';
export function readQueue():QueuedGo[]{try{return JSON.parse(localStorage.getItem(KEY)??'[]') as QueuedGo[];}catch{return [];}}
export function queueGo(row:QueuedGo){localStorage.setItem(KEY,JSON.stringify(coalesce(readQueue(),row)));window.dispatchEvent(new Event('lezgo-queue'));}
export async function syncGoes(uid:string){const {data}=await supabase.auth.getUser();if(data.user?.id!==uid)return {sent:0,expired:0};let sent=0,expired=0;for(const row of readQueue().filter(r=>r.uid===uid)){const {error}=await supabase.rpc('checkin_upsert',{_user_habit_id:row.habit,_day:row.day,_value:row.value,_detail:row.detail});if(error){if(error.message.includes('day_closed'))expired++;else break;}else sent++;const next=readQueue().filter(r=>!(r.uid===row.uid&&r.habit===row.habit&&r.day===row.day&&r.value===row.value&&JSON.stringify(r.detail)===JSON.stringify(row.detail)));localStorage.setItem(KEY,JSON.stringify(next));}window.dispatchEvent(new Event('lezgo-queue'));return {sent,expired};}
export async function registerOffline(){if(!('serviceWorker' in navigator))return;if(offlineRefused(location.hostname,import.meta.env.PROD,window.self!==window.top,new URLSearchParams(location.search).get('sw')==='off')){for(const r of await navigator.serviceWorker.getRegistrations()){if(r.active?.scriptURL===location.origin+'/sw.js'||r.waiting?.scriptURL===location.origin+'/sw.js')await r.unregister();}return;}const {registerSW}=await import('virtual:pwa-register');registerSW({immediate:true});}
