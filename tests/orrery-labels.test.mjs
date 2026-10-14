import test from 'node:test';
import assert from 'node:assert/strict';
import { placeLabel, easeLabel, labelsOverlap } from '../src/orrery-labels.ts';
import { MOONS, satelliteOffset, moonOrbitRadius, J2000, DAY_MS } from '../src/orrery-model.ts';

test('a moon label keeps its side when an earlier candidate becomes available again',()=>{
  const candidates=[{x:220,y:180,w:85,h:23},{x:140,y:110,w:85,h:23}];
  const initial=placeLabel(candidates,[{x:220,y:180,w:30,h:30}],640,480);
  assert.equal(initial.slot,1);
  const next=placeLabel(candidates,[],640,480,initial);
  assert.equal(next.slot,1,'removing a passing obstruction must not snap the name back to the right');
  const moved=candidates.map(r=>({...r,x:r.x+.25,y:r.y+.1}));
  assert.equal(placeLabel(moved,[],640,480,next).slot,1);
});

test('blocked placements change side only when necessary and never run off the stage',()=>{
  const candidates=[{x:600,y:180,w:85,h:23},{x:140,y:110,w:85,h:23}];
  const result=placeLabel(candidates,[],640,480,{slot:0,rect:candidates[0]});
  assert.equal(result.slot,1);
  assert.equal(placeLabel(candidates,[result.rect],640,480),undefined);
  assert.equal(labelsOverlap(result.rect,{x:100,y:100,w:60,h:30}),true);
});

test('a necessary label move eases smoothly and converges equally at different frame rates',()=>{
  const start={x:100,y:100,w:85,h:23},end={...start,x:300,y:150};
  for(const hz of [30,60,144]){
    let rect=start;
    for(let i=0;i<hz;i++)rect=easeLabel(rect,end,1/hz);
    assert.ok(Math.abs(rect.x-(300-200*Math.exp(-1/.12)))<1e-8);
  }
  assert.ok(easeLabel(start,end,10).x<170,'a suspended tab must not produce a full-width one-frame snap');
  assert.deepEqual(easeLabel(undefined,end,0),end);
});

test('Ganymede follows a continuous closed orbit through phase wraps in either direction',()=>{
  const ganymede=MOONS.find(w=>w.id==='ganymede');
  for(const amount of [0,.5,1]){
    const radius=moonOrbitRadius(ganymede,amount);
    const start=satelliteOffset(ganymede,J2000,amount);
    const finish=satelliteOffset(ganymede,J2000+ganymede.satellite.periodDays*DAY_MS,amount);
    assert.ok(Math.hypot(...finish.map((v,i)=>v-start[i]))<1e-10);
    for(const epoch of [J2000,J2000+ganymede.satellite.periodDays*DAY_MS]){
      const before=satelliteOffset(ganymede,epoch-1,amount),after=satelliteOffset(ganymede,epoch+1,amount);
      assert.ok(Math.hypot(...after.map((v,i)=>v-before[i]))<radius*1e-6);
      const radialVariation=ganymede.satellite.distanceKm/149597870.7*ganymede.satellite.eccentricity*(1-amount);
      assert.ok(Math.abs(Math.hypot(...after)-radius)<=radialVariation+1e-10,'physical eccentricity fades smoothly into the circular display lane');
    }
    assert.deepEqual(satelliteOffset({...ganymede,spinHours:1},J2000+DAY_MS,amount),satelliteOffset(ganymede,J2000+DAY_MS,amount),'surface spin cannot move a moon around Jupiter');
  }
});
