/** A square kilometre has the same size on either axis. Span is half the
 * horizontal field in pair-separation units, fixed throughout a replay. */
export const CLOSEUP_PLOT={x:84,y:56,w:552,h:240};
export const launchCloseupSpan=(offsetPercent:number)=>Math.max(.001,Math.abs(offsetPercent)/100*6);
export const clampCloseupSpan=(span:number)=>Math.max(1e-5,Math.min(16,span));
export function closeupPosition(state:{x:number;y:number},origin:{x:number;y:number},span:number){
  const p=CLOSEUP_PLOT,cx=p.x+p.w/2,cy=p.y+p.h/2,scale=p.w/(2*span);
  const dx=(state.x-origin.x)*scale,dy=-(state.y-origin.y)*scale;
  const edge=Math.max(1,Math.abs(dx)/(p.w/2),Math.abs(dy)/(p.h/2));
  return {x:cx+dx,y:cy+dy,edgeX:cx+dx/edge,edgeY:cy+dy/edge,outside:edge>1,angle:Math.atan2(dy,dx)*180/Math.PI};
}
export function fitCloseupSpan(paths:{states:readonly {x:number;y:number}[];origin:{x:number;y:number}}[]){
  const aspect=CLOSEUP_PLOT.w/CLOSEUP_PLOT.h;
  let extent=.001;
  for(const {states,origin} of paths)for(const p of states)extent=Math.max(extent,Math.abs(p.x-origin.x),Math.abs(p.y-origin.y)*aspect);
  return clampCloseupSpan(extent*1.15);
}
