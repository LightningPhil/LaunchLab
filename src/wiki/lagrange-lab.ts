import { LAGRANGE_SYSTEMS, lagrangePoints, massFraction, simulateLagrangeProbe, type LagrangeName, type ProbeRun } from '../lagrange-model.ts';
import { metric, number, option, output, rangeField, selectField } from './science-lab-ui.ts';
import { helpAttrs } from './science-help.ts';
import { createLagrangeView } from './lagrange-view.ts';
import { lagrangeDefaults as defaults, resetLagrangePair, type LagrangeOptions, type LagrangeSession, type LagrangeFrame } from './lagrange-session.ts';
import { launchCloseupSpan, clampCloseupSpan } from './lagrange-closeup.ts';

export type { LagrangeSession } from './lagrange-session.ts';
const systems=new Map(LAGRANGE_SYSTEMS.map(s=>[s.id,s]));
const pairFor=(o:LagrangeOptions)=>systems.get(o.system)!;
const muFor=(o:LagrangeOptions)=>o.custom?1/(1+10**o.ratioLog):massFraction(pairFor(o));
function runFor(o:LagrangeOptions):ProbeRun {
  const system=pairFor(o);
  return simulateLagrangeProbe({mu:muFor(o),point:o.point,offset:o.offsetPercent/100,kick:o.kickPercent/100,orbits:o.orbits,
    primaryRadius:system.primaryRadiusKm/system.distanceKm,secondaryRadius:system.secondaryRadiusKm/system.distanceKm,distanceKm:system.distanceKm});
}
export function lagrangeLabMarkup(){return `<section class="science-lab science-lagrange" aria-labelledby="lagrange-lab-title">
  <header class="science-lab-head"><div><p class="atlas-kicker">TRY IT / NUDGE THE BALANCE</p><h2 id="lagrange-lab-title">Will your probe stay nearby?</h2></div><span class="science-lab-badge">Orbit & balance lab</span></header>
  <div class="lagrange-mission-presets" role="group" aria-label="Suggested probe experiments"><span>CHOOSE A MISSION</span><button type="button" data-scenario="stable" ${helpAttrs('Earth–Moon L4','A small nudge at this triangular point can remain nearby. Watch it orbit with the worlds, then compare its departure graph with L1.')}>01 · Hold the balance</button><button type="button" data-scenario="unstable" ${helpAttrs('Earth–Moon L1','Use the same nudge on an unstable point between Earth and the Moon. The time graph makes the growing error easy to compare.')}>02 · Watch it drift</button><button type="button" data-scenario="charon" ${helpAttrs('Pluto–Charon L4','The companion is too massive for triangular stability. Test the same point and nudge in a different pair.')}>03 · The Charon challenge</button></div>
  <div class="science-workbench"><figure class="science-figure"><div class="lagrange-view-switch" role="group" aria-label="Probe viewing frame"><button type="button" data-frame="orbit" aria-pressed="true" ${helpAttrs('Watch the orbit','An outside view: the worlds, their Lagrange points and the probe all travel around the shared centre of mass. This is the same computed trajectory as the rotating view.')}>Watch the orbit</button><button type="button" data-frame="rotating" aria-pressed="false" ${helpAttrs('Ride with the pair','The camera rotates at the worlds’ orbital speed. The worlds and their balance points stand still, making the probe’s small departure easier to follow.')}>Ride with the pair</button><button type="button" data-frame="closeup" aria-pressed="false" ${helpAttrs('Close-up on the balance point','Magnify the actual equilibrium and the probe’s motion relative to it. Both axes use kilometres at the same scale. The camera rotates with the pair, so the equilibrium stays on the gold crosshair.')}>Close-up on point</button></div>
    <div class="lagrange-closeup-tools" data-closeup-only hidden><div role="group" aria-label="Close-up scale"><button type="button" data-closeup-action="launch" ${helpAttrs('Magnify the release','Rewind to the start and choose a scale that makes your initial positioning error visible. The scale then stays fixed during replay.')}>Magnify launch</button><button type="button" data-closeup-action="fit" ${helpAttrs('Fit the full drift','Choose a fixed scale that contains the entire predicted trajectory and any pinned comparison. It stays fixed while replaying; no automatic camera chasing.')}>Fit full drift</button><button type="button" data-closeup-action="in" aria-label="Zoom in on point" ${helpAttrs('Zoom in','Halve the width and height of the close-up, keeping the equilibrium at its centre. A probe outside the frame is marked on its edge.')}>＋</button><button type="button" data-closeup-action="out" aria-label="Zoom out from point" ${helpAttrs('Zoom out','Double the width and height of the close-up, keeping the equilibrium at its centre. Zoom changes the view, never the physics.')}>−</button></div><label class="science-checkbox"><input id="lagrange-slow" type="checkbox" checked ${helpAttrs('Slow close-up replay','One pair orbit takes twenty viewing seconds, instead of compressing the whole experiment into twelve seconds. This reveals the early drift. Scrub the replay slider to inspect later times immediately.')}> Slow replay</label></div>
    <div class="lagrange-space-wrap"><svg data-lagrange-closeup class="lagrange-flight-stage lagrange-closeup-stage" viewBox="0 0 720 370" role="img" tabindex="0" aria-label="Close-up of probe motion relative to the Lagrange point" hidden ${helpAttrs('Read the close-up','Gold marks the exact Lagrange equilibrium. The open circle is the release position. Teal shows the moving probe and its trail; a faint dashed line shows the full prediction. Axes are kilometres, with equal scale in both directions. An edge arrow means the probe is outside this view, not that it has escaped. The camera turns with the worlds.')}></svg><svg data-lagrange-map class="lagrange-flight-stage" viewBox="0 0 720 470" role="group" aria-label="Worlds, balance points and moving probe"></svg><p class="lagrange-closeup-status" data-closeup-only data-closeup-status hidden></p><div class="lagrange-flight-hud"><div><span>LAUNCH FROM</span><strong data-flight-point></strong></div><div><span>FROM BALANCE</span><strong data-flight-distance></strong></div><div><span>REPLAY TIME</span><strong data-flight-orbits></strong></div></div></div><div class="lagrange-transport"><div class="science-actions"><button type="button" class="science-primary" data-play>Run probe</button><button type="button" data-reset>Reset</button><button type="button" data-pin disabled>Pin comparison</button></div>
    ${rangeField('lagrange-time','Replay / pair orbits',0,1000,1,0)}</div><aside class="lagrange-station-keeping" data-closeup-only data-station-keeping hidden></aside><div class="lagrange-chart-heading"><strong>Is the error growing?</strong><span>Departure = distance from your chosen balance point</span></div><svg data-lagrange-detail viewBox="0 0 720 260" role="img" tabindex="0" aria-label="Departure from the balance point over time" ${helpAttrs('Read the departure graph','Left to right is time in pair orbits; upwards is distance from the selected balance point, as a percentage of pair separation. This departure includes the initial offset; it is the physical positioning error from the equilibrium, not accumulated integration error. A small wavy curve can remain nearby; a growing curve exposes instability. The faint curve is the full prediction, teal is the replay so far, and orange is your pinned comparison. Both runs share the same axes.')}></svg><div class="science-chart-legend"><span class="legend-current">Replay so far</span><span class="legend-prediction">Full prediction</span><span class="legend-pinned">Pinned comparison</span></div><figcaption>World sizes are enlarged. Probe positions follow the computed orbit. The flight trail shows the latest pair orbit; the graph shows the complete experiment. Axes stay fixed during replay. Other parameter changes keep the moment you were inspecting; changing the pair starts a fresh experiment and clears its comparison. The close-up uses true distances in kilometres and shows the complete trail.</figcaption></figure>
  <div class="science-controls"><div class="lagrange-prediction-readout" tabindex="0" ${helpAttrs('Largest predicted departure','The largest distance from the selected balance point during the complete computed experiment, as a percentage of pair separation. This updates immediately when a setting changes; it is a prediction, not the replay’s current distance.')}><span>LARGEST PREDICTED DEPARTURE</span><strong data-prediction-maximum></strong><small>of the pair’s separation</small></div>${selectField('lagrange-system','Pair of worlds',LAGRANGE_SYSTEMS.map(s=>option(s.id,s.label)).join(''))}
    ${selectField('lagrange-point','Starting point',['L1','L2','L3','L4','L5'].map(p=>option(p,p)).join(''))}
    ${rangeField('lagrange-offset','Initial offset to the right',.02,2,.02,.1)}${rangeField('lagrange-kick','Initial kick upwards',-.5,.5,.02,0)}
    ${selectField('lagrange-duration','Experiment length','<option value="2">2 pair orbits</option><option value="6" selected>6 pair orbits</option><option value="12">12 pair orbits</option>')}
    <details class="science-extra"><summary>Invent a different mass ratio</summary><label class="science-checkbox"><input id="lagrange-custom" type="checkbox" ${helpAttrs('Use a custom mass ratio','Switch from the real pair’s masses to invented masses. The ratio initially matches the chosen pair where it fits within the slider range. Move the ratio through about 25:1 and test L4 or L5.')}> Use a custom mass ratio</label>${rangeField('lagrange-ratio','Primary mass / companion mass',0,7,.01,1.91)}<p>Custom masses make this a fictional system, keeping the chosen pair’s distance and radii.</p></details>
<p class="science-comparison" data-comparison role="status"></p>
  </div></div><p class="science-answer" data-lagrange-answer></p><dl class="science-metrics" data-lagrange-metrics></dl>
  <p class="science-challenge"><strong>Try this:</strong> Run Earth–Moon L4 with a small offset and pin it. Switch only the point to L1. Then try Pluto–Charon L4, or invent a 10:1 mass ratio.</p>
  <details class="science-model-note"><summary>What does this experiment assume?</summary><p>The planar circular restricted three-body model: two circularly orbiting masses, a negligible probe, and no other gravity or thrusters. Coriolis and centrifugal terms are included. “Stable” means linearly stable to sufficiently small disturbances, not guaranteed capture or settling. The initial kick is a rotating-frame velocity in the positive vertical direction, as a fraction of the pair’s relative orbital speed.</p><p>Offset = selected percentage × pair separation / 100. Departure = the straight-line distance from the selected equilibrium, including that initial offset. The kick is measured relative to the rotating frame; with zero kick the probe initially moves with that frame. Integration controls local position and velocity error, checks a tighter second trajectory and monitors the Jacobi constant. A close approach stops at a model surface; a probe beyond four pair separations ends the experiment. A sensitive prediction stops early if the tighter numerical run ceases to agree. This is not a real spacecraft trajectory planner. Numerical check: <span data-jacobi></span></p></details>
  </section>`;}

export function mountLagrangeLab(root:HTMLElement,saved?:LagrangeSession){
  let s:LagrangeSession=saved?{...saved,options:{...saved.options},pinned:saved.pinned?{...saved.pinned,options:{...saved.pinned.options}}:undefined}:{kind:'lagrange',options:defaults(),time:0};
  let run=runFor(s.options),pinnedRun=s.pinned?runFor(s.pinned.options):undefined,playing=false,frame=0,last=0;
  const abort=new AbortController(),signal=abort.signal,find=<T extends Element=HTMLElement>(q:string)=>root.querySelector<T>(q)!;
  const cachedPoints=new Map<number,ReturnType<typeof lagrangePoints>>();
  const pointFor=(o:LagrangeOptions)=>{const mu=muFor(o);if(!cachedPoints.has(mu))cachedPoints.set(mu,lagrangePoints(mu));return cachedPoints.get(mu)!.find(p=>p.name===o.point)!;};
  const finalTime=(r:ProbeRun)=>r.samples[r.samples.length-1].time;
  const view=createLagrangeView(root);
  function sync(){
    find<HTMLSelectElement>('#lagrange-system').value=s.options.system;find<HTMLSelectElement>('#lagrange-point').value=s.options.point;
    find<HTMLInputElement>('#lagrange-offset').value=String(s.options.offsetPercent);find<HTMLInputElement>('#lagrange-kick').value=String(s.options.kickPercent);
    find<HTMLSelectElement>('#lagrange-duration').value=String(s.options.orbits);find<HTMLInputElement>('#lagrange-custom').checked=s.options.custom;
    find<HTMLInputElement>('#lagrange-ratio').value=String(s.options.ratioLog);
  }
  function pause(){playing=false;cancelAnimationFrame(frame);frame=0;find('[data-play]').textContent=s.time>=finalTime(run)?'Replay probe':'Run probe';}
  function staticFigure(){
    const o=s.options,mu=muFor(o),point=pointFor(o),system=pairFor(o);
    s.closeupSpan??=launchCloseupSpan(o.offsetPercent);
    view.configure(o,run,s.pinned,pinnedRun,s.view??'orbit',s.closeupSpan);
    find<HTMLInputElement>('#lagrange-slow').checked=s.slowCloseup!==false;
    output(root,'lagrange-offset',`${number(o.offsetPercent,2)}% of separation`);output(root,'lagrange-kick',`${number(o.kickPercent,2)}% of orbital speed`);output(root,'lagrange-ratio',`${number(o.custom?10**o.ratioLog:(1-mu)/mu,1)} : 1`);
    find<HTMLInputElement>('#lagrange-ratio').disabled=!o.custom;
    const period=2*Math.PI*Math.sqrt(system.distanceKm**3/(system.primaryGM+system.secondaryGM))/86400;
    find('[data-lagrange-metrics]').innerHTML=metric('Selected point',`${o.point} · ${point.stable?'linearly stable':'unstable'}`,'Linearly stable means sufficiently small nudges can remain nearby in this model. It does not mean the probe settles down or that a large kick cannot escape.')+metric('Mass ratio',`${number((1-mu)/mu,1)} : 1`,'Primary mass divided by companion mass. L4 and L5 change stability at approximately 25:1; L1–L3 remain unstable.')+metric('Pair separation',`${number(system.distanceKm,0)} km`,'The distance between the worlds in this circular model. Offsets and the departure graph are percentages of this distance.')+metric(o.custom?'Time unit':'Circular-model period',o.custom?'Pair orbits':`${number(period,2)} days`,'One complete revolution of the two worlds about their shared centre of mass. Normal replay takes about twelve viewing seconds. Close-up slow replay takes twenty seconds per pair orbit, to reveal the early drift.');
    find('[data-station-keeping]').innerHTML=`<strong>${point.stable?'Nearby does not mean settled':'Why active position control?'}</strong><p>${point.stable?`${o.point} is stable to sufficiently small disturbances in this ideal model. The probe can oscillate around it: there is no friction to make it settle. Real disturbances and mission requirements may still call for small corrections.`:`${o.point} is an unstable equilibrium. Small errors in position or velocity can grow, carrying an unpowered probe away. Spacecraft measure their motion and make planned, small thruster burns — <b>station keeping</b> — to remain near their intended orbit.`}</p><p>The gold crosshair is the actual equilibrium. It stays fixed in this view because the camera turns with the pair. Teal shows the probe’s motion <em>relative to it</em>; the point itself is not wandering. Real spacecraft often orbit near a point, rather than sit exactly on it. <a href="https://science.nasa.gov/mission/webb/orbit/" target="_blank" rel="noopener noreferrer">NASA: Webb’s orbit near L2 ↗</a></p>`;
    find('[data-jacobi]').textContent=`DOP853 order 8, with order-7 replay. Maximum |ΔC| = ${run.maxJacobiError.toExponential(1)}. A tighter rerun differs in position by at most ${(run.maxPositionDisagreement*system.distanceKm*1000).toPrecision(3)} m over the displayed trajectory. This is a numerical agreement check, not a bound on real-world prediction error.`;
    find('[data-comparison]').textContent=s.pinned?`Pinned: ${s.pinned.options.custom?'custom system':pairFor(s.pinned.options).label} ${s.pinned.options.point}, ${number(s.pinned.options.offsetPercent,2)}% offset, ${number(s.pinned.options.kickPercent,2)}% kick. Orange records the first ${number(s.pinned.time/(2*Math.PI),2)} pair orbits.`:'Predict what will happen. Run or scrub the probe, then pin a comparison.';
    dynamicFigure();
  }
  function dynamicFigure(){
    const time=Math.max(0,Math.min(s.time,finalTime(run))),point=pointFor(s.options);
    view.draw(time);
    find<HTMLInputElement>('#lagrange-time').value=String(finalTime(run)>0?Math.round(time/finalTime(run)*1000):0);output(root,'lagrange-time',`${number(time/(2*Math.PI),2)} orbits`);
    find<HTMLButtonElement>('[data-pin]').disabled=time===0;
    const finished=time>=finalTime(run)-1e-8;
    find('[data-play]').textContent=playing?'Pause probe':finished?'Replay probe':'Run probe';
    find<HTMLElement>('[data-play]').dataset.helpSuppressed=String(playing);
    const ending=run.end==='primary'?'Reached the primary’s model surface.':run.end==='secondary'?'Reached the companion’s model surface.':run.end==='left-view'?'Left the experiment region.':run.end==='limit'?'Reached the integration limit.':run.end==='accuracy'?'Reached the numerical agreement limit.':'Experiment complete.';
    find('[data-lagrange-answer]').innerHTML=`<strong>${finished?ending:playing?'Probe in motion':'Ready to test'}</strong><span>${number(time/(2*Math.PI),2)} pair orbits inspected. ${run.end==='accuracy'?`The verified prediction ends at ${number(finalTime(run)/(2*Math.PI),2)} pair orbits: two numerical runs cease to agree closely beyond there. This is distinct from the probe’s physical departure.`:'Use the departure graph to compare your probe with its starting balance.'} ${point.stable?'Small oscillations can remain nearby; the probe need not settle.':'This equilibrium is unstable to small disturbances.'}</span>`;
  }
  function tick(now:number){
    if(!playing)return;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;
    const rate=s.view==='closeup'&&s.slowCloseup!==false?2*Math.PI/20:finalTime(run)/12;
    s.time=Math.min(finalTime(run),s.time+dt*rate);
    dynamicFigure();if(s.time>=finalTime(run)){pause();dynamicFigure();}else frame=requestAnimationFrame(tick);
  }
  function rebuild(){const progress=finalTime(run)>0?s.time/finalTime(run):0;pause();run=runFor(s.options);s.time=Math.min(1,progress)*finalTime(run);staticFigure();}
  function choosePoint(name:LagrangeName,focus=false){s.options.point=name;sync();rebuild();if(focus)root.querySelector<SVGElement>(`[data-point="${name}"]`)!.focus({preventScroll:true});}
  root.addEventListener('keydown',event=>{
    const point=(event.target as Element).closest<SVGElement>('[data-point]');
    if(point&&(event.key==='Enter'||event.key===' ')){event.preventDefault();choosePoint(point.dataset.point as LagrangeName,true);}
  },{signal});
  root.addEventListener('input',event=>{
    const input=event.target as HTMLInputElement;
    if(input.id==='lagrange-time'){pause();s.time=Number(input.value)/1000*finalTime(run);dynamicFigure();return;}
    if(input.id==='lagrange-slow'){s.slowCloseup=input.checked;return;}
    if(input.id==='lagrange-system'){pause();s=resetLagrangePair(s,input.value);pinnedRun=undefined;run=runFor(s.options);sync();staticFigure();return;}
    else if(input.id==='lagrange-point')s.options.point=input.value as LagrangeName;
    else if(input.id==='lagrange-offset')s.options.offsetPercent=Number(input.value);
    else if(input.id==='lagrange-kick')s.options.kickPercent=Number(input.value);
    else if(input.id==='lagrange-duration')s.options.orbits=Number(input.value);
    else if(input.id==='lagrange-custom'){
      s.options.custom=input.checked;
      if(input.checked){
        const pair=pairFor(s.options);
        s.options.ratioLog=Math.max(0,Math.min(7,Math.log10(pair.primaryGM/pair.secondaryGM)));
        find<HTMLInputElement>('#lagrange-ratio').value=String(s.options.ratioLog);
      }
    }
    else if(input.id==='lagrange-ratio')s.options.ratioLog=Number(input.value);else return;
    rebuild();
  },{signal});
  root.addEventListener('click',event=>{
    const point=(event.target as Element).closest<SVGElement>('[data-point]');if(point){choosePoint(point.dataset.point as LagrangeName);return;}
    const button=(event.target as Element).closest('button');if(!button)return;
    if(button.hasAttribute('data-frame')){const next=button.getAttribute('data-frame') as LagrangeFrame;if(next==='closeup'&&s.view!==next&&s.time>0)s.closeupSpan=view.fullCloseupSpan();s.view=next;staticFigure();}
    else if(button.hasAttribute('data-closeup-action')){
      const action=button.dataset.closeupAction;
      if(action==='launch'){pause();s.time=0;s.closeupSpan=launchCloseupSpan(s.options.offsetPercent);}
      else if(action==='fit')s.closeupSpan=view.fullCloseupSpan();
      else s.closeupSpan=clampCloseupSpan((s.closeupSpan??launchCloseupSpan(s.options.offsetPercent))*(action==='in'?.5:2));
      staticFigure();
    }
    else if(button.hasAttribute('data-scenario')){
      const scenario=button.getAttribute('data-scenario'),system=scenario==='charon'?'pluto-charon':'earth-moon';
      pause();if(system!==s.options.system){s=resetLagrangePair(s,system);pinnedRun=undefined;}
      s.options={...defaults(),system,point:scenario==='unstable'?'L1':'L4'};s.time=0;s.closeupSpan=undefined;run=runFor(s.options);sync();staticFigure();
    }
    else if(button.hasAttribute('data-play')){
      if(playing){pause();dynamicFigure();return;}
      if(s.time>=finalTime(run))s.time=0;
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){s.time=finalTime(run);dynamicFigure();return;}
      playing=true;last=0;button.dataset.helpSuppressed='true';button.textContent='Pause probe';root.dispatchEvent(new Event('science-dismiss-help'));root.querySelector('.lagrange-space-wrap')!.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});frame=requestAnimationFrame(tick);
    }else if(button.hasAttribute('data-pin')){s.pinned={options:{...s.options},time:s.time};pinnedRun=runFor(s.pinned.options);staticFigure();}
    else if(button.hasAttribute('data-reset')){pause();s={kind:'lagrange',options:defaults(),time:0};pinnedRun=undefined;run=runFor(s.options);sync();staticFigure();}
  },{signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();dynamicFigure();}},{signal});
  const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&playing){pause();dynamicFigure();}});observer.observe(root);
  sync();s.time=Math.min(s.time,finalTime(run));staticFigure();
  return {dispose:()=>{pause();abort.abort();observer.disconnect();return s;}};
}
