import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseIdleLook, gazeAim, observationAim, rocketWatchAim, type IdleLook, type WatchAim } from '../src/crew-watch.ts';

const rocket = { x: 0, y: 100 };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('walkers glance before occasionally raising optics, and keep watching flights; swimmers do not', () => {
  for (const type of ['golfer','spaceman','alien','robot','icerobot','snowman','icebear']) {
    const idleLook: IdleLook = {sequence:2,side:-1,duration:10,opticsAt:6};
    for(const stateTimer of [0,1,3,5.9])assert.equal(observationAim({type,state:'idle',stateTimer,idleLook}),undefined);
    assert.deepEqual(gazeAim({type,state:'idle',stateTimer:1,idleLook}),{yaw:type==='icebear'?-1:0,elevation:0});
    assert.deepEqual(gazeAim({type,state:'idle',stateTimer:5,idleLook}),{yaw:-1,elevation:0});
    assert.ok(observationAim({type,state:'idle',stateTimer:6,idleLook}));
    const aim: WatchAim = {yaw:-1,elevation:.8};
    assert.deepEqual(observationAim({type,state:'watching',stateTimer:0,watchAim:aim}),aim);
    for (const state of ['running_away','running_to','inspecting','squashed']) assert.equal(observationAim({type,state,stateTimer:3,watchAim:aim}),undefined);
  }
  for (const type of ['whale','squid','newt']) for (const state of ['idle','watching']) {
    assert.equal(observationAim({type,state,stateTimer:8,reaction:'apex',watchAim:{yaw:1,elevation:.8},idleLook:{sequence:0,side:1,duration:10,opticsAt:0}}),undefined);
  }
  assert.ok(observationAim({type:'submarine',state:'hatch_peek',stateTimer:3}));
});

test('idle pauses support all four gaze sequences and some have no binoculars at all',()=>{
  const poses=([0,1,2,3] as const).map(sequence=>[1,7].map(stateTimer=>gazeAim({type:'golfer',state:'idle',stateTimer,idleLook:{sequence,side:1,duration:10,opticsAt:Infinity}})!.yaw));
  assert.deepEqual(poses,[[0,0],[1,1],[0,1],[1,0]]);
  assert.equal(chooseIdleLook(()=>.9).opticsAt,Infinity);
  assert.ok(chooseIdleLook(()=>.1).opticsAt>=5);
  const bear=(t: number)=>gazeAim({type:'icebear',state:'idle',stateTimer:t,idleLook:{sequence:2,side:1,duration:10,opticsAt:Infinity}})!.yaw;
  assert.deepEqual([1,5,6,7,9].map(bear),[1,1,0,1,1],'Bear glances at the viewer briefly, then returns to its surroundings');
});

test('optics follow both sides and altitude in the observer’s tangent plane', () => {
  assert.equal(rocketWatchAim(8, { x: -20, y: 30 }).yaw, -1);
  assert.equal(rocketWatchAim(8, { x: 20, y: 30 }).yaw, 1);
  assert.ok(rocketWatchAim(8, { x: 20, y: 100 }).elevation > rocketWatchAim(8, { x: 20, y: 2 }).elevation);
  assert.ok(rocketWatchAim(0, { x: Math.PI * 100, y: 10 }, 100).elevation < 0);
  const flat = rocketWatchAim(8, rocket), curved = rocketWatchAim(8, rocket, 6.371e6);
  near(flat.elevation, curved.elevation);
});
