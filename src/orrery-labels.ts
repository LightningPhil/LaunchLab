export interface LabelRect { x:number; y:number; w:number; h:number }
export interface LabelBody { id:string; x:number; y:number; z:number; r:number }
export interface LabelDirection { x:number; y:number }

/** Keep a unit direction even at an edge-on conjunction. Only large direction
 * changes need a bounded turn; ordinary orbital motion follows the ray exactly.
 * Near zero projected radius, hold the last heading rather than shortening the
 * leader into the object or flipping it to the opposite side. */
export function radialDirection(body:LabelBody,centre:{x:number;y:number}|undefined,
  previous?:LabelDirection,seconds=1/60):LabelDirection {
  const dx=centre?body.x-centre.x:1,dy=centre?body.y-centre.y:-1;
  const distance=Math.hypot(dx,dy);
  if(!distance)return previous??{x:Math.SQRT1_2,y:-Math.SQRT1_2};
  const desired={x:dx/distance,y:dy/distance};
  if(!previous||!centre)return desired;
  const delta=Math.atan2(previous.x*desired.y-previous.y*desired.x,previous.x*desired.x+previous.y*desired.y);
  const maxTurn=12*Math.min(1,distance/12)*Math.max(0,Math.min(seconds,.05));
  if(Math.abs(delta)<=maxTurn)return desired;
  const angle=Math.atan2(previous.y,previous.x)+Math.sign(delta)*maxTurn;
  return {x:Math.cos(angle),y:Math.sin(angle)};
}

/** Attach the label's centre, using its bounding circle for angle-independent
 * clearance. Width/height support along a ray made the centres trace a rounded
 * rectangle; half the diagonal provides the same safe distance at every angle. */
export function radialLabel(body:LabelBody,centre:{x:number;y:number}|undefined,w:number,h:number,
  heading=radialDirection(body,centre)):LabelRect {
  const gap=body.r+9+Math.hypot(w,h)/2;
  return {x:body.x+heading.x*gap-w/2,y:body.y+heading.y*gap-h/2,w,h};
}

/** The label's centre is the endpoint, even though its opaque background hides
 * the last part of the line. Begin just outside the body's displayed outline. */
export function labelLeader(body:LabelBody,rect:LabelRect){
  const end={x:rect.x+rect.w/2,y:rect.y+rect.h/2};
  const dx=end.x-body.x,dy=end.y-body.y,length=Math.hypot(dx,dy);
  if(length<=body.r+3)return undefined;
  const fraction=(body.r+3)/length;
  return {start:{x:body.x+dx*fraction,y:body.y+dy*fraction},end};
}

/** NDC depth increases away from an orthographic camera. Ties use a stable
 * identity, so selection, menu order and passing neighbours cannot reshuffle
 * the text. Draw far leaders first; give nearer DOM labels higher z-indices. */
export function labelsFarToNear<T extends {id:string;z:number}>(bodies:T[]):T[] {
  return [...bodies].sort((a,b)=>b.z-a.z||a.id.localeCompare(b.id));
}

/** Clip at the stage edge rather than moving a label to another side. */
export const labelInView=(rect:LabelRect,width:number,height:number)=>
  rect.x<width&&rect.y<height&&rect.x+rect.w>0&&rect.y+rect.h>0;

/** Masks use actual projected solid spheres, excluding rings and a body's own
 * surface. A hidden body can still have a completely visible outward label. */
export const foregroundBodies=(body:LabelBody,solids:LabelBody[])=>
  solids.filter(s=>s.id!==body.id&&s.r>0&&s.z<body.z-1e-8);

/** Cut holes only where a foreground sphere intersects this text rectangle.
 * Intersecting outside-circle alpha masks correctly hide the UNION of circles,
 * including overlapping silhouettes. Only the limb gets subpixel antialiasing;
 * neither the whole label's opacity nor its position changes. */
export function labelMask(rect:LabelRect,foreground:LabelBody[]):string {
  return foreground.filter(s=>Math.hypot(s.x-Math.max(rect.x,Math.min(s.x,rect.x+rect.w)),
    s.y-Math.max(rect.y,Math.min(s.y,rect.y+rect.h)))<s.r+.4)
    .map(s=>`radial-gradient(circle at ${(s.x-rect.x).toFixed(3)}px ${(s.y-rect.y).toFixed(3)}px, transparent ${Math.max(0,s.r-.4).toFixed(3)}px, #000 ${(s.r+.4).toFixed(3)}px)`)
    .join(', ')||'none';
}

/** CSS alpha masks do not change HTML hit testing. Route a click in a masked
 * hole to the visible foreground world instead of the invisible label. */
export function foregroundBodyAt(point:{x:number;y:number},foreground:LabelBody[]):LabelBody|undefined {
  return foreground.filter(s=>Math.hypot(point.x-s.x,point.y-s.y)<s.r)
    .sort((a,b)=>a.z-b.z||a.id.localeCompare(b.id))[0];
}

type LabelLine={start:{x:number;y:number};end:{x:number;y:number}};
/** Subtract the union of sphere intersections from a leader. This produces
 * disjoint visible segments without even-odd holes revealing circle overlaps. */
export function visibleLeaderSegments(line:LabelLine,foreground:LabelBody[]):LabelLine[] {
  const dx=line.end.x-line.start.x,dy=line.end.y-line.start.y,a=dx*dx+dy*dy;
  if(!a)return [];
  const covered: [number,number][]=[];
  for(const s of foreground){
    const x=line.start.x-s.x,y=line.start.y-s.y,b=2*(x*dx+y*dy),c=x*x+y*y-s.r*s.r;
    const discriminant=b*b-4*a*c;
    if(discriminant<=0)continue;
    const root=Math.sqrt(discriminant),lo=Math.max(0,(-b-root)/(2*a)),hi=Math.min(1,(-b+root)/(2*a));
    if(hi>lo)covered.push([lo,hi]);
  }
  const at=(t:number)=>({x:line.start.x+dx*t,y:line.start.y+dy*t});
  const visible:LabelLine[]=[];let cursor=0;
  for(const [lo,hi] of covered.sort((a,b)=>a[0]-b[0])){
    if(lo>cursor)visible.push({start:at(cursor),end:at(lo)});
    cursor=Math.max(cursor,hi);
    if(cursor>=1)break;
  }
  if(cursor<1)visible.push({start:at(cursor),end:at(1)});
  return visible;
}
