import { dop853Trial, denseValue, type DenseStep } from './numerics/dop853.ts';

/** Circular restricted three-body model, in barycentric rotating coordinates.
 * Distance between primaries = 1, total GM = 1, angular speed = 1.
 * JPL mass parameters and the approximation's limits: docs/gravity-and-optics.md.
 */
export type LagrangeName='L1'|'L2'|'L3'|'L4'|'L5';
export interface LagrangePoint {name:LagrangeName;x:number;y:number;stable:boolean}
export interface LagrangeSystem {
  id:string;primary:string;secondary:string;label:string;
  primaryGM:number;secondaryGM:number;distanceKm:number;
  primaryRadiusKm:number;secondaryRadiusKm:number;
}
// km³/s², body (rather than whole satellite-system) masses from JPL/NAIF
// gm_de440.tpc, checked 19 October 2026. Ganymede: JUP365; Charon: PLU043.
export const BODY_GM:Record<string,number>={
  sun:132712440041.27942,mercury:22031.8685514,venus:324858.592,
  earth:398600.43550702266,moon:4902.80011845755,mars:42828.37362069909,
  jupiter:126686531.9003704,ganymede:9887.832752719638,saturn:37931206.23436167,
  uranus:5793951.256527211,neptune:6835103.145462294,pluto:869.6138177608748,charon:105.8799888601881,
};
const radii:Record<string,number>={sun:695700,mercury:2439.7,venus:6051.8,earth:6371,moon:1737.4,
  mars:3389.5,jupiter:69911,ganymede:2631.2,saturn:58232,uranus:25362,neptune:24622,pluto:1188.3,charon:606};
const title=(id:string)=>id[0].toUpperCase()+id.slice(1);
const system=(primary:string,secondary:string,distanceKm:number):LagrangeSystem=>({
  id:`${primary}-${secondary}`,primary,secondary,label:`${title(primary)}–${title(secondary)}`,
  primaryGM:BODY_GM[primary],secondaryGM:BODY_GM[secondary],distanceKm,
  primaryRadiusKm:radii[primary],secondaryRadiusKm:radii[secondary],
});
export const LAGRANGE_SYSTEMS:LagrangeSystem[]=[
  ...Object.entries({mercury:.38709843,venus:.72332102,earth:1.00000018,mars:1.52371243,
    jupiter:5.20248019,saturn:9.54149883,uranus:19.18797948,neptune:30.06952752,pluto:39.48686035})
    .map(([id,a])=>system('sun',id,a*149597870.7)),
  system('earth','moon',384400),system('jupiter','ganymede',1070400),system('pluto','charon',19596),
];
export const massFraction=(system:Pick<LagrangeSystem,'primaryGM'|'secondaryGM'>)=>system.secondaryGM/(system.primaryGM+system.secondaryGM);
export const TRIANGULAR_STABILITY_LIMIT=(1-Math.sqrt(23/27))/2;

export function rotatingAcceleration(mu:number,x:number,y:number,vx=0,vy=0):[number,number] {
  const dx=x+mu,ex=x-1+mu,r1=Math.hypot(dx,y),r2=Math.hypot(ex,y);
  return [x-(1-mu)*dx/r1**3-mu*ex/r2**3+2*vy,
    y-(1-mu)*y/r1**3-mu*y/r2**3-2*vx];
}
function root(mu:number,lo:number,hi:number){
  for(let i=0;i<100;i++){
    const x=(lo+hi)/2;if(x===lo||x===hi)return x;
    if(rotatingAcceleration(mu,x,0)[0]>0)hi=x;else lo=x;
  }
  return (lo+hi)/2;
}
/** Solve the collinear force equations directly, without small-mass Hill
 * approximations. Brackets never cross either body's singularity. */
export function lagrangePoints(mu:number):LagrangePoint[] {
  if(!(mu>=1e-12&&mu<=.5))throw new RangeError('Secondary mass fraction must be between 1e-12 and 0.5.');
  const epsilon=1e-13,stable=mu<TRIANGULAR_STABILITY_LIMIT;
  return [
    {name:'L1',x:root(mu,-mu+epsilon,1-mu-epsilon),y:0,stable:false},
    {name:'L2',x:root(mu,1-mu+epsilon,2),y:0,stable:false},
    {name:'L3',x:root(mu,-2,-mu-epsilon),y:0,stable:false},
    {name:'L4',x:.5-mu,y:Math.sqrt(3)/2,stable},
    {name:'L5',x:.5-mu,y:-Math.sqrt(3)/2,stable},
  ];
}
export type Vec3=[number,number,number];
const difference=(a:Vec3,b:Vec3)=>a.map((n,i)=>n-b[i]) as Vec3;
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec3):Vec3=>{const r=Math.hypot(...v);if(!r)throw new RangeError('An orbital direction is required.');return v.map(n=>n/r) as Vec3;};
export interface LagrangeFrame {
  primary:Vec3;secondary:Vec3;relativeVelocity:Vec3;
  drawnPrimary:Vec3;drawnSecondary:Vec3;evenSeparation:number;evenClearance:number;
}
/** Use the actual orbital normal, so +y (L4) leads motion in inclined planes.
 * True scale uses the circular model scaled to the instantaneous separation.
 * At Even spacing, L1/L2 offsets alone may be enlarged to clear drawn bodies. */
export function placedLagrangePoints(mu:number,frame:LagrangeFrame,amount:number){
  const delta=difference(frame.secondary,frame.primary),distance=Math.hypot(...delta),u=unit(delta);
  const v=unit(cross(unit(cross(delta,frame.relativeVelocity)),u));
  const span=Math.hypot(...difference(frame.drawnSecondary,frame.drawnPrimary));
  return lagrangePoints(mu).map(point=>{
    let position:Vec3;
    if(point.name==='L1'||point.name==='L2'){
      const fraction=Math.abs(point.x+mu-1);
      const evenOffset=Math.max(fraction*frame.evenSeparation,frame.evenClearance);
      const offset=distance*fraction*(1-amount)+evenOffset*amount;
      const sign=point.name==='L1'?-1:1;
      position=frame.drawnSecondary.map((n,i)=>n+sign*u[i]*offset) as Vec3;
    }else position=frame.drawnPrimary.map((n,i)=>n+span*(u[i]*(point.x+mu)+v[i]*point.y)) as Vec3;
    const companionDistance=distance*Math.hypot(point.x+mu-1,point.y);
    return {...point,position,companionDistance};
  });
}

export interface ProbeState {time:number;x:number;y:number;vx:number;vy:number}
export const jacobiConstant=(mu:number,s:Pick<ProbeState,'x'|'y'|'vx'|'vy'>)=>
  s.x*s.x+s.y*s.y+2*(1-mu)/Math.hypot(s.x+mu,s.y)+2*mu/Math.hypot(s.x-1+mu,s.y)-s.vx*s.vx-s.vy*s.vy;
export function stepProbe(mu:number,s:ProbeState,dt:number):ProbeState {
  const derivative=(v:number[])=>{const [ax,ay]=rotatingAcceleration(mu,v[0],v[1],v[2],v[3]);return [v[2],v[3],ax,ay];};
  const values=[s.x,s.y,s.vx,s.vy],a=derivative(values);
  const b=derivative(values.map((v,i)=>v+a[i]*dt/2)),c=derivative(values.map((v,i)=>v+b[i]*dt/2));
  const d=derivative(values.map((v,i)=>v+c[i]*dt));
  const next=values.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);
  return {time:s.time+dt,x:next[0],y:next[1],vx:next[2],vy:next[3]};
}
export interface ProbeOptions {mu:number;point:LagrangeName;offset:number;kick:number;orbits:number;primaryRadius?:number;secondaryRadius?:number;distanceKm?:number}
export interface ProbeSegment {solution:DenseStep;originX:number}
export interface ProbeRun {
  samples:ProbeState[];segments:ProbeSegment[];end:'complete'|'primary'|'secondary'|'left-view'|'limit'|'accuracy';
  initialJacobi:number;maxJacobiError:number;maxPositionDisagreement:number;positionTolerance:number;acceptedSteps:number;rejectedSteps:number;
}
const asState=(time:number,v:readonly number[]):ProbeState=>({time,x:v[0],y:v[1],vx:v[2],vy:v[3]});
export const probeDeparture=(state:Pick<ProbeState,'x'|'y'>,point:{x:number;y:number})=>Math.hypot(state.x-point.x,state.y-point.y)*100;
/** Replay uses the solver's seventh-order continuous solution, including
 * velocities. Never linearly interpolate the sparse drawing vertices. */
export function probeStateAt(run:Pick<ProbeRun,'samples'|'segments'>,time:number):ProbeState {
  const first=run.samples[0],last=run.samples[run.samples.length-1];
  if(time<=first.time)return {...first};if(time>=last.time)return {...last};
  let lo=0,hi=run.segments.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(run.segments[mid].solution.end<time)lo=mid+1;else hi=mid;}
  const segment=run.segments[lo],value=denseValue(segment.solution,time);value[0]+=segment.originX;
  return asState(time,value);
}
function* integrateProbe(options:ProbeOptions,initial:ProbeState,rtol:number,atol:number,maxStep:number){
  const {mu}=options,radius1=options.primaryRadius??.015,radius2=options.secondaryRadius??.005;
  const origin=lagrangePoints(mu).find(p=>p.name===options.point)!;
  const segments:ProbeSegment[]=[],samples=[initial];
  let state=initial,h=.01,end:ProbeRun['end']='complete',acceptedSteps=0,rejectedSteps=0;
  // Integrate distance from the nearer world, preserving small coordinates
  // during an encounter (e.g. Pluto's tiny radius at 40 AU). Reconstructing
  // x≈1 and subtracting 1 at every RK stage destroys those significant bits.
  let companion=Math.hypot(initial.x-1+mu,initial.y)<Math.hypot(initial.x+mu,initial.y);
  const centre=()=>companion?1-mu:-mu;
  let local=[initial.x-centre(),initial.y,initial.vx,initial.vy];
  const finish=options.orbits*2*Math.PI;
  const distances=(v:readonly number[])=>[Math.hypot(v[0]+(companion?1:0),v[1]),Math.hypot(v[0]-(companion?0:1),v[1])];
  const derivative=(v:readonly number[])=>{
    const a=v[0]+(companion?1:0),b=v[0]-(companion?0:1),[r1,r2]=distances(v);
    return [v[2],v[3],v[0]+centre()-(1-mu)*a/r1**3-mu*b/r2**3+2*v[3],v[1]-(1-mu)*v[1]/r1**3-mu*v[1]/r2**3-2*v[2]];
  };
  const boundaries=(s:ProbeState)=>[Math.hypot(s.x+mu,s.y)-radius1,Math.hypot(s.x-1+mu,s.y)-radius2,4-Math.hypot(s.x,s.y)];
  const endings=['primary','secondary','left-view'] as const;
  const initialBoundary=boundaries(initial).findIndex(d=>d<=0);
  if(initialBoundary>=0)return {samples,segments,end:endings[initialBoundary],acceptedSteps,rejectedSteps};
  for(let attempts=0;state.time<finish;attempts++){
    if(attempts>=100000){end='limit';break;}
    const [r1,r2]=distances(local),speed=Math.hypot(state.vx,state.vy);
    // Limit travel and local orbital angle as well as the truncation error, so
    // an accepted step cannot jump through a small body's model surface.
    h=Math.min(h,maxStep,.2*Math.sqrt(r1**3/(1-mu)),.2*Math.sqrt(r2**3/mu),.2*Math.min(r1,r2)/Math.max(speed,1e-20),finish-state.time);
    if(!(h>8*Number.EPSILON*Math.max(1,state.time))){end='limit';break;}
    const trial=dop853Trial(derivative,local,h,rtol,atol);
    if(!Number.isFinite(trial.error)||!trial.value.every(Number.isFinite)){h*=.1;rejectedSteps++;continue;}
    if(trial.error>1){h*=Math.max(.1,.9*trial.error**(-1/8));rejectedSteps++;continue;}
    const segment=trial.dense(state.time),originX=centre();
    const global=(time:number)=>{const v=denseValue(segment,time);v[0]+=originX;return asState(time,v);};
    const localBounds=(v:readonly number[])=>{const [r1,r2]=distances(v);return [r1-radius1,r2-radius2,4-Math.hypot(v[0]+originX,v[1])];};
    const next=asState(segment.end,[trial.value[0]+originX,...trial.value.slice(1)]),limits=localBounds(trial.value);
    let eventTime=segment.end,eventEnd:ProbeRun['end']|undefined;
    for(let i=0;i<limits.length;i++)if(limits[i]<=0){
      let low=segment.start,high=segment.end;
      for(let j=0;j<48;j++){const mid=(low+high)/2;if(mid===low||mid===high)break;if(localBounds(denseValue(segment,mid))[i]>0)low=mid;else high=mid;}
      if(high<=eventTime){eventTime=high;eventEnd=endings[i];}
    }
    segments.push({solution:segment,originX});acceptedSteps++;
    // Retain the adaptive mesh, with a dense midpoint on every accepted step.
    // Close approaches thus get many more drawing vertices than quiet arcs.
    const midpoint=(state.time+eventTime)/2,vertices=[global(midpoint)];
    const slope=(s:ProbeState)=>(s.x-origin.x)*s.vx+(s.y-origin.y)*s.vy;
    const terminal=eventEnd?global(eventTime):next;
    // Include radial-distance maxima, rather than under-reporting the largest
    // departure merely because the peak falls between drawing vertices.
    if(slope(state)>0&&slope(terminal)<0){
      let low=state.time,high=eventTime;
      for(let i=0;i<40;i++){const mid=(low+high)/2;if(slope(global(mid))>0)low=mid;else high=mid;}
      const time=(low+high)/2;vertices.push(global(time));
    }
    samples.push(...vertices.sort((a,b)=>a.time-b.time));
    state=terminal;samples.push(state);
    yield {samples,segments,end:eventEnd??'complete',acceptedSteps,rejectedSteps};
    if(eventEnd){end=eventEnd;break;}
    local=trial.value;
    const [newR1,newR2]=distances(local);
    if(companion&&newR1<newR2*.5){local[0]+=1;companion=false;}
    else if(!companion&&newR2<newR1*.5){local[0]-=1;companion=true;}
    h*=trial.error===0?5:Math.max(.2,Math.min(5,.9*trial.error**(-1/8)));
  }
  return {samples,segments,end,acceptedSteps,rejectedSteps};
}
/** Check the trajectory itself against a tighter, independently stepped run.
 * Jacobi conservation alone cannot certify a trajectory in a chaotic system.
 * Stop a long sensitive run before its numerical solutions visibly disagree. */
export function simulateLagrangeProbe(options:ProbeOptions):ProbeRun {
  const {mu,offset,kick,orbits}=options;
  const point=lagrangePoints(mu).find(p=>p.name===options.point);
  if(!point||![offset,kick,orbits].every(Number.isFinite)||Math.abs(offset)>.1||Math.abs(kick)>.1||!(orbits>0&&orbits<=20)||[options.primaryRadius,options.secondaryRadius,options.distanceKm].some(v=>v!==undefined&&(!Number.isFinite(v)||v<=0)))throw new RangeError('Invalid probe experiment.');
  const initial:ProbeState={time:0,x:point.x+offset,y:point.y,vx:0,vy:kick};
  const initialJacobi=jacobiConstant(mu,initial),positionTolerance=Math.max(1e-12,Math.min(1e-8,.01/(options.distanceKm??1)));
  // An exact, unperturbed equilibrium is an analytic solution. Returning that
  // solution avoids amplifying the final floating-point root residual.
  if(offset===0&&kick===0&&Math.hypot(initial.x+mu,initial.y)>(options.primaryRadius??.015)&&Math.hypot(initial.x-1+mu,initial.y)>(options.secondaryRadius??.005)){
    const final={...initial,time:orbits*2*Math.PI};
    const segment:DenseStep={start:0,end:final.time,initial:[initial.x,initial.y,0,0],coefficients:Array.from({length:7},()=>[0,0,0,0])};
    return {samples:[initial,final],segments:[{solution:segment,originX:0}],end:'complete',initialJacobi,maxJacobiError:0,maxPositionDisagreement:0,positionTolerance,acceptedSteps:0,rejectedSteps:0};
  }
  // Advance the two integrations together. A rejected, sensitive future is
  // never computed to the requested duration just to discard it afterwards.
  const primaryIterator=integrateProbe(options,initial,1e-13,1e-15,.1),checkIterator=integrateProbe(options,initial,2.3e-14,2e-16,.05);
  let primaryNext=primaryIterator.next(),checkNext=checkIterator.next(),primary=primaryNext.value,check=checkNext.value;
  let maxPositionDisagreement=0,safeTime=0;
  let inspected=0;
  const disagreement=(time:number)=>{const a=probeStateAt(primary,time),b=probeStateAt(check,time);return Math.hypot(a.x-b.x,a.y-b.y);};
  for(;;){
    const endTime=primary.samples[primary.samples.length-1].time;
    while(!checkNext.done&&check.samples[check.samples.length-1].time<endTime){checkNext=checkIterator.next();check=checkNext.value;}
    const commonEnd=Math.min(endTime,check.samples[check.samples.length-1].time);
    for(;inspected<primary.samples.length;inspected++){
      const sample=primary.samples[inspected];if(sample.time>commonEnd)break;
      const error=disagreement(sample.time);
      if(error>positionTolerance){
        let low=safeTime,high=sample.time;
        for(let i=0;i<40;i++){const mid=(low+high)/2;if(disagreement(mid)<=positionTolerance)low=mid;else high=mid;}
        safeTime=low;primary.end='accuracy';maxPositionDisagreement=positionTolerance;break;
      }
      safeTime=sample.time;maxPositionDisagreement=Math.max(maxPositionDisagreement,error);
    }
    if(primary.end==='accuracy')break;
    if(endTime>commonEnd+1e-8){safeTime=commonEnd;primary.end='accuracy';break;}
    if(primaryNext.done)break;
    primaryNext=primaryIterator.next();primary=primaryNext.value;
  }
  if(primary.end==='accuracy'){
    const last=probeStateAt(primary,safeTime);
    primary.samples=primary.samples.filter(s=>s.time<safeTime);primary.samples.push(last);
    primary.segments=primary.segments.filter(s=>s.solution.start<safeTime);
  }
  const maxJacobiError=primary.samples.reduce((max,s)=>Math.max(max,Math.abs(jacobiConstant(mu,s)-initialJacobi)),0);
  return {...primary,initialJacobi,maxJacobiError,maxPositionDisagreement,positionTolerance};
}
