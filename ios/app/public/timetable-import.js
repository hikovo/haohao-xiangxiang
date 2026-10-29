// OCR coordinates use top-left origin. Nothing is saved before the user confirms.
const days={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7};
const weekday=text=>{const m=text.replace(/\s/g,'').match(/^(?:周|星期)([一二三四五六日天])$/);return m?days[m[1]]:null};
const clock=text=>[...text.matchAll(/(?:^|[^\d])([01]?\d|2[0-3])[:：]([0-5]\d)(?!\d)/g)].map(m=>m[1].padStart(2,'0')+':'+m[2]);
export function scanDrafts(result,{from,until,slots}){
 const drafts=[];const texts=[];
 for(const page of result.pages||[]){const blocks=[...page.blocks].sort((a,b)=>a.y-b.y||a.x-b.x);texts.push(`第 ${page.number} 页\n`+blocks.map(b=>b.text).join('\n'));
  const headers=blocks.filter(b=>weekday(b.text)).map(b=>({...b,day:weekday(b.text),center:b.x+b.width/2}));
  if(headers.length<3)continue;
  const anchors=Array.from({length:7},(_,i)=>{const found=headers.find(h=>h.day===i+1);if(found)return found.center;const a=headers[0],z=headers[headers.length-1];return a.center+(i+1-a.day)*(z.center-a.center)/(z.day-a.day)});
  const left=anchors[0]-(anchors[1]-anchors[0])/2,headerBottom=Math.max(...headers.map(h=>h.y+h.height));
  const times=blocks.filter(b=>b.x+b.width/2<left&&b.y>headerBottom).flatMap(b=>clock(b.text).map((time,i)=>({time,y:b.y+i*b.height/2})));
  const periods=[];for(let i=0;i+1<times.length;i+=2){if(times[i].time<times[i+1].time)periods.push({start:times[i].time,end:times[i+1].time,y:times[i].y})}
  const columns=Array.from({length:7},()=>[]);
  for(const b of blocks){const t=b.text.trim();if(b.y<=headerBottom+.005||b.x+b.width/2<left||weekday(t)||/^\d{1,2}(?:日|月)?$/.test(t)||clock(t).length||!t)continue;const center=b.x+b.width/2,col=anchors.reduce((best,x,i)=>Math.abs(x-center)<Math.abs(anchors[best]-center)?i:best,0);columns[col].push(b)}
  for(const [col,items]of columns.entries()){
   const groups=[];for(const b of items.sort((a,b)=>a.y-b.y)){const last=groups[groups.length-1],prev=last?.[last.length-1];if(prev&&b.y-(prev.y+prev.height)<Math.max(.023,prev.height*1.25))last.push(b);else groups.push([b])}
   for(const group of groups){const lines=group.map(b=>b.text.trim());let split=lines.findIndex(t=>/[@＠]|教室|教学楼|实验楼|實训楼|实训楼|地点/.test(t));if(split<0)split=lines.length;const name=lines.slice(0,split).join('').slice(0,80);if(!name||/^[A-Za-z]\d+$/.test(name))continue;let period=0;if(periods.length)period=periods.reduce((best,p,i)=>Math.abs(p.y-group[0].y)<Math.abs(periods[best].y-group[0].y)?i:best,0);const time=periods[period]||slots[Math.min(period,slots.length-1)]||{start:'08:00',end:'09:00'};drafts.push({id:crypto.randomUUID(),name,place:lines.slice(split).join(' ').replace(/^[@＠]\s*/, '').slice(0,100),teacher:'',note:'',weekday:col+1,start:time.start,end:time.end,from,until,parity:'all',color:['yellow','pink','sage','blue','lilac'][col%5]})}
  }

 }
 return {drafts:drafts.slice(0,500),text:texts.join('\n\n')};
}
