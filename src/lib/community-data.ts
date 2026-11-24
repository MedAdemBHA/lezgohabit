import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
export type HabitStat = { value:number; name:Record<string,string>; kind:string; key:string|null; faith:boolean };
export type RankRowData = { rank:number; user_id:string|null; crew_id:string|null; display_name:string; handle:string|null; avatar_url:string|null; country_code:string|null; streak:number; points:number; previous_rank:number|null; is_me:boolean; members:number|null; stat:HabitStat|null; completed_days?:number; perfect_days?:number; elapsed_days?:number; consistency?:number };
export type Member = { user_id:string; display_name:string; handle:string; avatar_url:string|null; total:number; done:number; points:number; perfect:boolean; nudged:boolean };
export type CrewDetails = { crew:{id:string;name:string;code:string;max_members:number}; members:Member[]; country_code:string; country_rank:number; season_points:number };
export type Summary = { points:number; streak:number; rank:number|null; stat:HabitStat|null; badges:string[]; crew:{id:string;name:string}|null; mode:string };
export type Buddy = { user_id:string;display_name:string;handle:string;avatar_url:string|null;streak:number;status:string|null };
export const summaryQuery = (uid:string,sid:string,share=false)=>queryOptions({queryKey:['profileSummary',uid,sid,share],queryFn:async()=>{const {data,error}=await supabase.rpc('profile_summary',{_season_id:sid,_share:share});if(error)throw error;return data as unknown as Summary;}});
export const crewDetailsQuery = (id:string)=>queryOptions({queryKey:['crewDetails',id],queryFn:async()=>{const {data,error}=await supabase.rpc('crew_details',{_crew_id:id});if(error)throw error;return data as unknown as CrewDetails;},refetchInterval:30_000});
export const buddyQuery = (uid:string,sid:string,search='')=>queryOptions({queryKey:['buddies',uid,sid,search],queryFn:async()=>{const {data,error}=await supabase.rpc('buddy_directory',{_season_id:sid,_search:search});if(error)throw error;return data as unknown as {buddy:Buddy|null;incoming:Buddy[];results:Buddy[]};}});
export function countryName(code:string,lang:string) { try{return new Intl.DisplayNames([lang==='aeb'?'ar-TN':lang],{type:'region'}).of(code)??code;}catch{return code;} }
