import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {Ghost,ArrowUp,ArrowDown} from 'lucide-react';
import {ghostQuery} from '@/lib/batch6-data';
import {Num} from '@/components/lezgo/ui';
export function GhostBar({uid,sid}:{uid:string;sid:string}){const {t}=useTranslation();const q=useQuery({...ghostQuery(uid,sid),enabled:!!uid&&!!sid});if(!q.data)return null;const up=q.data.current>=(q.data.points??0);return <div className="ghost-inline"><Ghost size={22}/><span>{t('batch6.ghost')}: <Num>{q.data.points??0}</Num> · {t('batch6.you')}: <Num>{q.data.current}</Num></span>{up?<ArrowUp size={18}/>:<ArrowDown size={18}/>}</div>;}
