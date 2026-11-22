import type { TurnFlight, TurnFrame } from './gravity-turn-model.ts';

export type TurnView = 'ascent' | 'orbit';

interface Point { x: number; y: number }
interface Camera { x: number; y: number; scale: number }
export interface TurnScene {
  view: TurnView;
  flight: TurnFlight;
  reference: TurnFrame[];
  pinned?: TurnFlight;
  frame: TurnFrame;
  powered: boolean;
  secondBurnActive: boolean;
}

const WIDTH = 680;
const HEIGHT = 382;
const ASCENT: Camera = { x: 138, y: 1459, scale: 1140 };
const VELOCITY = '#ffd18c';
const SECOND_BURN = '#ff9468';
const GRAVITY = '#78dad4';
const COAST = '#c4acf7';
const CIRCULAR = '#82e5d4';
const PINNED = '#eb9f54';
const stars = Array.from({ length: 92 }, (_, i) => ({
  x: ((i * 101 + 233) % 691) - 5,
  y: ((i * i * 47 + 29) % 389) - 3,
  size: i % 11 === 0 ? 1.55 : 0.55 + (i % 5) * 0.12,
  opacity: 0.16 + (i % 7) * 0.085,
}));

function screen(camera: Camera, point: Point): Point {
  return { x: camera.x + point.x * camera.scale, y: camera.y - point.y * camera.scale };
}

function line(ctx: CanvasRenderingContext2D, a: Point, b: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
}

function backdrop(ctx: CanvasRenderingContext2D) {
  const dusk = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  dusk.addColorStop(0, '#0a1528');
  dusk.addColorStop(0.55, '#132940');
  dusk.addColorStop(1, '#1f3b52');
  ctx.fillStyle = dusk;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (const star of stars) {
    ctx.fillStyle = `rgba(216,229,254,${star.opacity})`;
    disc(ctx, star.x, star.y, star.size);
    ctx.fill();
  }
}

function planet(ctx: CanvasRenderingContext2D, camera: Camera, showCentre: boolean) {
  const { x, y, scale } = camera;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Subtle limb glow so the airless horizon reads crisply against deep space
  const halo = ctx.createRadialGradient(0, 0, 0.99, 0, 0, 1.045);
  halo.addColorStop(0, 'rgba(143, 198, 188, 0.24)');
  halo.addColorStop(1, 'rgba(143, 198, 188, 0)');
  disc(ctx, 0, 0, 1.045);
  ctx.fillStyle = halo;
  ctx.fill();

  const light = ctx.createLinearGradient(-0.45, -0.98, 0.3, 0.9);
  light.addColorStop(0, '#7ca8a0');
  light.addColorStop(0.23, '#42797f');
  light.addColorStop(0.65, '#21455c');
  light.addColorStop(1, '#10263b');
  disc(ctx, 0, 0, 1);
  ctx.fillStyle = light;
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 14; i++) {
    const offset = i * 0.135 - 0.94;
    ctx.beginPath();
    ctx.moveTo(-1.2, offset - 0.06);
    ctx.bezierCurveTo(-0.62, offset + 0.18, -0.26, offset - 0.3, 0.21, offset - 0.12);
    ctx.bezierCurveTo(0.51, offset + 0.01, 0.68, offset - 0.14, 1.2, offset + 0.04);
    ctx.strokeStyle = i % 3 === 0 ? '#b1cb9b39' : '#a5d2bd25';
    ctx.lineWidth = i % 3 === 0 ? 0.037 : 0.011;
    ctx.stroke();
  }
  const shade = ctx.createLinearGradient(-1, -0.25, 1, 0.5);
  shade.addColorStop(0, '#122b4444');
  shade.addColorStop(0.45, '#0e223000');
  shade.addColorStop(1, '#0b192fbb');
  ctx.fillStyle = shade;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  disc(ctx, 0, 0, 1);
  ctx.strokeStyle = '#abd0c3';
  ctx.lineWidth = 1.6 / scale;
  ctx.stroke();
  ctx.restore();

  if (showCentre) {
    // Subtle centre-of-planet crosshair so focus-offset ellipses vs centred circles read immediately
    ctx.save();
    ctx.strokeStyle = '#d3ece478';
    ctx.lineWidth = 1.2;
    line(ctx, { x: x - 6, y }, { x: x + 6, y });
    line(ctx, { x, y: y - 6 }, { x, y: y + 6 });
    disc(ctx, x, y, 1.8);
    ctx.fillStyle = '#d3ece4aa';
    ctx.fill();
    ctx.restore();
  }
}

function track(ctx: CanvasRenderingContext2D, camera: Camera, points: Point[], color: string, width: number, dash: number[] = []) {
  if (points.length < 2) return;
  ctx.beginPath();
  const start = screen(camera, points[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 1; i < points.length; i++) {
    const point = screen(camera, points[i]);
    ctx.lineTo(point.x, point.y);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);
}

function maxFlightRadius(flight: TurnFlight, initial: number): number {
  let max = initial;
  for (const group of [flight.coast, flight.transfer, flight.kickArc, flight.unburnedCoast]) {
    for (const point of group) {
      max = Math.max(max, Math.hypot(point.x, point.y));
    }
  }
  return max;
}

function orbitCamera(scene: TurnScene, x: number, y: number, size: number): Camera {
  let maxRadius = maxFlightRadius(scene.flight, 1.12);
  if (scene.pinned) maxRadius = maxFlightRadius(scene.pinned, maxRadius);
  return { x, y, scale: size / Math.min(maxRadius * 1.06, 2.7) };
}

function marker(ctx: CanvasRenderingContext2D, point: Point, color: string, radius: number) {
  disc(ctx, point.x, point.y, radius);
  ctx.fillStyle = '#14263c';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.stroke();
}

function diamondMarker(ctx: CanvasRenderingContext2D, point: Point, stroke: string, size = 4) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#13263c';
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.7;
  ctx.fillRect(-size, -size, size * 2, size * 2);
  ctx.strokeRect(-size, -size, size * 2, size * 2);
  ctx.restore();
}

function orbitCallout(ctx: CanvasRenderingContext2D, camera: Camera, worldPoint: Point, text: string, color: string) {
  const r = Math.hypot(worldPoint.x, worldPoint.y) || 1;
  const ux = worldPoint.x / r;
  const uy = -worldPoint.y / r;
  const p = screen(camera, worldPoint);
  const lx = Math.max(54, Math.min(WIDTH - 54, p.x + ux * 22));
  const ly = Math.max(18, Math.min(HEIGHT - 16, p.y + uy * 18));
  ctx.save();
  ctx.font = '600 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#0b1829e6';
  ctx.lineWidth = 3.5;
  ctx.strokeText(text, lx, ly);
  ctx.fillStyle = color;
  ctx.fillText(text, lx, ly);
  ctx.restore();
}

function vector(ctx: CanvasRenderingContext2D, point: Point, angle: number, length: number, color: string, tag: string) {
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(length, 0);
  ctx.lineTo(length - 7, -4);
  ctx.moveTo(length, 0);
  ctx.lineTo(length - 7, 4);
  ctx.stroke();
  ctx.restore();

  const lx = point.x + Math.cos(angle) * (length + 9);
  const ly = point.y + Math.sin(angle) * (length + 9);
  ctx.save();
  ctx.font = 'italic 600 12px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#0d1d31dd';
  ctx.lineWidth = 3;
  ctx.strokeText(tag, lx, ly);
  ctx.fillStyle = color;
  ctx.fillText(tag, lx, ly);
  ctx.restore();
}

function rocket(ctx: CanvasRenderingContext2D, camera: Camera, frame: TurnFrame, powered: boolean, secondBurnActive: boolean) {
  const p = screen(camera, frame);
  if (p.x < -16 || p.x > WIDTH + 16 || p.y < -16 || p.y > HEIGHT + 16) return;
  const radius = Math.hypot(frame.x, frame.y);
  const speed = Math.hypot(frame.vx, frame.vy);
  const angle = speed ? Math.atan2(-frame.vy, frame.vx) : Math.atan2(-frame.y, frame.x);
  const up = Math.atan2(-frame.y, frame.x);

  // Local horizon tangent line through the rocket
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(up + Math.PI / 2);
  ctx.strokeStyle = '#d9e6ff94';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  line(ctx, { x: -32, y: 0 }, { x: 32, y: 0 });
  ctx.restore();

  vector(ctx, p, up + Math.PI, 39 / Math.min(radius, 1.5), GRAVITY, 'g');
  if (speed) vector(ctx, p, angle, 18 + 49 * Math.min(speed * Math.sqrt(radius), 1.5), VELOCITY, 'v');

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  if (powered && frame.time > 0) {
    const plume = ctx.createLinearGradient(-38, 0, -7, 0);
    plume.addColorStop(0, '#ed8a6000');
    plume.addColorStop(0.55, secondBurnActive ? '#ff7c52ee' : '#f49a65dd');
    plume.addColorStop(1, '#fff3c4');
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(-8, -3.2);
    ctx.quadraticCurveTo(-22, -4.6, -37, 0);
    ctx.quadraticCurveTo(-22, 4.6, -8, 3.2);
    ctx.fill();
  }
  ctx.fillStyle = '#edab83';
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(-10, -8);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-10, 8);
  ctx.lineTo(0, 3);
  ctx.fill();
  ctx.fillStyle = '#fcf1db';
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.quadraticCurveTo(5, -5, 12, 0);
  ctx.quadraticCurveTo(5, 5, -8, 4);
  ctx.fill();
  disc(ctx, 3, 0, 2.1);
  ctx.fillStyle = '#2a6178';
  ctx.fill();
  ctx.restore();
}

function drawFlightPaths(ctx: CanvasRenderingContext2D, camera: Camera, flight: TurnFlight, thin = false) {
  const scaleW = thin ? 0.72 : 1;
  if (flight.unburnedCoast.length > 1) {
    track(ctx, camera, flight.unburnedCoast, '#c4acf74a', 1.7 * scaleW, [2, 5]);
  }
  if (flight.transfer.length > 1) {
    track(ctx, camera, flight.transfer, COAST, 2.1 * scaleW, [5, 5]);
  }
  const finalColor = flight.circular ? CIRCULAR : COAST;
  if (flight.circular && !thin) {
    track(ctx, camera, flight.coast, '#45a8983d', 6.5);
  }
  track(ctx, camera, flight.coast, finalColor, (flight.circular ? 2.4 : 2.2) * scaleW, flight.circular ? [6, 4] : [5, 6]);
  track(ctx, camera, flight.ascent, '#c37a4766', 7.5 * scaleW);
  track(ctx, camera, flight.ascent, VELOCITY, 2.8 * scaleW);
  if (flight.kickArc.length > 1) {
    track(ctx, camera, flight.kickArc, '#df5d376e', 8 * scaleW);
    track(ctx, camera, flight.kickArc, SECOND_BURN, 3.1 * scaleW);
  }
}

function drawPinnedPaths(ctx: CanvasRenderingContext2D, camera: Camera, pinned: TurnFlight, thin = false) {
  const w = thin ? 1.35 : 2;
  if (pinned.transfer.length > 1) track(ctx, camera, pinned.transfer, '#eb9f5499', w, [4, 4]);
  track(ctx, camera, pinned.coast, '#eb9f54aa', w, [6, 5]);
  track(ctx, camera, pinned.ascent, PINNED, w * 1.15, [7, 5]);
  if (pinned.kickArc.length > 1) track(ctx, camera, pinned.kickArc, PINNED, w * 1.25);
}

function orbitInset(ctx: CanvasRenderingContext2D, scene: TurnScene) {
  const x = 520, y = 16, size = 144;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size + 12, 13);
  ctx.fillStyle = '#0e1d31f2';
  ctx.fill();
  ctx.strokeStyle = '#4e6983';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();
  const camera = orbitCamera(scene, x + size / 2, y + 86, 56);
  planet(ctx, camera, false);
  if (scene.pinned) drawPinnedPaths(ctx, camera, scene.pinned, true);
  drawFlightPaths(ctx, camera, scene.flight, true);
  if (scene.flight.apoapsisPoint && scene.flight.kickArc.length > 1) {
    marker(ctx, screen(camera, scene.flight.apoapsisPoint), SECOND_BURN, 2.8);
  }
  const dot = screen(camera, scene.frame);
  disc(ctx, dot.x, dot.y, 2.8);
  ctx.fillStyle = scene.powered ? (scene.secondBurnActive ? SECOND_BURN : VELOCITY) : '#f4effe';
  ctx.fill();
  ctx.fillStyle = '#c8d8ee';
  ctx.font = '600 11.5px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Whole-planet preview', x + size / 2, y + 22);
  ctx.restore();
}

export function drawTurnScene(canvas: HTMLCanvasElement, scene: TurnScene) {
  const ctx = canvas.getContext('2d');
  const clientWidth = canvas.clientWidth || WIDTH;
  if (!ctx) return;
  const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const width = Math.round(clientWidth * dpr);
  const height = Math.round((width * HEIGHT) / WIDTH);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
  backdrop(ctx);

  const { flight } = scene;
  const camera = scene.view === 'ascent' ? ASCENT : orbitCamera(scene, WIDTH / 2, HEIGHT / 2, 156);
  if (scene.view === 'ascent') {
    ctx.strokeStyle = '#b1c8ed22';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    for (let i = 1; i <= 4; i++) {
      disc(ctx, camera.x, camera.y, camera.scale * (1 + i * 0.05));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#9db6d378';
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('+10% R', camera.x + 8, camera.y - camera.scale * 1.1 - 5);
    ctx.fillText('+20% R', camera.x + 8, camera.y - camera.scale * 1.2 - 5);
  } else if (flight.apoapsisPoint) {
    // Faint planet-centred reference ring through apoapsis so focus-offset ellipses
    // contrast visually with a planet-centred circular orbit.
    const apoRadius = Math.hypot(flight.apoapsisPoint.x, flight.apoapsisPoint.y);
    if (apoRadius > 1.02) {
      ctx.save();
      ctx.strokeStyle = '#9ec4df29';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      disc(ctx, camera.x, camera.y, camera.scale * apoRadius);
      ctx.stroke();
      ctx.restore();
    }
  }

  planet(ctx, camera, scene.view === 'orbit');

  if (scene.pinned) drawPinnedPaths(ctx, camera, scene.pinned, false);
  if (scene.view === 'ascent') track(ctx, camera, scene.reference, '#bfd3e8a0', 1.7, [3, 5]);
  drawFlightPaths(ctx, camera, flight, false);

  const pad = screen(camera, flight.ascent[0]);
  const end1 = screen(camera, flight.cutoff);
  marker(ctx, pad, '#c6dfdd', 3.8);
  marker(ctx, end1, VELOCITY, 4.3);

  if (flight.kickArc.length > 1) {
    const start2 = screen(camera, flight.kickArc[0]);
    const end2 = screen(camera, flight.kickArc[flight.kickArc.length - 1]);
    marker(ctx, start2, SECOND_BURN, 3.8);
    marker(ctx, end2, SECOND_BURN, 4.2);
  }

  if (scene.view === 'orbit') {
    if (flight.apoapsisPoint && Math.hypot(flight.apoapsisPoint.x, flight.apoapsisPoint.y) > 1.015) {
      const apoScreen = screen(camera, flight.apoapsisPoint);
      diamondMarker(ctx, apoScreen, flight.kickArc.length > 1 ? SECOND_BURN : VELOCITY, 4.2);
      orbitCallout(
        ctx,
        camera,
        flight.apoapsisPoint,
        flight.kickArc.length > 1 ? '2nd burn · Apoapsis' : 'Apoapsis (high)',
        flight.kickArc.length > 1 ? '#ffb899' : '#ffe0ad',
      );
    }
    if (flight.outcome === 'orbit' && !flight.circular && flight.periapsisPoint) {
      const periScreen = screen(camera, flight.periapsisPoint);
      diamondMarker(ctx, periScreen, '#9fe3c4', 3.8);
      orbitCallout(ctx, camera, flight.periapsisPoint, 'Periapsis (low)', '#a9ebd0');
    }
  }

  rocket(ctx, camera, scene.frame, scene.powered, scene.secondBurnActive);
  if (scene.view === 'ascent') orbitInset(ctx, scene);

  const p = screen(camera, scene.frame);
  if (p.x < 0 || p.x > WIDTH || p.y < 0 || p.y > HEIGHT) {
    ctx.fillStyle = '#102238dd';
    ctx.beginPath();
    ctx.roundRect(14, 14, 198, 30, 8);
    ctx.fill();
    ctx.strokeStyle = '#567591';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#eef0fb';
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Rocket beyond this view ↗', 26, 33);
  }
}
