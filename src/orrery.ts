import './orrery.css';
import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { WORLDS, ALL_MOONS, ASTEROIDS, KUIPER_BODIES, moonsFor, worldsFor, isExtraWorld, normalRadii, beltHalfWidth, moonOrbitRadius, satelliteOffset, BELTS, AU_KM, DAY_MS, YEAR_DAYS, MIN_DATE, MAX_DATE, TAU, mix, seeded,
  elementsAt, positionFromElements, positionAt, displayPosition, diameterAt, spinAt, outerRadius, eclipticPole,
  daysSinceJ2000, advanceTime, type World } from './orrery-model.ts';
import { PlanetSurface, haloTexture, ringTexture } from './orrery-textures.ts';
import { TouchPan, panOrthographic } from './orrery-navigation.ts';
import { radialDirection, radialLabel, labelLeader, labelsFarToNear, labelInView, foregroundBodies, labelMask, foregroundBodyAt, visibleLeaderSegments, type LabelDirection, type LabelBody } from './orrery-labels.ts';
import { COMPACT_LAYOUT_QUERY } from './display-layout.ts';

const ALL_WORLDS=worldsFor(true);
const inspectOptions=(expanded:boolean)=>`<option value="">Choose a world…</option>${WORLDS.map(w=>
  `<optgroup label="${w.name}${moonsFor(expanded).some(m=>m.satellite!.parent===w.id)?' & moons':''}"><option value="${w.id}">${w.name}</option>${moonsFor(expanded).filter(m=>m.satellite!.parent===w.id).map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}</optgroup>`).join('')}
  ${expanded?[['Asteroid belt bodies',ASTEROIDS],['Kuiper belt bodies',KUIPER_BODIES]].map(([name,bodies])=>`<optgroup label="${name}">${(bodies as World[]).map(w=>`<option value="${w.id}">${w.name}</option>`).join('')}</optgroup>`).join(''):''}<optgroup label="Belts">${BELTS.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</optgroup>`;

let activeDialog:HTMLDialogElement|undefined;
export const isOrreryOpen=()=>!!activeDialog?.open;
const localInput=(ms:number)=>{const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};
const dateFormat=new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'2-digit'});
const timeFormat=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const circlePoints=(n:number)=>Array.from({length:n},(_,i)=>i/n*TAU);

export function installOrrery(onOpen:()=>void) {
  if(activeDialog)return;
  const opener=document.querySelector<HTMLButtonElement>('#open-orrery')!;
  const dialog=document.createElement('dialog');dialog.id='solar-orrery';dialog.className='orrery-dialog';dialog.setAttribute('aria-labelledby','orrery-title');
  dialog.innerHTML=`<header class="orrery-header"><div class="orrery-brand"><span class="orrery-emblem" aria-hidden="true">◎</span><div><p class="orrery-kicker">LAUNCH LAB / CELESTIAL MECHANICS</p><h1 id="orrery-title">The Orrery<span>A moving solar system.</span></h1></div></div><button type="button" class="orrery-close">↙ Back to the lab</button></header>
    <section class="orrery-stage" aria-label="Interactive three dimensional solar system">
      <div class="orrery-render"></div><canvas class="orrery-leaders" aria-hidden="true"></canvas><div class="orrery-labels"></div>
      <div class="orrery-view-tools" role="group" aria-label="View controls"><button type="button" class="orrery-home" data-view="home" title="Restore the original view" aria-label="Restore the original view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9"/></svg></button><button type="button" data-view="fit" title="Re-centre and fit the complete solar system at the current angle">Fit system</button><button type="button" data-view="top">Top</button><button type="button" data-view="edge">Edge</button><span class="orrery-tool-divider"></span><label><input id="orrery-label-toggle" type="checkbox" checked> Labels</label><label><input id="orrery-orbit-toggle" type="checkbox" checked> Orbits</label><label title="Show ${ALL_MOONS.length} moons, ${ASTEROIDS.length} asteroids and ${KUIPER_BODIES.length} Kuiper belt bodies. Even spacing makes room for their orbits."><input id="orrery-catalogue-toggle" type="checkbox" aria-describedby="orrery-catalogue-note"> More bodies</label></div>
      <aside class="orrery-info" hidden aria-label="Selected world"><button class="orrery-info-close" type="button" aria-label="Close world details">×</button><p class="orrery-kicker" id="orrery-kind"></p><h2></h2><dl></dl><p class="orrery-info-note"></p><button type="button" class="orrery-focus">View close-up</button></aside>
      <div class="orrery-stage-foot"><span class="orrery-mouse-hint">Drag to turn freely <b>·</b> Scroll to zoom <b>·</b> Right-drag to pan</span><span class="orrery-touch-hint">Drag to turn <b>·</b> Pinch to zoom <b>·</b> Two-finger drag to pan</span><span id="orrery-mode-note">Evenly spaced display</span></div>
      <p class="orrery-error" role="alert" hidden></p>
    </section>
    <footer class="orrery-controls">
      <div class="orrery-transport"><div class="orrery-time"><p class="orrery-kicker">SIMULATION TIME <span id="orrery-zone"></span></p><div><output id="orrery-live-date"></output><output id="orrery-live-time"></output></div></div>
      <div class="orrery-playback"><button type="button" id="orrery-play" class="orrery-primary">Ⅱ Pause</button><button type="button" id="orrery-direction" title="Reverse time" aria-pressed="false">Forward →</button><label class="orrery-speed-label">Speed<select id="orrery-speed" aria-label="Simulation speed"><option value="real">Real time</option><option value="0.002737850787">1 day / minute</option><option value="week" selected>1 week / minute</option><option value="0.083333333333">1 month / minute</option><option value="1">1 year / minute</option><option value="10">10 years / minute</option><option value="100">100 years / minute</option></select></label></div>
      <label class="orrery-inspect-label">Explore<select id="orrery-inspect" aria-label="Inspect a world">${inspectOptions(false)}</select></label></div>
      <details class="orrery-adjustment-panel" open><summary>Date & display scale <span aria-hidden="true">⌄</span></summary><div class="orrery-adjustments"><form class="orrery-date-form"><label for="orrery-date">Go to date & time <small>(local)</small></label><div><input type="datetime-local" step="1" id="orrery-date" required aria-describedby="orrery-date-note"><button type="submit" title="Jump to the selected date and pause">Set date</button><button type="button" id="orrery-now">Now</button></div><span id="orrery-date-note">Supported dates: 1000–3000</span></form>
      <div class="orrery-scale-control"><div><label for="orrery-scale">Distance & size</label><output for="orrery-scale" id="orrery-scale-value">Even spacing</output></div><input id="orrery-scale" type="range" min="0" max="100" value="100" step="1" aria-label="Solar system distance and planet size scale"><div class="orrery-scale-ends"><button type="button" data-scale="0">True scale</button><span>Same orbital clock. A different perspective.</span><button type="button" data-scale="100">Even spacing</button></div><p id="orrery-catalogue-note">More bodies widens the lanes at Even spacing. Zoom in or Explore a planet to see its moons.</p></div></div></details>
      <div class="orrery-bottom"><p id="orrery-status" role="status">Running · 1 week / minute</p><details class="orrery-model-note"><summary>About the model</summary><div><strong>A date-driven Keplerian orrery</strong><p>Elliptical, inclined planetary orbits use <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noreferrer">JPL approximate elements</a> for 1000–3000. Earth represents the Earth–Moon barycentre; Pluto uses the original JPL elements. UTC approximates dynamical time.</p><p>Even spacing preserves orbital angles and timing, while circularising distances into separated lanes. Sizes are enlarged: Sun 3× Earth; Jupiter 2×. More bodies reserves a separate lane for every visible moon and named belt body, including room around Saturn’s rings.</p><p>The ${ALL_MOONS.length} moons use <a href="https://ssd.jpl.nasa.gov/sats/elem/" target="_blank" rel="noreferrer">JPL mean elements</a>, with elliptical shapes, epochs and reference planes converted to the J2000 ecliptic. The ${ASTEROIDS.length} asteroids and ${KUIPER_BODIES.length} additional Kuiper belt bodies use <a href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html" target="_blank" rel="noreferrer">JPL Small-Body Database</a> elements retrieved 13–14 October 2026. These fixed Kepler ellipses omit precession, resonances and perturbations: phases drift away from each source epoch, especially over centuries. The planet model’s 1000–3000 accuracy interval does not apply to moons or small bodies. Use <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noreferrer">Horizons</a> for precise positions. Background belt particles remain representative.</p><p>Planet spins use <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noreferrer">NASA rotation data</a>; added moon spins, untextured surfaces, colours and lighting are illustrative. Surface maps by <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope / INOVE</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>) and <a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noreferrer">NASA VTAD</a> are packaged at up to three resolutions. Some poorly mapped regions are filled or less detailed.</p></div></details></div>
    </footer>`;
  document.body.append(dialog);
  const $=<T extends HTMLElement>(selector:string)=>dialog.querySelector<T>(selector)!;
  const mount=$<HTMLDivElement>('.orrery-render'), stage=$<HTMLElement>('.orrery-stage');
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(error){dialog.remove();throw error;}
  activeDialog=dialog;
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(1,1,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000);mount.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','Animated solar system. Use the Explore menu for world information.');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x000000);
  const camera=new THREE.OrthographicCamera(-60,60,40,-40,.01,2000);camera.position.set(0,100,90);camera.lookAt(0,0,0);scene.add(camera);
  // Stable illumination: neither brightness nor colour depends on solar distance.
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const studio=new THREE.DirectionalLight(0xe8f2ff,1.05);studio.position.set(-40,60,80);camera.add(studio);
  const controls=new TrackballControls(camera,renderer.domElement);controls.rotateSpeed=2.6;controls.zoomSpeed=1.15;controls.noPan=true;controls.staticMoving=true;controls.minZoom=.35;controls.maxZoom=45;
  // CAD-style pan: a point in the scene follows the pointer pixel for pixel,
  // independent of zoom, viewport shape, camera roll or distance to the target.
  let pan:{pointerId:number;x:number;y:number}|undefined;
  let following='';
  const touchPan=new TouchPan();
  const panBy=(dx:number,dy:number)=>{
    if(!dx&&!dy)return;
    following='';
    panOrthographic(camera,controls.target,stage.clientWidth,stage.clientHeight,dx,dy);
  };
  // Observe touch input without consuming it: TrackballControls still handles
  // one-finger rotation and pinch zoom. Use document events to finish off-canvas.
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch')touchPan.start(event);
  },true);
  document.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')touchPan.move(event);
  },true);
  const endTouch=(event:PointerEvent)=>{
    if(event.pointerType==='touch')touchPan.end(event);
  };
  document.addEventListener('pointerup',endTouch,true);
  document.addEventListener('pointercancel',endTouch,true);
  renderer.domElement.addEventListener('lostpointercapture',endTouch);
  const overViewUI=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.orrery-view-tools, .orrery-info');
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==2||overViewUI(event.target))return;
    event.preventDefault();event.stopPropagation();
    following='';
    pan={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    stage.setPointerCapture(event.pointerId);stage.classList.add('orrery-panning');
  },true);
  stage.addEventListener('pointermove',event=>{
    if(!pan||pan.pointerId!==event.pointerId)return;
    event.preventDefault();event.stopPropagation();
    const dx=event.clientX-pan.x,dy=event.clientY-pan.y;pan.x=event.clientX;pan.y=event.clientY;
    panBy(dx,dy);
  },true);
  function endPan(event?:PointerEvent){
    if(!pan||(event&&pan.pointerId!==event.pointerId))return;
    event?.stopPropagation();
    const pointerId=pan.pointerId;pan=undefined;stage.classList.remove('orrery-panning');
    if(stage.hasPointerCapture(pointerId))stage.releasePointerCapture(pointerId);
  }
  stage.addEventListener('pointerup',endPan,true);stage.addEventListener('pointercancel',endPan,true);stage.addEventListener('lostpointercapture',endPan,true);
  window.addEventListener('blur',()=>{endPan();touchPan.reset();pointerStart=undefined;});
  stage.addEventListener('contextmenu',event=>{if(!overViewUI(event.target))event.preventDefault();});
  // Capture above the canvas so hovering a clickable planet label cannot swallow
  // wheel events. Exponential zoom gives equal steps at every magnification.
  stage.addEventListener('wheel',event=>{
    if(event.target instanceof Element&&event.target.closest('.orrery-view-tools, .orrery-info'))return;
    event.preventDefault();event.stopPropagation();
    const unit=event.deltaMode===WheelEvent.DOM_DELTA_LINE?16:event.deltaMode===WheelEvent.DOM_DELTA_PAGE?stage.clientHeight:1;
    const delta=THREE.MathUtils.clamp(event.deltaY*unit,-500,500);
    camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(-delta*.0025),controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();
  },{passive:false,capture:true});
  const labelCanvas=$<HTMLCanvasElement>('.orrery-leaders'), ink=labelCanvas.getContext('2d')!;
  const slider=$<HTMLInputElement>('#orrery-scale'),labelToggle=$<HTMLInputElement>('#orrery-label-toggle'),orbitToggle=$<HTMLInputElement>('#orrery-orbit-toggle');
  const catalogueToggle=$<HTMLInputElement>('#orrery-catalogue-toggle');
  const dateInput=$<HTMLInputElement>('#orrery-date'),play=$<HTMLButtonElement>('#orrery-play'),status=$<HTMLElement>('#orrery-status');
  const compactLayout=matchMedia(COMPACT_LAYOUT_QUERY),adjustments=$<HTMLDetailsElement>('.orrery-adjustment-panel');
  const syncAdjustments=()=>{adjustments.open=!compactLayout.matches;};
  compactLayout.addEventListener('change',syncAdjustments);syncAdjustments();
  dateInput.min=localInput(MIN_DATE);dateInput.max=localInput(MAX_DATE);
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  $('#orrery-zone').textContent=` / ${timezone.replace(/_/g,' ')}`;
  let amount=1,simulation=Date.now(),running=true,rate=7/YEAR_DAYS,direction=1,dateDirty=false,selected='';
  let width=1,height=1,frame=0,last:number|undefined,lastUI=0,orbitEpoch=NaN,orbitScale=NaN;
  let renderedDate=NaN,renderedAmount=NaN;
  let labelsVisible=true,orbitsVisible=true,firstOpen=true,expanded=false;
  const pointsPerOrbit=256;
  const orbitAngles=circlePoints(pointsPerOrbit);
  const sphereGeometry=new THREE.SphereGeometry(.5,96,64);
  const smallGeometry=new THREE.SphereGeometry(.5,24,16);
  type Target={id:string;name:string;colour:string;position:THREE.Vector3;radius:number;bodyRadius:number;parent?:string;label:HTMLButtonElement;enabled:boolean;labelOccluders:LabelBody[]};
  type Planet={world:World;root:THREE.Group;tilt:THREE.Group;mesh:THREE.Mesh;surface:PlanetSurface;orbit?:THREE.LineLoop;target:Target;real:[number,number,number];halo?:THREE.Sprite};
  const targets:Target[]=[],planets:Planet[]=[];
  function makeTarget(id:string,name:string,colour:string,parent?:string):Target {
    const label=document.createElement('button');label.type='button';label.className='orrery-world-label';label.textContent=name;label.style.setProperty('--world-colour',colour);label.setAttribute('aria-label',`Explore ${name}`);$('.orrery-labels').append(label);
    const target:Target={id,name,colour,position:new THREE.Vector3(),radius:0,bodyRadius:0,parent,label,enabled:!isExtraWorld(id),labelOccluders:[]};
    label.onclick=event=>{
      const box=stage.getBoundingClientRect();
      const foreground=event.detail?foregroundBodyAt({x:event.clientX-box.left,y:event.clientY-box.top},target.labelOccluders):undefined;
      inspect(foreground?.id??id);
    };
    label.hidden=!target.enabled;targets.push(target);return target;
  }
  for(const world of ALL_WORLDS){
    const root=new THREE.Group(),tilt=new THREE.Group();root.add(tilt);scene.add(root);tilt.rotation.z=world.tilt*Math.PI/180;
    // Orient the giant planets and their rings in the same measured plane as
    // their inner moons. A scalar obliquity alone leaves the node arbitrary.
    const reference=world.satellite??ALL_MOONS.find(m=>m.satellite!.parent===world.id&&m.satellite!.poleRaDec)?.satellite;
    if(reference?.poleRaDec){
      const [x,y,z]=eclipticPole(reference.poleRaDec);
      tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(x,z,-y));
    }
    const surface=new PlanetSurface(world,Math.min(8,renderer.capabilities.getMaxAnisotropy()),renderer.capabilities.maxTextureSize);
    const mesh=new THREE.Mesh(isExtraWorld(world.id)?smallGeometry:sphereGeometry,surface.material);tilt.add(mesh);
    const target=makeTarget(world.id,world.name,world.colour,world.satellite?.parent??(world.id==='sun'?undefined:'sun')),planet:Planet={world,root,tilt,mesh,surface,target,real:[0,0,0]};
    if(world.id==='saturn'){
      const geometry=new THREE.RingGeometry(.63,1.15,128),uv=geometry.getAttribute('uv'),pos=geometry.getAttribute('position');
      for(let i=0;i<uv.count;i++)uv.setXY(i,(Math.hypot(pos.getX(i),pos.getY(i))-.63)/.52,.5);
      const ring=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:ringTexture(),side:THREE.DoubleSide,transparent:true,depthWrite:false}));ring.rotation.x=-Math.PI/2;tilt.add(ring);
    }
    if(world.id==='sun'){
      const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloTexture(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));root.add(halo);halo.scale.setScalar(2.15);planet.halo=halo;
    }else{
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pointsPerOrbit*3),3));
      planet.orbit=new THREE.LineLoop(geo,new THREE.LineBasicMaterial({color:world.colour,transparent:true,opacity:.23,depthWrite:false}));planet.orbit.frustumCulled=false;scene.add(planet.orbit);
    }
    planets.push(planet);
  }
  const beltObjects=BELTS.map((belt,index)=>{
    const random=seeded(801+index*211),data=Array.from({length:belt.count},()=>{
      const a=mix(belt.inner,belt.outer,random());
      return {a,phase:random()*TAU,node:random()*TAU,inclination:random()**2*(index?.19:.11),motion:TAU/(365.256*Math.pow(a,1.5)),fraction:(a-belt.inner)/(belt.outer-belt.inner)};
    });
    const array=new Float32Array(belt.count*3),colours=new Float32Array(belt.count*3),colour=new THREE.Color(belt.colour);
    for(let i=0;i<belt.count;i++){const shade=.38+random()*.62;colours[i*3]=colour.r*shade;colours[i*3+1]=colour.g*shade;colours[i*3+2]=colour.b*shade;}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(array,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(colours,3));
    const points=new THREE.Points(geo,new THREE.PointsMaterial({size:index?1.15:1.45,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.85,depthWrite:false}));points.frustumCulled=false;scene.add(points);
    return {belt,data,array,points,target:makeTarget(belt.id,belt.name,belt.colour,'sun')};
  });
  // A restrained, fixed star field; its shell always lies beyond the model.
  const random=seeded(744),stars=new Float32Array(1100*3);
  for(let i=0;i<1100;i++){const z=random()*2-1,a=random()*TAU,r=Math.sqrt(1-z*z);stars[i*3]=r*Math.cos(a)*600;stars[i*3+1]=z*600;stars[i*3+2]=r*Math.sin(a)*600;}
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
  scene.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#a3b4cc',size:1,sizeAttenuation:false,transparent:true,opacity:.34,depthWrite:false})));

  function inspect(id:string){
    selected=id;$<HTMLSelectElement>('#orrery-inspect').value=id;const pane=$<HTMLElement>('.orrery-info');pane.hidden=!id;
    targets.forEach(t=>{t.label.classList.toggle('selected',t.id===id);t.label.setAttribute('aria-pressed',String(t.id===id));});
    planets.forEach(p=>{if(p.orbit)(p.orbit.material as THREE.LineBasicMaterial).opacity=id===p.world.id?.65:.23;});
    if(!id)return;
    const world=ALL_WORLDS.find(w=>w.id===id),belt=BELTS.find(b=>b.id===id);
    const focusButton=$<HTMLButtonElement>('.orrery-focus');focusButton.hidden=!world;
    focusButton.textContent=world&&!world.satellite&&moonsFor(expanded).some(m=>m.satellite!.parent===id)?'View moon system':'View close-up';
    $('.orrery-info h2').textContent=world?.name??belt!.name;
    $('#orrery-kind').textContent=belt?'SMALL-BODY REGION':world?.satellite?`MOON OF ${WORLDS.find(w=>w.id===world.satellite!.parent)!.name.toUpperCase()}`:id==='sun'?'OUR STAR':id==='pluto'||world?.kind==='dwarf-planet'?'DWARF PLANET':world?.kind==='asteroid'?'MAIN-BELT ASTEROID':world?.kind==='kuiper-object'?'KUIPER BELT OBJECT':'PLANET';
    const year=world?.satellite?world.satellite.periodDays/YEAR_DAYS:world?.kepler?360/world.kepler.meanMotion/YEAR_DAYS:world?.elements?360/world.rates![3]*36525/YEAR_DAYS:0;
    $('.orrery-info dl').innerHTML=belt?`<div><dt>Solar distance</dt><dd>${belt.inner}–${belt.outer} AU</dd></div><div><dt>Model particles</dt><dd>${belt.count.toLocaleString()}</dd></div>`:`<div><dt>Solar distance</dt><dd id="orrery-distance"></dd></div>${year?`<div><dt>Orbit</dt><dd>${year<2?(year*YEAR_DAYS).toFixed(1)+' days':year.toFixed(1)+' years'}</dd></div>`:''}<div><dt>Axial rotation</dt><dd>${world!.spinHours>48?(world!.spinHours/24).toFixed(2)+' days':world!.spinHours.toFixed(2)+' hours'}</dd></div>`;
    $('.orrery-info-note').textContent=belt?'Representative particles orbit the Sun at speeds set by their distance.':world!.tilt>90?'A retrograde spinner: its rotation axis leans beyond 90°.':id==='earth'?'Our home, with an axis tilted by 23.4°.':id==='sun'?'A rotating star. All worlds share steady ambient lighting.':`Axial tilt ${world!.tilt}°. Select another world to compare.`;
    if(world?.satellite){
      const s=world.satellite!;
      $('.orrery-info dl').innerHTML=`<div><dt>Mean orbit radius</dt><dd>${s.distanceKm.toLocaleString()} km</dd></div><div><dt>Orbital period</dt><dd>${s.periodDays.toFixed(3)} days</dd></div><div><dt>Eccentricity</dt><dd>${s.eccentricity.toFixed(3)}</dd></div><div><dt>Inclination</dt><dd>${s.inclination.toFixed(1)}° (${s.frame})</dd></div>`;
      $('.orrery-info-note').textContent=`${s.inclination>90?'Retrograde orbit. ':''}JPL mean orbital shape and reference plane; phase is approximate away from the source epoch. Surface rotation is illustrative.`;
    }else if(world?.kepler){
      if(world.spinIllustrative)$('.orrery-info dl').querySelector('div:last-child dd')!.textContent='Illustrative';
      $('.orrery-info dl').innerHTML+=`<div><dt>Diameter</dt><dd>${world.diameterKm.toFixed(1)} km</dd></div><div><dt>Eccentricity</dt><dd>${world.elements![1].toFixed(3)}</dd></div>`;
      $('.orrery-info-note').textContent=`An individual JPL orbit with its own ellipse, inclination and date-driven phase. Kepler propagation omits planetary perturbations.${world.region==='kuiper'?' Size is approximate; the sphere and surface spin are illustrative.':''}`;
    }
    updateUI();
  }
  function updateUI(){
    const date=new Date(simulation);$('#orrery-live-date').textContent=dateFormat.format(date);$('#orrery-live-time').textContent=timeFormat.format(date);
    if(!dateDirty&&document.activeElement!==dateInput)dateInput.value=localInput(simulation);
    play.textContent=running?'Ⅱ Pause':'▶ Play';play.setAttribute('aria-label',running?'Pause orrery':'Play orrery');
    const distance=$<HTMLElement>('#orrery-distance');if(distance){const planet=planets.find(p=>p.world.id===selected);distance.textContent=!planet?'':planet.world.id==='sun'?'Centre':`${Math.hypot(...positionAt(planet.world,simulation)).toFixed(3)} AU`;}
  }
  function updateStatus(message?:string){status.textContent=message??`${running?'Running':'Paused'}${direction<0?' backwards':''} · ${$<HTMLSelectElement>('#orrery-speed').selectedOptions[0].text}`;}
  function updateOrbits(){
    if(Math.abs(simulation-orbitEpoch)<30*DAY_MS&&orbitScale===amount)return;
    orbitEpoch=simulation;orbitScale=amount;
    for(const p of planets){if(!p.orbit||!p.target.enabled)continue;
      const e=p.world.satellite?undefined:elementsAt(p.world,simulation),attribute=p.orbit.geometry.getAttribute('position');
      orbitAngles.forEach((angle,i)=>{const v=p.world.satellite?satelliteOffset(p.world,simulation,amount,expanded,angle):displayPosition(positionFromElements(e!,angle),p.world.id,amount,expanded);attribute.setXYZ(i,...v);});attribute.needsUpdate=true;
    }
  }
  function updateScene(){
    if(renderedDate===simulation&&renderedAmount===amount)return;
    renderedDate=simulation;renderedAmount=amount;
    for(const p of planets){
      p.root.visible=p.target.enabled;if(p.orbit)p.orbit.visible=p.target.enabled&&orbitsVisible;
      if(!p.target.enabled)continue;
      const satellite=p.world.satellite;
      if(satellite){
        const parent=planets.find(parent=>parent.world.id===satellite.parent)!;
        p.root.position.set(...satelliteOffset(p.world,simulation,amount,expanded)).add(parent.root.position);
        p.orbit!.position.copy(parent.root.position);
      }else{p.real=positionAt(p.world,simulation);p.root.position.set(...displayPosition(p.real,p.world.id,amount,expanded));}
      const diameter=diameterAt(p.world,amount);p.root.scale.setScalar(diameter);p.mesh.rotation.y=spinAt(p.world,simulation);
      p.target.position.copy(p.root.position);p.target.bodyRadius=diameter*.5;p.target.radius=p.target.bodyRadius*(p.world.id==='saturn'?2.3:1);
    }
    const days=daysSinceJ2000(simulation);
    const radii=normalRadii(expanded);
    for(const {belt,data,array,points,target} of beltObjects){
      for(let i=0;i<data.length;i++){
        const d=data[i],theta=d.phase+days*d.motion,r=mix(d.a,radii[belt.id]+(d.fraction*2-1)*beltHalfWidth(belt.id,expanded),amount);
        const inclination=mix(d.inclination,.012,amount),phase=theta-d.node;
        // Rotate a circular Kepler orbit through its own ascending node and inclination.
        const x=r*Math.cos(phase),z=r*Math.sin(phase),c=Math.cos(d.node),s=Math.sin(d.node);
        array[i*3]=x*c-z*Math.cos(inclination)*s;array[i*3+1]=z*Math.sin(inclination);array[i*3+2]=-(x*s+z*Math.cos(inclination)*c);
      }
      points.geometry.getAttribute('position').needsUpdate=true;
      const r=mix((belt.inner+belt.outer)/2,radii[belt.id],amount),angle=belt.id==='kuiper'?2.35:.55;
      target.position.set(Math.cos(angle)*r,0,-Math.sin(angle)*r);target.radius=0;
    }
    updateOrbits();
    if(following){
      const focus=planets.find(p=>p.world.id===following)!;
      camera.position.add(focus.root.position.clone().sub(controls.target));controls.target.copy(focus.root.position);
    }
  }
  const labelDirections=new Map<string,{heading:LabelDirection;dx:number;dy:number}>();
  function updateLabels(seconds:number){
    ink.clearRect(0,0,width,height);if(!labelsVisible)return;
    const pxPerUnit=height/(camera.top-camera.bottom)*camera.zoom;
    const projected=targets.filter(target=>target.enabled).map(target=>{const p=target.position.clone().project(camera);return {id:target.id,target,x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z,r:target.radius*pxPerUnit};});
    const byId=new Map(projected.map(p=>[p.id,p]));
    const solids=projected.filter(p=>p.z>=-1&&p.z<=1&&p.target.bodyRadius>0).map(p=>({...p,r:p.target.bodyRadius*pxPerUnit}));
    ink.font="11px 'Segoe UI',system-ui,sans-serif";
    for(const [layer,p] of labelsFarToNear(projected).entries()){
      const label=p.target.label;
      label.style.zIndex=String(layer+1);
      if(p.z< -1||p.z>1){label.hidden=true;continue;}
      // Extra names appear as their system becomes readable. The selected body
      // remains available at physical scale, but still obeys camera depth.
      if(isExtraWorld(p.id)&&p.id!==selected&&following!==p.target.parent&&p.r<2.3){label.hidden=true;continue;}
      const w=Math.ceil(ink.measureText(p.target.name).width)+27,h=23;
      const parent=byId.get(p.target.parent!);
      const dx=parent?p.x-parent.x:1,dy=parent?p.y-parent.y:-1,previous=labelDirections.get(p.id);
      // A paused scene must also freeze an unfinished conjunction turn. Pan
      // translations keep this ray unchanged; orbit motion or camera rotation
      // can advance the heading without changing the centre offset's length.
      const heading=previous&&Math.hypot(dx-previous.dx,dy-previous.dy)<1e-8?previous.heading:
        radialDirection(p,parent,previous?.heading,seconds);
      labelDirections.set(p.id,{heading,dx,dy});
      const rect=radialLabel(p,parent,w,h,heading);
      const foreground=foregroundBodies(p,solids);
      p.target.labelOccluders=foreground;
      label.hidden=!labelInView(rect,width,height);
      label.style.maskImage=labelMask(rect,foreground);
      label.style.width=`${w}px`;label.style.transform=`translate(${rect.x.toFixed(2)}px,${rect.y.toFixed(2)}px)`;
      if(label.hidden)continue;
      const leader=labelLeader(p,rect);
      ink.strokeStyle=p.id===selected?'#eac58aaa':'#7e91a44a';ink.lineWidth=1;
      if(leader){
        ink.beginPath();
        for(const segment of visibleLeaderSegments(leader,foreground)){ink.moveTo(segment.start.x,segment.start.y);ink.lineTo(segment.end.x,segment.end.y);}
        ink.stroke();
      }
      if(p.r<2){
        ink.save();
        for(const solid of foreground.filter(s=>Math.hypot(s.x-p.x,s.y-p.y)<s.r+1.5)){
          ink.beginPath();ink.rect(0,0,width,height);ink.arc(solid.x,solid.y,solid.r,0,TAU);ink.clip('evenodd');
        }
        ink.fillStyle=p.target.colour;ink.beginPath();ink.arc(p.x,p.y,1.5,0,TAU);ink.fill();ink.restore();
      }
    }
  }
  function resize(){
    width=Math.max(1,mount.clientWidth);height=Math.max(1,mount.clientHeight);
    renderer.setSize(width,height,false);const extent=outerRadius(amount,expanded)*1.13,aspect=width/height;
    const halfHeight=extent/Math.min(1,aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();
    const dpr=Math.min(devicePixelRatio,2);renderer.setPixelRatio(dpr);labelCanvas.width=Math.round(width*dpr);labelCanvas.height=Math.round(height*dpr);ink.setTransform(dpr,0,0,dpr,0,0);controls.handleResize();
  }
  function fit(view?:string){
    following='';
    labelDirections.clear();
    const offset=camera.position.clone().sub(controls.target),up=camera.up.clone();
    controls.reset();controls.target.set(0,0,0);camera.zoom=1;camera.up.set(0,1,0);
    if(view==='fit'){camera.position.copy(offset).setLength(150);camera.up.copy(up);}
    else if(view==='top'){camera.position.set(0,150,0);camera.up.set(0,0,-1);}else if(view==='edge')camera.position.set(0,0,150);else camera.position.set(0,100,90);
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();controls.update();resize();
  }
  const observer=new ResizeObserver(()=>{if(dialog.open)resize();});
  window.addEventListener('displaychange',()=>{if(dialog.open)resize();});
  function draw(now:number){
    if(!dialog.open){frame=0;return;}
    const seconds=last===undefined?1/60:(now-last)/1000;
    if(!document.hidden&&last!==undefined&&running){
      const next=advanceTime(simulation,(now-last)/1000,rate*direction);simulation=next;
      if(next===MIN_DATE||next===MAX_DATE){running=false;updateStatus('Date limit reached · choose a date between 1000 and 3000, or reverse time.');}
    }
    last=document.hidden?undefined:now;controls.update();
    const touchDelta=touchPan.consume();panBy(touchDelta.x,touchDelta.y);
    updateScene();renderer.render(scene,camera);updateLabels(seconds);
    if(now-lastUI>200){
      updateUI();lastUI=now;
      const pixelsPerUnit=height/(camera.top-camera.bottom)*camera.zoom*renderer.getPixelRatio();
      for(const p of planets){
        if(!p.target.enabled)continue;
        const position=p.root.position.clone().project(camera),radius=diameterAt(p.world,amount)*pixelsPerUnit/2;
        const visible=position.z>=-1&&position.z<=1&&Math.abs(position.x)<=1+radius/(width/2)&&Math.abs(position.y)<=1+radius/(height/2);
        p.surface.update(visible?radius*2:0,now);
      }
    }frame=requestAnimationFrame(draw);
  }
  function open(){
    if(dialog.open)return;dialog.showModal();document.body.classList.add('orrery-open');onOpen();
    if(firstOpen){simulation=Date.now();firstOpen=false;fit();}else resize();
    observer.observe(mount);last=undefined;updateUI();updateScene();if(!frame)frame=requestAnimationFrame(draw);
  }
  function close(){endPan();touchPan.reset();pointerStart=undefined;dialog.close();document.body.classList.remove('orrery-open');cancelAnimationFrame(frame);frame=0;last=undefined;observer.disconnect();for(const p of planets)p.surface.releaseDetails();opener.focus({preventScroll:true});}
  opener.onclick=open;$('.orrery-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  document.addEventListener('visibilitychange',()=>{last=undefined;if(document.hidden){touchPan.reset();pointerStart=undefined;}});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();running=false;$('.orrery-error').hidden=false;$('.orrery-error').textContent='The graphics context was interrupted. Reload the app to restore the orrery.';updateUI();});
  slider.oninput=()=>{amount=Number(slider.value)/100;$('#orrery-scale-value').textContent=amount===1?'Even spacing':amount===0?'True scale':`${slider.value}% normalised`;$('#orrery-mode-note').textContent=amount===0?'True distances & diameters · labels mark tiny worlds':'Illustrated sizes & orbital spacing';resize();};
  dialog.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach(button=>button.onclick=()=>{slider.value=button.dataset.scale!;slider.dispatchEvent(new Event('input'));});
  dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>fit(button.dataset.view));
  labelToggle.onchange=()=>{labelsVisible=labelToggle.checked;$('.orrery-labels').hidden=!labelsVisible;ink.clearRect(0,0,width,height);};
  orbitToggle.onchange=()=>{orbitsVisible=orbitToggle.checked;planets.forEach(p=>{if(p.orbit)p.orbit.visible=orbitsVisible&&p.target.enabled;});};
  catalogueToggle.onchange=()=>{
    expanded=catalogueToggle.checked;
    const previous=ALL_WORLDS.find(w=>w.id===selected);
    const followed=ALL_WORLDS.find(w=>w.id===following);
    if(!expanded&&isExtraWorld(selected))selected=previous?.satellite?.parent??previous?.region??'asteroids';
    if(!expanded&&isExtraWorld(following))following=followed?.satellite?.parent??'';
    targets.forEach(target=>{target.enabled=expanded||!isExtraWorld(target.id);if(!target.enabled)target.label.hidden=true;});
    $<HTMLSelectElement>('#orrery-inspect').innerHTML=inspectOptions(expanded);
    planets.forEach(p=>{if(!p.target.enabled)p.surface.releaseDetails();});
    renderedDate=NaN;orbitScale=NaN;labelDirections.clear();
    resize();updateScene();inspect(selected);
    if(following)focusWorld(following);
    updateStatus(`${expanded?`${ALL_MOONS.length} moons · ${ASTEROIDS.length} asteroids · ${KUIPER_BODIES.length} Kuiper belt bodies`:'Main worlds'} · ${running?'Running':'Paused'}`);
  };
  $<HTMLSelectElement>('#orrery-inspect').onchange=event=>inspect((event.target as HTMLSelectElement).value);
  $('.orrery-info-close').onclick=()=>inspect('');
  function focusWorld(id:string){
    const p=planets.find(p=>p.world.id===id&&p.target.enabled);if(!p)return;
    const offset=camera.position.clone().sub(controls.target);
    controls.target.copy(p.root.position);camera.position.copy(p.root.position).add(offset);following=p.world.id;
    const children=moonsFor(expanded).filter(m=>m.satellite!.parent===id);
    const radius=p.world.satellite||p.world.kepler?diameterAt(p.world,amount)/2:
      Math.max(p.target.radius,...children.map(m=>mix(m.satellite!.distanceKm*(1+m.satellite!.eccentricity)/AU_KM,moonOrbitRadius(m,1,expanded),amount)+diameterAt(m,amount)/2));
    const span=Math.min(camera.top-camera.bottom,camera.right-camera.left);
    camera.zoom=THREE.MathUtils.clamp(span/(radius*2.8),controls.minZoom,controls.maxZoom);
    camera.updateProjectionMatrix();controls.update();
  }
  $('.orrery-focus').onclick=()=>{
    focusWorld(selected);
    // Let the requested close-up use the phone's narrow stage. Selecting a
    // label or another Explore entry brings the information card back.
    if(width<700)$('.orrery-info').hidden=true;
  };
  play.onclick=()=>{running=!running;last=undefined;updateUI();updateStatus();};
  $('#orrery-direction').onclick=()=>{direction*=-1;$('#orrery-direction').textContent=direction<0?'← Reverse':'Forward →';$('#orrery-direction').setAttribute('aria-pressed',String(direction<0));$('#orrery-direction').title=direction<0?'Run time forwards':'Reverse time';updateStatus();};
  $<HTMLSelectElement>('#orrery-speed').onchange=event=>{const value=(event.target as HTMLSelectElement).value;rate=value==='real'?60/(YEAR_DAYS*86400):value==='week'?7/YEAR_DAYS:Number(value);last=undefined;updateStatus();};
  dateInput.oninput=()=>{dateDirty=true;dateInput.setCustomValidity('');};
  $('.orrery-date-form').onsubmit=event=>{
    event.preventDefault();const ms=new Date(dateInput.value).getTime();
    if(!Number.isFinite(ms)||ms<MIN_DATE||ms>MAX_DATE){dateInput.setCustomValidity('Choose a valid local date between 1000 and 3000.');dateInput.reportValidity();return;}
    simulation=ms;running=false;dateDirty=false;last=undefined;labelDirections.clear();updateUI();updateStatus('Paused at your selected date · press Play to continue.');
  };
  $('#orrery-now').onclick=()=>{simulation=Math.max(MIN_DATE,Math.min(MAX_DATE,Date.now()));dateDirty=false;dateInput.setCustomValidity('');last=undefined;labelDirections.clear();updateUI();updateStatus('Returned to the current date and time.');};
  let pointerStart:{id:number;x:number;y:number}|undefined;
  renderer.domElement.addEventListener('pointerdown',event=>{
    if(event.button===0)pointerStart=event.pointerType==='touch'&&touchPan.suppressTap?undefined:{id:event.pointerId,x:event.clientX,y:event.clientY};
  });
  document.addEventListener('pointermove',event=>{
    if(pointerStart?.id===event.pointerId&&Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5)pointerStart=undefined;
  });
  renderer.domElement.addEventListener('pointercancel',()=>{pointerStart=undefined;});
  renderer.domElement.addEventListener('lostpointercapture',()=>{pointerStart=undefined;});
  renderer.domElement.addEventListener('pointerup',event=>{
    if(!pointerStart||pointerStart.id!==event.pointerId||(event.pointerType==='touch'&&touchPan.suppressTap)||Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y)>5){pointerStart=undefined;return;}pointerStart=undefined;
    const rect=renderer.domElement.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top,pxPerUnit=height/(camera.top-camera.bottom)*camera.zoom;
    const candidates=planets.filter(p=>p.target.enabled).map(p=>{const v=p.root.position.clone().project(camera);return {id:p.world.id,z:v.z,d:Math.hypot((v.x+1)*width/2-x,(1-v.y)*height/2-y),r:Math.max(9,p.target.radius*pxPerUnit)};}).filter(p=>p.z>=-1&&p.z<=1&&p.d<=p.r).sort((a,b)=>a.z-b.z);
    if(candidates.length)inspect(candidates[0].id);
  });
  stage.addEventListener('keydown',event=>{if(event.target===renderer.domElement&&event.key==='Home')fit();});
  renderer.domElement.tabIndex=0;
}
