import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENVIRONMENTS } from '../src/environment.ts';
import { LAGRANGE_SYSTEMS, TRIANGULAR_STABILITY_LIMIT, massFraction, lagrangePoints, rotatingAcceleration,
  simulateLagrangeProbe, stepProbe, jacobiConstant } from '../src/lagrange-model.ts';
import { orreryLagrangePoints, worldPositionAt } from '../src/orrery-lagrange.ts';
import { MIN_DATE, MAX_DATE, J2000 } from '../src/orrery-model.ts';
import { ESCAPE_DEFAULTS, escapeExperiment, coastSpeedAtRadius, escapeCoastToInfinity, maximumStartingSpeed, retargetEscapeWorld } from '../src/wiki/escape-model.ts';
import { orbitCoordinates, probeDeparture, lagrangeBodyArtwork } from '../src/wiki/lagrange-view.ts';
import { lagrangeDefaults, resetLagrangePair } from '../src/wiki/lagrange-session.ts';
import { CLOSEUP_PLOT, closeupPosition, fitCloseupSpan, launchCloseupSpan } from '../src/wiki/lagrange-closeup.ts';
import { TELESCOPE_DEFAULTS, telescopeExperiment, besselJ1, diffractionIntensity, doubleStarIntensity } from '../src/wiki/telescope-model.ts';
import { getArticle, searchArticles } from '../src/wiki/content.ts';

const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

test('Lagrange pairs cover every Launch Lab world, with the Sun acting as a primary',()=>{
  const included=new Set(LAGRANGE_SYSTEMS.flatMap(s=>[s.primary,s.secondary]));
  for(const w of ENVIRONMENTS)assert.ok(included.has(w.name),w.name);
  assert.ok(LAGRANGE_SYSTEMS.some(s=>s.id==='earth-moon'));
  assert.ok(LAGRANGE_SYSTEMS.some(s=>s.id==='jupiter-ganymede'));
  assert.equal(new Set(LAGRANGE_SYSTEMS.map(s=>s.id)).size,LAGRANGE_SYSTEMS.length);
});

test('every Lagrange world has displayable artwork, including the non-launch companion Charon',()=>{
  for(const body of new Set(LAGRANGE_SYSTEMS.flatMap(s=>[s.primary,s.secondary]))){
    const art=lagrangeBodyArtwork(body,20);
    assert.match(art,/<(?:image|circle)\b/);assert.doesNotMatch(art,/undefined|NaN/);
  }
  assert.match(lagrangeBodyArtwork('charon',16),/<circle r="16"/);
});

test('all five points satisfy the rotating equations over small and comparable mass ratios',()=>{
  for(const mu of [1e-12,1e-8,.0001,.01215,.03852,.1,.5,...LAGRANGE_SYSTEMS.map(massFraction)]){
    const points=lagrangePoints(mu),[l1,l2,l3,l4,l5]=points;
    assert.ok(l3.x< -mu&&l1.x> -mu&&l1.x<1-mu&&l2.x>1-mu);
    for(const p of points)assert.ok(Math.hypot(...rotatingAcceleration(mu,p.x,p.y))<1e-10,`${mu}/${p.name}`);
    near(Math.hypot(l4.x+mu,l4.y),1);near(Math.hypot(l4.x-1+mu,l4.y),1);
    near(l4.y,-l5.y);assert.equal(l1.stable,false);assert.equal(l2.stable,false);assert.equal(l3.stable,false);
  }
  near(lagrangePoints(.5)[0].x,0);near(lagrangePoints(.5)[1].x,-lagrangePoints(.5)[2].x);
  assert.throws(()=>lagrangePoints(0));assert.throws(()=>lagrangePoints(NaN));assert.throws(()=>lagrangePoints(.6));
});

test('independent JPL coordinates validate all five roots and the barycentric convention',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/lagrange-jpl.json',import.meta.url),'utf8'));
  for(const {id,system} of fixture.systems){
    for(const p of lagrangePoints(Number(system.mass_ratio))){
      // JPL's catalogue coordinates and printed mass ratios are rounded
      // independently. 2e-11 separation units is under 3 m at one AU.
      near(p.x,Number(system[p.name][0]),2e-11);near(p.y,Number(system[p.name][1]),2e-11);
    }
    assert.ok(system.L1&&system.L5,id);
  }
});

test('triangular stability changes at the Routh criterion, including Pluto–Charon',()=>{
  const earthMoon=LAGRANGE_SYSTEMS.find(s=>s.id==='earth-moon'),plutoCharon=LAGRANGE_SYSTEMS.find(s=>s.id==='pluto-charon');
  assert.equal(lagrangePoints(massFraction(earthMoon))[3].stable,true);
  assert.equal(lagrangePoints(massFraction(plutoCharon))[3].stable,false);
  assert.equal(lagrangePoints(TRIANGULAR_STABILITY_LIMIT-1e-8)[3].stable,true);
  assert.equal(lagrangePoints(TRIANGULAR_STABILITY_LIMIT+1e-8)[3].stable,false);
});

test('orrery points remain finite across dates, expanded systems and the complete scale slider',()=>{
  for(const pair of LAGRANGE_SYSTEMS)for(const ms of [MIN_DATE,J2000,Date.UTC(2026,9,19),MAX_DATE])for(const expanded of [false,true])for(const amount of [0,.5,1]){
    const points=orreryLagrangePoints(pair,ms,amount,expanded);
    for(const point of points){assert.ok(point.position.every(Number.isFinite),`${pair.id}/${ms}/${amount}`);assert.ok(point.companionDistanceKm>0);}
    if(amount===0){
      const primary=worldPositionAt(pair.primary,ms,0),secondary=worldPositionAt(pair.secondary,ms,0),d=Math.hypot(...primary.map((n,i)=>n-secondary[i]));
      for(const point of points.filter(p=>p.name==='L4'||p.name==='L5')){
        near(Math.hypot(...point.position.map((n,i)=>n-primary[i])),d,1e-10);
        near(Math.hypot(...point.position.map((n,i)=>n-secondary[i])),d,1e-10);
      }
      assert.deepEqual(points,orreryLagrangePoints(pair,ms,0,!expanded),'the display toggle cannot move physical points');
    }
  }
});

test('L4 leads and L5 trails actual motion, including inclined moon planes',()=>{
  for(const pair of LAGRANGE_SYSTEMS){
    const relative=ms=>{const a=worldPositionAt(pair.primary,ms,0),b=worldPositionAt(pair.secondary,ms,0);return b.map((n,i)=>n-a[i]);};
    const before=relative(J2000-60000),after=relative(J2000+60000),velocity=after.map((n,i)=>n-before[i]);
    const points=orreryLagrangePoints(pair,J2000,0),delta=points[3].position.map((n,i)=>n-points[4].position[i]);
    assert.ok(delta.reduce((sum,n,i)=>sum+n*velocity[i],0)>0,pair.id);
  }
});

test('probe integration conserves Jacobi and distinguishes disturbed L1 from L4',()=>{
  const pair=LAGRANGE_SYSTEMS.find(s=>s.id==='earth-moon'),mu=massFraction(pair);
  const runs=['L1','L4'].map(point=>simulateLagrangeProbe({mu,point,offset:.001,kick:0,orbits:6}));
  const excursion=(run,point)=>Math.max(...run.samples.map(s=>Math.hypot(s.x-point.x,s.y-point.y)));
  assert.ok(runs[0].maxJacobiError<1e-6);assert.ok(runs[1].maxJacobiError<1e-10);
  assert.ok(excursion(runs[0],lagrangePoints(mu)[0])>10*excursion(runs[1],lagrangePoints(mu)[3]));
  const p=lagrangePoints(mu)[3],initial={time:0,x:p.x+.001,y:p.y,vx:0,vy:0};
  let coarse=initial,fine=initial;
  for(let i=0;i<1000;i++)coarse=stepProbe(mu,coarse,.01);
  for(let i=0;i<2000;i++)fine=stepProbe(mu,fine,.005);
  assert.ok(Math.hypot(coarse.x-fine.x,coarse.y-fine.y)<1e-8);
  near(jacobiConstant(mu,initial),jacobiConstant(mu,fine),1e-11);
});

test('probe runs stop safely at a body, stay bounded and reject invalid durations',()=>{
  const mu=.01215,l1=lagrangePoints(mu)[0];
  const run=simulateLagrangeProbe({mu,point:'L1',offset:.001,kick:0,orbits:1,primaryRadius:l1.x+mu+.01});
  assert.equal(run.end,'primary');assert.equal(run.samples.length,1);
  for(const mu of [1e-6,.01215,.1,.5])for(const point of ['L1','L4']){
    const r=simulateLagrangeProbe({mu,point,offset:.02,kick:.005,orbits:2});
    assert.ok(r.samples.every(s=>Object.values(s).every(Number.isFinite)));
    assert.ok(r.samples.length<6000);
  }
  assert.throws(()=>simulateLagrangeProbe({mu,point:'L1',offset:.001,kick:0,orbits:Infinity}));
});

test('escape thresholds reproduce familiar speeds and circular-speed relation',()=>{
  const earth=escapeExperiment(ESCAPE_DEFAULTS),moon=escapeExperiment({...ESCAPE_DEFAULTS,world:'moon'});
  near(earth.escapeSpeed/1000,11.181,0.002);near(moon.escapeSpeed/1000,2.373,0.005);
  near(earth.escapeSpeed/earth.circularSpeed,Math.SQRT2);
  for(const world of ENVIRONMENTS){const r=escapeExperiment({...ESCAPE_DEFAULTS,world:world.name});assert.ok(Number.isFinite(r.escapeSpeed)&&r.escapeSpeed>0);}
});

test('switching launch worlds keeps the speed thumb, height and mass but uses each local escape speed',()=>{
  for(const altitudeKm of [0,50000])for(const factor of [0,.8,1,1.2,2]){
    const base={...ESCAPE_DEFAULTS,altitudeKm,massKg:100};
    base.speedKmS=escapeExperiment(base).escapeSpeed/1000*factor;
    for(const world of ENVIRONMENTS){
      const next=retargetEscapeWorld(base,world.name),r=escapeExperiment(next);
      near(maximumStartingSpeed(next),2*r.escapeSpeed/1000);
      near(next.speedKmS/maximumStartingSpeed(next),factor/2);
      assert.equal(next.altitudeKm,altitudeKm);assert.equal(next.massKg,100);
      assert.equal(r.outcome,factor<1?'returns':factor===1?'threshold':'escapes');
      near(retargetEscapeWorld(next,'earth').speedKmS,base.speedKmS,1e-9);
    }
  }
  assert.ok(retargetEscapeWorld(ESCAPE_DEFAULTS,'moon').speedKmS<ESCAPE_DEFAULTS.speedKmS);
  const excessive={...ESCAPE_DEFAULTS,speedKmS:9999};
  near(retargetEscapeWorld(excessive,'moon').speedKmS,maximumStartingSpeed({...excessive,world:'moon'}));
});

test('a new Lagrange pair clears elapsed time, comparison, custom masses and close-up scale',()=>{
  const options={...lagrangeDefaults(),point:'L1',offsetPercent:.4,kickPercent:.2,orbits:12,custom:true,ratioLog:1};
  const previous={kind:'lagrange',options,time:20,view:'closeup',closeupSpan:.3,slowCloseup:false,pinned:{options:{...options},time:12}};
  for(const pair of LAGRANGE_SYSTEMS){
    const next=resetLagrangePair(previous,pair.id);
    assert.equal(next.time,0);assert.equal(next.pinned,undefined);assert.equal(next.closeupSpan,undefined);
    assert.equal(next.options.system,pair.id);assert.equal(next.options.custom,false);
    near(next.options.ratioLog,Math.max(0,Math.min(7,Math.log10(pair.primaryGM/pair.secondaryGM))));
    for(const key of ['point','offsetPercent','kickPercent','orbits'])assert.equal(next.options[key],options[key]);
    assert.equal(next.view,'closeup');assert.equal(next.slowCloseup,false);
  }
  assert.equal(previous.time,20);assert.equal(previous.options.custom,true);assert.ok(previous.pinned);
  assert.throws(()=>resetLagrangePair(previous,'unknown'));
});

test('close-up uses equal physical scales, marks off-screen drift and fits the computed trajectory',()=>{
  const pair=LAGRANGE_SYSTEMS.find(s=>s.id==='earth-moon'),mu=massFraction(pair),origin=lagrangePoints(mu)[0];
  const span=launchCloseupSpan(.1),centre=closeupPosition(origin,origin,span);
  const oneKm=1/pair.distanceKm;
  const right=closeupPosition({x:origin.x+oneKm,y:origin.y},origin,span),up=closeupPosition({x:origin.x,y:origin.y+oneKm},origin,span);
  near(right.x-centre.x,centre.y-up.y,1e-9);assert.equal(centre.outside,false);
  const run=simulateLagrangeProbe({mu,point:'L1',offset:.001,kick:0,orbits:2});
  near(Math.hypot(run.samples[0].x-origin.x,run.samples[0].y-origin.y)*pair.distanceKm,384.4,1e-6);
  assert.equal(closeupPosition(run.samples[0],origin,span).outside,false);
  const departed=run.samples.find(s=>s.time>Math.PI/2),edge=closeupPosition(departed,origin,span);
  assert.equal(edge.outside,true);
  assert.ok(edge.edgeX>=CLOSEUP_PLOT.x&&edge.edgeX<=CLOSEUP_PLOT.x+CLOSEUP_PLOT.w);
  assert.ok(edge.edgeY>=CLOSEUP_PLOT.y&&edge.edgeY<=CLOSEUP_PLOT.y+CLOSEUP_PLOT.h);
  const fitted=fitCloseupSpan([{states:run.samples,origin}]);
  for(const state of run.samples)assert.equal(closeupPosition(state,origin,fitted).outside,false);
  near(closeupPosition(origin,origin,fitted).x,centre.x);near(closeupPosition(origin,origin,fitted).y,centre.y);
});

test('mass changes energy but not escape speed; altitude and outward coast obey energy conservation',()=>{
  const a=escapeExperiment(ESCAPE_DEFAULTS),b=escapeExperiment({...ESCAPE_DEFAULTS,massKg:2000});
  assert.equal(a.escapeSpeed,b.escapeSpeed);near(b.bindingEnergy/a.bindingEnergy,2);
  const high=escapeExperiment({...ESCAPE_DEFAULTS,altitudeKm:a.world.radius/1000});near(high.escapeSpeed,a.escapeSpeed/Math.SQRT2);
  for(const factor of [.8,1,1.2]){
    const options={...ESCAPE_DEFAULTS,speedKmS:a.escapeSpeed*factor/1000},r=escapeExperiment(options);
    assert.equal(r.outcome,factor<1?'returns':factor===1?'threshold':'escapes');
    for(const radius of [r.radius,r.radius*1.2,r.radius*2]){
      const speed=coastSpeedAtRadius(options,radius);if(speed!==null)near(speed*speed/2-r.gm/radius,r.specificEnergy,1e-7);
    }
    if(factor<1){const turn=(r.maximumAltitudeKm*1000+r.world.radius);near(coastSpeedAtRadius(options,turn),0,.001);assert.equal(coastSpeedAtRadius(options,turn*1.1),null);}
  }
  assert.throws(()=>escapeExperiment({...ESCAPE_DEFAULTS,massKg:0}));
});

test('telescope changes separate aperture, magnification, collection and obstruction',()=>{
  const a=telescopeExperiment(TELESCOPE_DEFAULTS),twice=telescopeExperiment({...TELESCOPE_DEFAULTS,apertureMm:200});
  near(a.magnification,50);near(twice.collectingAreaMm2/a.collectingAreaMm2,4);near(twice.rayleighArcsec/a.rayleighArcsec,.5);
  const eyepiece=telescopeExperiment({...TELESCOPE_DEFAULTS,eyepieceMm:10});
  near(eyepiece.magnification,100);assert.equal(eyepiece.rayleighArcsec,a.rayleighArcsec);assert.equal(eyepiece.collectingAreaMm2,a.collectingAreaMm2);
  const mirror=telescopeExperiment({...TELESCOPE_DEFAULTS,type:'reflector',obstruction:.2});near(mirror.collectingAreaMm2/a.collectingAreaMm2,.96);
  near(telescopeExperiment({...TELESCOPE_DEFAULTS,wavelengthNm:700}).rayleighArcsec/a.rayleighArcsec,700/550);
});

test('the compressed escape plot separates finite turning points from the infinity boundary',()=>{
  const escape=escapeExperiment(ESCAPE_DEFAULTS).escapeSpeed/1000;
  for(const factor of [0,.2,.8,.999999,1,1.2,2]){
    const options={...ESCAPE_DEFAULTS,speedKmS:escape*factor};
    const result=escapeExperiment(options),coast=escapeCoastToInfinity(options),last=coast.points.at(-1);
    near(coast.points[0].speed,options.speedKmS*1000,1e-7);
    for(const [i,p] of coast.points.entries()){
      assert.ok(Number.isFinite(p.u)&&Number.isFinite(p.speed)&&p.speed>=0);
      if(i){assert.ok(p.u>=coast.points[i-1].u);assert.ok(p.speed<=coast.points[i-1].speed+1e-7);}
      if(p.u<1){const speed=coastSpeedAtRadius(options,result.radius/(1-p.u));near(p.speed,speed,0.003);}
    }
    if(factor<1){assert.equal(coast.endsAtInfinity,false);assert.ok(last.u<1);assert.equal(last.speed,0);near(coast.turningRadiusRatio,1/(1-factor*factor),.001);}
    else {assert.equal(coast.endsAtInfinity,true);assert.equal(last.u,1);near(last.speed,result.excessSpeed,.001);assert.equal(coast.turningRadiusRatio,null);}
  }
  assert.throws(()=>escapeCoastToInfinity(ESCAPE_DEFAULTS,0));
});

test('orbit and rotating views preserve distances and the measured probe departure',()=>{
  const mu=.01215,point=lagrangePoints(mu)[3],probe={x:point.x+.001,y:point.y+.002};
  near(probeDeparture(probe,point),Math.sqrt(5)*.1);
  for(const t of [0,.3,Math.PI,2*Math.PI,41]){
    const [x,y]=orbitCoordinates(probe.x,probe.y,t),[px,py]=orbitCoordinates(point.x,point.y,t);
    near(Math.hypot(x,y),Math.hypot(probe.x,probe.y));near(probeDeparture({x,y},{x:px,y:py}),probeDeparture(probe,point));
    const [ax,ay]=orbitCoordinates(-mu,0,t),[bx,by]=orbitCoordinates(1-mu,0,t);near(Math.hypot(ax-bx,ay-by),1);
  }
});

test('diffraction matches J1 references, the Airy zero and symmetric incoherent star profiles',()=>{
  near(besselJ1(1),.4400505857449335,1e-14);near(besselJ1(10),.0434727461688614,2e-13);near(besselJ1(20),.06683312417585,2e-7);
  near(diffractionIntensity(TELESCOPE_DEFAULTS,0),1);
  const exactZero=3.8317059702075125/Math.PI*550e-6/100*180*3600/Math.PI;
  assert.ok(diffractionIntensity(TELESCOPE_DEFAULTS,exactZero)<1e-25);
  for(const type of ['refractor','reflector'])for(const apertureMm of [20,100,500])for(const angle of [-8,-1,0,.5,8]){
    const o={...TELESCOPE_DEFAULTS,type,apertureMm};
    const intensity=doubleStarIntensity(o,angle);assert.ok(Number.isFinite(intensity)&&intensity>=0);
    near(intensity,doubleStarIntensity(o,-angle),1e-12);
    assert.equal(intensity,doubleStarIntensity({...o,eyepieceMm:5,focalMm:2000},angle),'angular diffraction is independent of eyepiece magnification');
  }
  near(doubleStarIntensity({...TELESCOPE_DEFAULTS,separationArcsec:0},0),2);
});

test('all three new topics expose an interactive lesson, sources and searchable concepts',()=>{
  for(const [id,kind] of [['escape-velocity','escape'],['lagrange-points','lagrange'],['telescopes','telescope']]){
    const article=getArticle(id);assert.equal(article.lab,kind);assert.equal(article.levels.length,3);assert.ok(article.sources.length>=3);
  }
  for(const [query,id] of [['escape speed','escape-velocity'],['Coriolis','lagrange-points'],['refractor','telescopes'],['mirror','telescopes'],['Rayleigh','telescopes']])assert.ok(searchArticles(query).some(a=>a.id===id));
});
