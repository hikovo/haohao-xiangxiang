import {weekDates,occurs,minute} from './timetable-model.js';
export function shiftDay(day,n){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function habitDue(h,day){return !h.archived&&(!h.days||h.days.includes(new Date(day+'T12:00:00Z').getUTCDay()||7))}
export function weeklyHabitProgress(habits,checkins,day){
 const active=new Set(habits.filter(h=>!h.archived).map(h=>h.id)),dates=new Set(weekDates(day));
 const done=new Set(checkins.filter(c=>active.has(c.habitId)&&dates.has(c.date)).map(c=>c.habitId+'|'+c.date)).size;
 return {done,total:active.size*7};
}
export function habitSummary(h,checkins,day){
 const checked=new Set(checkins.filter(c=>c.habitId===h.id).map(c=>c.date));
 const week=weekDates(day),weekCount=week.filter(d=>checked.has(d)).length;
 const dates=Array.from({length:30},(_,i)=>shiftDay(day,-i)).filter(d=>habitDue(h,d));
 let streak=0,cursor=day;
 if(habitDue(h,cursor)&&!checked.has(cursor))cursor=shiftDay(cursor,-1);
 for(let i=0;i<3660;i++,cursor=shiftDay(cursor,-1)){if(!habitDue(h,cursor))continue;if(!checked.has(cursor))break;streak++}
 const count=dates.filter(d=>checked.has(d)).length;
 return {weekCount,target:h.weeklyTarget||h.days?.length||7,count,total:dates.length,streak,rate:dates.length?Math.round(count*100/dates.length):0};
}
export function healthSummary(state,day,days){
 const first=shiftDay(day,1-days),within=x=>x.date>=first&&x.date<=day;
 const weights=state.weights.filter(within).sort((a,b)=>a.date.localeCompare(b.date));
 const exercise=state.exercises.filter(within),meals=state.meals.filter(within);
 return {first,weights,minutes:exercise.reduce((a,b)=>a+b.minutes,0),exerciseDays:new Set(exercise.map(x=>x.date)).size,mealDays:new Set(meals.map(x=>x.date)).size,change:weights.length>1?weights.at(-1).grams-weights[0].grams:null};
}
export function budgetProgress(state,budget){const spent=state.entries.filter(e=>e.type==='out'&&e.date.startsWith(budget.month)&&(!budget.categoryId||e.categoryId===budget.categoryId)).reduce((s,e)=>s+BigInt(e.cents),0n);return {spent,left:BigInt(budget.cents)-spent,percent:Math.min(100,Number(spent*100n/BigInt(budget.cents||1)))};}
export function ledgerMonths(state,end,count=6){const [year,month]=end.split('-').map(Number);return Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(year,month-1-count+1+i,1)),key=d.toISOString().slice(0,7),entries=state.entries.filter(e=>e.date.startsWith(key));return {month:key,out:entries.filter(e=>e.type==='out').reduce((s,e)=>s+BigInt(e.cents),0n),income:entries.filter(e=>e.type==='in').reduce((s,e)=>s+BigInt(e.cents),0n)}})}
export function courseConflicts(courses){const result=[];const sorted=[...courses].sort((a,b)=>a.weekday-b.weekday||a.start.localeCompare(b.start));for(let i=0;i<sorted.length;i++){const a=sorted[i];for(let j=i+1;j<sorted.length;j++){const b=sorted[j];if(b.weekday!==a.weekday||minute(b.start)>=minute(a.end))break;const first=a.from>b.from?a.from:b.from,last=a.until<b.until?a.until:b.until;for(let n=0;n<14;n++){const date=shiftDay(first,n);if(date>last)break;if(occurs(a,date)&&occurs(b,date)){result.push({a,b,date});break}}}}return result}
export function nextCourse(courses,now=new Date()){const day=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-'),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');for(let n=0;n<14;n++){const date=shiftDay(day,n),found=courses.filter(c=>occurs(c,date)&&(n>0||c.end>time)).sort((a,b)=>a.start.localeCompare(b.start))[0];if(found)return {course:found,date,ongoing:!n&&found.start<=time}}return null}
