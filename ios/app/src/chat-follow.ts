export class ChatFollowState {
 following=true;held=false;scrolling=false;moved=false;
 hold(){this.held=true;this.moved=false}
 userScroll(distance:number){this.moved=true;this.scrolling=true;this.following=distance<=48}
 release(){this.held=false}
 settle(){this.scrolling=false}
 get canFollow(){return this.following&&!this.held&&!this.scrolling}
}
export function setupChatFollow(log:HTMLElement){
 const state=new ChatFollowState();let frame=0,gestureUntil=0,settleTimer=0;let press:{x:number;y:number;scrollbar:boolean}|undefined;
 const request=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(state.canFollow&&log.clientHeight>0)log.scrollTop=log.scrollHeight})};
 const settle=()=>{clearTimeout(settleTimer);settleTimer=window.setTimeout(()=>{state.settle();request()},180)};
 const gesture=()=>{gestureUntil=performance.now()+1000;state.scrolling=true;settle()};
 log.addEventListener('pointerdown',event=>{state.hold();gestureUntil=0;const box=log.getBoundingClientRect();press={x:event.clientX,y:event.clientY,scrollbar:event.clientX>=box.right-16}},{passive:true});
 log.addEventListener('pointermove',event=>{if(state.held&&press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>3)gesture()},{passive:true});
 const release=()=>{if(!state.held)return;state.release();press=undefined;if(state.moved)settle();else request()};
 window.addEventListener('pointerup',release,{passive:true});window.addEventListener('pointercancel',release,{passive:true});
 log.addEventListener('wheel',gesture,{passive:true});log.addEventListener('touchmove',gesture,{passive:true});
 log.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))gesture()});
 log.addEventListener('scroll',()=>{if((state.held&&press?.scrollbar)||performance.now()<gestureUntil){gestureUntil=performance.now()+1000;state.userScroll(Math.max(0,log.scrollHeight-log.clientHeight-log.scrollTop));settle()}},{passive:true});
 const resize=new ResizeObserver(request),children=new Set<Element>();resize.observe(log);
 const observe=()=>{for(const child of children)if(child.parentElement!==log){resize.unobserve(child);children.delete(child)}for(const child of log.children)if(!children.has(child)){children.add(child);resize.observe(child)}request()};
 new MutationObserver(observe).observe(log,{childList:true,subtree:true,characterData:true});
 log.addEventListener('load',request,{capture:true,passive:true});
 window.visualViewport?.addEventListener('resize',request,{passive:true});
 observe();return {request,reset:()=>{state.following=true;request()}};
}
