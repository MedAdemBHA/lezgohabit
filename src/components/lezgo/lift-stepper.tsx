import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Num, StickerButton } from './ui';
export function LiftStepper({value,label,suffix='',min=1,max=1000,step=1,disabled,onChange}:{value:number;label:string;suffix?:string;min?:number;max?:number;step?:number;disabled:boolean;onChange:(v:number)=>void}) {
  const {t}=useTranslation();
  return <div className="lift-stepper" dir="ltr">
    <StickerButton variant="ghost" aria-label={t('batch4.decrease',{name:label})} disabled={disabled||value<=min} onClick={()=>onChange(Math.max(min,Math.round((value-step)*100)/100))}><Minus size={18}/></StickerButton>
    <Num className="lift-step-value">{value}{suffix&&` ${suffix}`}</Num>
    <StickerButton variant="ghost" aria-label={t('batch4.increase',{name:label})} disabled={disabled||value>=max} onClick={()=>onChange(Math.min(max,Math.round((value+step)*100)/100))}><Plus size={18}/></StickerButton>
  </div>;
}