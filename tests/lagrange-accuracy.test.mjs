import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { dop853Trial, denseValue } from '../src/numerics/dop853.ts';
import { LAGRANGE_SYSTEMS, massFraction, lagrangePoints, rotatingAcceleration, simulateLagrangeProbe, probeStateAt, probeDeparture } from '../src/lagrange-model.ts';

const near=(a,b,tol,message='')=>assert.ok(Math.abs(a-b)<=tol,`${message}: ${a} vs ${b} (tolerance ${tol})`);

test('DOP853 continuous positions and velocities reproduce an analytic harmonic oscillator',()=>{
  for(const h of [.025,.05,.1]){
    const step=dop853Trial(([x,v])=>[v,-x],[1,0],h,1e-13,1e-15).dense(7);
    for(const fraction of [0,.017,.31,.5,.877,1]){
      const [x,v]=denseValue(step,7+h*fraction);
      near(x,Math.cos(h*fraction),1e-13,'position');near(v,-Math.sin(h*fraction),1e-13,'velocity');
    }
  }
  assert.ok(dop853Trial(([x,v])=>[v,-x],[1,0],.5,1e-13,1e-15).error>1,'an oversized step must be rejected');
});

test('rotating equations transform back to pure Newtonian gravity, including both Coriolis signs',()=>{
  for(const mu of [1e-12,.01215,.1,.5])for(const t of [.371,2.131]){
    const x=.7,y=.41,vx=-.013,vy=.057,[ax,ay]=rotatingAcceleration(mu,x,y,vx,vy);
    // R(t) [a_rot + 2 Ω×v_rot + Ω×(Ω×r)] = a_inertial.
    const rx=ax-2*vy-x,ry=ay+2*vx-y,c=Math.cos(t),s=Math.sin(t);
    const actual=[c*rx-s*ry,s*rx+c*ry];
    const probe=[c*x-s*y,s*x+c*y],bodies=[[-mu*c,-mu*s,1-mu],[(1-mu)*c,(1-mu)*s,mu]];
    const expected=[0,0];
    for(const [bx,by,m] of bodies){const dx=bx-probe[0],dy=by-probe[1],r=Math.hypot(dx,dy);expected[0]+=m*dx/r**3;expected[1]+=m*dy/r**3;}
    actual.forEach((v,i)=>near(v,expected[i],3e-14));
  }
});

test('the initial offset is a fraction of separation, and the kick is a rotating-frame velocity',()=>{
  for(const point of lagrangePoints(.01215))for(const offset of [.0002,.001,.02])for(const kick of [-.005,0,.005]){
    const run=simulateLagrangeProbe({mu:.01215,point:point.name,offset,kick,orbits:.01});
    const state=probeStateAt(run,0);
    near(state.x-point.x,offset,2e-16);assert.equal(state.y,point.y);
    assert.equal(state.vx,0);assert.equal(state.vy,kick);
    near(probeDeparture(state,point),offset*100,2e-14);
  }
});

test('an exactly unperturbed equilibrium has no artificial numerical drift in twelve pair orbits',()=>{
  for(const pair of LAGRANGE_SYSTEMS)for(const point of ['L1','L2','L3','L4','L5']){
    const mu=massFraction(pair),origin=lagrangePoints(mu).find(p=>p.name===point);
    const run=simulateLagrangeProbe({mu,point,offset:0,kick:0,orbits:12,primaryRadius:pair.primaryRadiusKm/pair.distanceKm,secondaryRadius:pair.secondaryRadiusKm/pair.distanceKm});
    assert.equal(run.end,'complete');near(run.samples.at(-1).time,24*Math.PI,1e-14);
    for(const time of [0,.137,12.317,run.samples.at(-1).time]){
      const state=probeStateAt(run,time);assert.equal(state.x,origin.x);assert.equal(state.y,origin.y);
      assert.equal(state.vx,0);assert.equal(state.vy,0);assert.equal(probeDeparture(state,origin),0);
    }
  }
});

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/lagrange-probes.json',import.meta.url),'utf8'));
for(const reference of fixture.cases)test(`independent SciPy propagation and off-grid replay: ${reference.id}`,()=>{
  const run=simulateLagrangeProbe(reference.options),origin=lagrangePoints(reference.options.mu).find(p=>p.name===reference.options.point);
  const end=run.samples.at(-1).time;
  assert.notEqual(run.end,'limit',reference.id);
  assert.ok(run.samples.length<50000&&run.samples.every(s=>Object.values(s).every(Number.isFinite)));
  let checked=0;
  for(const p of reference.checkpoints){
    if(p.time>end+1e-12)continue;
    const actual=probeStateAt(run,p.time),positionError=Math.hypot(actual.x-p.state[0],actual.y-p.state[1]);
    const tolerance=2*run.positionTolerance+5*p.referenceDisagreement+3e-12;
    assert.ok(positionError<tolerance,`${reference.id} t=${p.time}: position error ${positionError}, limit ${tolerance}`);
    near(probeDeparture(actual,origin),Math.hypot(p.state[0]-origin.x,p.state[1]-origin.y)*100,tolerance*100,'plotted departure');
    checked++;
  }
  assert.ok(checked>=4&&end>.12,`${reference.id}: not enough verified trajectory`);
  for(const p of reference.radau??[]){
    if(p.time>end)continue;
    const actual=probeStateAt(run,p.time);
    assert.ok(Math.hypot(actual.x-p.state[0],actual.y-p.state[1])<Math.max(5e-11,4*run.positionTolerance),'different Radau algorithm');
  }
  if(run.end!=='accuracy'){
    assert.equal(run.end,reference.end);
    near(end,reference.endTime,2e-7,'surface/region event time');
  }
});

test('largest predicted departure resolves independently located peaks between output times',()=>{
  const reference=fixture.cases.find(c=>c.id==='earth-moon-L4-long');
  const run=simulateLagrangeProbe(reference.options),origin=lagrangePoints(reference.options.mu)[3];
  const expected=Math.max(...reference.departurePeaks.map(p=>p.departure));
  const actual=run.samples.reduce((max,s)=>Math.max(max,probeDeparture(s,origin)/100),0);
  near(actual,expected,2e-11,'maximum departure');
  for(const peak of reference.departurePeaks){
    const vertex=run.samples.find(s=>Math.abs(s.time-peak.time)<1e-7);
    assert.ok(vertex,`missing peak at ${peak.time}`);
    near((vertex.x-origin.x)*vertex.vx+(vertex.y-origin.y)*vertex.vy,0,1e-13,'radial derivative at peak');
  }
});

test('surface contact is located on the surface, rather than one integration step below it',()=>{
  const pair=LAGRANGE_SYSTEMS.find(p=>p.id==='pluto-charon');
  const mu=massFraction(pair),radius=pair.secondaryRadiusKm/pair.distanceKm;
  const run=simulateLagrangeProbe({mu,point:'L4',offset:.001,kick:0,orbits:6,primaryRadius:pair.primaryRadiusKm/pair.distanceKm,secondaryRadius:radius});
  assert.equal(run.end,'secondary');const s=run.samples.at(-1);
  near(Math.hypot(s.x-1+mu,s.y),radius,2e-12);
});

test('long chaotic forecasts stop when two integrations no longer agree at the required precision',()=>{
  const pair=LAGRANGE_SYSTEMS.find(p=>p.id==='earth-moon'),mu=massFraction(pair);
  const run=simulateLagrangeProbe({mu,point:'L1',offset:.001,kick:0,orbits:12,primaryRadius:pair.primaryRadiusKm/pair.distanceKm,secondaryRadius:pair.secondaryRadiusKm/pair.distanceKm,distanceKm:pair.distanceKm});
  assert.equal(run.end,'accuracy');assert.ok(run.samples.at(-1).time>2*Math.PI&&run.samples.at(-1).time<24*Math.PI);
  assert.ok(run.maxPositionDisagreement<=run.positionTolerance);
  const clamped=probeStateAt(run,999);assert.deepEqual(clamped,run.samples.at(-1));
  assert.ok(run.maxJacobiError<1e-10);
});

test('invalid radii and dimensions cannot produce non-finite numerical states',()=>{
  for(const [key,value] of [['primaryRadius',0],['secondaryRadius',-1],['distanceKm',NaN],['distanceKm',Infinity]]){
    assert.throws(()=>simulateLagrangeProbe({mu:.01215,point:'L4',offset:.001,kick:0,orbits:1,[key]:value}),RangeError);
  }
});
