/** Either horizontal direction exits; scrolling, editing and galleries keep their gestures. */
export function isExitSwipe(dx:number,dy:number,elapsed:number,width:number) {
 return elapsed>=60&&elapsed<=900&&Math.abs(dx)>=Math.max(70,width*.2)&&Math.abs(dy)<Math.min(55,Math.abs(dx)*.4);
}
export function attachSecondarySwipe(doc:Document,back:()=>HTMLButtonElement|null) {
 let start:{x:number;y:number;time:number;id:number;button:HTMLButtonElement}|null=null;
 const blocked='button,a,input,textarea,select,video,audio,canvas,[contenteditable="true"],[role="slider"],.rich-text-editor,.rich-text-toolbar,.ios-rabbit-handle,.home-board,.letter-page';
 const begin=(target:Element|null,x:number,y:number,id:number)=>{
  start=null;const button=back();
  const control=target?.closest(blocked),edge=x<24||x>doc.documentElement.clientWidth-24;
  const editorEdge=edge&&control?.matches('[contenteditable="true"],.rich-text-editor');
  if(!button||(control&&!editorEdge)||doc.getSelection()?.toString())return;
  for(let el=target;el&&el!==doc.body;el=el.parentElement)if(el.scrollWidth>el.clientWidth+2&&/auto|scroll/.test(doc.defaultView!.getComputedStyle(el).overflowX))return;
  start={x,y,time:performance.now(),id,button};
 };
 const finish=(x:number,y:number,id:number)=>{const initial=start;start=null;if(initial&&id===initial.id&&back()===initial.button&&isExitSwipe(x-initial.x,y-initial.y,performance.now()-initial.time,doc.documentElement.clientWidth))initial.button.click()};
 doc.addEventListener('touchstart',event=>{if(event.touches.length!==1){start=null;return}const t=event.touches[0];begin(event.target as Element|null,t.clientX,t.clientY,t.identifier)},{passive:true});
 doc.addEventListener('touchmove',event=>{if(event.touches.length!==1)start=null},{passive:true});
 doc.addEventListener('touchcancel',()=>{start=null},{passive:true});
 doc.addEventListener('touchend',event=>{const initial=start;if(!initial)return;const t=[...event.changedTouches].find(t=>t.identifier===initial.id);if(t)finish(t.clientX,t.clientY,t.identifier)},{passive:true});
 // Desktop preview mouse/pen drags use the same navigation rules as touch.
 doc.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'&&event.button===0)begin(event.target as Element|null,event.clientX,event.clientY,event.pointerId)},{passive:true});
 doc.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')finish(event.clientX,event.clientY,event.pointerId)},{passive:true});
 doc.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')start=null},{passive:true});
 let wheel:{dx:number;dy:number;time:number;button:HTMLButtonElement}|null=null;
 doc.addEventListener('wheel',event=>{
  if(event.ctrlKey||Math.abs(event.deltaX)<=Math.abs(event.deltaY)*1.5)return;
  if(!wheel||performance.now()-wheel.time>600){begin(event.target as Element|null,event.clientX,event.clientY,-2);if(!start)return;wheel={dx:0,dy:0,time:performance.now(),button:start.button};start=null}
  wheel.dx+=event.deltaX;wheel.dy+=event.deltaY;
  if(back()===wheel.button&&isExitSwipe(wheel.dx,wheel.dy,performance.now()-wheel.time,doc.documentElement.clientWidth)){event.preventDefault();const button=wheel.button;wheel=null;button.click()}
 },{passive:false});

}

/** Commit a real back tap on touchend, before a keyboard resize can cancel the
 * compatibility click. Mouse, keyboard and accessibility clicks use one route. */
export function attachSecondaryBack(doc:Document,resolve:()=>{button:HTMLButtonElement;close:()=>void}|null) {
 let tap:{x:number;y:number;id:number;button:HTMLButtonElement}|null=null;
 const targetButton=(event:Event)=>{const target=event.target as Element|null;return target?.closest?.('button')};
 doc.addEventListener('touchstart',event=>{tap=null;const route=resolve();if(event.touches.length!==1||!route||targetButton(event)!==route.button)return;const t=event.touches[0];tap={x:t.clientX,y:t.clientY,id:t.identifier,button:route.button}},{passive:true,capture:true});
 doc.addEventListener('touchcancel',()=>{tap=null},{passive:true,capture:true});
 doc.addEventListener('touchend',event=>{const first=tap;tap=null;const route=resolve();if(!first||route?.button!==first.button)return;const t=[...event.changedTouches].find(t=>t.identifier===first.id);if(!t||Math.hypot(t.clientX-first.x,t.clientY-first.y)>12)return;event.preventDefault();event.stopImmediatePropagation();route.close()},{passive:false,capture:true});
 doc.addEventListener('click',event=>{const route=resolve();if(!route||targetButton(event)!==route.button)return;event.preventDefault();event.stopImmediatePropagation();route.close()},{capture:true});
}
