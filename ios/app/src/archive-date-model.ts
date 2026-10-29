export type DatedArchive={date?:string|null;periodStart?:string;periodEnd?:string};
export function validArchiveDate(value:unknown):value is string {
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function archiveDateIndex(rows:DatedArchive[]) {
 const dates=new Set(rows.map(row=>row.date).filter(validArchiveDate));
 const sorted=[...dates].sort();if(!sorted.length)throw Error('没有读到带日期的内容');
 return {min:sorted[0],max:sorted[sorted.length-1],dates};
}
export function clampArchiveRange(index:{min:string;max:string},value?:{start?:unknown;end?:unknown}) {
 const clamp=(date:unknown,fallback:string)=>validArchiveDate(date)?date<index.min?index.min:date>index.max?index.max:date:fallback;
 const start=clamp(value?.start,index.min),end=clamp(value?.end,index.max);
 return start<=end?{start,end}:{start:index.min,end:index.max};
}
export function calendarDays(month:string) {
 const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1));
 const offset=(first.getUTCDay()+6)%7;
 const daysInMonth=new Date(Date.UTC(year,m,0)).getUTCDate();
 return Array.from({length:Math.ceil((offset+daysInMonth)/7)*7},(_,i)=>{const day=new Date(Date.UTC(year,m-1,1-offset+i));return {date:day.toISOString().slice(0,10),day:day.getUTCDate(),inMonth:day.getUTCMonth()===m-1}});
}
