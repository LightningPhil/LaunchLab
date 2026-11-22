/**
 * ground-scenery.ts — Ground Layers, Whole-Globe Disc, Rings & Surface Marks
 *
 * Draws flat, spherical, and subpixel local-horizon ground layers (solid and
 * gas), whole-globe surface textures with Saturn C/B/A ring masking, the cannon
 * mound, decorative Earth golf flag, craters, gas holes, and shockwave rings.
 */
import { horizonPoint, localHorizon, traceLocalDisc, type LocalHorizon } from './local-horizon.ts';
import { worldGlobe } from './world-globe.ts';
import {
  CANNON_BASE_X_M,
  DEFAULT_PPM,
  PARALLAX_GROUND,
  type SceneViewport,
} from './scene-viewport.ts';
import { drawPlanetFeatures, drawSky, type SceneryFeatures } from './sky-scenery.ts';
import { clamp, lerpRGB, rgb, rgba } from './world-palettes.ts';

export function drawWorld(vp: SceneViewport, f: SceneryFeatures): void {
  const { env } = vp;
  drawSky(vp, f);
  const localDetail = 1 - globeVisibility(vp);
  if (env.lowerAlpha * localDetail > 0.02) drawPlanetFeatures(vp, f, env.lowerPlanet, env.lowerAlpha * localDetail);
  if (env.upperAlpha * localDetail > 0.02 && env.upperPlanet !== env.lowerPlanet) {
    drawPlanetFeatures(vp, f, env.upperPlanet, env.upperAlpha * localDetail);
  }
  drawWorldRings(vp, false);
  drawGround(vp, f);
  if (vp.curveActive) drawGlobeSurface(vp);
  drawWorldRings(vp, true);
  drawMound(vp);
}

function globeVisibility(vp: SceneViewport): number {
  return vp.curveRadiusPx > 0 ? clamp(((Math.max(vp.W, vp.H) * 10) / vp.curveRadiusPx - 1) / 2, 0, 1) : 0;
}

function drawWorldRings(vp: SceneViewport, front: boolean): void {
  const visibility = globeVisibility(vp);
  if (!vp.curveActive || visibility <= 0) return;
  const { env, ctx } = vp;
  const saturnAlpha =
    (env.lowerPlanet.name === 'saturn' ? env.lowerAlpha : 0) +
    (env.upperPlanet.name === 'saturn' ? env.upperAlpha : 0);
  if (saturnAlpha < 0.01) return;
  ctx.save();
  ctx.globalAlpha = saturnAlpha * visibility * 0.7;
  for (let metres = 74658000; metres <= 136780000; metres += 1000000) {
    if (metres > 117507000 && metres < 122340000) continue;
    const radius = metres / vp.curveRadius;
    ctx.strokeStyle = metres < 91975000 ? '#9c927c' : metres < 117507000 ? '#daccab' : '#baad8b';
    ctx.lineWidth = Math.max(0.6, vp.curveRadiusPx * 0.014);
    ctx.beginPath();
    ctx.ellipse(
      vp.curveCentreX, vp.curveCentreY,
      vp.curveRadiusPx * radius, vp.curveRadiusPx * radius * 0.32,
      -0.32, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlobeSurface(vp: SceneViewport): void {
  const visibility = globeVisibility(vp);
  if (visibility <= 0) return;
  const { ctx, W, H, env } = vp;
  ctx.save();
  ctx.globalAlpha = visibility;
  ctx.beginPath();
  ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, 0, Math.PI * 2);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const shade = ctx.createRadialGradient(
    vp.curveCentreX - vp.curveRadiusPx * 0.35, vp.curveCentreY - vp.curveRadiusPx * 0.35,
    0, vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx
  );
  shade.addColorStop(0, rgb(env.groundTop));
  shade.addColorStop(0.7, rgb(env.groundBot));
  shade.addColorStop(1, '#14232e');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  for (const [planet, alpha] of [[env.lowerPlanet, env.lowerAlpha], [env.upperPlanet, env.upperAlpha]] as const) {
    if (alpha < 0.01) continue;
    const globe = worldGlobe(planet.name, vp.curveRadiusPx * 2 * vp.pixelRatio);
    if (!globe) continue;
    ctx.globalAlpha = visibility * alpha;
    ctx.drawImage(globe, vp.curveCentreX - vp.curveRadiusPx, vp.curveCentreY - vp.curveRadiusPx, vp.curveRadiusPx * 2, vp.curveRadiusPx * 2);
  }
  ctx.restore();
}

function drawGround(vp: SceneViewport, f: SceneryFeatures): void {
  if (vp.env.solidness > 0.01) drawSolidGround(vp, vp.env.solidness);
  if (vp.env.solidness < 0.99) drawGasGround(vp, f, 1 - vp.env.solidness);
}

function drawLocalGround(vp: SceneViewport, gas: boolean): void {
  const { ctx, W, H, env } = vp;
  const h = localHorizon(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, W, H);
  if (h.offset > h.extent / 2 + 12) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  const zr = Math.min(1, vp.currentPPM / DEFAULT_PPM);
  const depth = Math.max(8, 40 * zr);
  const gradient = ctx.createLinearGradient(
    h.middle.x + (h.normal.x * h.extent) / 2, h.middle.y + (h.normal.y * h.extent) / 2,
    h.middle.x - (h.normal.x * h.extent) / 2, h.middle.y - (h.normal.y * h.extent) / 2
  );
  for (let i = 0; i <= 8; i++) {
    const inward = -h.offset + (i / 8 - 0.5) * h.extent;
    const fraction = gas
      ? clamp(1 - inward / (h.radius * 0.3), 0, 1)
      : clamp((h.radius * 0.15 - inward) / (h.radius * 0.13), 0, 1);
    const colour = gas
      ? fraction < 0.5
        ? lerpRGB(env.subBot, env.groundBot, fraction * 2)
        : lerpRGB(env.groundBot, env.groundTop, fraction * 2 - 1)
      : lerpRGB(env.subBot, env.subTop, fraction);
    gradient.addColorStop(i / 8, rgb(colour));
  }
  ctx.fillStyle = gradient;
  ctx.beginPath(); traceLocalDisc(ctx, h); ctx.fill();

  if (Math.abs(h.offset) <= h.extent / 2 + depth + 12) {
    if (!gas) {
      const surface = ctx.createLinearGradient(
        h.surface.x, h.surface.y,
        h.surface.x - h.normal.x * depth, h.surface.y - h.normal.y * depth
      );
      surface.addColorStop(0, rgb(env.groundTop));
      surface.addColorStop(1, rgb(env.groundBot));
      ctx.fillStyle = surface;
      ctx.beginPath(); traceLocalDisc(ctx, h); traceLocalDisc(ctx, h, depth); ctx.fill('evenodd');
    }
    drawLocalGroundEdge(vp, h, gas, zr);
  }
  ctx.restore();
}

function drawLocalGroundEdge(vp: SceneViewport, h: LocalHorizon, gas: boolean, zr: number): void {
  const { ctx, env, worldTime } = vp;
  const step = gas ? 8 : 10;
  const count = Math.ceil((2 * h.extent) / step);
  const phase = vp.parallaxOffset(PARALLAX_GROUND);
  ctx.fillStyle = rgb(env.surfEdge);
  ctx.beginPath();
  for (let i = 0; i <= count; i++) {
    const along = -h.extent + (i * 2 * h.extent) / count;
    const wx = along + phase;
    const ripple = gas
      ? Math.sin(wx * 0.03 + worldTime * 1.8) * 5 + Math.sin(wx * 0.07 + worldTime * 1.3) * 3 + Math.sin(wx * 0.15 + worldTime * 2.5) * 2
      : zr * (3 * Math.sin(wx * 0.05) + 2 * Math.sin(wx * 0.13));
    const p = horizonPoint(h, along, -ripple);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let i = count; i >= 0; i--) {
    const p = horizonPoint(h, -h.extent + (i * 2 * h.extent) / count, gas ? 12 : Math.max(2, 6 * zr));
    ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawSolidGround(vp: SceneViewport, alpha: number): void {
  const { ctx, W, H, groundY, env } = vp;
  ctx.globalAlpha = alpha;
  const zr = Math.min(1, vp.currentPPM / DEFAULT_PPM);
  const surfDepth = Math.max(8, 40 * zr);
  const edgeAmp = 3 * zr;
  const edgeAmp2 = 2 * zr;

  if (vp.curveActive) {
    if (vp.curveRadiusPx > 16 * (Math.hypot(W, H) + 32)) {
      drawLocalGround(vp, false);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    const subGrad = ctx.createRadialGradient(
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx * 0.85,
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx * 0.98
    );
    subGrad.addColorStop(0, rgb(env.subBot));
    subGrad.addColorStop(1, rgb(env.subTop));
    ctx.fillStyle = subGrad;
    ctx.beginPath();
    ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    const surfGrad = ctx.createRadialGradient(
      vp.curveCentreX, vp.curveCentreY, Math.max(0, vp.curveRadiusPx - surfDepth),
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx
    );
    surfGrad.addColorStop(0, rgb(env.groundBot));
    surfGrad.addColorStop(1, rgb(env.groundTop));
    ctx.fillStyle = surfGrad;
    ctx.beginPath();
    ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, 0, Math.PI * 2);
    ctx.arc(vp.curveCentreX, vp.curveCentreY, Math.max(0, vp.curveRadiusPx - surfDepth), 0, Math.PI * 2, true);
    ctx.fill();

    if (vp.planetViewFrac < 0.5) {
      const groundOff = vp.parallaxOffset(PARALLAX_GROUND);
      ctx.fillStyle = rgb(env.surfEdge);
      ctx.beginPath();
      const STEP = 10;
      for (let sx = -STEP; sx <= W + STEP; sx += STEP) {
        const approxPhysX = vp.cameraX + sx / vp.currentPPM;
        const gPt = vp.worldToScreen(approxPhysX, 0);
        const wx = sx + groundOff;
        const ripple = edgeAmp * Math.sin(wx * 0.05) + edgeAmp2 * Math.sin(wx * 0.13);
        let nx = gPt.sx - vp.curveCentreX;
        let ny = gPt.sy - vp.curveCentreY;
        const nl = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= nl; ny /= nl;
        if (sx === -STEP) ctx.moveTo(gPt.sx - nx * ripple, gPt.sy - ny * ripple);
        else ctx.lineTo(gPt.sx - nx * ripple, gPt.sy - ny * ripple);
      }
      for (let sx2 = W + STEP; sx2 >= -STEP; sx2 -= STEP) {
        const approxPhysX2 = vp.cameraX + sx2 / vp.currentPPM;
        const gPt2 = vp.worldToScreen(approxPhysX2, 0);
        const nx2 = gPt2.sx - vp.curveCentreX;
        const ny2 = gPt2.sy - vp.curveCentreY;
        const nl2 = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
        ctx.lineTo(gPt2.sx + (nx2 / nl2) * Math.max(2, 6 * zr), gPt2.sy + (ny2 / nl2) * Math.max(2, 6 * zr));
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  const grad = ctx.createLinearGradient(0, groundY, 0, groundY + surfDepth);
  grad.addColorStop(0, rgb(env.groundTop));
  grad.addColorStop(1, rgb(env.groundBot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY, W, surfDepth);

  const groundOff = vp.parallaxOffset(PARALLAX_GROUND);
  ctx.fillStyle = rgb(env.surfEdge);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= W; x += 10) {
    const wx = x + groundOff;
    ctx.lineTo(x, groundY - edgeAmp * Math.sin(wx * 0.05) - edgeAmp2 * Math.sin(wx * 0.13));
  }
  ctx.lineTo(W, groundY + Math.max(2, 6 * zr));
  ctx.lineTo(0, groundY + Math.max(2, 6 * zr));
  ctx.closePath();
  ctx.fill();

  const grad2 = ctx.createLinearGradient(0, groundY + surfDepth, 0, H);
  grad2.addColorStop(0, rgb(env.subTop));
  grad2.addColorStop(1, rgb(env.subBot));
  ctx.fillStyle = grad2;
  ctx.fillRect(0, groundY + surfDepth, W, H - groundY - surfDepth);
  ctx.globalAlpha = 1;
}

function drawGasGround(vp: SceneViewport, f: SceneryFeatures, alpha: number): void {
  const { ctx, W, H, groundY, env, worldTime } = vp;
  ctx.globalAlpha = alpha;

  if (vp.curveActive) {
    if (vp.curveRadiusPx > 16 * (Math.hypot(W, H) + 32)) {
      drawLocalGround(vp, true);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    const gasGrad = ctx.createRadialGradient(
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx * 0.7,
      vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx
    );
    gasGrad.addColorStop(0, rgb(env.subBot));
    gasGrad.addColorStop(0.5, rgb(env.groundBot));
    gasGrad.addColorStop(1, rgb(env.groundTop));
    ctx.fillStyle = gasGrad;
    ctx.beginPath();
    ctx.arc(vp.curveCentreX, vp.curveCentreY, vp.curveRadiusPx, 0, Math.PI * 2);
    ctx.fill();

    if (vp.planetViewFrac < 0.5) {
      const gasGroundOff = vp.parallaxOffset(PARALLAX_GROUND);
      ctx.fillStyle = rgb(env.surfEdge);
      ctx.beginPath();
      const STEP = 8;
      for (let sx = -STEP; sx <= W + STEP; sx += STEP) {
        const approxPhysX = vp.cameraX + sx / vp.currentPPM;
        const gPt = vp.worldToScreen(approxPhysX, 0);
        const wx = sx + gasGroundOff;
        const turb = Math.sin(wx * 0.03 + worldTime * 1.8) * 5 + Math.sin(wx * 0.07 + worldTime * 1.3) * 3 + Math.sin(wx * 0.15 + worldTime * 2.5) * 2;
        const nx = gPt.sx - vp.curveCentreX;
        const ny = gPt.sy - vp.curveCentreY;
        const nl = Math.sqrt(nx * nx + ny * ny) || 1;
        const px = gPt.sx + (nx / nl) * turb;
        const py = gPt.sy + (ny / nl) * turb;
        if (sx === -STEP) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let sx2 = W + STEP; sx2 >= -STEP; sx2 -= STEP) {
        const approxPhysX2 = vp.cameraX + sx2 / vp.currentPPM;
        const gPt2 = vp.worldToScreen(approxPhysX2, 0);
        const nx2 = gPt2.sx - vp.curveCentreX;
        const ny2 = gPt2.sy - vp.curveCentreY;
        const nl2 = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
        ctx.lineTo(gPt2.sx + (nx2 / nl2) * 12, gPt2.sy + (ny2 / nl2) * 12);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  const grad = ctx.createLinearGradient(0, groundY, 0, H);
  grad.addColorStop(0, rgb(env.groundTop));
  grad.addColorStop(0.5, rgb(env.groundBot));
  grad.addColorStop(1, rgb(env.subBot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, groundY - 5, W, H - groundY + 5);

  const gasGroundOff = vp.parallaxOffset(PARALLAX_GROUND);
  ctx.fillStyle = rgb(env.surfEdge);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let x = 0; x <= W; x += 8) {
    const wx = x + gasGroundOff;
    const turb = Math.sin(wx * 0.03 + worldTime * 1.8) * 5 + Math.sin(wx * 0.07 + worldTime * 1.3) * 3 + Math.sin(wx * 0.15 + worldTime * 2.5) * 2;
    ctx.lineTo(x, groundY + turb);
  }
  ctx.lineTo(W, groundY + 12);
  ctx.lineTo(0, groundY + 12);
  ctx.closePath();
  ctx.fill();

  for (const s of f.gasSwirls) {
    const bandY = groundY + s.yFrac * (H - groundY);
    const shift = Math.sin(worldTime * 0.5 + s.phase) * 2;
    const col = [
      clamp(env.groundTop[0] + s.colShift, 0, 255),
      clamp(env.groundTop[1] + s.colShift, 0, 255),
      clamp(env.groundTop[2] + s.colShift, 0, 255),
    ];
    ctx.fillStyle = rgba(col, 0.25);
    ctx.beginPath();
    ctx.moveTo(0, bandY + shift);
    for (let x2 = 0; x2 <= W; x2 += 10) {
      const wx2 = x2 + gasGroundOff;
      ctx.lineTo(x2, bandY + shift + Math.sin(wx2 * s.freq + worldTime * 0.7) * s.amp);
    }
    ctx.lineTo(W, bandY + shift + 8);
    ctx.lineTo(0, bandY + shift + 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMound(vp: SceneViewport): void {
  if (vp.planetViewFrac > 0.5) return;
  const { ctx, env } = vp;
  const px = vp.toCanvasX(CANNON_BASE_X_M);
  const py = vp.groundYAtPhysX(CANNON_BASE_X_M);
  const mw = Math.max(25, 0.9 * vp.currentPPM);
  const mh = Math.max(6, mw * 0.28);
  const tilt = vp.surfaceNormalAngle(CANNON_BASE_X_M);
  ctx.fillStyle = rgb(env.moundCol);
  ctx.beginPath();
  ctx.ellipse(px, py, mw, mh, tilt, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGolfFlag(vp: SceneViewport): void {
  if (vp.currentPPM < 8) return;
  const { ctx } = vp;
  const x = 8.5;
  const point = vp.toCanvas(x, 0);
  const scale = vp.currentPPM / 80;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.rotate(vp.surfaceNormalAngle(x));
  ctx.scale(scale, scale);
  ctx.fillStyle = '#456e49';
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#243d37';
  ctx.beginPath(); ctx.ellipse(0, -1, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f9f0cf';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(0, -66); ctx.stroke();
  ctx.fillStyle = '#c76649';
  ctx.strokeStyle = '#744831';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1, -65);
  ctx.quadraticCurveTo(14, -69, 24, -60);
  ctx.lineTo(19, -47);
  ctx.quadraticCurveTo(10, -54, 1, -49);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawCrater(vp: SceneViewport, physX: number): void {
  const { ctx, env } = vp;
  const cx = vp.toCanvasX(physX);
  const cy = vp.groundYAtPhysX(physX) + 2;
  const r1 = Math.max(8, 0.2 * vp.currentPPM);
  ctx.fillStyle = rgba(env.subBot, 0.8);
  ctx.beginPath(); ctx.ellipse(cx, cy, r1, r1 * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(env.subTop, 0.6);
  ctx.beginPath(); ctx.ellipse(cx, cy - 1, r1 * 0.7, r1 * 0.2, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawGasHole(vp: SceneViewport, physX: number): void {
  const { ctx, worldTime } = vp;
  const cx = vp.toCanvasX(physX);
  const cy = vp.groundYAtPhysX(physX) + 2;
  const r = Math.max(10, 0.28 * vp.currentPPM);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.3, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.8, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(1, vp.currentPPM * 0.015);
  for (let i = 0; i < 3; i++) {
    const sr = r * (0.5 + i * 0.3);
    const sa = worldTime * 1.8 + i * Math.PI * 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, sr, sa, sa + Math.PI * 0.45);
    ctx.stroke();
  }
}

export function drawShockwave(vp: SceneViewport, physX: number, progress: number): void {
  if (progress <= 0 || progress > 1) return;
  const { ctx } = vp;
  const cx = vp.toCanvasX(physX);
  const cy = vp.groundYAtPhysX(physX);
  const r = progress * Math.max(25, 0.6 * vp.currentPPM);
  ctx.strokeStyle = `rgba(200,180,140,${1 - progress})`;
  ctx.lineWidth = Math.max(1.5, vp.currentPPM * 0.025);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
}
