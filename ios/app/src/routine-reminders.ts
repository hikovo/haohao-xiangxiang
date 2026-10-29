import {invoke} from '@tauri-apps/api/core';
import {normalizeRoutineSettings,routineRequests,mealDefinitions,type RoutineKind,type RoutineSettings,type RoutineCourse,type RoutineHealth} from './routine-reminder-model';
import {reminderOptions} from './reminder-styles';
const storageKey='sanhao-tu.routine-reminders.v1';
export function readRoutineSettings():RoutineSettings{try{return normalizeRoutineSettings(JSON.parse(localStorage.getItem(storageKey)||'{}'))}catch{return normalizeRoutineSettings()}}
export async function getRoutineReminderRequests(){
 const prefs=readRoutineSettings();if(!prefs.course.enabled&&!prefs.course.agendaEnabled&&!prefs.habit.enabled&&!prefs.meal.enabled)return [];
 const read=async(command:string,key:string,fallback:unknown)=>{
  if('__TAURI_INTERNALS__' in window){const r=await invoke<{snapshot?:string}>(`plugin:mobile-pet|${command}`,{payload:JSON.stringify({operation:'read'})});if(!r.snapshot)throw Error('记录暂时无法读取');return JSON.parse(r.snapshot)}
  return JSON.parse(localStorage.getItem(key)||'null')||fallback;
 };
 const [table,health]=await Promise.all([prefs.course.enabled||prefs.course.agendaEnabled?read('timetable_store','sanhao-tu.timetable.v1',{courses:[]}):{courses:[]},prefs.habit.enabled?read('health_store','sanhao-tu.health.v1',{habits:[],checkins:[]}):{habits:[],checkins:[]}]);
 return routineRequests(prefs,table.courses as RoutineCourse[],health as RoutineHealth).slice(0,120);
}
export function setupRoutineReminders(options:{open:(panel:HTMLElement)=>void;close:()=>void;toast:(message:string)=>void;sync:()=>Promise<boolean>}){
 const panel=document.createElement('section');panel.id='routine-reminder-panel';panel.className='mobile-sheet';panel.hidden=true;
 panel.innerHTML='<div class="sheet-handle"></div><header class="sheet-heading"><h2></h2><button type="button" data-close-sheet aria-label="关闭"><svg viewBox="0 0 24 24"><path d="M6 6L18 18M18 6L6 18"/></svg></button></header><div class="sheet-body"></div><p class="sheet-ending">小小的提醒，陪你过好今天 (｡•ᴗ•｡)</p>';
 document.querySelector('#mobile-app')!.append(panel);panel.querySelector('[data-close-sheet]')!.addEventListener('click',options.close);
 const body=panel.querySelector<HTMLElement>('.sheet-body')!;
 let kind:RoutineKind='course',draft=readRoutineSettings();
 const element=(tag:string,text?:string,cls?:string)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
 const button=(text:string,cls:string,click:()=>void)=>{const b=element('button',text,cls) as HTMLButtonElement;b.type='button';b.addEventListener('click',click);return b};
 function toggle(text:string,value:boolean,change:(v:boolean)=>void){const label=element('label',undefined,'switch-row'),input=document.createElement('input');input.type='checkbox';input.checked=value;input.addEventListener('change',()=>change(input.checked));label.append(element('span',text),input);return label}
 function timeList(title:string,values:string[],change:(v:string[])=>void){
  const group=element('section',undefined,'routine-time-group'),head=element('div',undefined,'weather-time-heading');head.append(element('h3',title),button('＋ 添加','reminder-add-button plain-add-action',()=>{if(values.length>=6){options.toast('最多设置六个时间');return}const next=['07:30','09:00','12:00','18:00','20:00','21:00','08:00'].find(t=>!values.includes(t))!;change([...values,next]);paint()}));group.append(head);
  values.forEach((value,i)=>{const row=element('div',undefined,'weather-time-row'),input=document.createElement('input');input.type='time';input.value=value;input.setAttribute('aria-label',`${title} ${i+1}`);input.addEventListener('change',()=>{const next=[...values];next[i]=input.value;change(next)});row.append(input,button('移除','weather-time-remove',()=>{change(values.filter((_,j)=>j!==i));paint()}));group.append(row)});return group;
 }
 function paint(){
  body.replaceChildren();panel.dataset.routineKind=kind;panel.querySelector('h2')!.textContent=kind==='course'?'课程提醒':kind==='habit'?'打卡提醒':'好好吃饭';
  if(kind==='course'){
   body.append(toggle('上课前提醒',draft.course.enabled,v=>draft.course.enabled=v));
   const group=element('section',undefined,'routine-time-group'),head=element('div',undefined,'weather-time-heading');head.append(element('h3','提前多久'),button('＋ 添加','reminder-add-button plain-add-action',()=>{if(draft.course.leads.length>=6){options.toast('最多设置六个提前量');return}draft.course.leads.push([10,30,5,15,60,0].find(n=>!draft.course.leads.includes(n))!);paint()}));group.append(head);
   draft.course.leads.forEach((n,i)=>{const row=element('div',undefined,'weather-time-row routine-lead-row'),input=document.createElement('input');input.type='number';input.min='0';input.max='180';input.step='1';input.value=String(n);input.setAttribute('aria-label',`第${i+1}个提前分钟数`);input.addEventListener('input',()=>draft.course.leads[i]=Number(input.value));row.append(input,element('span','分钟'),button('移除','weather-time-remove',()=>{draft.course.leads.splice(i,1);paint()}));group.append(row)});body.append(group,element('p','所有课程共用这些提前量，提醒里会带上课程名称、时间和地点。','routine-copy'));
   body.append(toggle('每天汇总当天课程',draft.course.agendaEnabled,v=>draft.course.agendaEnabled=v),timeList('汇总提醒时间',draft.course.agendaTimes,v=>draft.course.agendaTimes=v));
  }else if(kind==='habit') body.append(toggle('开启打卡提醒',draft.habit.enabled,v=>draft.habit.enabled=v),timeList('提醒时间',draft.habit.times,v=>draft.habit.times=v),element('p','提醒当天还没完成的小习惯，已经完成的就不再催你啦。','routine-copy'));
  if(kind==='meal'){
   for(const def of mealDefinitions){
    const slot=draft.meal.meals[def.id],group=element('section',undefined,'reminder-group meal-reminder-group');
    const enable=toggle('',slot.enabled,v=>slot.enabled=v);enable.querySelector('input')!.setAttribute('aria-label',`开启${def.name}提醒`);
    const label=element('label',undefined,'field-label'),input=document.createElement('input');input.type='time';input.id='meal-time-'+def.id;input.value=slot.time;input.setAttribute('aria-label',`${def.name}提醒时间`);input.addEventListener('change',()=>slot.time=input.value);label.append(input);
    group.append(element('span',def.name,'meal-reminder-name'),label,enable);body.append(group);
   }
  }
  const value=reminderOptions(kind),summary=[value.popup&&'弹窗',value.vibration&&'震动',value.sound&&'铃声'].filter(Boolean).join(' · ')||'安安静静地记着';
  const style=button('','setting-button reminder-inline-card',()=>window.dispatchEvent(new CustomEvent('sanhao:routine-style',{detail:{kind,panel}})));style.innerHTML='<span><b>提醒方式</b><small></small></span><i>›</i>';style.querySelector('small')!.textContent=summary;body.append(style);
  const save=button('保存提醒','wide-primary',()=>void commit());body.append(save);
 }
 async function commit(){
  if(kind==='meal'&&mealDefinitions.some(d=>draft.meal.meals[d.id].enabled&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.meal.meals[d.id].time))){options.toast('选好要提醒的时间再保存呀');return}
  const normalized=normalizeRoutineSettings(draft);
  if(kind==='course'&&((draft.course.enabled&&!normalized.course.leads.length)||(draft.course.agendaEnabled&&!normalized.course.agendaTimes.length))||kind==='habit'&&draft.habit.enabled&&!normalized.habit.times.length){options.toast('开启提醒时至少设置一个时间');return}
  if(draft.course.leads.some(n=>!Number.isInteger(n)||n<0||n>180)){options.toast('提前量填写0–180分钟');return}
  try{localStorage.setItem(storageKey,JSON.stringify(normalized))}catch{options.toast('提醒还没存好，请检查手机剩余空间');return}draft=normalized;refreshMealSummary();
  const save=body.querySelector<HTMLButtonElement>('.wide-primary')!;save.disabled=true;
  try{const saved=await options.sync();if(saved||!('__TAURI_INTERNALS__' in window)){options.close();options.toast('提醒时间收好啦')}else options.toast('时间已保存，系统提醒还没同步，请再试一下')}finally{save.disabled=false}
 }
 const open=(value:RoutineKind)=>{kind=value;draft=readRoutineSettings();paint();options.open(panel)};
 new MutationObserver(()=>{if(!panel.hidden)paint()}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('message',event=>{const selector=event.data==='sanhao:course-reminders'?'#timetable-frame':event.data==='sanhao:habit-reminders'?'#habit-frame':null;if(selector&&event.source===document.querySelector<HTMLIFrameElement>(selector)?.contentWindow)open(selector==='#timetable-frame'?'course':'habit')});
 function refreshMealSummary(){const prefs=readRoutineSettings().meal;document.querySelector('#meal-reminder-summary')!.textContent=mealDefinitions.map(d=>`${d.name} ${prefs.meals[d.id].enabled?prefs.meals[d.id].time:'不提醒'}`).join(' · ')}
 document.querySelector('#open-meal-reminders')!.addEventListener('click',()=>open('meal'));refreshMealSummary();
 const entries=()=>{const p=readRoutineSettings();return [{kind:'course' as const,title:'所有课程',detail:[p.course.enabled?`上课前${p.course.leads.join('、')}分钟`:null,p.course.agendaEnabled?`当天汇总 ${p.course.agendaTimes.join('、')}`:null].filter(Boolean).join(' · ')||'暂时不提醒',edit:()=>open('course')},{kind:'habit' as const,title:'习惯打卡',detail:p.habit.enabled?`每天 ${p.habit.times.join('、')}`:'暂时不提醒',edit:()=>open('habit')},{kind:'meal' as const,title:'好好吃饭',detail:p.meal.enabled?mealDefinitions.filter(d=>p.meal.meals[d.id].enabled).map(d=>`${d.name} ${p.meal.meals[d.id].time}`).join(' · '):'暂时不提醒',edit:()=>open('meal')}]};
 return {open,entries};
}
