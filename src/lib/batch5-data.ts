import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
export type Exercise = Database['public']['Tables']['lift_exercises']['Row'];
export type LiftSet = Database['public']['Tables']['lift_sets']['Row'];
export type DetoxSession = { id: string; started_at: string; minutes: number; completed: boolean; ended_at: string | null };
export type Match = { user_id: string; display_name: string; handle: string; avatar_url: string | null; country_code: string; city: string | null; utc_offset: number; streak: number; active_days: number; match: number; crew_id: string | null; shared: {key:string; name:Record<string,string>; color:string; icon:string}[] };
export type Matches = {eligible:boolean; buddy:Match|null; incoming:Match[]; results:Match[]};
export type DetoxOverview = {today_minutes:number|null; baseline:number|null; saved_minutes:number; logged_days:number; days_left:number; targets:{id:string;name:string}[]; duel:{id:string;a:string;b:string;week_start:string;status:string;opponent_name:string;mine:number|null;theirs:number|null;mine_days:number;their_days:number}|null};
export const liftQuery = (uid:string) => queryOptions({queryKey:['lift',uid],queryFn:async()=>{
  const [exercises,sets]=await Promise.all([supabase.from('lift_exercises').select('*').order('sort'),supabase.from('lift_sets').select('*').eq('user_id',uid).order('day',{ascending:false})]);
  if(exercises.error)throw exercises.error;if(sets.error)throw sets.error;
  return {exercises:exercises.data,sets:sets.data};
}});
export const matchesQuery=(uid:string,sid:string,filters:boolean[]=[false,false,false,false])=>queryOptions({queryKey:['buddies',uid,sid,...filters],queryFn:async()=>{
  const {data,error}=await supabase.rpc('buddy_matches',{_season_id:sid,_language:filters[0]??false,_timezone:filters[1]??false,_goals:filters[2]??false,_gender:filters[3]??false});
  if(error)throw error;
  const matches = data as unknown as Matches | null;
  if (typeof matches?.eligible !== 'boolean' || !Array.isArray(matches.results) || !Array.isArray(matches.incoming)) throw Error('invalid_buddy_matches');
  return matches;
}});
export const outgoingBuddyCountQuery = (uid: string) => queryOptions({
  queryKey: ['buddies', uid, 'outgoing'],
  queryFn: async () => {
    const { count, error } = await supabase.from('buddy_requests')
      .select('id', { count: 'exact', head: true })
      .eq('from_user', uid)
      .eq('status', 'pending');
    if (error || count === null) throw error ?? Error('missing_buddy_request_count');
    return count;
  },
});
export const detoxQuery=(uid:string)=>queryOptions({queryKey:['detox',uid],queryFn:async()=>{
  const {data,error}=await supabase.rpc('detox_overview');if(error)throw error;
  return data as unknown as DetoxOverview;
}});
export const seasonsHubQuery=(uid:string)=>queryOptions({queryKey:['seasonsHub',uid],queryFn:async()=>{
  const [seasons,reminders,trophies]=await Promise.all([supabase.from('seasons').select('*').order('starts_on'),supabase.from('season_reminders').select('*').eq('user_id',uid),supabase.from('season_trophies').select('*').eq('user_id',uid)]);
  if(seasons.error)throw seasons.error;if(reminders.error)throw reminders.error;if(trophies.error)throw trophies.error;
  return {seasons:seasons.data,reminders:reminders.data,trophies:trophies.data};
}});
