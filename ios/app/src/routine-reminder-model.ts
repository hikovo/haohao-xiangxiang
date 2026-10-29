export type RoutineKind = 'course' | 'habit' | 'meal';
export const mealDefinitions = [{id:'breakfast',name:'早餐',time:'08:00'}, {id:'lunch',name:'午餐',time:'13:00'}, {id:'dinner',name:'晚餐',time:'18:00'}] as const;
export type MealKey = typeof mealDefinitions[number]['id'];
export const mealReminderMessage=(name:string)=>`${name}时间到啦，让兔兔帮你决定${name}吃什么吧 (｡•ᴗ•｡)`;
export type RoutineSettings = {
  course: {enabled: boolean; leads: number[]; agendaEnabled: boolean; agendaTimes: string[]};
  habit: {enabled: boolean; times: string[]};
  meal: {enabled: boolean; schemaVersion?:2; meals:Record<MealKey,{enabled:boolean;time:string}>};
};
export type RoutineCourse = {id:string; name:string; place:string; weekday:number; start:string; end:string; from:string; until:string; parity:string};
export type RoutineHealth = {habits:{id:string;name:string;archived:boolean;days?:number[]}[];checkins:{habitId:string;date:string}[]};
export type RoutineRequest = {id:string;title:string;kind:RoutineKind;reminderId:string;completed:boolean;triggerAt:number;message:string;date:string;time:string};
const times=(values:unknown, fallback:string[]) => {
 const list=Array.isArray(values)?values: fallback;
 return [...new Set(list.filter((v):v is string=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)))].sort().slice(0,6);
};
export function normalizeRoutineSettings(value?:Partial<RoutineSettings>):RoutineSettings {
 const c=value?.course,h=value?.habit;
 const leads=Array.isArray(c?.leads)?[...new Set(c.leads.filter(n=>Number.isInteger(n)&&n>=0&&n<=180))].sort((a,b)=>b-a).slice(0,6):[10];
 const independent=value?.meal?.schemaVersion===2;
 const meals=Object.fromEntries(mealDefinitions.map(def=>{const slot=value?.meal?.meals?.[def.id];return [def.id,{enabled:independent?slot?.enabled===true:value?.meal?.enabled===true&&slot?.enabled!==false,time:times([slot?.time],[])[0]||def.time}]})) as RoutineSettings['meal']['meals'];
 return {course:{enabled:c?.enabled===true,leads,agendaEnabled:c?.agendaEnabled===true,agendaTimes:times(c?.agendaTimes,['07:30'])},habit:{enabled:h?.enabled===true,times:times(h?.times,['09:00','20:00'])},meal:{enabled:mealDefinitions.some(d=>meals[d.id].enabled),schemaVersion:2,meals}};
}
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monday=(date:string)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())};
function occurs(c:RoutineCourse,date:string){
 const day=new Date(date+'T12:00:00').getDay()||7;
 if(date<c.from||date>c.until||day!==c.weekday)return false;
 const week=Math.round((monday(date)-monday(c.from))/604800000);
 return c.parity==='all'||(c.parity==='odd'?week%2===0:week%2===1);
}
export function routineRequests(settings:RoutineSettings,courses:RoutineCourse[],health:RoutineHealth,now=new Date(),days=30):RoutineRequest[]{
 const result:RoutineRequest[]=[];
 const add=(id:string,kind:RoutineKind,title:string,message:string,when:Date,reminderId='')=>{
  if(!Number.isFinite(when.getTime())||when<=now)return;
  result.push({id,kind,title,message,reminderId,completed:false,triggerAt:when.getTime(),date:key(when),time:`${String(when.getHours()).padStart(2,'0')}:${String(when.getMinutes()).padStart(2,'0')}`});
 };
 if(settings.meal.enabled)for(const def of mealDefinitions){const meal=settings.meal.meals[def.id];if(!meal.enabled)continue;const when=new Date(now),[hour,minute]=meal.time.split(':').map(Number);when.setHours(hour,minute,0,0);if(when<=now)when.setDate(when.getDate()+1);add(`meal-${def.id}`,'meal',`${def.name}吃什么`,mealReminderMessage(def.name),when,def.id)}
 for(let offset=0;offset<days;offset++){
  const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);const date=key(d);
  const today=courses.filter(c=>occurs(c,date)).sort((a,b)=>a.start.localeCompare(b.start));
  if(settings.course.enabled)for(const c of today)for(const lead of settings.course.leads){
   const start=new Date(`${date}T${c.start}:00`);
   const message=`${c.name} · ${c.start}–${c.end}${c.place?' · '+c.place:''}${lead?'，还有'+lead+'分钟上课，准备好再出发呀。':'，上课时间到啦。'}`;
   add(`course-${c.id}-${date}-${lead}`,'course',c.name,message,new Date(start.getTime()-lead*60000));
  }
  if(settings.course.agendaEnabled)for(const time of settings.course.agendaTimes){
   const message=today.length?'今天的课程：'+today.map(c=>`${c.start}–${c.end} ${c.name}${c.place?'（'+c.place+'）':''}`).join('；'):'今天没有课程，好好安排学习和休息呀。';
   add(`course-agenda-${date}-${time}`,'course','今天的课程',message,new Date(`${date}T${time}:00`));
  }
  if(settings.habit.enabled){
   const unfinished=health.habits.filter(h=>!h.archived&&(!h.days||h.days.includes(new Date(date+'T12:00:00').getDay()||7))&&!health.checkins.some(c=>c.date===date&&c.habitId===h.id));
   if(unfinished.length)for(const time of settings.habit.times)add(`habit-${date}-${time}`,'habit','今天的小约定',`今天还有${unfinished.map(h=>h.name).join('、')}，做一点点也很好，兔兔陪着你 ♡`,new Date(`${date}T${time}:00`));
  }
 }
 return result.sort((a,b)=>a.triggerAt-b.triggerAt||a.id.localeCompare(b.id));
}
