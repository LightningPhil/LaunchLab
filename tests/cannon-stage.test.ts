import test from 'node:test';
import assert from 'node:assert/strict';
import { CannonStage } from '../src/cannon-stage.ts';
import { SceneFx } from '../src/scene-fx.ts';

test('CannonStage lowers, modifies barrel length with crew poses, and raises back to the slider angle', () => {
  const stage = new CannonStage();
  stage.init(1.5, 45);
  assert.equal(stage.isRebuilding, false);
  assert.equal(stage.getCrew(1.5), null);

  const lengths: number[] = [];
  let clangs = 0;
  stage.onBarrelChange(3.0, 45, false, len => lengths.push(len));
  assert.equal(stage.animState, 'lowering');
  assert.equal(stage.getCrew(1.5)?.length, 3);
  assert.equal(stage.getCrew(1.5)?.[0].pose, 'carrying');

  for (let i = 0; i < 60; i++) {
    stage.updateBarrel(0.02, 50, {
      onBarrelLength: len => lengths.push(len),
      onClang: () => { clangs++; },
    });
  }
  assert.equal(stage.animState, 'idle');
  assert.equal(stage.displayedLen, 3.0);
  assert.equal(stage.displayedAngle, 50);
  assert.ok(clangs >= 1, 'clang cues fire during modification');
  assert.equal(lengths.at(-1), 3.0);
});

test('CannonStage recoil and muzzle flash settle cleanly back to rest', () => {
  const stage = new CannonStage();
  stage.triggerFireEffect();
  stage.updateRecoilAndFlash(0.04);
  assert.ok(stage.recoilOffset > 0 && stage.flashProgress > 0 && stage.flashProgress < 1);
  for (let i = 0; i < 20; i++) stage.updateRecoilAndFlash(0.02);
  assert.equal(stage.recoilOffset, 0);
  assert.equal(stage.flashProgress, 1);
});

test('SceneFx caps landed cannon shots, advances flag springs, and clears particles in reduced motion', () => {
  const fx = new SceneFx();
  for (let i = 1; i <= 10; i++) fx.recordCannonLanding(i * 10, false);
  assert.equal(fx.shots.length, 8);
  assert.equal(fx.shots[0].number, 3);
  assert.equal(fx.shots[7].number, 10);
  assert.ok(fx.particles.length > 0);

  fx.update(0.2, false);
  assert.ok(fx.shots[7].flagSpring > 0 && fx.shots[7].flagSpring < 1);

  fx.update(0.1, true);
  assert.equal(fx.particles.length, 0);
});
