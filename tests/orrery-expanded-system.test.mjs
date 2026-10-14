import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALL_MOONS, MOONS, ASTEROIDS, WORLDS, worldsFor, isExtraWorld, J2000, DAY_MS, AU_KM, MIN_DATE, MAX_DATE,
  NORMAL_RADII, EXPANDED_RADII, NORMAL_GAP, MOON_GAP, ASTEROID_GAP, footprint, moonOrbitRadius,
  satellitePositionAt, satelliteOffset, positionAt, positionFromElements, elementsAt, displayPosition,
  diameterAt, asteroidOrbitRadius, beltHalfWidth, eclipticPole, jdToMs } from '../src/orrery-model.ts';

test('expanded catalogue has unique selectable identities, complete major moon families and named belt bodies',()=>{
  assert.equal(MOONS.length,3);
  assert.equal(ALL_MOONS.length,46);
  assert.equal(ASTEROIDS.length,16);
  const defaults=worldsFor(),expanded=worldsFor(true);
  assert.equal(new Set(expanded.map(w=>w.id)).size,expanded.length,'52 Europa must not share Jupiter’s Europa identity');
  assert.ok(defaults.every(w=>!isExtraWorld(w.id)));
  for(const parent of ['earth','mars','jupiter','saturn','uranus','neptune','pluto']){
    assert.ok(ALL_MOONS.some(m=>m.satellite.parent===parent));
  }
  for(const name of ['Io','Europa','Titan','Enceladus','Oberon','Triton','Nereid','Hydra'])assert.ok(expanded.some(w=>w.name===name));
  for(const name of ['Ceres','Vesta','Pallas','Hygiea','Psyche','Ida','Gaspra'])assert.ok(ASTEROIDS.some(w=>w.name===name));
});

test('every expanded planet system and belt reserves the same clear edge gap',()=>{
  for(const expanded of [false,true]){
    const radii=expanded?EXPANDED_RADII:NORMAL_RADII,ids=Object.keys(radii);
    for(let i=1;i<ids.length;i++){
      const previous=ids[i-1],current=ids[i];
      const gap=radii[current]-footprint(current,expanded)-radii[previous]-footprint(previous,expanded);
      assert.ok(Math.abs(gap-NORMAL_GAP)<1e-12,`${previous} → ${current}`);
    }
  }
  assert.ok(EXPANDED_RADII.kuiper>NORMAL_RADII.kuiper);
  assert.ok(footprint('saturn',true)>footprint('saturn'));
  for(const parent of WORLDS){
    const children=ALL_MOONS.filter(m=>m.satellite.parent===parent.id).sort((a,b)=>a.satellite.distanceKm-b.satellite.distanceKm);
    let edge=parent.displayDiameter/2*(parent.id==='saturn'?2.3:1);
    for(const moon of children){
      const radius=moonOrbitRadius(moon,1,true);
      assert.ok(Math.abs(radius-moon.displayDiameter/2-edge-MOON_GAP)<1e-12);
      edge=radius+moon.displayDiameter/2;
    }
    assert.ok(footprint(parent.id,true)>=edge-1e-12);
  }
});

test('named asteroids have ordered, separate lanes wholly inside the expanded belt',()=>{
  const sorted=[...ASTEROIDS].sort((a,b)=>a.elements[0]-b.elements[0]);
  let edge=EXPANDED_RADII.asteroids-beltHalfWidth('asteroids',true);
  for(const [i,world] of sorted.entries()){
    const radius=asteroidOrbitRadius(world.id),inner=radius-world.displayDiameter/2;
    assert.ok(Math.abs(inner-edge-(i?ASTEROID_GAP:0))<1e-12);
    edge=radius+world.displayDiameter/2;
    assert.ok(edge<=EXPANDED_RADII.asteroids+beltHalfWidth('asteroids',true)+1e-12);
    assert.ok(Math.abs(Math.hypot(...displayPosition(positionAt(world,J2000),world.id,1,true))-radius)<1e-10);
  }
});

test('the toggle leaves physical positions and sizes unchanged; intermediate scales preserve direction',()=>{
  for(const world of WORLDS){
    const real=positionAt(world,J2000);
    assert.deepEqual(displayPosition(real,world.id,0),displayPosition(real,world.id,0,true));
  }
  for(const moon of MOONS)assert.deepEqual(satelliteOffset(moon,J2000,0),satelliteOffset(moon,J2000,0,true));
  for(const world of worldsFor(true)){
    assert.ok(Math.abs(diameterAt(world,0)-world.diameterKm/AU_KM)<1e-15);
    for(const ms of [MIN_DATE,J2000,Date.UTC(2026,9,13),MAX_DATE])for(const amount of [0,.25,.75,1]){
      const p=world.satellite?satelliteOffset(world,ms,amount,true):displayPosition(positionAt(world,ms),world.id,amount,true);
      assert.ok(p.every(Number.isFinite),`${world.name} at ${ms}/${amount}`);
    }
  }
  for(const moon of ALL_MOONS){
    const physical=satelliteOffset(moon,J2000,0,true),display=satelliteOffset(moon,J2000,.6,true);
    const cross=[physical[1]*display[2]-physical[2]*display[1],physical[2]*display[0]-physical[0]*display[2],physical[0]*display[1]-physical[1]*display[0]];
    assert.ok(Math.hypot(...cross)<1e-12);
  }
});

test('moon ellipses use measured eccentricity, epoch and orbital period independently of spin',()=>{
  for(const moon of ALL_MOONS){
    const s=moon.satellite,epoch=jdToMs(s.epochJD),a=s.distanceKm/AU_KM;
    for(const [E,expected] of [[0,a*(1-s.eccentricity)],[Math.PI,a*(1+s.eccentricity)]]){
      assert.ok(Math.abs(Math.hypot(...satellitePositionAt(moon,epoch,E))-expected)<1e-12);
      assert.ok(Math.abs(Math.hypot(...satelliteOffset(moon,epoch,1,true,E))-moonOrbitRadius(moon,1,true))<1e-12);
    }
    const p=satellitePositionAt(moon,epoch),after=satellitePositionAt(moon,epoch+s.periodDays*DAY_MS);
    assert.ok(Math.hypot(...p.map((v,i)=>v-after[i]))<a*1e-8);
    assert.deepEqual(satellitePositionAt({...moon,spinHours:1},epoch+DAY_MS),satellitePositionAt(moon,epoch+DAY_MS));
  }
  const triton=ALL_MOONS.find(m=>m.id==='triton'),pole=eclipticPole(triton.satellite.poleRaDec);
  const before=satellitePositionAt(triton,J2000),after=satellitePositionAt(triton,J2000+1000);
  const momentum=[before[1]*after[2]-before[2]*after[1],before[2]*after[0]-before[0]*after[2],before[0]*after[1]-before[1]*after[0]];
  assert.ok(momentum.reduce((sum,v,i)=>sum+v*pole[i],0)<0,'Triton goes backwards around Neptune’s equator');
});

test('independent Horizons vectors validate ecliptic, Laplace and equatorial reference frames at J2000',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/orrery-horizons.json',import.meta.url),'utf8'));
  for(const ref of fixture.moons){
    const moon=ALL_MOONS.find(m=>m.id===ref.id),model=satellitePositionAt(moon,J2000);
    const error=Math.hypot(...model.map((v,i)=>v-ref.position[i]))/Math.hypot(...ref.position);
    assert.ok(error<ref.maxRelativeError,`${ref.id}: ${error}`);
  }
});

test('SBDB mean anomalies advance from their own JD epoch and keep the complete Kepler ellipse',()=>{
  for(const world of ASTEROIDS){
    const epoch=jdToMs(world.kepler.epochJD),atEpoch=elementsAt(world,epoch);
    assert.deepEqual(atEpoch,world.elements);
    assert.deepEqual(positionAt(world,epoch),positionFromElements(world.elements));
    const next=elementsAt(world,epoch+DAY_MS);
    assert.ok(Math.abs(next[3]-atEpoch[3]-world.kepler.meanMotion)<1e-12);
    const [a,e]=world.elements;
    assert.ok(Math.abs(Math.hypot(...positionFromElements(atEpoch,0))-a*(1-e))<1e-12);
    assert.ok(Math.abs(Math.hypot(...positionFromElements(atEpoch,Math.PI))-a*(1+e))<1e-12);
  }
});
