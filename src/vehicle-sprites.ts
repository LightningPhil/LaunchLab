/**
 * vehicle-sprites.ts — Cannon, Launch Tower, Rocket, Plumes, Vectors & Ghost Markers
 *
 * Draws the side-elevation cannon, muzzle flash, cannonball, distance flags,
 * baseline ghost trails & markers, direction vectors, nozzle inset, launch
 * tower, rocket, Mach-diamond exhaust plume, particles, and fizzle sparks.
 */
import { NozzleRender, type NozzleData } from './nozzle_render.ts';
import type { Particle, RocketSprite, VectorState } from './scene-types.ts';
import type { SurfacePoint } from './spherical-world.ts';
import {
  BALL_RADIUS_M,
  CANNON_BASE_X_M,
  CANNON_BASE_Y_M,
  DEFAULT_PPM,
  TOWER_BASE_X_M,
  TOWER_HEIGHT_M,
  type SceneViewport,
} from './scene-viewport.ts';
import { clamp } from './world-palettes.ts';

const PAD_WIDTH_M = 2.2;
const PAD_HEIGHT_M = 0.15;
const ROCKET_LENGTH_M = 2.0;
const ROCKET_WIDTH_M = 0.4;
const NOZZLE_LENGTH_M = 0.3;
const SHAKE_AMPLITUDE = 0.02;
const SHAKE_FREQUENCY = 30;

export function drawCannon(vp: SceneViewport, angleDeg: number, recoilOffset: number): void {
  const { ctx } = vp;
  const pivot = vp.toCanvas(CANNON_BASE_X_M, CANNON_BASE_Y_M);
  const base = vp.toCanvas(CANNON_BASE_X_M, 0);
  const s = vp.currentPPM;
  if (s < 6) {
    ctx.save();
    ctx.fillStyle = '#efc66b';
    ctx.beginPath();
    ctx.arc(base.x, base.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(pivot.x, pivot.y);
  ctx.rotate(vp.surfaceNormalAngle(CANNON_BASE_X_M));
  ctx.strokeStyle = '#2d4249';
  ctx.lineWidth = Math.max(1.5, s * 0.024);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-s * 0.33, -s * 0.08);
  ctx.lineTo(s * 0.24, -s * 0.08);
  ctx.lineTo(s * 0.75, s * 0.7);
  ctx.lineTo(-s * 0.65, s * 0.7);
  ctx.closePath();
  const timber = ctx.createLinearGradient(0, -s * 0.08, 0, s * 0.7);
  timber.addColorStop(0, '#c3a374');
  timber.addColorStop(1, '#8c6947');
  ctx.fillStyle = timber;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-s * 0.23, s * 0.12);
  ctx.lineTo(-s * 0.4, s * 0.52);
  ctx.lineTo(s * 0.47, s * 0.52);
  ctx.lineTo(s * 0.2, s * 0.12);
  ctx.closePath();
  ctx.fillStyle = '#765c42';
  ctx.fill();

  ctx.strokeStyle = '#d1b180';
  ctx.lineWidth = Math.max(1, s * 0.022);
  ctx.beginPath(); ctx.moveTo(-s * 0.1, s * 0.06); ctx.lineTo(s * 0.4, s * 0.61); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(s * 0.11, s * 0.05); ctx.lineTo(-s * 0.4, s * 0.61); ctx.stroke();

  ctx.strokeStyle = '#2d4249';
  ctx.lineWidth = Math.max(1.5, s * 0.024);
  for (const wx of [-0.37, 0.44]) {
    const y = s * 0.63;
    const r = s * 0.35;
    ctx.beginPath(); ctx.arc(wx * s, y, r, 0, Math.PI * 2); ctx.fillStyle = '#445450'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(wx * s, y, r * 0.78, 0, Math.PI * 2); ctx.fillStyle = '#617066'; ctx.fill();
    ctx.strokeStyle = '#d0ac70'; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4;
      ctx.strokeStyle = '#283e43'; ctx.lineWidth = Math.max(1.5, s * 0.065);
      ctx.beginPath(); ctx.moveTo(wx * s, y); ctx.lineTo(wx * s + Math.cos(t) * r * 0.72, y + Math.sin(t) * r * 0.72); ctx.stroke();
      ctx.strokeStyle = '#d0ac70'; ctx.lineWidth = Math.max(1, s * 0.034); ctx.stroke();
    }
    ctx.strokeStyle = '#2d4249'; ctx.lineWidth = Math.max(1.5, s * 0.024);
    ctx.beginPath(); ctx.arc(wx * s, y, r * 0.23, 0, Math.PI * 2); ctx.fillStyle = '#edc775'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#52605a'; ctx.beginPath(); ctx.arc(wx * s, y, r * 0.07, 0, Math.PI * 2); ctx.fill();
  }

  ctx.save();
  ctx.rotate((-angleDeg * Math.PI) / 180);
  const length = vp.barrelLengthM * s;
  const shift = -(recoilOffset || 0);
  const start = -s * 0.25 + shift;
  const end = length + shift;
  const rearHalf = s * 0.195;
  const frontHalf = s * 0.15;
  const steel = ctx.createLinearGradient(0, -rearHalf, 0, rearHalf);
  steel.addColorStop(0, '#64818b');
  steel.addColorStop(0.24, '#3d5d70');
  steel.addColorStop(0.7, '#2d485c');
  steel.addColorStop(1, '#203a4c');
  ctx.beginPath();
  ctx.moveTo(start, -rearHalf);
  ctx.bezierCurveTo(start - s * 0.2, -rearHalf, start - s * 0.2, rearHalf, start, rearHalf);
  ctx.lineTo(end, frontHalf);
  ctx.lineTo(end, -frontHalf);
  ctx.closePath();
  ctx.fillStyle = steel;
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#9bb0af';
  ctx.lineWidth = Math.max(0.7, s * 0.012);
  ctx.beginPath();
  ctx.moveTo(start + s * 0.09, -rearHalf * 0.65);
  ctx.lineTo(end - s * 0.17, -frontHalf * 0.67);
  ctx.stroke();

  const brass = ctx.createLinearGradient(0, -rearHalf, 0, rearHalf);
  brass.addColorStop(0, '#f1d28e');
  brass.addColorStop(0.55, '#d7ac60');
  brass.addColorStop(1, '#af8146');
  ctx.strokeStyle = '#2d4249';
  ctx.lineWidth = Math.max(1, s * 0.018);
  for (const band of [[start + s * 0.1, s * 0.09, rearHalf + s * 0.018], [end - s * 0.13, s * 0.13, frontHalf + s * 0.035]] as const) {
    ctx.beginPath();
    ctx.rect(band[0], -band[2], band[1], band[2] * 2);
    ctx.fillStyle = brass;
    ctx.fill();
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#203744';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(end, -frontHalf - s * 0.035);
  ctx.lineTo(end, frontHalf + s * 0.035);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c878';
  ctx.fill();
  ctx.strokeStyle = '#304b53';
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.052, 0, Math.PI * 2);
  ctx.fillStyle = '#304e64';
  ctx.fill();
  if (s > 32) {
    ctx.strokeStyle = '#9bb0af';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(-s * 0.028, -s * 0.018);
    ctx.lineTo(s * 0.028, s * 0.018);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBall(vp: SceneViewport, physX: number, physY: number, squashX: number, squashY: number): void {
  const { ctx, env } = vp;
  const sx = squashX || 1;
  const sy = squashY || 1;
  const pt = vp.toCanvas(physX, physY);
  const r = Math.max(3, BALL_RADIUS_M * vp.currentPPM);

  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.scale(sx, sy);

  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.08, 0, 0, r);
  grad.addColorStop(0, '#a5b7b7');
  grad.addColorStop(0.45, '#486573');
  grad.addColorStop(1, '#203846');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

  const skyLum = env.skyMid[0] * 0.299 + env.skyMid[1] * 0.587 + env.skyMid[2] * 0.114;
  ctx.strokeStyle = skyLum < 100 || vp.planetViewFrac > 0.35 ? '#f2d693' : '#263e49';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,250,229,.65)';
  ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.35, r * 0.18, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

export function drawLandedBall(vp: SceneViewport, physX: number): void {
  drawBall(vp, physX, 0.02, 1.0, 0.7);
}

function getTrailColour(vp: SceneViewport): [number, number, number] {
  const sm = vp.env.skyMid;
  let lum = sm[0] * 0.299 + sm[1] * 0.587 + sm[2] * 0.114;
  const spaceFrac = vp.curveActive ? clamp(1 - vp.curveRadiusPx / (vp.H * 2), 0, 1) : 0;
  lum = lum * (1 - spaceFrac) + 18 * spaceFrac;
  if (lum > 140) return [60, 20, 10];
  if (lum > 80) return [255, 166, 35];
  return [255, 230, 120];
}

export function drawTrajectoryDot(vp: SceneViewport, physX: number, physY: number): void {
  const { ctx } = vp;
  const r = Math.max(1.5, vp.currentPPM * 0.03);
  const c = getTrailColour(vp);
  ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.6)`;
  ctx.beginPath();
  const _td = vp.toCanvas(physX, physY);
  ctx.arc(_td.x, _td.y, r, 0, Math.PI * 2);
  ctx.fill();
}

export function drawFlag(vp: SceneViewport, physX: number, shotNumber: number, springProgress: number): void {
  const { ctx } = vp;
  const position = vp.toCanvas(physX, 0);
  const sp = typeof springProgress === 'number' ? clamp(springProgress, 0, 1) : 1;
  const maxH = Math.max(22, 0.65 * vp.currentPPM);
  let flagH = maxH * sp;
  if (sp < 1) flagH = maxH * (1 - Math.pow(1 - sp, 3) * Math.cos(sp * Math.PI * 3));

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(vp.surfaceNormalAngle(physX));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#354d50';
  ctx.lineWidth = Math.max(1.5, vp.currentPPM * 0.02);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -flagH); ctx.stroke();

  if (flagH > 8) {
    const pW = Math.max(16, 0.3 * vp.currentPPM);
    const pH = Math.max(12, pW * 0.62);
    ctx.fillStyle = '#b9674d';
    ctx.beginPath();
    ctx.moveTo(1, -flagH);
    ctx.lineTo(pW, -flagH + pH * 0.1);
    ctx.lineTo(pW * 0.8, -flagH + pH * 0.5);
    ctx.lineTo(pW, -flagH + pH * 0.9);
    ctx.lineTo(1, -flagH + pH);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,237,198,.45)';
    ctx.beginPath(); ctx.moveTo(3, -flagH + 2); ctx.lineTo(pW - 3, -flagH + pH * 0.1 + 2); ctx.stroke();
    if (flagH > 18) {
      ctx.fillStyle = '#fff5d9';
      ctx.font = `600 ${Math.max(8, Math.min(12, vp.currentPPM * 0.11))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(shotNumber), pW * 0.4, -flagH + pH * 0.52, pW * 0.62);
    }
  }
  ctx.restore();
}

export function drawGhost(vp: SceneViewport, points: readonly SurfacePoint[], options: { color?: string } = {}): void {
  if (!points || points.length < 2) return;
  const { ctx, env } = vp;
  ctx.save();
  ctx.strokeStyle = options.color || (env.skyMid[0] > 100 ? '#566c7b' : '#aec4da');
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.setLineDash([6, 7]);
  ctx.beginPath();
  let last: { x: number; y: number } | null = null;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) { last = null; continue; }
    const p = vp.toCanvas(point.x, point.y);
    if (!last) ctx.moveTo(p.x, p.y);
    else if (Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) ctx.lineTo(p.x, p.y);
    else continue;
    last = p;
  }
  ctx.stroke();
  ctx.restore();
}

export function drawGhostMarker(vp: SceneViewport, x: number, y: number): void {
  const { ctx } = vp;
  const point = vp.toCanvas(x, y);
  ctx.save();
  ctx.strokeStyle = '#ffffffaa';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawVectors(vp: SceneViewport, state: VectorState): void {
  const { ctx } = vp;
  const origin = vp.toCanvas(state.x, state.y);
  const surfaceAngle = state.planetRadius > 0 ? state.x / state.planetRadius : 0;
  const arrows: { label: string; angle: number; color: string }[] = [
    { label: 'gravity', angle: -Math.PI / 2, color: '#f0d385' },
  ];
  if (Math.hypot(state.vx, state.vy) > 0.01) {
    arrows.unshift({ label: 'velocity', angle: Math.atan2(state.vy, state.vx), color: '#94d9ed' });
  }
  if (state.engineOn && typeof state.theta === 'number') {
    arrows.push({ label: 'thrust', angle: (state.theta * Math.PI) / 180, color: '#eeae8c' });
  }
  ctx.save();
  ctx.font = '13px system-ui';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#193330';
  ctx.fillRect(12, 12, 180, 27);
  ctx.fillStyle = '#fff7e6';
  ctx.fillText('Directions · not to scale', 20, 30);
  arrows.forEach((arrow, index) => {
    const angle = arrow.angle - surfaceAngle;
    const dx = Math.cos(angle) * (58 + index * 10);
    const dy = -Math.sin(angle) * (58 + index * 10);
    const x = origin.x + dx;
    const y = origin.y + dy;
    ctx.strokeStyle = arrow.color;
    ctx.fillStyle = arrow.color;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(x, y);
    const a = Math.atan2(dy, dx);
    ctx.lineTo(x - 8 * Math.cos(a - 0.45), y - 8 * Math.sin(a - 0.45));
    ctx.moveTo(x, y);
    ctx.lineTo(x - 8 * Math.cos(a + 0.45), y - 8 * Math.sin(a + 0.45));
    ctx.stroke();
    ctx.strokeStyle = '#193330';
    ctx.lineWidth = 3;
    ctx.strokeText(arrow.label, x + 5, y - 4);
    ctx.fillText(arrow.label, x + 5, y - 4);
    ctx.lineWidth = 2;
  });
  ctx.restore();
}

export function drawNozzleInset(vp: SceneViewport, data: NozzleData): void {
  NozzleRender.draw(vp.ctx, vp.W, vp.H, data);
}

export function drawParticles(vp: SceneViewport, particles: readonly Particle[]): void {
  const { ctx } = vp;
  for (const p of particles) {
    if (p.life <= 0) continue;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    const _pp = vp.toCanvas(p.x, p.y);
    ctx.arc(_pp.x, _pp.y, Math.max(1, (p.radius * vp.currentPPM) / DEFAULT_PPM), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawMuzzleFlash(vp: SceneViewport, angleDeg: number, progress: number): void {
  if (progress <= 0 || progress > 1) return;
  const { ctx } = vp;
  const tip = vp.getCannonTipPhys(angleDeg);
  const _tp = vp.toCanvas(tip.x, tip.y);
  const rad = (angleDeg * Math.PI) / 180;
  const size = (1 - progress) * Math.max(15, 0.4 * vp.currentPPM) + 5;

  ctx.save();
  ctx.translate(_tp.x, _tp.y);
  ctx.rotate(-rad);
  ctx.globalAlpha = 1 - progress;

  const cols = ['#ffdd44', '#ffaa22', '#ff6600', '#ffdd44', '#ff8833'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI - Math.PI / 2;
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * size * 0.7 + size * 0.5, Math.sin(a) * size * 0.6);
    ctx.lineTo(Math.cos(a + 0.3) * size * 0.3 + size * 0.3, Math.sin(a + 0.3) * size * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function getRocketPadPosition(angleDeg: number, epsilon = 20): { x: number; y: number } {
  const angle = (angleDeg * Math.PI) / 180;
  const nozzleLength = NOZZLE_LENGTH_M * Math.min(2, Math.max(0.6, epsilon / 20));
  const centreOffset = ROCKET_LENGTH_M * 0.5 + nozzleLength;
  return {
    x: TOWER_BASE_X_M + Math.cos(angle) * centreOffset,
    y: PAD_HEIGHT_M + Math.sin(angle) * centreOffset,
  };
}

export function drawLaunchTower(vp: SceneViewport, angleDeg: number): void {
  const { ctx } = vp;
  const s = vp.currentPPM;
  const _tw = vp.toCanvas(TOWER_BASE_X_M, 0);
  const baseX = _tw.x;
  const baseY = _tw.y;
  const rad = (angleDeg * Math.PI) / 180;

  if (s < 3) {
    ctx.save();
    ctx.fillStyle = '#e5bd6f';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const tilt = vp.surfaceNormalAngle(TOWER_BASE_X_M);
  if (tilt !== 0) {
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(tilt);
    ctx.translate(-baseX, -baseY);
  }

  const padW = PAD_WIDTH_M * s;
  const padH = PAD_HEIGHT_M * s;
  const padGrad = ctx.createLinearGradient(0, baseY - padH, 0, baseY);
  padGrad.addColorStop(0, '#8f9e96');
  padGrad.addColorStop(1, '#536864');
  ctx.fillStyle = padGrad;
  ctx.fillRect(baseX - padW / 2, baseY - padH, padW, padH);
  ctx.strokeStyle = '#b0b9a3';
  ctx.lineWidth = 1;
  ctx.strokeRect(baseX - padW / 2, baseY - padH, padW, padH);

  ctx.fillStyle = '#d6b979';
  const boltR = s * 0.02;
  const boltY = baseY - padH / 2;
  for (let b = 0; b < 5; b++) {
    const boltX = baseX - padW * 0.4 + padW * 0.8 * (b / 4);
    ctx.beginPath();
    ctx.arc(boltX, boltY, boltR, 0, Math.PI * 2);
    ctx.fill();
  }

  const trenchW = 0.6 * s;
  const trenchD = 0.12 * s;
  ctx.fillStyle = 'rgba(20,18,15,0.7)';
  ctx.beginPath();
  ctx.ellipse(baseX, baseY + 1, trenchW / 2, trenchD, 0, 0, Math.PI);
  ctx.fill();

  const towerH = TOWER_HEIGHT_M * s;
  const railW = Math.max(3, 0.06 * s);
  const railTop = Math.max(2, 0.03 * s);

  ctx.save();
  ctx.translate(baseX, baseY - padH);
  ctx.rotate(Math.PI / 2 - rad);

  const towerOff = railW * 1.2;

  ctx.strokeStyle = '#b16b4c';
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.beginPath();
  ctx.moveTo(-railW + towerOff, 0);
  ctx.lineTo(-railTop + towerOff, -towerH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(railW + towerOff, 0);
  ctx.lineTo(railTop + towerOff, -towerH);
  ctx.stroke();

  ctx.strokeStyle = '#815c48';
  ctx.lineWidth = Math.max(1, s * 0.018);
  const numBraces = Math.max(4, Math.round(towerH / 25));
  for (let i = 0; i < numBraces; i++) {
    const frac0 = i / numBraces;
    const frac1 = (i + 1) / numBraces;
    const y0 = -towerH * frac0;
    const y1 = -towerH * frac1;
    const lw0 = railW + (railTop - railW) * frac0;
    const lw1 = railW + (railTop - railW) * frac1;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.moveTo(-lw0 + towerOff, y0);
      ctx.lineTo(lw1 + towerOff, y1);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(lw0 + towerOff, y0);
      ctx.lineTo(-lw1 + towerOff, y1);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-lw1 + towerOff, y1);
    ctx.lineTo(lw1 + towerOff, y1);
    ctx.stroke();
  }

  ctx.strokeStyle = '#e9dfc2';
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -towerH);
  ctx.stroke();

  ctx.restore();
  if (tilt !== 0) ctx.restore();
}

export function drawRocket(vp: SceneViewport, rocketState: RocketSprite | null, angleDeg: number, epsilon: number): void {
  const { ctx, worldTime } = vp;
  const s = Math.max(vp.currentPPM, 8);
  const eps = epsilon || 20;
  const phase = rocketState ? rocketState.phase : 'pad';

  const rocketLen = ROCKET_LENGTH_M * s;
  const rocketW = ROCKET_WIDTH_M * s;
  const nozzleLen = NOZZLE_LENGTH_M * s * Math.min(2.0, Math.max(0.6, eps / 20));
  const nozzleExitW = rocketW * 0.4 * Math.min(2.2, Math.max(0.7, Math.sqrt(eps / 10)));
  const nozzleThroatW = rocketW * 0.15;
  const noseLen = rocketLen * 0.22;
  const finLen = rocketLen * 0.18;
  const finH = rocketW * 0.55;

  let cx: number, cy: number, rot: number;
  if (rocketState?.phase === 'flight') {
    const _rp = vp.toCanvas(rocketState.x, rocketState.y);
    cx = _rp.x;
    cy = _rp.y;
    const heading =
      typeof rocketState.theta === 'number' && Number.isFinite(rocketState.theta)
        ? (rocketState.theta * Math.PI) / 180
        : (angleDeg * Math.PI) / 180;
    rot = Math.PI - heading + vp.surfaceNormalAngle(rocketState.x);
  } else {
    const rad = (angleDeg * Math.PI) / 180;
    const padPosition = getRocketPadPosition(angleDeg, eps);
    const _padPt = vp.toCanvas(padPosition.x, padPosition.y);
    cx = _padPt.x;
    cy = _padPt.y;
    rot = Math.PI - rad + vp.surfaceNormalAngle(padPosition.x);

    if (phase === 'fizzle') {
      cx += SHAKE_AMPLITUDE * s * Math.sin(worldTime * SHAKE_FREQUENCY * Math.PI * 2);
      cy += SHAKE_AMPLITUDE * s * Math.cos(worldTime * SHAKE_FREQUENCY * Math.PI * 2 * 1.3);
    }
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  const bodyStart = -rocketLen / 2 + noseLen;
  const bodyEnd = rocketLen / 2;

  ctx.fillStyle = '#d1844a';
  ctx.beginPath();
  ctx.moveTo(bodyEnd - finLen, -rocketW / 2);
  ctx.lineTo(bodyEnd, -rocketW / 2);
  ctx.lineTo(bodyEnd - finLen * 0.3, -rocketW / 2 - finH);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bodyEnd - finLen, rocketW / 2);
  ctx.lineTo(bodyEnd, rocketW / 2);
  ctx.lineTo(bodyEnd - finLen * 0.3, rocketW / 2 + finH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#354f5c';
  ctx.beginPath();
  ctx.moveTo(bodyEnd, -nozzleThroatW);
  ctx.lineTo(bodyEnd + nozzleLen, -nozzleExitW);
  ctx.lineTo(bodyEnd + nozzleLen, nozzleExitW);
  ctx.lineTo(bodyEnd, nozzleThroatW);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#222';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();

  const bodyGrad = ctx.createLinearGradient(0, -rocketW / 2, 0, rocketW / 2);
  bodyGrad.addColorStop(0, '#fff6df');
  bodyGrad.addColorStop(0.3, '#fffaed');
  bodyGrad.addColorStop(0.7, '#e7ddc4');
  bodyGrad.addColorStop(1, '#c3c4b3');
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(bodyStart, -rocketW / 2, bodyEnd - bodyStart, rocketW);

  const bandW = rocketLen * 0.08;
  const bandX = bodyStart + (bodyEnd - bodyStart) * 0.35;
  ctx.fillStyle = '#507481';
  ctx.fillRect(bandX, -rocketW / 2, bandW, rocketW);

  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.strokeRect(bodyStart, -rocketW / 2, bodyEnd - bodyStart, rocketW);

  const noseGrad = ctx.createLinearGradient(0, -rocketW / 2, 0, rocketW / 2);
  noseGrad.addColorStop(0, '#7592a0');
  noseGrad.addColorStop(0.5, '#4d7184');
  noseGrad.addColorStop(1, '#2d4b5d');
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(-rocketLen / 2, 0);
  ctx.bezierCurveTo(-rocketLen / 2 + noseLen * 0.3, -rocketW * 0.12, bodyStart - noseLen * 0.1, -rocketW / 2, bodyStart, -rocketW / 2);
  ctx.lineTo(bodyStart, rocketW / 2);
  ctx.bezierCurveTo(bodyStart - noseLen * 0.1, rocketW / 2, -rocketLen / 2 + noseLen * 0.3, rocketW * 0.12, -rocketLen / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = Math.max(0.5, s * 0.008);
  ctx.stroke();

  ctx.fillStyle = '#e9b765';
  ctx.beginPath();
  ctx.arc(-rocketLen / 2, 0, Math.max(2, rocketW * 0.12), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawExhaust(vp: SceneViewport, physX: number, physY: number, theta: number, thrustFrac: number, epsilon = 20): void {
  if (thrustFrac <= 0) return;
  const { ctx, worldTime } = vp;
  const s = Math.max(vp.currentPPM, 8);
  const _ep = vp.toCanvas(physX, physY);
  const nozzleLength = NOZZLE_LENGTH_M * s * Math.min(2, Math.max(0.6, epsilon / 20));
  const exitOffset = (ROCKET_LENGTH_M * s) / 2 + nozzleLength;
  const screenHeading = theta - vp.surfaceNormalAngle(physX);
  const cx = _ep.x - Math.cos(screenHeading) * exitOffset;
  const cy = _ep.y + Math.sin(screenHeading) * exitOffset;
  const exhaustAngle = screenHeading + Math.PI;

  const plumeLenBase = ROCKET_LENGTH_M * 0.8 * s * thrustFrac;
  const plumeW = ROCKET_WIDTH_M * 0.35 * s;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-exhaustAngle);

  const t = worldTime * 12;
  const flicker = 1 + 0.12 * Math.sin(t) + 0.08 * Math.sin(t * 2.7);
  const coreLen = plumeLenBase * 0.7 * flicker;
  const coreW = plumeW * 0.35;

  const coreGrad = ctx.createLinearGradient(0, 0, coreLen, 0);
  coreGrad.addColorStop(0, 'rgba(200,220,255,0.95)');
  coreGrad.addColorStop(0.3, 'rgba(255,255,200,0.85)');
  coreGrad.addColorStop(0.7, 'rgba(255,180,50,0.5)');
  coreGrad.addColorStop(1, 'rgba(255,100,20,0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(coreLen * 0.5, -coreW * flicker, coreLen, 0);
  ctx.quadraticCurveTo(coreLen * 0.5, coreW * flicker, 0, 0);
  ctx.fill();

  const outerLen = plumeLenBase * flicker;
  const outerW = plumeW * 0.7;
  const outerGrad = ctx.createLinearGradient(0, 0, outerLen, 0);
  outerGrad.addColorStop(0, 'rgba(255,200,100,0.6)');
  outerGrad.addColorStop(0.4, 'rgba(255,120,30,0.35)');
  outerGrad.addColorStop(0.8, 'rgba(200,60,10,0.12)');
  outerGrad.addColorStop(1, 'rgba(100,30,5,0)');
  ctx.fillStyle = outerGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(outerLen * 0.4, -outerW, outerLen, 0);
  ctx.quadraticCurveTo(outerLen * 0.4, outerW, 0, 0);
  ctx.fill();

  if (thrustFrac > 0.3) {
    const numDiamonds = Math.min(4, Math.floor(Math.sqrt(thrustFrac * 12)));
    const diamondSpacing = coreLen * 0.22;
    for (let md = 0; md < numDiamonds; md++) {
      const mdX = (md + 1) * diamondSpacing;
      if (mdX > coreLen * 0.9) break;
      const mdR = coreW * 0.5 * (1 - md * 0.18) * flicker;
      const mdAlpha = (0.4 - md * 0.08) * thrustFrac;
      ctx.globalAlpha = Math.max(0, mdAlpha);
      ctx.fillStyle = '#ffffcc';
      ctx.beginPath();
      ctx.moveTo(mdX - mdR * 0.5, 0);
      ctx.lineTo(mdX, -mdR);
      ctx.lineTo(mdX + mdR * 0.5, 0);
      ctx.lineTo(mdX, mdR);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const smokeX = outerLen * 0.85;
  const smokeR = plumeW * 0.4 * thrustFrac;
  ctx.globalAlpha = 0.15 * thrustFrac;
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.arc(smokeX, 0, Math.max(2, smokeR), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function drawFizzle(vp: SceneViewport, physX: number, physY: number, progress: number): void {
  if (progress <= 0 || progress > 1) return;
  const { ctx, worldTime } = vp;
  const s = Math.max(vp.currentPPM, 18);
  const _fz = vp.toCanvas(physX, physY);

  const sparks = 5 + Math.floor(progress * 6);
  const sputter = 1 - progress * 0.6;

  ctx.save();
  ctx.translate(_fz.x, _fz.y);

  for (let i = 0; i < sparks; i++) {
    const angle = (i / sparks) * Math.PI * 2 + worldTime * 8 + progress * 5;
    const dist = (((5 + Math.random() * 12) * s) / 80) * sputter;
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist * 0.6 + Math.random() * 4;
    const sparkR = Math.max(1, (1.5 + Math.random() * 2) * sputter);

    const alpha = (0.5 + Math.random() * 0.5) * sputter;
    ctx.fillStyle = `rgba(255,${Math.floor(120 + Math.random() * 80)},0,${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, sparkR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 0.25 * sputter;
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(0, (-3 * s) / 80, Math.max(3, ((8 * s) / 80) * progress), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}
