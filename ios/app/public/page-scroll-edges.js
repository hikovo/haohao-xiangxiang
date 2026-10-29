// Fade the scrolling content itself. There is no floating rectangle above it.
const selector='.phone > .content, .sheet-scroll, .category-list, .source-text';
const targets=new Set(), masked=new Map();
let frame=0;
const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
const resize=new ResizeObserver(schedule);
function update(){
 frame=0;const current=new Set();
 for(const target of targets){
  if(!target.isConnected){resize.unobserve(target);targets.delete(target);continue}
  const box=target.getBoundingClientRect(),style=getComputedStyle(target),maximum=target.scrollHeight-target.clientHeight;
  if(target.closest('[hidden]')||box.height<=0||maximum<=2||!['auto','scroll'].includes(style.overflowY))continue;
  const header=target.matches('.sheet')?target.querySelector('.sheet-head')?.getBoundingClientRect():null;
  const top=Math.max(box.top,header?.bottom??box.top);
  const footer=target.matches('.content')?target.closest('.phone')?.querySelector('footer')?.getBoundingClientRect():null;
  const bottom=Math.min(box.bottom,footer?.top??box.bottom);
  const start=Math.min(24,Math.max(0,target.scrollTop-1));
  const end=Math.min(24,Math.max(0,maximum-target.scrollTop-1));
  for(const child of target.children){
   if(child.matches('.handle,.sheet-head,[hidden]'))continue;
   const r=child.getBoundingClientRect();if(r.height<=0)continue;
   if(!masked.has(child))masked.set(child,{mask:child.style.maskImage,webkit:child.style.webkitMaskImage});
   const stops=[start?`transparent ${top-r.top}px, #000 ${top-r.top+start}px`:'#000 0px',end?`#000 ${bottom-r.top-end}px, transparent ${bottom-r.top}px`:'#000 100%'];
   const value=`linear-gradient(to bottom,${stops.join(',')})`;
   if(child.style.maskImage!==value){child.style.maskImage=value;child.style.webkitMaskImage=value}
   current.add(child);
  }
 }
 for(const [child,old]of masked){if(current.has(child))continue;child.style.maskImage=old.mask;child.style.webkitMaskImage=old.webkit;masked.delete(child)}
}
function discover(){document.querySelectorAll(selector).forEach(t=>{if(!targets.has(t)){targets.add(t);resize.observe(t)}});schedule()}
new MutationObserver(discover).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','open']});
document.addEventListener('scroll',schedule,{capture:true,passive:true});document.addEventListener('input',schedule,{passive:true});document.addEventListener('load',schedule,{capture:true,passive:true});document.addEventListener('loadedmetadata',schedule,{capture:true,passive:true});document.addEventListener('transitionend',schedule,{capture:true,passive:true});document.addEventListener('animationend',schedule,{capture:true,passive:true});window.addEventListener('resize',schedule,{passive:true});void document.fonts.ready.then(schedule);discover();
