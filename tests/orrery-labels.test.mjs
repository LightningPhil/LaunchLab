import test from 'node:test';
import assert from 'node:assert/strict';
import { radialDirection, radialLabel, labelLeader, labelsFarToNear, labelInView, foregroundBodies, labelMask, foregroundBodyAt, visibleLeaderSegments } from '../src/orrery-labels.ts';
import { MOONS, satelliteOffset, moonOrbitRadius, J2000, DAY_MS } from '../src/orrery-model.ts';

const centre={x:320,y:240,r:25};
const body=(overrides={})=>({id:'moon',x:420,y:290,z:.2,r:5,...overrides});
const middle=rect=>({x:rect.x+rect.w/2,y:rect.y+rect.h/2});

test('labels point radially outwards at arbitrary angles throughout a complete orbit',()=>{
  for(let i=0;i<720;i++){
    const angle=i*Math.PI/360,dx=100*Math.cos(angle),dy=70*Math.sin(angle);
    const moon=body({x:centre.x+dx,y:centre.y+dy});
    const label=middle(radialLabel(moon,centre,85,23));
    const offset={x:label.x-moon.x,y:label.y-moon.y};
    assert.ok(offset.x*dx+offset.y*dy>0,'label remains on the outward ray');
    assert.ok(Math.abs(offset.x*dy-offset.y*dx)<1e-9,'there is no snapping to compass directions');
    assert.ok(Math.hypot(label.x-centre.x,label.y-centre.y)>Math.hypot(dx,dy));
  }
});

test('orbital quadrant and phase-wrap crossings cannot jump a label across its body',()=>{
  const at=angle=>radialLabel(body({x:centre.x+120*Math.cos(angle),y:centre.y+80*Math.sin(angle)}),centre,100,23);
  for(const boundary of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]){
    const before=at(boundary-1e-5),after=at(boundary+1e-5);
    assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<.01);
  }
  assert.ok(Math.hypot(at(.3).x-at(0).x,at(.3).y-at(0).y)>10,'the label follows the orbital angle, rather than holding a cardinal slot');
});

test('an edge-on conjunction retains a continuous heading and full clearance through zero projected radius',()=>{
  const beforeBody=body({x:centre.x-.001,y:centre.y}),afterBody=body({x:centre.x+.001,y:centre.y});
  const beforeHeading=radialDirection(beforeBody,centre);
  const afterHeading=radialDirection(afterBody,centre,beforeHeading);
  const before=radialLabel(beforeBody,centre,85,23,beforeHeading);
  const after=radialLabel(afterBody,centre,85,23,afterHeading);
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<.01,'no 180-degree side flip at conjunction');
  const exactBody=body({x:centre.x,y:centre.y});
  const exactHeading=radialDirection(exactBody,centre,beforeHeading);
  const exact=radialLabel(exactBody,centre,85,23,exactHeading);
  assert.ok(Object.values(exact).every(Number.isFinite));
  assert.deepEqual(exactHeading,beforeHeading);
  assert.ok(Math.hypot(middle(exact).x-centre.x,middle(exact).y-centre.y)>exactBody.r+Math.hypot(85,23)/2);
  assert.ok(Object.values(radialLabel(body(),undefined,85,23)).every(Number.isFinite),'the Sun has a stable standalone label');
});

test('label centres trace a circle with constant clearance, for short and long names',()=>{
  for(const [w,h] of [[27,23],[85,23],[180,23],[80,60]])for(const radius of [0,5,80]){
    const distances=[];
    for(let i=0;i<720;i++){
      const angle=i*Math.PI/360;
      const moon=body({x:centre.x+150*Math.cos(angle),y:centre.y+150*Math.sin(angle),r:radius});
      const rect=radialLabel(moon,centre,w,h),label=middle(rect);
      distances.push(Math.hypot(label.x-moon.x,label.y-moon.y));
      const closestX=Math.max(rect.x,Math.min(moon.x,rect.x+w));
      const closestY=Math.max(rect.y,Math.min(moon.y,rect.y+h));
      assert.ok(Math.hypot(closestX-moon.x,closestY-moon.y)>=radius+9-1e-10,'every part of the rectangle stays outside the object at every angle');
      const leader=labelLeader(moon,rect);
      assert.deepEqual(leader.end,label,'the line attaches to the text rectangle’s centre');
      assert.ok(Math.abs(Math.hypot(leader.start.x-moon.x,leader.start.y-moon.y)-radius-3)<1e-10);
    }
    assert.ok(Math.max(...distances)-Math.min(...distances)<1e-10,'the label shape cannot change the orbital offset');
  }
});

test('a conjunction turns the heading smoothly without shortening the line, at different frame rates',()=>{
  for(const hz of [30,60,144]){
    let heading={x:-1,y:0};
    const moon=body({x:centre.x+30,y:centre.y});
    for(let i=0;i<hz;i++){
      const previous=heading;heading=radialDirection(moon,centre,heading,1/hz);
      assert.ok(Math.abs(Math.hypot(heading.x,heading.y)-1)<1e-12);
      const turn=Math.atan2(previous.x*heading.y-previous.y*heading.x,previous.x*heading.x+previous.y*heading.y);
      assert.ok(Math.abs(turn)<=12/hz+1e-12);
      const label=middle(radialLabel(moon,centre,85,23,heading));
      assert.ok(Math.abs(Math.hypot(label.x-moon.x,label.y-moon.y)-(moon.r+9+Math.hypot(85,23)/2))<1e-10);
    }
    assert.deepEqual(heading,{x:1,y:0},'the heading settles on the outward ray in either display frame rate');
  }
});

test('passing labels, bodies, depth changes and selection never change radial placement',()=>{
  const moon=body(),expected=radialLabel(moon,centre,85,23);
  for(const z of [-.5,0,.5]){
    const other=body({id:'passing-moon',x:moon.x,y:moon.y,z});
    labelsFarToNear([moon,other]);labelMask(expected,foregroundBodies(moon,[other]));
    assert.deepEqual(radialLabel({...moon,z,selected:true},centre,85,23),expected);
  }
  const translated=radialLabel({...moon,x:moon.x+100,y:moon.y-40},{...centre,x:centre.x+100,y:centre.y-40},85,23);
  assert.ok(Math.abs(translated.x-expected.x-100)<1e-12);
  assert.ok(Math.abs(translated.y-expected.y+40)<1e-12,'panning moves labels and bodies together immediately');
});

test('overlapping labels stack by current camera depth with stable ties',()=>{
  const far=body({id:'far',z:.6}),near=body({id:'near',z:-.4}),middle=body({id:'middle',z:0});
  assert.deepEqual(labelsFarToNear([near,far,middle]).map(b=>b.id),['far','middle','near']);
  assert.deepEqual(labelsFarToNear([{...far,selected:true},near]).map(b=>b.id),['far','near'],'selection does not pull a distant label in front');
  const a=body({id:'a'}),b=body({id:'b'});
  assert.deepEqual(labelsFarToNear([a,b]),labelsFarToNear([b,a]));
  assert.deepEqual(labelsFarToNear([{...near,z:.7},far]).map(b=>b.id),['near','far'],'rotating the camera may reverse which label is in front');
});

test('a body behind a planet retains its label; only intersecting text pixels get masked',()=>{
  const planet=body({id:'planet',x:centre.x,y:centre.y,r:25,z:0});
  const moon=body({x:centre.x,y:centre.y,r:3,z:.2});
  const position=radialLabel(moon,centre,85,23);
  assert.equal(labelMask(position,foregroundBodies(moon,[planet])),'none','hidden body does not make its outward name disappear');
  const intersecting={x:centre.x+20,y:centre.y-10,w:85,h:23};
  const foreground=foregroundBodies(moon,[planet,moon,{...planet,id:'distant',z:.4}]);
  assert.deepEqual(foreground,[planet],'self and distant silhouettes are excluded');
  assert.match(labelMask(intersecting,foreground),/circle at -20\.000px 10\.000px/,'mask uses coordinates relative to the label');
  assert.equal(labelMask(intersecting,foregroundBodies({...moon,z:-.2},[planet])),'none','foreground moon label stays in front');
  assert.equal(labelMask(intersecting,[{...planet,r:0}]),'none','rings and belt regions have no solid silhouette');
  assert.deepEqual(radialLabel(moon,centre,85,23),position);
});

test('masks include small foreground bodies and combine overlapping silhouettes as an intersection',()=>{
  const far=body({r:80,z:.4}),tiny=body({id:'tiny',x:425,y:292,z:0,r:3});
  const other=body({id:'other',x:427,y:292,z:-.1,r:4}),rect={x:420,y:285,w:85,h:23};
  const near=foregroundBodies(far,[far,tiny,other]);
  assert.equal(near.length,2,'small moons can mask parts of a distant name');
  assert.equal(labelMask(rect,near).split('radial-gradient').length-1,2,'each hole has its own outside-circle alpha layer');
  assert.equal(foregroundBodyAt({x:425,y:292},near).id,'other','masked clicks go to the nearest visible world');
  assert.equal(foregroundBodyAt({x:450,y:292},near),undefined);
});

test('leader clipping subtracts the union of overlapping spheres without revealing their overlap',()=>{
  const line={start:{x:0,y:0},end:{x:100,y:0}};
  const spheres=[body({id:'a',x:35,y:0,r:15}),body({id:'b',x:50,y:0,r:15}),body({id:'c',x:80,y:0,r:5})];
  assert.deepEqual(visibleLeaderSegments(line,spheres),[
    {start:{x:0,y:0},end:{x:20,y:0}},
    {start:{x:65,y:0},end:{x:75,y:0}},
    {start:{x:85,y:0},end:{x:100,y:0}},
  ]);
  assert.deepEqual(visibleLeaderSegments(line,[body({x:50,y:0,r:100})]),[]);
  assert.deepEqual(visibleLeaderSegments(line,[body({x:50,y:10,r:10})]),[line],'a tangent leaves the leader intact');
  assert.deepEqual(visibleLeaderSegments({start:line.start,end:line.start},spheres),[]);
  assert.deepEqual(visibleLeaderSegments({start:line.end,end:line.start},spheres).map(s=>[s.start.x,s.end.x]),[[100,85],[75,65],[20,0]],'reversed leaders use the same cutouts');
});

test('viewport edges clip the radial label instead of switching its side',()=>{
  const moon=body({x:639,y:240}),rect=radialLabel(moon,centre,85,23);
  assert.ok(rect.x>moon.x,'label still points away from its parent even beyond the right edge');
  assert.equal(labelInView(rect,640,480),false);
  assert.equal(labelInView({x:620,y:240,w:85,h:23},640,480),true,'a partially visible label is allowed to clip');
  assert.equal(labelInView({x:-85,y:240,w:85,h:23},640,480),false);
  assert.equal(labelInView({x:200,y:-12,w:85,h:23},640,480),true);
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
