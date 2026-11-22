/**
 * character-overlay.ts — Crew Stickmen, World Guests, Squid Holes & Portrait Inset
 *
 * Draws barrel-crew stickmen, surface/cloud/ice characters, Ganymede squid ice
 * holes, and the persistent circular character portrait + speech bubble inset.
 */
import { drawSubmarine, drawWhale } from './aquatic-characters.ts';
import { businessTime } from './character-business.ts';
import { drawCrew } from './crew.ts';
import { gazeAim, observationAim, rocketWatchAim } from './crew-watch.ts';
import { drawIceBear } from './ice-bear.ts';
import { NozzleRender } from './nozzle_render.ts';
import { drawNewt, drawSnowman } from './planet-guests.ts';
import type { ActiveIceHole, SceneCharacter, SceneCharacterPose, WorkerPose } from './scene-types.ts';
import type { SceneViewport } from './scene-viewport.ts';
import { drawGiantSquid, drawIceHole } from './squid.ts';

export function drawStickman(
  vp: SceneViewport,
  physX: number,
  physY: number,
  poseData: Pick<WorkerPose, 'pose' | 'timer' | 'direction'>
): void {
  if (vp.currentPPM < 16) return;
  const point = vp.toCanvas(physX, physY);
  const pose = poseData.pose || 'idle';
  drawCrew(vp.ctx, point.x, point.y, vp.currentPPM * 0.76, {
    type: 'worker',
    state: pose === 'running' ? 'running_away' : pose,
    stateTimer: poseData.timer || 0,
    direction: poseData.direction || 1,
  });
}

export function drawCharacter(vp: SceneViewport, char: SceneCharacter | SceneCharacterPose | null): void {
  if (!char) return;
  if (char.type === 'squid' && Array.isArray(char.holes)) drawSquidHoles(vp, char.holes);
  if (!char.visible) return;

  const position = vp.toCanvas(char.x ?? 0, Number.isFinite(char.y) ? (char.y as number) : 0);
  vp.ctx.save();
  vp.ctx.translate(position.x, position.y);
  vp.ctx.rotate(vp.surfaceNormalAngle(char.x ?? 0));
  drawCharacterSprite(vp, 0, 0, vp.currentPPM, char as SceneCharacter);
  vp.ctx.restore();
}

export function drawSquidHoles(vp: SceneViewport, holes: readonly ActiveIceHole[]): void {
  if (vp.planetViewFrac > 0.5 || !(vp.currentPPM > 2)) return;
  const { ctx, W } = vp;
  for (const hole of holes) {
    if (!hole || !Number.isFinite(hole.x)) continue;
    const at = vp.toCanvas(hole.x, 0);
    if (at.x < -vp.currentPPM || at.x > W + vp.currentPPM) continue;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(vp.surfaceNormalAngle(hole.x));
    ctx.scale(vp.currentPPM / 80, vp.currentPPM / 80);
    drawIceHole(ctx, 'back', hole);
    ctx.restore();
  }
}

function drawCharacterSprite(vp: SceneViewport, cx: number, cy: number, s: number, char: SceneCharacter): void {
  const { ctx, env } = vp;
  let drawChar = char;
  if (char.gaitSpeed !== undefined && Number.isFinite(char.gaitSpeed)) {
    drawChar = { ...char, speed: char.gaitSpeed };
  }
  if (char.state === 'rocket_startled') {
    drawChar = { ...drawChar, state: 'startled' };
  }
  if ((drawChar.type === 'whale' || drawChar.type === 'submarine') && env && env.surfEdge) {
    if (drawChar === char) drawChar = { ...char };
    drawChar.cloudEdge = env.surfEdge;
  }

  const isCrew = ['golfer', 'alien', 'spaceman', 'robot', 'icerobot'].includes(drawChar.type);
  if (isCrew) {
    drawCrew(ctx, cx, cy, s * 1.32, drawChar);
  } else {
    switch (drawChar.type) {
      case 'newt':      drawNewt(ctx, cx, cy, s, drawChar); break;
      case 'icebear':   drawIceBear(ctx, cx, cy, s, drawChar); break;
      case 'squid':     drawGiantSquid(ctx, cx, cy, s, drawChar); break;
      case 'whale':     drawWhale(ctx, cx, cy, s, drawChar); break;
      case 'snowman':   drawSnowman(ctx, cx, cy, s, drawChar); break;
      case 'submarine': drawSubmarine(ctx, cx, cy, s, drawChar); break;
    }
  }
}

export function drawSceneNotes(vp: SceneViewport, mode: 'cannon' | 'rocket', char: SceneCharacter | SceneCharacterPose | null): void {
  const nozzle = mode === 'rocket' ? NozzleRender.insetBounds(vp.W, vp.H) : null;
  if (char) drawCharacterAside(vp, char as SceneCharacter, nozzle ? nozzle.y + nozzle.height + 48 : vp.H < 300 ? 46 : 90);
}

function drawCharacterAside(vp: SceneViewport, char: SceneCharacter, centreY = 90): void {
  const { ctx, W } = vp;
  const offsetY = centreY - 90;
  ctx.save();
  ctx.translate(0, offsetY);
  const speech =
    char.business?.kind === 'paper-plane'
      ? businessTime(char) >= 2 ? 'Does this really need air..?' : ''
      : typeof char.bubbleText === 'string' ? char.bubbleText.trim() : '';
  if (char.banter !== false && speech) drawCharacterSpeech(vp, speech);

  ctx.save();
  ctx.beginPath();
  ctx.arc(W - 52, 90, 36, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,249,233,.78)';
  ctx.fill();

  let framing =
    char.type === 'newt' ? { scale: 68, x: -26.35, footY: 122.3 }
    : char.type === 'snowman' ? { scale: 54, x: 0, footY: 147 }
    : char.type === 'icebear' ? { scale: 72, x: -5.5, footY: 163.8 }
    : char.type === 'squid' ? { scale: 62, x: 0, footY: 137.3 }
    : char.type === 'whale' ? { scale: 54, x: -27.7, footY: 124.4 }
    : char.type === 'submarine' ? { scale: 65, x: -21.1, footY: 119.3 }
    : char.type === 'robot' || char.type === 'icerobot' ? { scale: 40, x: 0, footY: 120 }
    : { scale: 43, x: 0, footY: 120 };

  const portrait: SceneCharacter = {
    ...char,
    portrait: true,
    state: char.state === 'off_screen' ? 'running_away' : char.state,
  };
  if (char.state === 'watching' && char.watchTarget) {
    const target = vp.toCanvas(char.watchTarget.x, char.watchTarget.y);
    portrait.watchAim = rocketWatchAim(W - 52, { x: target.x, y: 91 + offsetY - target.y });
    if (char.type !== 'submarine') portrait.direction = portrait.watchAim.yaw < 0 ? -1 : 1;
  }
  if (char.state === 'inspecting' && char.inspectTarget) {
    portrait.direction = vp.toCanvas(char.inspectTarget.x, char.inspectTarget.y).x < W - 52 ? -1 : 1;
  }
  const portraitAim = observationAim(portrait) || gazeAim(portrait);
  if (portraitAim && char.type !== 'submarine') portrait.direction = portraitAim.yaw < 0 ? -1 : 1;

  if (char.type === 'submarine' && ['hatch_peek', 'watching'].includes(char.state)) framing = { scale: 104, x: 10.4, footY: 194 };
  if (char.business?.kind === 'umbrella') framing = { scale: 34, x: -9, footY: 124 };
  if (char.business?.kind === 'paper-plane') framing = { scale: 36, x: -12, footY: 115 };
  if (char.business?.kind === 'police-hat') framing = { scale: 56, x: -21, footY: 128 };
  if (char.business?.kind === 'ice-cream') framing = { scale: 60, x: -10, footY: 146 };
  if (char.type === 'whale' && char.state === 'spouting') framing = { scale: 43, x: -17, footY: 131 };
  if (char.type === 'squid' && char.state === 'hammering') framing = { scale: 42, x: -15, footY: 123 };
  if (char.state === 'squashed' && !['icebear', 'squid'].includes(char.type)) {
    framing = { ...framing, footY: char.type === 'whale' ? 100 : char.type === 'submarine' ? 98 : 101 };
  }
  if (portrait.direction === -1) framing.x = -framing.x;
  drawCharacterSprite(vp, W - 52 + framing.x, framing.footY, framing.scale, portrait);
  ctx.restore();
  ctx.restore();
}

function drawCharacterSpeech(vp: SceneViewport, speech: string): void {
  const { ctx, W } = vp;
  ctx.save();
  ctx.font = '500 13px system-ui, sans-serif';
  const maxWidth = Math.min(190, W - 112);
  const lines: string[] = [];
  let current = '';
  for (const word of speech.split(/\s+/)) {
    const next = current ? current + ' ' + word : word;
    if (current && ctx.measureText(next).width > maxWidth - 24) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  const bubbleW = Math.min(maxWidth, Math.max(64, ...lines.map(line => ctx.measureText(line).width + 24)));
  const bubbleH = lines.length * 18 + 18;
  const bx = W - 102 - bubbleW;
  const by = 56;
  ctx.fillStyle = 'rgba(255,249,233,.97)';
  ctx.strokeStyle = 'rgba(39,61,61,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + 12, by);
  ctx.lineTo(bx + bubbleW - 12, by);
  ctx.quadraticCurveTo(bx + bubbleW, by, bx + bubbleW, by + 12);
  ctx.lineTo(bx + bubbleW, by + 13);
  ctx.lineTo(bx + bubbleW + 9, by + 19);
  ctx.lineTo(bx + bubbleW, by + 23);
  ctx.lineTo(bx + bubbleW, by + bubbleH - 12);
  ctx.quadraticCurveTo(bx + bubbleW, by + bubbleH, bx + bubbleW - 12, by + bubbleH);
  ctx.lineTo(bx + 12, by + bubbleH);
  ctx.quadraticCurveTo(bx, by + bubbleH, bx, by + bubbleH - 12);
  ctx.lineTo(bx, by + 12);
  ctx.quadraticCurveTo(bx, by, bx + 12, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d4145';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => ctx.fillText(line, bx + 12, by + 9 + i * 18));
  ctx.restore();
}
