import { lagrangePoints, massFraction, probeStateAt, probeDeparture, type ProbeRun, type ProbeState } from '../lagrange-model.ts';
import { WORLD_ART } from '../world-art.ts';
import { helpAttrs } from './science-help.ts';
import { n, number, plotGrid } from './science-lab-ui.ts';
import type { LagrangeOptions, LagrangeSession, LagrangeFrame } from './lagrange-session.ts';
import { LAGRANGE_SYSTEMS } from '../lagrange-model.ts';
import { CLOSEUP_PLOT, closeupPosition, fitCloseupSpan } from './lagrange-closeup.ts';

const TAU=2*Math.PI;
export const orbitCoordinates=(x:number,y:number,time:number):[number,number]=>[x*Math.cos(time)-y*Math.sin(time),x*Math.sin(time)+y*Math.cos(time)];
export { probeDeparture } from '../lagrange-model.ts';
const endTime=(run:ProbeRun)=>run.samples[run.samples.length-1].time;
const niceMaximum=(value:number)=>{const unit=10**Math.floor(Math.log10(Math.max(value,.01)));return Math.ceil(value/unit)*unit;};
const stars=Array.from({length:54},(_,i)=>`<circle cx="${(i*173+31)%710}" cy="${(i*i*37+17)%455}" r="${i%7===0?1.5:.7}" opacity="${.18+i%5*.1}"/>`).join('');
let closeupSequence=0;
const km=(value:number)=>Math.abs(value)>=1e5?value.toExponential(1):number(value,Math.abs(value)<10?2:0);
/** Charon has no launch-world cartoon; keep it a schematic moon, rather than
 * failing the whole pair's graph or borrowing a different world's portrait. */
export function lagrangeBodyArtwork(id:string,size:number){
  const art=WORLD_ART[id];
  return art?`<image href="${art.full}" x="${-size}" y="${-size}" width="${size*2}" height="${size*2}"/>`:
    `<circle r="${size}" fill="#a8a4a3" stroke="#d4d4cb" stroke-width="1"/><ellipse cx="${-size*.3}" cy="${-size*.25}" rx="${size*.32}" ry="${size*.23}" fill="#777b7c"/><circle cx="${size*.3}" cy="${size*.25}" r="${size*.18}" fill="#8b8b8a"/>`;
}

/** The flight view and time chart use the same recorded states. The inertial
 * camera rotates each state at its own time; it never invents a new orbit. */
export function createLagrangeView(root:HTMLElement){
  const find=<T extends Element=Element>(selector:string)=>root.querySelector<T>(selector)!;
  let options:LagrangeOptions,run:ProbeRun,pinned:LagrangeSession['pinned'],pinnedRun:ProbeRun|undefined,mode:LagrangeFrame='orbit';
  let mu=0,scale=140,chartMax=1,chartOrbits=6,point={x:0,y:0,stable:false};
  let closeupSpan=.006,distanceKm=1;
  const clipId=`lagrange-closeup-${++closeupSequence}`;
  let pinnedPoint={x:0,y:0};
  let points:ReturnType<typeof lagrangePoints>=[];
  const map=(p:{x:number;y:number},time:number):[number,number]=>{const [x,y]=mode==='orbit'?orbitCoordinates(p.x,p.y,time):[p.x,p.y];return [360+x*scale,248-y*scale];};
  const trace=(r:ProbeRun,time:number,project:(p:Pick<ProbeState,'x'|'y'|'time'>)=>[number,number],trail=false)=>{
    const start=trail?Math.max(0,time-TAU):0;
    const samples=r.samples.filter(s=>s.time>=start&&s.time<time).map(s=>s as Pick<ProbeState,'x'|'y'|'time'>);samples.push(probeStateAt(r,time));
    return samples.map((s,i)=>{const [x,y]=project(s);return `${i?'L':'M'}${n(x)} ${n(y)}`;}).join('');
  };
  const chart=(state:Pick<ProbeState,'x'|'y'|'time'>,origin:{x:number;y:number}):[number,number]=>[76+state.time/TAU/chartOrbits*608,192-probeDeparture(state,origin)/chartMax*137];
  const local=(state:{x:number;y:number},origin:{x:number;y:number}=point):[number,number]=>{const p=closeupPosition(state,origin,closeupSpan);return [p.x,p.y];};
  function fullCloseupSpan(){return fitCloseupSpan([{states:run.samples,origin:point},...(pinnedRun?[{states:pinnedRun.samples,origin:pinnedPoint}]:[])]);}
  function configure(o:LagrangeOptions,r:ProbeRun,pin:LagrangeSession['pinned'],pr:ProbeRun|undefined,frame:LagrangeFrame,span:number){
    options=o;run=r;pinned=pin;pinnedRun=pr;mode=frame;
    const pair=LAGRANGE_SYSTEMS.find(s=>s.id===o.system)!;
    closeupSpan=span;distanceKm=pair.distanceKm;
    mu=o.custom?1/(1+10**o.ratioLog):massFraction(pair);
    points=lagrangePoints(mu);point=points.find(p=>p.name===o.point)!;
    if(pin){const pair=LAGRANGE_SYSTEMS.find(s=>s.id===pin.options.system)!;const pm=pin.options.custom?1/(1+10**pin.options.ratioLog):massFraction(pair);pinnedPoint=lagrangePoints(pm).find(p=>p.name===pin.options.point)!;}
    const radialExtent=(r:ProbeRun)=>r.samples.reduce((max,s)=>Math.max(max,Math.hypot(s.x,s.y)),0);
    const departureExtent=(r:ProbeRun,p:{x:number;y:number})=>r.samples.reduce((max,s)=>Math.max(max,probeDeparture(s,p)),0);
    const extent=Math.max(1.35,radialExtent(r),pr?radialExtent(pr):0);
    scale=184/(extent*1.05);
    chartMax=niceMaximum(Math.max(.02,departureExtent(r,point),pr?departureExtent(pr,pinnedPoint):0)*1.08);
    chartOrbits=Math.max(o.orbits,pin?.options.orbits??0);
    const primarySize=pair.primary==='sun'?48:34,secondarySize=pair.secondary==='moon'||pair.secondary==='charon'?16:24;
    find('[data-lagrange-map]').innerHTML=`<title>${pair.label}: ${o.point}, ${frame==='orbit'?'orbital':'rotating'} view</title><desc>The pictured worlds are enlarged. The probe and balance points use the calculated positions. The trail shows the most recent pair orbit.</desc>
      <g class="lagrange-stars">${stars}</g><circle cx="360" cy="248" r="${n((1-mu)*scale)}" class="lagrange-space-orbit"/><circle cx="360" cy="248" r="${n(mu*scale)}" class="lagrange-space-orbit"/>
      <path data-triangle class="lagrange-triangle"/><g tabindex="0" role="img" aria-label="Shared centre of mass" ${helpAttrs('Shared centre of mass','Both worlds orbit this point, called the barycentre. It lies much closer to the heavier world. In the rotating view the whole camera turns around it.')}><circle cx="360" cy="248" r="10" fill="transparent"/><path d="M353 248h14m-7-7v14" class="lagrange-barycentre"/></g>
      <path data-probe-pinned-map class="science-pinned-curve"/><path data-probe-map-path class="lagrange-probe-trail"/>
      <g data-primary-world tabindex="0" ${helpAttrs('The primary world','The heavier world. Both bodies travel around their shared centre of mass, although the primary’s motion can be very small. Its picture is enlarged for clarity.')}>${lagrangeBodyArtwork(pair.primary,primarySize)}<text y="${-primarySize-12}" text-anchor="middle">${o.custom?'Primary':pair.label.split('–')[0]}</text></g>
      <g data-secondary-world tabindex="0" ${helpAttrs('The companion world','The lighter world. L4 leads and L5 trails it by 60 degrees in the ideal circular orbit. Its picture is enlarged; contact in the physics uses its actual model radius.')}>${lagrangeBodyArtwork(pair.secondary,secondarySize)}<text y="${-secondarySize-12}" text-anchor="middle">${o.custom?'Companion':pair.label.split('–')[1]}</text></g>
      ${points.map(p=>`<g data-point="${p.name}" role="button" tabindex="0" aria-label="Choose ${p.name}, ${p.stable?'linearly stable':'unstable'}" aria-pressed="${p.name===o.point}" class="lagrange-space-point ${p.stable?'is-stable':'is-unstable'} ${p.name===o.point?'is-selected':''}" ${helpAttrs(p.name,`${p.name==='L1'?'Between the worlds.':p.name==='L2'?'Beyond the companion.':p.name==='L3'?'Beyond the primary, opposite the companion.':p.name==='L4'?'Leads the companion by 60 degrees.':'Trails the companion by 60 degrees.'} ${p.stable?'Small disturbances can remain nearby in this circular model.':'Small disturbances can grow in this circular model.'} Select to launch from here.`)}><circle r="16" class="lagrange-point-hit"/><circle r="${p.name===o.point?11:6}" class="lagrange-point-ring"/><circle r="3" class="lagrange-point-core"/><text text-anchor="middle" y="${p.name==='L1'?39:p.name==='L2'?-27:p.name==='L4'?-21:28}">${p.name}</text></g>`).join('')}
      <g data-probe-map-dot class="lagrange-probe-craft"><circle r="11" class="lagrange-probe-halo"/><path d="M-5-5h10v10H-5Z"/><path d="M-8-4h-12v8h12m16-8h12v8H8" class="lagrange-solar-panels"/><path d="M0-6v-7m-4 0h8"/></g>
      <text x="24" y="36" class="lagrange-stage-kicker">${o.custom?'CUSTOM MASSES':pair.label.toUpperCase()} / ${frame==='orbit'?'WATCH THE WORLDS MOVE':'RIDE WITH THE PAIR'}</text>
      <text x="24" y="446" class="lagrange-stage-note">${frame==='orbit'?'Balance points travel with the orbiting worlds.':'The camera turns with the worlds; balance points stand still.'}</text>`;
    find('[data-lagrange-detail]').innerHTML=`<title>Distance from the balance point over time</title><desc>Vertical: departure as a percentage of pair separation. Horizontal: number of pair orbits. The faint curve is the complete prediction, teal is the replay so far, and orange is pinned.</desc>
      <text x="24" y="27" class="science-svg-kicker">DEPARTURE FROM THE BALANCE POINT</text>${plotGrid(76,55,608,137)}
      ${[0,.5,1].map(f=>`<text x="64" y="${n(197-137*f)}" text-anchor="end">${number(chartMax*f,chartMax<1?3:1)}%</text>`).join('')}
      ${[0,.5,1].map(f=>`<text x="${76+608*f}" y="219" text-anchor="middle">${number(chartOrbits*f,1)}</text>`).join('')}
      <text x="380" y="249" text-anchor="middle">Elapsed time / pair orbits</text>
      <path d="${trace(r,endTime(r),s=>chart(s,point))}" class="lagrange-prediction-curve"/>
      <path data-probe-pinned-detail class="science-pinned-curve"/><path data-probe-detail-path class="science-current-curve"/><path data-chart-cursor class="lagrange-chart-cursor"/><circle data-probe-detail-dot r="5" class="science-probe"/>`;
    const p=CLOSEUP_PLOT,halfY=span*p.h/p.w;
    find('[data-lagrange-closeup]').innerHTML=`<title>${pair.label} ${o.point}: motion relative to the equilibrium</title><desc>The gold crosshair is fixed at the actual equilibrium in the rotating frame. Equal-scale kilometre axes show the probe's displacement. The scale remains fixed during replay.</desc>
      <defs><clipPath id="${clipId}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/></clipPath></defs>
      <text x="24" y="26" class="lagrange-stage-kicker">${o.point} CLOSE-UP / CAMERA TURNS WITH THE PAIR</text>
      <text x="${p.x}" y="46" class="lagrange-local-axis">Δy / km · in the orbital plane</text>
      ${plotGrid(p.x,p.y,p.w,p.h)}<path d="M360 ${p.y}V${p.y+p.h}M${p.x} 176H${p.x+p.w}" class="lagrange-local-zero"/>
      ${[-1,0,1].map(f=>`<text x="${360+p.w/2*f}" y="320" text-anchor="middle" class="lagrange-local-axis">${km(f*span*distanceKm)}</text><text x="72" y="${182-p.h/2*f}" text-anchor="end" class="lagrange-local-axis">${km(f*halfY*distanceKm)}</text>`).join('')}
      <text x="360" y="352" text-anchor="middle" class="lagrange-local-axis">Δx / km · along the line between the worlds</text>
      <g clip-path="url(#${clipId})">
        ${[{x:-mu,y:0,r:pair.primaryRadiusKm},{x:1-mu,y:0,r:pair.secondaryRadiusKm}].map(body=>{const [x,y]=local(body);return `<circle cx="${n(x)}" cy="${n(y)}" r="${n(body.r/distanceKm*p.w/(2*span))}" class="lagrange-local-body"/>`;}).join('')}
        <path d="${trace(r,endTime(r),s=>local(s))}" class="lagrange-local-prediction"/>
        <path data-local-pinned class="science-pinned-curve"/><path data-local-trail class="lagrange-probe-trail"/>
        <circle cx="${n(local(r.samples[0])[0])}" cy="${n(local(r.samples[0])[1])}" r="7" class="lagrange-release-marker"/>
        <circle data-local-probe r="6" class="lagrange-local-probe"/>
      </g><g class="lagrange-local-equilibrium"><circle cx="360" cy="176" r="9"/><path d="M342 176h36m-18-18v36"/><text x="360" y="148" text-anchor="middle">${o.point}</text></g>
      <path data-local-edge d="M-13-7 0 0-13 7Z" class="lagrange-local-edge"/>`;
    find<SVGElement>('[data-lagrange-map]').style.display=frame==='closeup'?'none':'';
    find<SVGElement>('[data-lagrange-closeup]').toggleAttribute('hidden',frame!=='closeup');
    root.querySelectorAll<HTMLElement>('[data-closeup-only]').forEach(node=>node.hidden=frame!=='closeup');
    root.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.frame===frame)));
    find('[data-flight-point]').textContent=`${o.point} · ${point.stable?'stable to small nudges':'unstable balance'}`;
    find('[data-prediction-maximum]').textContent=`${number(departureExtent(r,point),3)}%`;
  }
  function draw(time:number){
    const state=probeStateAt(run,time);
    if(mode!=='closeup'){
    const move=(selector:string,p:{x:number;y:number})=>{const [x,y]=map(p,time);find(selector).setAttribute('transform',`translate(${n(x)} ${n(y)})`);};
    move('[data-primary-world]',{x:-mu,y:0});move('[data-secondary-world]',{x:1-mu,y:0});
    for(const p of points)move(`[data-point="${p.name}"]`,p);
    const triangle=[{x:-mu,y:0},points[3],{x:1-mu,y:0},points[4]].map((p,i)=>{const [x,y]=map(p,time);return `${i?'L':'M'}${n(x)} ${n(y)}`;}).join('')+'Z';find('[data-triangle]').setAttribute('d',triangle);
    move('[data-probe-map-dot]',state);
    find('[data-probe-map-path]').setAttribute('d',trace(run,time,s=>map(s,s.time),true));
    const comparable=pinned&&pinned.options.system===options.system&&pinned.options.custom===options.custom&&(!options.custom||pinned.options.ratioLog===options.ratioLog);
    find('[data-probe-pinned-map]').setAttribute('d',pinnedRun&&pinned&&comparable?trace(pinnedRun,pinned.time,s=>map(s,s.time),true):'');
    }
    find('[data-probe-detail-path]').setAttribute('d',trace(run,time,s=>chart(s,point)));
    find('[data-probe-pinned-detail]').setAttribute('d',pinnedRun&&pinned?trace(pinnedRun,pinned.time,s=>chart(s,pinnedPoint)):'');
    if(mode==='closeup'){
    const position=closeupPosition(state,point,closeupSpan),probe=find('[data-local-probe]');
    probe.setAttribute('cx',String(n(position.x)));probe.setAttribute('cy',String(n(position.y)));
    find('[data-local-trail]').setAttribute('d',trace(run,time,s=>local(s)));
    find('[data-local-pinned]').setAttribute('d',pinnedRun&&pinned?trace(pinnedRun,pinned.time,s=>local(s,pinnedPoint)):'');
    const edge=find<SVGElement>('[data-local-edge]');edge.style.display=position.outside?'':'none';edge.setAttribute('transform',`translate(${n(position.edgeX)} ${n(position.edgeY)}) rotate(${n(position.angle)})`);
    find('[data-closeup-status]').textContent=position.outside?`Probe outside this close-up · ${km(probeDeparture(state,point)/100*distanceKm)} km from ${options.point}. Use “Fit full drift” to follow it.`:'Gold: equilibrium · open circle: release · teal: probe & trail · dashed: prediction';
    }
    const [x,y]=chart(state,point);find('[data-probe-detail-dot]').setAttribute('cx',String(x));find('[data-probe-detail-dot]').setAttribute('cy',String(y));find('[data-chart-cursor]').setAttribute('d',`M${x} 55V192`);
    find('[data-flight-distance]').textContent=mode==='closeup'?`${km(probeDeparture(state,point)/100*distanceKm)} km`:`${number(probeDeparture(state,point),3)}%`;
    find('[data-flight-orbits]').textContent=`${number(time/TAU,2)} orbits`;
  }
  return {configure,draw,fullCloseupSpan};
}
