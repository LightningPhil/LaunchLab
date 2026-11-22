/**
 * sky-scenery.ts — Sky, Atmosphere, Stars, Moons, Rings & Horizon Features
 *
 * Procedurally generates and draws world-specific sky and horizon features
 * (stars, clouds, trees, mountains, volcanic haze, Saturn rings, moons,
 * Phobos shadow, Pluto heart, Ganymede's Jupiter/ice, solar prominences).
 */
import { resolveEnvironment } from './environment.ts';
import {
  DEFAULT_PPM,
  PARALLAX_CLOUDS,
  PARALLAX_GROUND,
  PARALLAX_MOUNTAINS,
  PARALLAX_STARS,
  PARALLAX_TREES,
  type SceneViewport,
} from './scene-viewport.ts';
import { clamp, lerpRGB, rgb, rgba, type PlanetPalette } from './world-palettes.ts';

export interface CelestialBody {
  planet: string;
  name: string;
  radius: number;
  colour: number[];
  orbitPeriod: number;
  yFrac: number;
  yOscillation: number;
  phase: number;
  texture: string;
  shapeVerts: { a: number; r: number }[];
  orbitRadiusFactor: number;
  inclination: number;
  craters?: { ax: number; ay: number; r: number }[];
  maria?: { ax: number; ay: number; r: number }[];
}

export interface SceneryFeatures {
  starData: { x: number; y: number; b: number; r: number }[];
  cloudData: { x: number; y: number; r: number; puffs: number }[];
  treeData: { x: number; h: number; w: number }[];
  mountainData: { x: number; h: number; w: number }[];
  craterFieldData: { x: number; r: number }[];
  gasSwirls: { yFrac: number; amp: number; freq: number; phase: number; colShift: number }[];
  celestialBodies: CelestialBody[];
}

export function createSceneryFeatures(): SceneryFeatures {
  return {
    starData: [],
    cloudData: [],
    treeData: [],
    mountainData: [],
    craterFieldData: [],
    gasSwirls: [],
    celestialBodies: [
      {
        planet: 'mars', name: 'phobos',
        radius: 8, colour: [170, 155, 140],
        orbitPeriod: 35, yFrac: 0.3, yOscillation: 0.04,
        phase: 0, texture: 'lumpy', shapeVerts: [],
        orbitRadiusFactor: 2.77, inclination: 0.02,
      },
      {
        planet: 'mars', name: 'deimos',
        radius: 4, colour: [160, 150, 135],
        orbitPeriod: 60, yFrac: 0.18, yOscillation: 0.03,
        phase: 17.5, texture: 'lumpy', shapeVerts: [],
        orbitRadiusFactor: 6.92, inclination: 0.03,
      },
      {
        planet: 'earth', name: 'moon',
        radius: 25, colour: [230, 225, 210],
        orbitPeriod: 120, yFrac: 0.25, yOscillation: 0.02,
        phase: 5, texture: 'moon', shapeVerts: [],
        orbitRadiusFactor: 4.5, inclination: 0.09,
        craters: [
          { ax: -0.25, ay: -0.3, r: 0.18 },
          { ax: 0.3, ay: -0.15, r: 0.14 },
          { ax: -0.1, ay: 0.35, r: 0.12 },
          { ax: 0.2, ay: 0.25, r: 0.1 },
          { ax: -0.35, ay: 0.05, r: 0.09 },
          { ax: 0.05, ay: -0.05, r: 0.07 },
        ],
        maria: [
          { ax: -0.15, ay: -0.1, r: 0.3 },
          { ax: 0.2, ay: 0.15, r: 0.22 },
          { ax: -0.05, ay: 0.3, r: 0.18 },
        ],
      },
    ],
  };
}

export function generateFeatures(f: SceneryFeatures): void {
  f.starData = [];
  for (let i = 0; i < 140; i++) {
    f.starData.push({ x: Math.random(), y: Math.random() * 0.8, b: 0.4 + Math.random() * 0.6, r: 0.5 + Math.random() * 1.5 });
  }
  f.cloudData = [];
  for (let i = 0; i < 5; i++) {
    f.cloudData.push({
      x: Math.random() * 1.2 - 0.1, y: 0.08 + Math.random() * 0.22,
      r: 25 + Math.random() * 35, puffs: 3 + Math.floor(Math.random() * 3),
    });
  }
  f.treeData = [];
  const tc = 14 + Math.floor(Math.random() * 6);
  for (let i = 0; i < tc; i++) {
    f.treeData.push({ x: i / tc + (Math.random() * 0.04 - 0.02), h: 35 + Math.random() * 50, w: 18 + Math.random() * 25 });
  }
  f.mountainData = [];
  const mc = 8 + Math.floor(Math.random() * 4);
  for (let i = 0; i < mc; i++) {
    f.mountainData.push({ x: i / mc + (Math.random() * 0.06 - 0.03), h: 40 + Math.random() * 80, w: 30 + Math.random() * 60 });
  }
  f.craterFieldData = [];
  for (let i = 0; i < 20; i++) {
    f.craterFieldData.push({ x: Math.random(), r: 3 + Math.random() * 8 });
  }
  f.gasSwirls = [];
  for (let i = 0; i < 6; i++) {
    f.gasSwirls.push({
      yFrac: 0.12 + i * 0.14, amp: 3 + Math.random() * 5,
      freq: 0.01 + Math.random() * 0.02, phase: Math.random() * Math.PI * 2,
      colShift: (Math.random() - 0.5) * 22,
    });
  }

  for (const body of f.celestialBodies) {
    if (body.texture === 'lumpy') {
      const nVerts = body.name === 'phobos' ? 10 : 8;
      body.shapeVerts = [];
      for (let v = 0; v < nVerts; v++) {
        body.shapeVerts.push({ a: (v / nVerts) * Math.PI * 2, r: 0.75 + Math.random() * 0.5 });
      }
    }
  }
}

export function drawSky(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, H, env } = vp;
  const skyBottom = Math.min(vp.groundY, H);

  let spaceFrac = 0;
  if (vp.curveActive && vp.curveRadiusPx > 0) {
    spaceFrac = clamp(1 - vp.curveRadiusPx / (H * 2), 0, 1);
  }

  if (spaceFrac > 0.01) {
    ctx.fillStyle = '#050d1c';
    ctx.fillRect(0, 0, W, H);
  }

  if (spaceFrac < 0.99) {
    ctx.globalAlpha = 1 - spaceFrac;
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(1, skyBottom));
    grad.addColorStop(0, rgb(env.skyTop));
    grad.addColorStop(0.6, rgb(env.skyMid));
    grad.addColorStop(1, rgb(env.skyBot));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (spaceFrac > 0.1) {
    ctx.globalAlpha = spaceFrac * 0.65;
    drawStars(vp, f);
    ctx.globalAlpha = 1;
  }

  const atmosphere = resolveEnvironment(vp.displayedGravity);
  if (spaceFrac > 0.1 && vp.curveRadiusPx > 5 && atmosphere.surfacePressure > 10) {
    const atmosPx = Math.max(2, atmosphere.scaleHeight * 6 * vp.currentPPM);
    const atmosGrad = ctx.createRadialGradient(
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx,
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx + atmosPx
    );
    const a = Math.min(1, spaceFrac * 1.5);
    atmosGrad.addColorStop(0, rgba(env.skyBot, 0.5 * a));
    atmosGrad.addColorStop(0.4, rgba(env.skyMid, 0.25 * a));
    atmosGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx + atmosPx, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPlanetFeatures(vp: SceneViewport, f: SceneryFeatures, planet: PlanetPalette, alpha: number): void {
  if (alpha < 0.02) return;
  vp.ctx.globalAlpha = alpha;
  const skipSurface = vp.planetViewFrac > 0.5;

  switch (planet.features) {
    case 'pluto':    drawStars(vp, f); drawPlutoFeatures(vp, f, planet, skipSurface); break;
    case 'ganymede': drawStars(vp, f); drawGanymedeJupiter(vp); if (!skipSurface) drawGanymedeIce(vp); break;
    case 'moon':     drawStars(vp, f); if (!skipSurface) drawCraterFieldFeature(vp, f); break;
    case 'mercury':  drawStars(vp, f); if (!skipSurface) drawCraterFieldFeature(vp, f); break;
    case 'mars':     drawStars(vp, f); drawCelestialBodies(vp, f, 'mars'); if (!skipSurface) drawMountains(vp, f, planet); drawPhobosShadow(vp, f); break;
    case 'venus':    if (!skipSurface) drawVolcanicHaze(vp); break;
    case 'earth':    drawCelestialBodies(vp, f, 'earth'); if (!skipSurface) { drawClouds(vp, f); drawTreeline(vp, f); } break;
    case 'saturn':   drawSaturnRings(vp); break;
    case 'sun':      drawSolarProminences(vp); break;
  }
  vp.ctx.globalAlpha = 1;
}

function drawStars(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, baseGroundY, worldTime } = vp;
  const offset = vp.parallaxOffset(PARALLAX_STARS);
  const offsetY = vp.parallaxOffsetY(PARALLAX_STARS);
  for (let i = 0; i < f.starData.length; i++) {
    const s = f.starData[i];
    const twinkle = 0.5 + 0.5 * Math.sin(worldTime * 2 + i * 3.7);
    ctx.fillStyle = `rgba(255,255,255,${s.b * twinkle})`;
    const sx = vp.wrapX(s.x * W - offset, 5);
    const sy = s.y * baseGroundY + offsetY;
    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawClouds(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, baseGroundY, worldTime } = vp;
  const zr = Math.min(1, vp.currentPPM / DEFAULT_PPM);
  const offset = vp.parallaxOffset(PARALLAX_CLOUDS);
  const offsetY = vp.parallaxOffsetY(PARALLAX_CLOUDS);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const c of f.cloudData) {
    const cx = ((c.x + worldTime * 0.008) % 1.3) - 0.1;
    const cr = c.r * zr;
    const baseX = vp.wrapX(cx * W - offset, cr * c.puffs);
    const baseY = c.y * baseGroundY + offsetY;
    ctx.beginPath();
    for (let p = 0; p < c.puffs; p++) {
      const puffX = baseX + p * cr * 0.8;
      const puffY = baseY + (p % 2) * cr * 0.22;
      const puffR = cr * (p % 2 ? 0.82 : 1);
      ctx.moveTo(puffX + puffR, puffY);
      ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

function drawTreeline(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, groundY } = vp;
  const zr = Math.min(1, vp.currentPPM / DEFAULT_PPM);
  const offset = vp.parallaxOffset(PARALLAX_TREES);
  const shades = ['#3d654a', '#527459', '#345b44'];
  for (let i = 0; i < f.treeData.length; i++) {
    const t = f.treeData[i];
    const th = t.h * zr;
    const tw = t.w * zr;
    const tx = vp.wrapX(t.x * W - offset, tw);
    ctx.fillStyle = shades[i % 3];
    ctx.beginPath();
    ctx.moveTo(tx - tw * 0.45, groundY);
    ctx.lineTo(tx - tw * 0.23, groundY - th * 0.32);
    ctx.lineTo(tx - tw * 0.36, groundY - th * 0.29);
    ctx.lineTo(tx - tw * 0.14, groundY - th * 0.62);
    ctx.lineTo(tx - tw * 0.25, groundY - th * 0.58);
    ctx.lineTo(tx, groundY - th);
    ctx.lineTo(tx + tw * 0.25, groundY - th * 0.58);
    ctx.lineTo(tx + tw * 0.14, groundY - th * 0.62);
    ctx.lineTo(tx + tw * 0.36, groundY - th * 0.29);
    ctx.lineTo(tx + tw * 0.23, groundY - th * 0.32);
    ctx.lineTo(tx + tw * 0.45, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMountains(vp: SceneViewport, f: SceneryFeatures, planet: PlanetPalette): void {
  const { ctx, W, groundY } = vp;
  const zr = Math.min(1, vp.currentPPM / DEFAULT_PPM);
  const col = lerpRGB(planet.groundTop, planet.skyBot, 0.4);
  const offset = vp.parallaxOffset(PARALLAX_MOUNTAINS);
  ctx.fillStyle = rgb(col);
  for (const m of f.mountainData) {
    const mx = vp.wrapX(m.x * W - offset, m.w * zr);
    const mh = m.h * zr;
    const mw = m.w * zr;
    ctx.beginPath();
    ctx.moveTo(mx - mw, groundY);
    ctx.lineTo(mx - mw * 0.3, groundY - mh * 0.6);
    ctx.lineTo(mx, groundY - mh);
    ctx.lineTo(mx + mw * 0.25, groundY - mh * 0.55);
    ctx.lineTo(mx + mw, groundY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawVolcanicHaze(vp: SceneViewport): void {
  const { ctx, W, baseGroundY } = vp;
  const hazeOffY = vp.parallaxOffsetY(PARALLAX_CLOUDS);
  const hazeTop = baseGroundY * 0.5 + hazeOffY;
  const hazeBot = baseGroundY + hazeOffY;
  const grad = ctx.createLinearGradient(0, hazeTop, 0, hazeBot);
  grad.addColorStop(0, 'rgba(200,150,40,0)');
  grad.addColorStop(0.5, 'rgba(200,150,40,0.08)');
  grad.addColorStop(1, 'rgba(200,130,30,0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, hazeBot);
}

function drawSaturnRings(vp: SceneViewport): void {
  const { ctx, W, H, baseGroundY, worldTime } = vp;
  const ringDefs = [
    { rOff: -42, w: 5, col: [210, 195, 150], a: 0.14 },
    { rOff: -28, w: 10, col: [195, 180, 135], a: 0.25 },
    { rOff: -14, w: 16, col: [215, 200, 160], a: 0.2 },
    { rOff: 0, w: 12, col: [225, 212, 172], a: 0.28 },
    { rOff: 16, w: 4, col: [60, 50, 35], a: 0.18 },
    { rOff: 22, w: 20, col: [200, 188, 148], a: 0.22 },
    { rOff: 44, w: 10, col: [185, 170, 130], a: 0.16 },
    { rOff: 58, w: 5, col: [170, 158, 118], a: 0.1 },
  ];

  if (vp.curveActive && vp.curveRadiusPx > 5) {
    ctx.save();
    const tilt = 0.25 + Math.sin(worldTime * 0.04) * 0.12;
    const baseRingR = vp.curveRadiusPx * 1.7;
    const offsetScale = vp.curveRadiusPx / 300;
    for (const rd of ringDefs) {
      const r = baseRingR + rd.rOff * offsetScale;
      if (r < vp.curveRadiusPx * 1.05) continue;
      ctx.strokeStyle = `rgba(${rd.col[0]},${rd.col[1]},${rd.col[2]},${rd.a})`;
      ctx.lineWidth = Math.max(1, rd.w * offsetScale);
      ctx.beginPath();
      ctx.ellipse(vp.curveCentreX, vp.curveCentreY, r, r * 0.35, tilt, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(230,215,170,0.04)';
    ctx.lineWidth = Math.max(2, 40 * offsetScale);
    ctx.beginPath();
    ctx.ellipse(vp.curveCentreX, vp.curveCentreY, baseRingR, baseRingR * 0.35, tilt, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, baseGroundY);
  ctx.clip();

  const drift = worldTime * 0.015;
  const tilt2 = 0.25 + Math.sin(worldTime * 0.04) * 0.12;
  const ringsOffset = vp.parallaxOffset(PARALLAX_STARS);
  const ringsOffsetY = vp.parallaxOffsetY(PARALLAX_STARS);
  const cx = W * 0.5 + Math.sin(drift) * W * 0.15 - ringsOffset;
  const cy = baseGroundY + H * 2.8 + ringsOffsetY;
  const baseR = H * 2.9;

  for (const rd2 of ringDefs) {
    const r2 = baseR + rd2.rOff;
    ctx.strokeStyle = `rgba(${rd2.col[0]},${rd2.col[1]},${rd2.col[2]},${rd2.a})`;
    ctx.lineWidth = rd2.w;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r2, r2 * 0.97, tilt2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(230,215,170,0.06)';
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.ellipse(cx, cy, baseR, baseR * 0.97, tilt2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCelestialBodies(vp: SceneViewport, f: SceneryFeatures, planetName: string): void {
  const { W, H, baseGroundY, worldTime } = vp;
  for (const body of f.celestialBodies) {
    if (body.planet !== planetName) continue;
    let cx: number, cy: number, displayR: number;

    if (vp.curveActive && body.orbitRadiusFactor) {
      const orbAngle = ((worldTime + body.phase) / body.orbitPeriod) * Math.PI * 2;
      const incl = body.inclination || 0;
      const orbitRPx = vp.curveRadius * body.orbitRadiusFactor * vp.currentPPM;
      cx = vp.curveCentreX + Math.cos(orbAngle) * orbitRPx;
      cy = vp.curveCentreY + Math.sin(orbAngle) * orbitRPx * Math.cos(incl);
      displayR = Math.max(body.radius, vp.curveRadiusPx * 0.012);
    } else {
      const offset = vp.parallaxOffset(PARALLAX_STARS);
      const offsetY = vp.parallaxOffsetY(PARALLAX_STARS);
      const xFrac = (((worldTime + body.phase) / body.orbitPeriod) % 1.3) - 0.15;
      const yBase = body.yFrac * baseGroundY + offsetY;
      const yBob = Math.sin(worldTime * 0.5 + body.phase) * body.yOscillation * baseGroundY;
      cx = xFrac * W - offset;
      cy = yBase + yBob;
      displayR = body.radius;
    }

    if (cx < -displayR * 2 || cx > W + displayR * 2 || cy < -displayR * 2 || cy > H + displayR * 2) continue;
    if (body.texture === 'lumpy') drawLumpyMoon(vp, cx, cy, body, displayR);
    else if (body.texture === 'moon') drawEarthMoon(vp, cx, cy, body, displayR);
  }
}

function drawLumpyMoon(vp: SceneViewport, cx: number, cy: number, body: CelestialBody, r: number): void {
  const verts = body.shapeVerts;
  if (!verts || verts.length < 3) return;
  const { ctx, worldTime } = vp;
  const rot = worldTime * 0.3 + body.phase;

  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i].a + rot;
    const vr = verts[i].r * r;
    const px = Math.cos(a) * vr + 2;
    const py = Math.sin(a) * vr + 2;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgb(body.colour);
  ctx.beginPath();
  for (let j = 0; j < verts.length; j++) {
    const a2 = verts[j].a + rot;
    const vr2 = verts[j].r * r;
    const px2 = Math.cos(a2) * vr2;
    const py2 = Math.sin(a2) * vr2;
    if (j === 0) ctx.moveTo(px2, py2);
    else ctx.lineTo(px2, py2);
  }
  ctx.closePath();
  ctx.fill();

  const shadeGrad = ctx.createLinearGradient(-r, 0, r, 0);
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = shadeGrad;
  ctx.beginPath();
  for (let k = 0; k < verts.length; k++) {
    const a3 = verts[k].a + rot;
    const vr3 = verts[k].r * r;
    const px3 = Math.cos(a3) * vr3;
    const py3 = Math.sin(a3) * vr3;
    if (k === 0) ctx.moveTo(px3, py3);
    else ctx.lineTo(px3, py3);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let c = 0; c < 3; c++) {
    const ca = c * 2.1 + rot * 0.2;
    const cr = r * 0.3;
    ctx.beginPath();
    ctx.arc(Math.cos(ca) * cr, Math.sin(ca) * cr, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEarthMoon(vp: SceneViewport, cx: number, cy: number, body: CelestialBody, r: number): void {
  const { ctx, worldTime } = vp;
  ctx.save();
  ctx.translate(cx, cy);

  ctx.save();
  ctx.shadowColor = 'rgba(240,235,210,0.35)';
  ctx.shadowBlur = r * 0.8;
  ctx.fillStyle = 'rgba(240,235,210,0.01)';
  ctx.beginPath();
  ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const mainGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r);
  mainGrad.addColorStop(0, 'rgb(248,246,238)');
  mainGrad.addColorStop(0.35, 'rgb(235,230,215)');
  mainGrad.addColorStop(0.7, 'rgb(215,210,195)');
  mainGrad.addColorStop(1, 'rgb(170,165,150)');
  ctx.fillStyle = mainGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  if (body.maria) {
    for (const ma of body.maria) {
      const mcx = ma.ax * r * 2;
      const mcy = ma.ay * r * 2;
      const mr = ma.r * r * 2;
      const mariaGrad = ctx.createRadialGradient(mcx, mcy, mr * 0.15, mcx, mcy, mr);
      mariaGrad.addColorStop(0, 'rgba(105,100,92,0.3)');
      mariaGrad.addColorStop(0.6, 'rgba(115,110,100,0.18)');
      mariaGrad.addColorStop(1, 'rgba(130,125,115,0)');
      ctx.fillStyle = mariaGrad;
      ctx.beginPath();
      ctx.arc(mcx, mcy, mr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (body.craters) {
    for (const cr of body.craters) {
      const crx = cr.ax * r * 2;
      const cry = cr.ay * r * 2;
      const crr = cr.r * r * 2;
      const craterGrad = ctx.createRadialGradient(crx, cry, crr * 0.1, crx, cry, crr);
      craterGrad.addColorStop(0, 'rgba(130,125,115,0.35)');
      craterGrad.addColorStop(0.7, 'rgba(145,140,130,0.2)');
      craterGrad.addColorStop(1, 'rgba(160,155,145,0)');
      ctx.fillStyle = craterGrad;
      ctx.beginPath();
      ctx.arc(crx, cry, crr, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,252,240,0.3)';
      ctx.lineWidth = Math.max(0.5, crr * 0.12);
      ctx.beginPath();
      ctx.arc(crx, cry, crr * 0.9, Math.PI * 0.85, Math.PI * 1.65);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(80,75,65,0.15)';
      ctx.lineWidth = Math.max(0.5, crr * 0.1);
      ctx.beginPath();
      ctx.arc(crx, cry, crr * 0.7, Math.PI * 1.85, Math.PI * 0.55);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  for (let ti = 0; ti < 20; ti++) {
    const ta = ti * 0.618 * Math.PI * 2;
    const td = ((ti * 0.37) % 1) * r * 0.85;
    const tr2 = 0.5 + (ti % 3) * 0.4;
    ctx.beginPath();
    ctx.arc(Math.cos(ta) * td, Math.sin(ta) * td, tr2, 0, Math.PI * 2);
    ctx.fill();
  }

  const phaseCycle = (worldTime * 0.0033) % 1.0;
  const shadowOffset = Math.cos(phaseCycle * Math.PI * 2) * r * 1.15;
  const phaseGrad = ctx.createLinearGradient(shadowOffset - r * 0.3, 0, shadowOffset + r * 0.3, 0);
  phaseGrad.addColorStop(0, 'rgba(10,10,20,0)');
  phaseGrad.addColorStop(0.4, 'rgba(10,10,20,0.45)');
  phaseGrad.addColorStop(1, 'rgba(10,10,20,0.55)');
  ctx.fillStyle = phaseGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.5, Math.PI * 0.5, false);
  ctx.arc(shadowOffset, 0, r, Math.PI * 0.5, -Math.PI * 0.5, false);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  const limbGrad = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
  limbGrad.addColorStop(0, 'rgba(0,0,0,0)');
  limbGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,245,0.09)';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.28, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPhobosShadow(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, groundY, worldTime } = vp;
  for (const body of f.celestialBodies) {
    if (body.name !== 'phobos') continue;
    let shadowX: number, shadowGY: number;
    let shadowW = 30 + Math.sin(worldTime * 0.8) * 5;
    let shadowH = 6;

    if (vp.curveActive && body.orbitRadiusFactor) {
      const orbAngle = ((worldTime + body.phase) / body.orbitPeriod) * Math.PI * 2;
      const shadowPhysX = orbAngle * vp.curveRadius;
      shadowX = vp.toCanvasX(shadowPhysX);
      shadowGY = vp.groundYAtPhysX(shadowPhysX);
      shadowW = Math.max(6, vp.curveRadiusPx * 0.015);
      shadowH = Math.max(2, shadowW * 0.2);
    } else {
      const offset = vp.parallaxOffset(PARALLAX_GROUND);
      const xFrac = (((worldTime + body.phase) / body.orbitPeriod) % 1.3) - 0.15;
      if (xFrac < -0.05 || xFrac > 1.05) continue;
      shadowX = xFrac * W - offset;
      shadowGY = groundY + 1;
    }

    if (shadowX < -shadowW * 2 || shadowX > W + shadowW * 2) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowGY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCraterFieldFeature(vp: SceneViewport, f: SceneryFeatures): void {
  const { ctx, W, groundY } = vp;
  const offset = vp.parallaxOffset(PARALLAX_GROUND);
  for (const c of f.craterFieldData) {
    const cx = vp.wrapX(c.x * W - offset, c.r * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 2, c.r, c.r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY + 1, c.r * 0.7, c.r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlutoFeatures(vp: SceneViewport, f: SceneryFeatures, planet: PlanetPalette, skipSurface: boolean): void {
  if (!skipSurface) {
    drawMountains(vp, f, planet);
    drawCraterFieldFeature(vp, f);
    return;
  }
  if (!vp.curveActive || vp.curveRadiusPx < 18) return;
  const { ctx } = vp;
  ctx.save();
  ctx.beginPath();
  ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(vp.curveCentreX - vp.curveRadiusPx * 0.18, vp.curveCentreY - vp.curveRadiusPx * 0.22);
  ctx.rotate(-0.24);
  const size = vp.curveRadiusPx * 0.26;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.3);
  ctx.bezierCurveTo(-size * 1.15, -size * 0.42, -size * 0.65, -size * 1.25, 0, -size * 0.62);
  ctx.bezierCurveTo(size * 0.65, -size * 1.25, size * 1.15, -size * 0.42, 0, size * 0.3);
  ctx.fillStyle = 'rgba(237,229,209,.5)';
  ctx.fill();
  ctx.restore();
}

function drawGanymedeJupiter(vp: SceneViewport): void {
  const { ctx, W, baseGroundY } = vp;
  const r = clamp(Math.min(W, baseGroundY) * 0.085, 28, 72);
  const offset = vp.parallaxOffset(PARALLAX_STARS);
  const x = W * 0.79 - offset;
  const y = baseGroundY * 0.2 + vp.parallaxOffsetY(PARALLAX_STARS);
  ctx.save();
  ctx.shadowColor = 'rgba(225,190,135,.2)';
  ctx.shadowBlur = r * 0.55;
  ctx.fillStyle = '#cfa783';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
  const bands: [number, number, string][] = [
    [-0.72, 0.19, '#e3c7a1'], [-0.43, 0.15, '#a86f58'], [-0.2, 0.19, '#e8d1ad'],
    [0.05, 0.14, '#bd8063'], [0.28, 0.18, '#efd9b5'], [0.55, 0.13, '#9f6857'],
  ];
  for (const band of bands) {
    ctx.fillStyle = band[2];
    ctx.fillRect(x - r, y + band[0] * r, r * 2, band[1] * r);
  }
  ctx.fillStyle = '#a85845';
  ctx.beginPath(); ctx.ellipse(x + r * 0.34, y + r * 0.28, r * 0.22, r * 0.095, -0.08, 0, Math.PI * 2); ctx.fill();
  const shade = ctx.createLinearGradient(x - r, y, x + r, y);
  shade.addColorStop(0, 'rgba(255,255,255,.18)');
  shade.addColorStop(0.55, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(20,18,28,.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
  ctx.strokeStyle = 'rgba(244,224,191,.48)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawGanymedeIce(vp: SceneViewport): void {
  const { ctx, W, groundY } = vp;
  const offset = vp.parallaxOffset(PARALLAX_GROUND);
  ctx.save();
  ctx.strokeStyle = 'rgba(163,217,226,.5)';
  ctx.fillStyle = 'rgba(205,235,236,.38)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 11; i++) {
    const x = vp.wrapX((i * W) / 10 - offset, 35);
    const height = 8 + ((i * 7) % 18);
    ctx.beginPath();
    ctx.moveTo(x - 25, groundY + 1);
    ctx.lineTo(x - 10, groundY - height * 0.35);
    ctx.lineTo(x, groundY - height);
    ctx.lineTo(x + 9, groundY - height * 0.42);
    ctx.lineTo(x + 25, groundY + 1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(101,166,182,.55)';
  ctx.lineWidth = 1.4;
  for (let j = 0; j < 8; j++) {
    const crackX = vp.wrapX((j * W) / 7 + 31 - offset, 25);
    ctx.beginPath();
    ctx.moveTo(crackX, groundY - 1);
    ctx.lineTo(crackX + 7, groundY - 9);
    ctx.lineTo(crackX + 3, groundY - 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSolarProminences(vp: SceneViewport): void {
  const { ctx, W, groundY, worldTime } = vp;
  ctx.save();
  ctx.lineCap = 'round';
  const rimAlpha = vp.curveActive && vp.curveRadiusPx > 10 ? Math.min(1, Math.max(0, (vp.planetViewFrac - 0.1) / 0.3)) : 0;
  const flatAlpha = 1 - Math.min(1, Math.max(0, vp.planetViewFrac / 0.3));
  if (rimAlpha > 0) {
    ctx.globalAlpha = rimAlpha;
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI * 0.92 + i * Math.PI * 0.37 + Math.sin(worldTime * 0.11 + i) * 0.03;
      const x = vp.curveCentreX + Math.cos(angle) * vp.curveRadiusPx;
      const y = vp.curveCentreY + Math.sin(angle) * vp.curveRadiusPx;
      const loop = Math.max(4, vp.curveRadiusPx * (0.08 + (i % 3) * 0.018));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI / 2);
      ctx.strokeStyle = 'rgba(255,193,68,.48)';
      ctx.lineWidth = Math.max(1.5, vp.curveRadiusPx * 0.012);
      ctx.beginPath();
      ctx.bezierCurveTo(-loop, -loop * 0.15, -loop * 0.72, -loop * 1.45, 0, -loop * 1.2);
      ctx.bezierCurveTo(loop * 0.72, -loop * 1.45, loop, -loop * 0.15, 0, 0);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (flatAlpha > 0) {
    ctx.globalAlpha = flatAlpha;
    const glow = ctx.createLinearGradient(0, groundY - 105, 0, groundY);
    glow.addColorStop(0, 'rgba(255,188,54,0)');
    glow.addColorStop(1, 'rgba(255,211,91,.35)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, Math.max(0, groundY - 105), W, 105);
    for (let j = 0; j < 5; j++) {
      const baseX = ((j + 0.35) / 5) * W;
      const height = 21 + (j % 3) * 13 + Math.sin(worldTime * 1.4 + j) * 4;
      ctx.strokeStyle = 'rgba(255,224,116,.45)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(baseX - 15, groundY + 2);
      ctx.bezierCurveTo(baseX - 18, groundY - height, baseX + 18, groundY - height, baseX + 15, groundY + 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
