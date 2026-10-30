import { ENVIRONMENTS } from '../environment.ts';
import { WORLD_ART } from '../world-art.ts';
import { ESCAPE_DEFAULTS, escapeExperiment, escapeCoastToInfinity, maximumStartingSpeed, retargetEscapeWorld, type EscapeOptions } from './escape-model.ts';
import { metric, number, n, option, output, rangeField, selectField, plotGrid } from './science-lab-ui.ts';
import { helpAttrs } from './science-help.ts';

export interface EscapeSession {kind:'escape';options:EscapeOptions;pinned?:EscapeOptions}
const name=(id:string)=>id[0].toUpperCase()+id.slice(1);
const energy=(joules:number)=>Math.abs(joules)>=1e12?`${number(joules/1e12,2)} TJ`:Math.abs(joules)>=1e9?`${number(joules/1e9,2)} GJ`:`${number(joules/1e6,2)} MJ`;
const resultText=(o:EscapeOptions)=>{
  const r=escapeExperiment(o);
  return r.outcome==='threshold'?'Just enough to escape':r.outcome==='escapes'?'Escapes this world':'Returns to this world';
};
export function escapeLabMarkup(){return `<section class="science-lab science-escape" aria-labelledby="escape-lab-title">
  <header class="science-lab-head"><div><p class="atlas-kicker">TRY IT / A SINGLE PUSH</p><h2 id="escape-lab-title">Can your probe get away?</h2></div><span class="science-lab-badge">Energy explorer</span></header>
  <div class="science-workbench"><figure class="science-figure"><div class="escape-speed-readout" data-escape-ratio></div><svg data-escape-figure viewBox="0 0 720 420" role="img" tabindex="0" aria-label="Coasting speed from the launch point to infinity" ${helpAttrs('Read the whole journey','The horizontal distance scale is compressed: halfway across is twice the starting radius, and the right edge is infinity. A returning probe ends at zero speed before that edge. Exactly at escape speed, zero is reached only at infinity; faster probes retain speed there.')}></svg><div class="escape-journey-status" data-escape-fate></div><figcaption><b>All the way to infinity.</b> Distance is compressed, not evenly spaced. Teal: your probe · dotted: exactly escape speed · orange: pinned. Curves use each experiment’s starting radius as their distance unit.</figcaption></figure>
  <div class="science-controls">${selectField('escape-world','Launch world',ENVIRONMENTS.map(w=>option(w.name,name(w.name))).join(''))}
  ${rangeField('escape-height','Launch height',0,50000,100,0)}${rangeField('escape-speed','Starting speed',0,20,.001,10)}
  <div class="science-presets" role="group" aria-label="Try speeds near the escape threshold"><button type="button" data-speed-factor=".8">80% escape</button><button type="button" data-speed-factor="1">At escape</button><button type="button" data-speed-factor="1.2">120% escape</button></div>
  ${rangeField('escape-mass','Probe mass',0,4,.1,3)}
  <div class="science-actions"><button type="button" data-pin>Pin comparison</button><button type="button" data-reset>Reset</button></div><p class="science-comparison" data-comparison role="status">Pin this experiment, then change one parameter.</p></div></div>
  <div class="science-answer" data-escape-answer role="status"></div><dl class="science-metrics" data-escape-metrics></dl>
  <p class="science-challenge"><strong>Try this:</strong> Pin Earth at 80% escape speed, then switch to the Moon. The thumb stays put: how much does the speed in km/s change? Then vary probe mass: does the escape threshold change?</p>
  <details class="science-model-note"><summary>What does this experiment assume?</summary><p>An isolated spherical world, one instantaneous outward push, then unpowered radial motion. The model uses the same gravity and radius as Launch Lab. Air resistance, surface rotation and other worlds are omitted. The picture of the world is illustrative; graph distance is divided by each experiment’s own starting radius. Escaping a moon does not automatically escape its planet or the Sun.</p></details>
  </section>`;}

function figure(options:EscapeOptions,pinned?:EscapeOptions){
  const current=escapeExperiment(options),previous=pinned?escapeExperiment(pinned):undefined;
  const maxSpeed=Math.max(current.escapeSpeed,options.speedKmS*1000,previous?.escapeSpeed??0,(pinned?.speedKmS??0)*1000,100)*1.12;
  const graph={x:190,y:104,w:480,h:224},px=(u:number)=>graph.x+u*graph.w,py=(v:number)=>graph.y+graph.h*(1-v/maxSpeed);
  const coast=escapeCoastToInfinity(options),endpoint=coast.points[coast.points.length-1];
  const curve=(o:EscapeOptions)=>escapeCoastToInfinity(o).points.map((p,i)=>`${i?'L':'M'}${n(px(p.u))} ${n(py(p.speed))}`).join('');
  const threshold={...options,speedKmS:current.escapeSpeed/1000};
  const summary=resultText(options);
  return `<title>${name(options.world)}: ${summary}</title><desc>Starting speed ${number(options.speedKmS,3)} kilometres per second; escape threshold ${number(current.escapeSpeed/1000,3)} kilometres per second. ${pinned?`Comparison: ${name(pinned.world)} at ${number(pinned.speedKmS,3)} kilometres per second.`:''}</desc>
    <text x="28" y="33" class="science-svg-kicker">ONE PUSH / THE WHOLE JOURNEY</text>
    <circle cx="87" cy="204" r="66" class="science-world-halo"/><image href="${WORLD_ART[options.world].full}" x="27" y="144" width="120" height="120"/>
    <path d="M87 134Q78 92 108 75m-2 9 2-9-10 2" class="science-arrow"/><path d="m86 118-6 8h12Z" class="science-probe"/>
    <text x="87" y="295" text-anchor="middle">${name(options.world)}</text><text x="87" y="321" text-anchor="middle" class="science-svg-muted">${number(options.altitudeKm,0)} km high</text>
    <text x="190" y="73">Coasting speed / km/s</text><rect x="${px(.9)}" y="91" width="${graph.w*.1}" height="${graph.h+13}" rx="4" class="escape-infinity-band"/>${plotGrid(graph.x,graph.y,graph.w,graph.h)}
    <path d="M670 91V328" class="escape-infinity-line"/><text x="670" y="73" text-anchor="end" class="escape-infinity-label">At infinity</text>
    ${[0,.5,1].map(f=>`<text x="179" y="${n(py(maxSpeed*f)+5)}" text-anchor="end">${number(maxSpeed*f/1000,1)}</text>`).join('')}
    ${[[0,'1'],[.5,'2'],[.8,'5'],[.9,'10'],[1,'∞']].map(([u,label])=>`<text x="${px(Number(u))}" y="356" text-anchor="middle" class="${label==='∞'?'escape-infinity-label':''}">${label}</text>`).join('')}
    <text x="430" y="392" text-anchor="middle">Distance / starting radius · compressed towards ∞</text>
    <path d="${curve(threshold)}" class="science-threshold-curve"/>
    ${pinned?`<path d="${curve(pinned)}" class="science-pinned-curve"/>`:''}<path d="${curve(options)}" class="science-current-curve"/>
    <circle cx="${n(px(endpoint.u))}" cy="${n(py(endpoint.speed))}" r="6" class="${coast.endsAtInfinity?'escape-infinity-end':'escape-turnaround'}"/>
    ${coast.endsAtInfinity?`<path d="m${n(px(1)-8)} ${n(py(endpoint.speed)-7)} 8 7-8 7" class="science-arrow"/>`:''}`;
}
export function mountEscapeLab(root:HTMLElement,saved?:EscapeSession){
  let s:EscapeSession=saved?{...saved,options:{...saved.options},pinned:saved.pinned?{...saved.pinned}:undefined}:{kind:'escape',options:{...ESCAPE_DEFAULTS}};
  const abort=new AbortController(),signal=abort.signal,find=<T extends Element=HTMLElement>(q:string)=>root.querySelector<T>(q)!;
  const world=find<HTMLSelectElement>('#escape-world'),height=find<HTMLInputElement>('#escape-height'),speed=find<HTMLInputElement>('#escape-speed'),mass=find<HTMLInputElement>('#escape-mass');
  function sync(){world.value=s.options.world;height.value=String(s.options.altitudeKm);mass.value=String(Math.log10(s.options.massKg));
    const maximum=maximumStartingSpeed(s.options);s.options.speedKmS=Math.min(s.options.speedKmS,maximum);
    speed.max=String(maximum);speed.step='any';speed.value=String(s.options.speedKmS);}
  function render(){
    const o=s.options,r=escapeExperiment(o);output(root,'escape-height',`${number(o.altitudeKm,0)} km`);output(root,'escape-speed',`${number(o.speedKmS,3)} km/s`);output(root,'escape-mass',`${number(o.massKg,0)} kg`);
    const coast=escapeCoastToInfinity(o),percent=o.speedKmS*1000/r.escapeSpeed*100;
    find('[data-escape-ratio]').innerHTML=`<span>YOUR STARTING SPEED</span><strong>${number(percent,1)}% <small>of escape speed</small></strong><meter min="0" max="200" low="100" high="100" optimum="200" value="${percent}" aria-label="Starting speed as a percentage of escape speed"></meter><span class="escape-threshold-label">Escape threshold: ${number(r.escapeSpeed/1000,3)} km/s · slider 0–200%</span>`;
    find('[data-escape-figure]').innerHTML=figure(o,s.pinned);
    find('[data-escape-fate]').innerHTML=r.outcome==='returns'?`<span aria-hidden="true">↶</span><div><strong>Turns around before infinity</strong><p>Zero speed at ${number(coast.turningRadiusRatio!,2)}× the starting radius. Then it falls back.</p></div>`:r.outcome==='threshold'?'<span aria-hidden="true">∞</span><div><strong>Zero speed only at infinity</strong><p>Speed approaches zero only infinitely far away. No finite turning point.</p></div>':`<span aria-hidden="true">↗</span><div><strong>Keeps going forever</strong><p>Still travelling at ${number(r.excessSpeed/1000,3)} km/s at infinity. No turning point.</p></div>`;
    find('[data-escape-answer]').innerHTML=`<strong>${resultText(o)}</strong><span>${r.outcome==='returns'?`Highest altitude: ${number(r.maximumAltitudeKm!,0)} km. This is a radial throw, not a circular orbit.`:r.outcome==='threshold'?'Speed tends towards zero infinitely far away; it never stops at a finite height.':`Far-away speed: ${number(r.excessSpeed/1000,3)} km/s in this isolated-world model.`}</span>`;
    find('[data-escape-metrics]').innerHTML=metric('Escape speed',`${number(r.escapeSpeed/1000,3)} km/s`,'The minimum speed for an unpowered outward coast to reach arbitrarily large distances from this isolated world.')+metric('Circular speed, sideways',`${number(r.circularSpeed/1000,3)} km/s`,'Speed for a sideways circular orbit at this height. A radial launch at this speed returns instead of orbiting.')+metric('Starting kinetic energy',energy(r.kineticEnergy),'Energy of motion immediately after the push: one half of mass times speed squared.')+metric('Energy to escape from rest',energy(r.bindingEnergy),'The gravitational energy needed to go from rest here to zero speed at infinity. It grows with probe mass.');
    find('[data-comparison]').textContent=s.pinned?`Pinned: ${name(s.pinned.world)}, ${number(s.pinned.speedKmS,3)} km/s, ${number(s.pinned.altitudeKm,0)} km high, ${number(s.pinned.massKg,0)} kg. ${resultText(s.pinned)}.`:'Pin this experiment, then change one parameter.';
  }
  root.addEventListener('input',event=>{
    const target=event.target;
    if(target===world){s.options=retargetEscapeWorld(s.options,world.value);sync();}
    else if(target===height){s.options.altitudeKm=Number(height.value);sync();}
    else if(target===speed)s.options.speedKmS=Number(speed.value);
    else if(target===mass)s.options.massKg=10**Number(mass.value);else return;
    render();
  },{signal});
  speed.addEventListener('keydown',event=>{
    const direction=event.key==='ArrowRight'||event.key==='ArrowUp'?1:event.key==='ArrowLeft'||event.key==='ArrowDown'?-1:0;
    if(!direction)return;
    event.preventDefault();s.options.speedKmS=Math.max(0,Math.min(maximumStartingSpeed(s.options),s.options.speedKmS+direction*maximumStartingSpeed(s.options)/200));sync();render();
  },{signal});
  root.addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button)return;
    if(button.hasAttribute('data-pin'))s.pinned={...s.options};
    else if(button.hasAttribute('data-reset')){s={kind:'escape',options:{...ESCAPE_DEFAULTS}};sync();}
    else if(button.dataset.speedFactor){s.options.speedKmS=escapeExperiment(s.options).escapeSpeed/1000*Number(button.dataset.speedFactor);sync();}else return;
    render();
  },{signal});
  sync();render();return {dispose:()=>{abort.abort();return s;}};
}
