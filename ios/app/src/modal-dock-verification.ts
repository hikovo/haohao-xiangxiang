// Explicit local verification only; no record writes or notification scheduling.
import {confirmAction} from './confirm-action';
import {cropImage} from './image-cropper';

export async function runModalDockVerification() {
 const rows: {name:string;passed:boolean;detail?:string}[]=[];
 const metrics: unknown[]=[];
 const wait=()=>new Promise(resolve=>setTimeout(resolve,250));
 const q=(s:string)=>{const e=document.querySelector<HTMLElement>(s);if(!e)throw Error('Missing '+s);return e};
 const tap=(s:string)=>q(s).click();
 const check=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
 const dock=()=>q('.mobile-dock').getBoundingClientRect();
 const stable=(before:DOMRect,label:string,visible=true)=>{
  const after=dock(),style=getComputedStyle(q('.mobile-dock'));
  check(['x','y','width','height'].every(k=>Math.abs(before[k as keyof DOMRect] as number-(after[k as keyof DOMRect] as number))<1),label+' dock moved');
  if(visible)check(style.visibility==='visible'&&style.display!=='none',label+' dock disappeared');
  check(q('#mobile-app').scrollTop===0&&q('#mobile-app').scrollLeft===0,label+' root scrolled');
  if(visible&&document.documentElement.classList.contains('native-glass-ready')){
   const button=q('.mobile-dock [data-nav=home]').getBoundingClientRect();
   check(Math.abs(button.x-after.x-24)<1&&Math.abs(button.y-after.y-9)<1,label+' native/web inset mismatch');
  }
  metrics.push({label,before:before.toJSON(),after:after.toJSON(),visibility:style.visibility});
 };
 const test=async(name:string,fn:()=>Promise<void>)=>{try{await fn();rows.push({name,passed:true})}catch(e){rows.push({name,passed:false,detail:String(e)})}};
 for(const page of ['home','chat','memo','profile'])await test(page+' centered confirmation keeps dock',async()=>{
  tap(`[data-nav=${page}]`);await wait();const before=dock();
  const result=confirmAction('保留这段记录，检查中部弹窗');await wait();
  try{stable(before,page+' confirmation')}finally{tap('dialog.app-confirm button');await result;await wait()}
  stable(before,page+' closed',!document.documentElement.classList.contains('native-glass-ready'));
 });
 await test('version info keeps dock and returns without movement',async()=>{
  tap('[data-nav=profile]');await wait();const before=dock();tap('#open-version-info');await wait();
  try{stable(before,'version info')}finally{tap('#version-info-panel .sheet-heading button');await wait()}
  stable(before,'version closed',!document.documentElement.classList.contains('native-glass-ready'));
 });
 await test('image selection and crop keep dock',async()=>{
  tap('[data-nav=chat]');await wait();const before=dock();tap('#open-chat-appearance');await wait();
  const choice=q('[data-chat-appearance=petAvatar]');choice.click();await wait();
  try{stable(before,'image selection')}finally{tap('[data-custom=close]');await wait()}
  const response=await fetch('/rabbit-head.png');const blob=await response.blob();
  const result=cropImage(new File([blob],'rabbit.png',{type:blob.type}),'avatar');await wait();
  try{stable(before,'image crop')}finally{tap('[data-crop=cancel]');await result;await wait()}
  // The appearance sheet remains underneath the crop dialog.
  tap('#chat-appearance-panel .sheet-heading button');await wait();
 });
 tap('[data-nav=profile]');
 return {phase:'modal-dock',createdAt:new Date().toISOString(),passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,rows,metrics};
}
