import { useEffect,useRef,useState } from 'react';
/** Keep the designed size unless a single word cannot fit its fixed-width parent. */
export function FittedLabel({text,className,size=14}:{text:string;className?:string;size?:number}){
 const ref=useRef<HTMLSpanElement>(null);const [fontSize,setFontSize]=useState(size);
 useEffect(()=>{const el=ref.current;if(!el)return;let disposed=false;const fit=()=>{if(disposed)return;const ctx=document.createElement('canvas').getContext('2d');if(!ctx)return;ctx.font=`700 ${size}px ${getComputedStyle(el).fontFamily}`;const width=Math.max(...text.split(/\s+/).map(word=>ctx.measureText(word).width));setFontSize(width>el.clientWidth?Math.max(12,Math.floor(size*el.clientWidth/width)):size);};const obs=new ResizeObserver(fit);obs.observe(el);void document.fonts.ready.then(fit);fit();return()=>{disposed=true;obs.disconnect();};},[text,size]);
 return <span ref={ref} className={className} style={{fontSize}}>{text}</span>;
}
