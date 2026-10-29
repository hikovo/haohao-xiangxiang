// Explicit verification build; run only on the disposable QA simulator.
import {invoke} from '@tauri-apps/api/core';
import {normalizeRoutineSettings} from './routine-reminder-model';
export async function runMealVerification(delivery=false){
 const bridge=(name:string,payload:unknown)=>invoke<any>('plugin:mobile-pet|'+name,{payload:JSON.stringify(payload)});
 const diagnostics=async()=>JSON.parse((await bridge('reminder_style',{action:'diagnostics'})).snapshot);
 const assert=(condition:unknown,message:string)=>{if(!condition)throw Error(message)};
 const settled=async(check:(data:any)=>boolean)=>{let data;for(let n=0;n<30;n++){data=await diagnostics();if(check(data))return data;await new Promise(r=>setTimeout(r,250))}return data};
 const key='sanhao-tu.routine-reminders.v1';
 if(delivery){
  const data=await diagnostics(),start=Number(localStorage.getItem('qa.meal.delivery-start'));
  const received=(data.delivered||[]).filter((x:any)=>x.id.startsWith('hhxx.meal.')&&x.at>=start);
  for(const [id,name] of [['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐']])assert(received.some((x:any)=>x.id.startsWith('hhxx.meal.'+id+'.')&&x.body.includes(name)),'No actual delivered notification for '+id);
  await bridge('sync_memo_reminders',[]);
  const cleared=await diagnostics();assert(!cleared.requests.some((x:any)=>x.id.startsWith('hhxx.meal.')),'Meal requests not cancelled');
  return {phase:'meals-delivery',passed:4,failed:0,delivered:received,cancelled:true};
 }
 const q=(s:string)=>document.querySelector<HTMLElement>(s)!;
 document.querySelectorAll<HTMLElement>('.mobile-sheet:not([hidden]) [data-close-sheet]').forEach(x=>x.click());
 localStorage.setItem(key,JSON.stringify(normalizeRoutineSettings()));q('[data-nav=profile]').click();q('#open-meal-reminders').click();
 await new Promise(r=>setTimeout(r,500));
 const groups=[...document.querySelectorAll<HTMLElement>('.meal-reminder-group')];assert(groups.length===3,'Three meal controls missing');
 assert(q('#routine-reminder-panel').querySelectorAll('input[type=checkbox]').length===3,'Extra master toggle');
 for(const group of groups){assert(group.lastElementChild?.matches('.switch-row'),'Checkbox must be after time');const label=group.querySelector('.switch-row')!;assert(getComputedStyle(label).backgroundImage==='none'&&getComputedStyle(label).boxShadow==='none','Label glass remains')}
 const save=async()=>{q('#routine-reminder-panel .wide-primary').click();for(let n=0;n<60&&!q('#routine-reminder-panel').hidden;n++)await new Promise(r=>setTimeout(r,200));assert(q('#routine-reminder-panel').hidden,'Save did not complete')};
 const morning=q('[aria-label="开启早餐提醒"]') as HTMLInputElement;morning.click();await save();
 let data=await settled(d=>d.requests.filter((x:any)=>x.id.startsWith('hhxx.meal.breakfast.')).length===7);assert(data.requests.filter((x:any)=>x.id.startsWith('hhxx.meal.breakfast.')).length===7,'Breakfast weekly slots missing');assert(!data.requests.some((x:any)=>/^hhxx.meal.(lunch|dinner)./.test(x.id)),'Disabled lunch/dinner scheduled');
 q('#open-meal-reminders').click();await new Promise(r=>setTimeout(r,300));(q('[aria-label="开启早餐提醒"]') as HTMLInputElement).click();await save();data=await settled(d=>!d.requests.some((x:any)=>x.id.startsWith('hhxx.meal.')));assert(!data.requests.some((x:any)=>x.id.startsWith('hhxx.meal.')),'Single meal off did not cancel');
 const when=new Date(Date.now()+90_000);when.setSeconds(0,0);const time=String(when.getHours()).padStart(2,'0')+':'+String(when.getMinutes()).padStart(2,'0');
 q('#open-meal-reminders').click();await new Promise(r=>setTimeout(r,300));
 for(const id of ['breakfast','lunch','dinner']){(q(`[aria-label="开启${id==='breakfast'?'早餐':id==='lunch'?'午餐':'晚餐'}提醒"]`) as HTMLInputElement).click();const input=q('#meal-time-'+id) as HTMLInputElement;input.value=time;input.dispatchEvent(new Event('change',{bubbles:true}))}
 localStorage.setItem('qa.meal.delivery-start',String(Date.now()/1000));await save();data=await settled(d=>d.requests.filter((x:any)=>x.id.startsWith('hhxx.meal.')).length===21);
 const requests=data.requests.filter((x:any)=>x.id.startsWith('hhxx.meal.'));assert(requests.length===21&&requests.every((x:any)=>x.repeats&&!x.sound),'Three meals must reserve 21 silent weekly slots');
 return {phase:'meals-schedule',passed:6,failed:0,deliveryAt:when.toISOString(),permission:data.permission,requests};
}
