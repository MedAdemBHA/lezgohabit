import {exportSize} from '@/lib/batch6-rules';

/**
 * Renders a share card into an exact 1080×1920 (or 1080×1080) poster.
 * The card is cloned into an offscreen full-bleed frame so the PNG never has
 * transparent rounded corners, clipped shadows or cropped content: when the
 * card is taller than the frame it is scaled down to fit instead of cut off.
 */
export async function exportCard(node:HTMLElement,name:string,square:boolean){
 await document.fonts.ready;
 const {toBlob}=await import('html-to-image');
 const size=exportSize(square);
 const width=Math.round(node.getBoundingClientRect().width)||360;
 const height=Math.round(width*size.height/size.width);
 const host=document.createElement('div');
 host.className='share-export-host';
 host.setAttribute('aria-hidden','true');
 const frame=document.createElement('div');
 frame.className='share-frame';
 frame.dir=node.closest('[dir]')?.getAttribute('dir')??document.documentElement.dir??'ltr';
 Object.assign(frame.style,{width:`${width}px`,height:`${height}px`,backgroundColor:frameColor(node)});
 const clone=node.cloneNode(true) as HTMLElement;
 clone.classList.toggle('square',square);
 clone.classList.add('is-exporting');
 frame.append(clone);host.append(frame);document.body.append(host);
 try{
  fitInto(clone,width,height);
  const blob=await toBlob(frame,{width,height,canvasWidth:size.width,canvasHeight:size.height,pixelRatio:1,cacheBust:true,skipAutoScale:true});
  if(!blob)throw Error('export_failed');
  const file=new File([blob],`${name}.png`,{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'lezgo'});return;}catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;}}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }finally{host.remove();}
}

/** Scale the clone down (never up) when its content is taller than the poster. */
function fitInto(clone:HTMLElement,width:number,height:number){
 clone.style.height='auto';
 const natural=clone.scrollHeight;
 if(natural<=height){clone.style.height='100%';return;}
 const scale=height/natural;
 Object.assign(clone.style,{width:`${width/scale}px`,height:`${natural}px`,transform:`scale(${scale})`,transformOrigin:'top left'});
}

function frameColor(node:HTMLElement){
 const bg=getComputedStyle(node).backgroundColor;
 return !bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)'?'#FFF6E5':bg;
}
