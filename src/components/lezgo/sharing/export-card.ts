import {exportSize} from '@/lib/batch6-rules';
export async function exportCard(node:HTMLElement,name:string,square:boolean){
 await document.fonts.ready;
 const {toBlob}=await import('html-to-image');const size=exportSize(square);const rect=node.getBoundingClientRect();
 const blob=await toBlob(node,{width:rect.width,height:square?rect.width:rect.width*16/9,canvasWidth:size.width,canvasHeight:size.height,pixelRatio:1,cacheBust:true,skipAutoScale:true});
 if(!blob)throw Error('export_failed');
 const file=new File([blob],`${name}.png`,{type:'image/png'});
 if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'lezgo'});return;}catch(e){if(e instanceof DOMException&&e.name==='AbortError')return;}}
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
