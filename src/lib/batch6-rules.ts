import type {UserHabit,Checkin} from './data';
export const WIN_KEYS=['water','stairs','coffee','fajr','read','dinner','steps','sleep','dessert'] as const;
export type WinKey=typeof WIN_KEYS[number];
export function prefilledWins(habits:UserHabit[],checkins:Checkin[]):WinKey[]{const wins=new Set<WinKey>();for(const h of habits){const c=checkins.find(x=>x.user_habit_id===h.id);if(!c||c.value<=0)continue;const key=h.template?.key;const prayers=(c.detail as {prayers?:Record<string,string>}|null)?.prayers;if(key==='water'&&c.value>=2)wins.add('water');if(key==='coffee')wins.add('coffee');if(key==='salat'&&prayers?.['fajr']==='on_time')wins.add('fajr');if(key==='read'&&c.value>=10)wins.add('read');if(key==='steps'&&c.value>=8000)wins.add('steps');}return [...wins];}
export function shareableWins(wins:WinKey[],faithPublic:boolean){return wins.filter(w=>w!=='fajr'||faithPublic);}
export function exportSize(square:boolean){return {width:1080,height:square?1080:1920};}
