type Point={x:number;y:number};
type Effects={
 scale:()=>number; resize:(value:number)=>void; commitResize:()=>void;
 beginDrag:()=>void; moveDrag:(dx:number,dy:number)=>void; commitDrag:()=>void;
 manipulation:()=>void; tap:()=>void;
};
/** Pointer bookkeeping is independent of the page and the rabbit's DOM host. */
export class FloatingRabbitGesture {
 private points=new Map<number,Point>();
 private origin:Point|undefined;
 private dragging=false;
 private suppressed=false;
 private pinch:{distance:number;scale:number}|undefined;
 private effects:Effects;
 constructor(effects:Effects){this.effects=effects;}
 get active(){return this.points.size>0;}
 has(id:number){return this.points.has(id);}
 private distance(){const [a,b]=[...this.points.values()];return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0;}
 private beginPinch(){this.pinch={distance:this.distance(),scale:this.effects.scale()};this.dragging=false;this.suppressed=true;this.effects.manipulation();}
 down(id:number,x:number,y:number){
  if(this.points.has(id))return;
  this.points.set(id,{x,y});
  if(this.points.size===1){this.origin={x,y};this.dragging=false;this.suppressed=false;this.effects.beginDrag();}
  else if(this.points.size===2)this.beginPinch();
 }
 move(id:number,x:number,y:number){
  if(!this.points.has(id))return;
  this.points.set(id,{x,y});
  if(this.points.size>=2){
   if(!this.pinch||this.pinch.distance<1){this.beginPinch();return;}
   this.effects.resize(this.pinch.scale*this.distance()/this.pinch.distance);return;
  }
  if(this.suppressed||!this.origin)return;
  const dx=x-this.origin.x,dy=y-this.origin.y;
  if(!this.dragging&&Math.hypot(dx,dy)>7){this.dragging=true;this.effects.manipulation();}
  if(this.dragging)this.effects.moveDrag(dx,dy);
 }
 up(id:number,cancelled=false){
  if(!this.points.delete(id))return;
  if(this.pinch){
   if(this.points.size>=2)this.beginPinch();
   else{this.pinch=undefined;this.effects.commitResize();}
  }else if(!this.suppressed){
   if(this.dragging)this.effects.commitDrag();
   else if(!cancelled)this.effects.tap();
  }
  if(!this.points.size){this.origin=undefined;this.dragging=false;this.suppressed=false;}
 }
}
