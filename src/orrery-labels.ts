export interface LabelRect { x:number; y:number; w:number; h:number }
export interface LabelPlacement { slot:number; rect:LabelRect }
export const labelsOverlap = (a:LabelRect,b:LabelRect) =>
  a.x < b.x+b.w+4 && a.x+a.w+4 > b.x && a.y < b.y+b.h+3 && a.y+a.h+3 > b.y;

/** Keep the current side while it still fits. Re-testing the first candidate
 * every frame made small moons' labels ping-pong around their parent. */
export function placeLabel(candidates:LabelRect[], occupied:LabelRect[], width:number, height:number,
  previous?:LabelPlacement):LabelPlacement|undefined {
  const fits = (r:LabelRect) => r.x>=10 && r.y>=10 && r.x+r.w<=width-10 && r.y+r.h<=height-12 &&
    !occupied.some(o=>labelsOverlap(r,o));
  const slot = previous && candidates[previous.slot] && fits(candidates[previous.slot])
    ? previous.slot : candidates.findIndex(fits);
  return slot < 0 ? undefined : {slot,rect:candidates[slot]};
}

/** A bounded ease on a necessary side change, with no frame-rate dependency. */
export function easeLabel(previous:LabelRect|undefined, next:LabelRect, seconds:number):LabelRect {
  if(!previous)return next;
  const fraction=1-Math.exp(-Math.max(0,Math.min(seconds,.05))/.12);
  return {...next,x:previous.x+(next.x-previous.x)*fraction,y:previous.y+(next.y-previous.y)*fraction};
}
