import {loadArchives} from './offline-blindbox';
import {archiveDateIndex,clampArchiveRange,calendarDays} from './archive-date-model';
export function setupArchiveRangeCalendar(toast:(text:string)=>void) {
 const container=document.querySelector<HTMLElement>('#archive-range-calendars')!;
 const start=document.querySelector<HTMLInputElement>('#archive-range-start')!,end=document.querySelector<HTMLInputElement>('#archive-range-end')!;
 const save=document.querySelector<HTMLButtonElement>('#save-archive-range')!;
 let index:ReturnType<typeof archiveDateIndex>|undefined;
 let months={start:'',end:''};
 const element=(tag:string,text?:string,cls?:string)=>{const node=document.createElement(tag);if(text)node.textContent=text;if(cls)node.className=cls;return node};
 function paint() {
  if(!index)return;container.replaceChildren();
  for(const kind of ['start','end'] as const){
   const selected=kind==='start'?start:end,month=months[kind],card=element('section',undefined,'archive-calendar');card.setAttribute('aria-label',kind==='start'?'起始日期日历':'结束日期日历');
   const nav=element('div',undefined,'archive-calendar-nav');
   const button=(text:string,action:()=>void)=>{const b=element('button',text) as HTMLButtonElement;b.type='button';b.addEventListener('click',action);return b};
   const year=document.createElement('select'),monthSelect=document.createElement('select');year.setAttribute('aria-label',(kind==='start'?'开始':'结束')+'年份');monthSelect.setAttribute('aria-label',(kind==='start'?'开始':'结束')+'月份');
   for(let y=+index.min.slice(0,4);y<=+index.max.slice(0,4);y++)year.add(new Option(y+'年',String(y)));
   for(let m=1;m<=12;m++)monthSelect.add(new Option(m+'月',String(m).padStart(2,'0')));
   year.value=month.slice(0,4);monthSelect.value=month.slice(5,7);
   const jump=()=>{const next=year.value+'-'+monthSelect.value;months[kind]=next<index!.min.slice(0,7)?index!.min.slice(0,7):next>index!.max.slice(0,7)?index!.max.slice(0,7):next;paint()};year.addEventListener('change',jump);monthSelect.addEventListener('change',jump);
   const title=element('div',undefined,'archive-calendar-month');title.append(year,monthSelect);
   const label=element('b',kind==='start'?'从这天开始':'翻到这一天','archive-calendar-label');
   const date=element('time',selected.value.replace(/-/g,'.'),'archive-calendar-date');date.setAttribute('datetime',selected.value);
   nav.append(label,title,date);card.append(nav);
   const weekdays=element('div',undefined,'archive-calendar-weekdays');for(const day of ['一','二','三','四','五','六','日'])weekdays.append(element('span',day));card.append(weekdays);
   const grid=element('div',undefined,'archive-calendar-grid');
   for(const day of calendarDays(month)){
    const b=button(String(day.day),()=>{selected.value=day.date;paint()});b.disabled=!day.inMonth||day.date<index.min||day.date>index.max;b.classList.toggle('outside-month',!day.inMonth);b.classList.toggle('has-archive',index.dates.has(day.date));b.classList.toggle('selected',day.date===selected.value);b.setAttribute('aria-pressed',String(day.date===selected.value));b.setAttribute('aria-label',day.date+(index.dates.has(day.date)?' 有网盘内容':''));grid.append(b);
   }
   card.append(grid);container.append(card);
  }
 }
 async function open(){
  save.disabled=true;container.textContent='正在翻翻这些日子……';
  try{index=archiveDateIndex((await loadArchives()).rows);let stored={};try{stored=JSON.parse(localStorage.getItem('sanhao.offline-range')||'{}')||{}}catch{/* retain defaults */}
   const range=clampArchiveRange(index,stored);start.value=range.start;end.value=range.end;months={start:range.start.slice(0,7),end:range.end.slice(0,7)};paint();save.disabled=false;
  }catch{container.textContent='这次没读到这些日子，重新打开试试吧';toast('网盘日期还没准备好')}
 }
 return {open};
}
