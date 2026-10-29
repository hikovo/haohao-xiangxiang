export type SolarDay = {date:string;sunrise?:number;sunset?:number};
const cacheKey='sanhao-tu.home-solar.v1';
export function solarLightsOn(days:SolarDay[],now=new Date()):boolean|null {
 const date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const day=days.find(d=>d.date===date);
 if(!day||!Number.isFinite(day.sunrise)||!Number.isFinite(day.sunset)||day.sunrise!>=day.sunset!)return null;
 return now.getTime()<day.sunrise!||now.getTime()>=day.sunset!;
}
export function setupHomeLightCycle(apply:(on:boolean)=>void){
 let days:SolarDay[]=[];let applied:string|undefined;
 try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');if(Array.isArray(cached))days=cached}catch{/* Preserve invalid old cache. */}
 const refresh=()=>{const now=new Date(),on=solarLightsOn(days,now);if(on===null)return;const signature=days.find(d=>d.date===`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`)?.date+'/'+on;if(applied===signature)return;applied=signature;apply(on)};
 window.addEventListener('sanhao:solar-update',event=>{const value=(event as CustomEvent<SolarDay[]>).detail;if(!Array.isArray(value))return;days=value.filter(d=>typeof d.date==='string');localStorage.setItem(cacheKey,JSON.stringify(days));refresh()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
 window.setInterval(refresh,15000);refresh();
}
