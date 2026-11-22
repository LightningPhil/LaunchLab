/**
 * scene-viewport.ts — Canvas Sizing, Camera Projection & Spherical Coordinate Mapping
 *
 * Owns the 2D canvas context, DPR transform, logarithmic zoom/pan easing,
 * manual inspection camera, cannon/rocket camera framing, and spherical-to-screen
 * coordinate mapping. Calling `init(canvas)` or `reset()` restores a clean baseline.
 */
import { cannonSceneTop, cannonSceneWidth, rocketCameraFraming, type RocketCameraRequest } from './camera.ts';
import { InspectionCamera } from './inspection-camera.ts';
import { surfacePosition, type SurfacePoint } from './spherical-world.ts';
import { blendEnvironment, clamp, createEnvironmentState, getPlanetRadius, type BlendedEnvironment } from './world-palettes.ts';

export const DEFAULT_PPM = 80;
export const MIN_PPM = 1e-8;
export const GROUND_OFFSET = 70;
export const CANNON_BASE_X_M = 1.5;
export const CANNON_BASE_Y_M = 1.0;
export const BALL_RADIUS_M = 0.1;
export const TOWER_BASE_X_M = 1.5;
export const TOWER_HEIGHT_M = 4.0;

export const PARALLAX_STARS = 0.03;
export const PARALLAX_CLOUDS = 0.15;
export const PARALLAX_MOUNTAINS = 0.35;
export const PARALLAX_TREES = 0.5;
export const PARALLAX_GROUND = 1.0;

export class SceneViewport {
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;
  W = 1;
  H = 1;
  groundY = 0;
  baseGroundY = 0;
  pixelRatio = 1;

  currentPPM = DEFAULT_PPM;
  targetPPM = DEFAULT_PPM;
  cameraX = 0;
  targetCameraX = 0;
  cameraY = 0;
  targetCameraY = 0;
  viewTransitionDuration = 1.2;

  rocketCamera: RocketCameraRequest | null = null;
  readonly inspection = new InspectionCamera();
  flightFocus: SurfacePoint = { x: 0, y: 0 };
  cannonBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  cannonStart = { ppm: DEFAULT_PPM, x: 0, y: 0 };

  displayedGravity = 9.81;
  targetGravity = 9.81;
  worldTime = 0;
  barrelLengthM = 1.5;

  curveActive = false;
  curveRadius = 0;
  curveRadiusPx = 0;
  projectionOriginX = 0;
  projectionOriginY = 0;
  curveCentreX = 0;
  curveCentreY = 0;
  planetViewFrac = 0;

  readonly env: BlendedEnvironment = createEnvironmentState();

  init(cvs: HTMLCanvasElement, onInitFeatures?: () => void): void {
    this.canvas = cvs;
    const context = cvs.getContext('2d');
    if (!context) throw new Error('A 2D canvas context is required.');
    this.ctx = context;
    this.reset();
    this.resize();
    onInitFeatures?.();
    this.updateCurvature();
    blendEnvironment(this.displayedGravity, this.env);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => {
        if (this.canvas !== cvs) return;
        const bounds = cvs.getBoundingClientRect();
        if (Math.round(bounds.width) !== this.W || Math.round(bounds.height) !== this.H) this.resize();
      }).observe(cvs);
    }
  }

  /** Restore clean camera, gravity, time, and barrel state without reallocating canvas listeners. */
  reset(): void {
    this.currentPPM = DEFAULT_PPM;
    this.targetPPM = DEFAULT_PPM;
    this.cameraX = 0;
    this.targetCameraX = 0;
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.viewTransitionDuration = 1.2;
    this.rocketCamera = null;
    this.inspection.active = false;
    this.flightFocus = { x: 0, y: 0 };
    this.cannonBounds = null;
    this.cannonStart = { ppm: DEFAULT_PPM, x: 0, y: 0 };
    this.displayedGravity = 9.81;
    this.targetGravity = 9.81;
    this.worldTime = 0;
    this.barrelLengthM = 1.5;
    this.planetViewFrac = 0;
  }

  resize(): void {
    const bounds = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, Math.round(bounds.width));
    this.H = Math.max(1, Math.round(bounds.height));
    this.inspection.resize(this.W, this.H);
    this.pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.pixelRatio);
    this.canvas.height = Math.round(this.H * this.pixelRatio);
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.baseGroundY = this.H - GROUND_OFFSET;
    this.groundY = this.baseGroundY + this.cameraY * this.currentPPM;
  }

  clear(): void {
    if (this.pixelRatio !== Math.max(1, window.devicePixelRatio || 1)) this.resize();
    this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  setBarrelLength(m: number): void {
    this.barrelLengthM = Math.max(0.4, Math.min(10.0, m));
  }

  getCannonTipPhys(angleDeg: number): { x: number; y: number } {
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: CANNON_BASE_X_M + this.barrelLengthM * Math.cos(rad),
      y: CANNON_BASE_Y_M + this.barrelLengthM * Math.sin(rad),
    };
  }

  parallaxOffset(factor: number): number {
    return this.cameraX * this.currentPPM * factor;
  }

  parallaxOffsetY(factor: number): number {
    return this.cameraY * this.currentPPM * factor;
  }

  wrapX(x: number, margin: number): number {
    if (this.W <= 0) return x;
    const m = margin || 50;
    const total = this.W + 2 * m;
    return (((x + m) % total) + total) % total - m;
  }

  setTargetZoom(ppm: number): void {
    if (!Number.isFinite(ppm)) return;
    this.targetPPM = Math.max(MIN_PPM, ppm);
  }

  setFlightFocus(point: SurfacePoint): void {
    this.flightFocus = point;
  }

  setZoomImmediate(ppm: number): void {
    if (!Number.isFinite(ppm)) return;
    const clamped = Math.max(MIN_PPM, ppm);
    this.currentPPM = clamped;
    this.targetPPM = clamped;
    const zoomRatio = Math.min(1, this.currentPPM / DEFAULT_PPM);
    this.baseGroundY = this.H - Math.max(12, GROUND_OFFSET * zoomRatio);
    this.groundY = this.baseGroundY + this.cameraY * this.currentPPM;
  }

  resetZoom(): void {
    this.targetPPM = DEFAULT_PPM;
  }

  setCameraTarget(x: number): void {
    this.targetCameraX = x;
  }

  setCameraImmediate(x: number): void {
    this.cameraX = x;
    this.targetCameraX = x;
  }

  resetCamera(): void {
    this.inspection.active = false;
    this.rocketCamera = null;
    this.cannonBounds = null;
    this.targetCameraX = 0;
    this.cameraX = 0;
    this.targetCameraY = 0;
    this.cameraY = 0;
  }

  setManualZoom(manual: boolean): void {
    if (manual && !this.inspection.active) {
      this.inspection.start({ ppm: this.currentPPM, originX: this.projectionOriginX, originY: this.projectionOriginY }, this.W, this.H);
    } else if (!manual) {
      this.inspection.active = false;
    }
  }

  setCannonCamera(points: readonly SurfacePoint[], radius: number): void {
    const projected = points.map(point => surfacePosition(point.x, point.y, radius));
    this.cannonBounds = null;
    if (!(radius > 0) || !projected.length) return;
    if (!projected.some(point => Math.hypot(point.x, point.y) > radius * 0.015)) return;
    let minX = 0, maxX = 0, minY = 0, maxY = 0, extent = 0;
    for (const point of projected) {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
      extent = Math.max(extent, Math.hypot(point.x, point.y));
    }
    const progress = clamp((extent / radius - 0.5) / 0.75, 0, 1);
    const reveal = progress * progress * (3 - 2 * progress);
    minX = Math.min(minX, -radius * reveal); maxX = Math.max(maxX, radius * reveal);
    minY = Math.min(minY, -2 * radius * reveal);
    minY -= Math.max((maxX - minX) * 0.07, (maxY - minY) * 0.08);
    this.cannonBounds = { minX, maxX, minY, maxY };
    this.cannonStart = { ppm: this.currentPPM, x: -this.cameraX * this.currentPPM, y: this.baseGroundY + this.cameraY * this.currentPPM };
    this.setTargetZoom(this.cannonCameraFrame().ppm);
  }

  private cannonCameraFrame() {
    const bounds = this.cannonBounds!;
    const left = 22;
    const right = cannonSceneWidth(this.W, this.H) - 22;
    const top = Math.max(cannonSceneTop(this.W, this.H), this.H >= 300 ? 132 : 0) + 22;
    const bottom = this.H - 22;
    const ppm = Math.max(
      MIN_PPM,
      Math.min(
        DEFAULT_PPM,
        (right - left) / ((bounds.maxX - bounds.minX) * 1.15),
        (bottom - top) / ((bounds.maxY - bounds.minY) * 1.15)
      )
    );
    return {
      ppm, left, right, top, bottom,
      originX: (left + right) / 2 - ((bounds.minX + bounds.maxX) / 2) * ppm,
      originY: (top + bottom) / 2 + ((bounds.minY + bounds.maxY) / 2) * ppm,
    };
  }

  private applyCannonCamera(): void {
    if (!this.cannonBounds) return;
    const framing = this.cannonCameraFrame();
    const focus = surfacePosition(this.flightFocus.x, this.flightFocus.y, this.curveRadius);
    const zoomSpan = Math.log(this.cannonStart.ppm / framing.ppm);
    const progress = Math.abs(zoomSpan) < 0.001 ? 1 : clamp(Math.log(this.cannonStart.ppm / this.currentPPM) / zoomSpan, 0, 1);
    const blend = progress * progress * (3 - 2 * progress);
    let x = this.cannonStart.x + (framing.originX - this.cannonStart.x) * blend;
    let y = this.cannonStart.y + (framing.originY - this.cannonStart.y) * blend;
    x += clamp(x + focus.x * this.currentPPM, framing.left, framing.right) - (x + focus.x * this.currentPPM);
    y += clamp(y - focus.y * this.currentPPM, framing.top, framing.bottom) - (y - focus.y * this.currentPPM);
    this.cameraX = this.targetCameraX = -x / this.currentPPM;
    this.cameraY = this.targetCameraY = (y - this.baseGroundY) / this.currentPPM;
    this.updateProjectionOrigin();
  }

  setRocketCamera(request: RocketCameraRequest): void {
    this.rocketCamera = request;
    this.setTargetZoom(rocketCameraFraming(request, this.W, this.H, this.currentPPM).targetPPM);
  }

  private applyRocketCamera(): void {
    if (!this.rocketCamera) return;
    let framing = rocketCameraFraming(this.rocketCamera, this.W, this.H, this.currentPPM);
    if (this.currentPPM > framing.maxPPM) {
      this.currentPPM = framing.maxPPM;
      this.baseGroundY = this.H - Math.max(12, GROUND_OFFSET * Math.min(1, this.currentPPM / DEFAULT_PPM));
      this.updateCurvature();
      framing = rocketCameraFraming(this.rocketCamera, this.W, this.H, this.currentPPM);
    }
    const point = surfacePosition(this.rocketCamera.state.x, this.rocketCamera.state.y, this.curveRadius);
    const anchor = framing.anchor;
    this.cameraX = point.x - anchor.x / this.currentPPM;
    this.cameraY = point.y + (anchor.y - this.baseGroundY) / this.currentPPM;
    this.targetCameraX = this.cameraX;
    this.targetCameraY = this.cameraY;
    this.updateProjectionOrigin();
  }

  setViewTransitionDuration(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    this.viewTransitionDuration = Math.max(0.15, seconds);
  }

  setTargetGravity(g: number): void {
    this.targetGravity = g;
  }

  getWholePlanetPPM(): number {
    const r = getPlanetRadius(this.targetGravity);
    if (r <= 0 || this.W <= 0) return 0;
    return Math.min(this.W, this.H) / (2.5 * r);
  }

  updateWorld(dt: number): void {
    this.worldTime += dt;
    const gDiff = this.targetGravity - this.displayedGravity;
    if (Math.abs(gDiff) < 0.01) this.displayedGravity = this.targetGravity;
    else this.displayedGravity += gDiff * Math.min(1, dt * 6);
    if (this.cannonBounds) this.targetPPM = this.cannonCameraFrame().ppm;

    const easingRate = 3 / this.viewTransitionDuration;

    if (!this.inspection.active) {
      const zDiff = this.targetPPM - this.currentPPM;
      if (this.currentPPM > 0 && this.targetPPM > 0) {
        let logCur = Math.log(this.currentPPM);
        const logTgt = Math.log(this.targetPPM);
        const logDiff = logTgt - logCur;
        if (Math.abs(logDiff) < 0.001) this.currentPPM = this.targetPPM;
        else {
          logCur += logDiff * (1 - Math.exp(-Math.max(0, dt) * easingRate));
          this.currentPPM = Math.exp(logCur);
        }
      } else {
        this.currentPPM += zDiff * Math.min(1, dt * easingRate);
      }

      const camDiff = this.targetCameraX - this.cameraX;
      if (Math.abs(camDiff) < 0.01) this.cameraX = this.targetCameraX;
      else this.cameraX += camDiff * Math.min(1, dt * easingRate);

      const camDiffY = this.targetCameraY - this.cameraY;
      if (Math.abs(camDiffY) < 0.01) this.cameraY = this.targetCameraY;
      else this.cameraY += camDiffY * Math.min(1, dt * easingRate);
    } else {
      this.currentPPM = this.inspection.view.ppm;
    }

    const zoomRatio = Math.min(1, this.currentPPM / DEFAULT_PPM);
    this.baseGroundY = this.H - Math.max(12, GROUND_OFFSET * zoomRatio);
    if (this.inspection.active) {
      this.cameraX = -this.inspection.view.originX / this.currentPPM;
      this.cameraY = (this.inspection.view.originY - this.baseGroundY) / this.currentPPM;
    }
    this.groundY = this.baseGroundY + this.cameraY * this.currentPPM;

    const wpPPM = this.getWholePlanetPPM();
    if (wpPPM > 0) {
      const rampStart = wpPPM * 5;
      const rampEnd = wpPPM;
      if (this.currentPPM <= rampStart) {
        const logStart = Math.log(rampStart);
        const logEnd = Math.log(rampEnd);
        const logNow = Math.log(Math.max(this.currentPPM, rampEnd * 0.5));
        this.planetViewFrac = clamp((logStart - logNow) / (logStart - logEnd), 0, 1);
      } else {
        this.planetViewFrac = 0;
      }
    } else {
      this.planetViewFrac = 0;
    }

    this.updateCurvature();
    if (!this.inspection.active) {
      this.applyRocketCamera();
      this.applyCannonCamera();
    }
    blendEnvironment(this.displayedGravity, this.env);
  }

  updateCurvature(): void {
    this.curveRadius = getPlanetRadius(this.targetGravity);
    if (this.curveRadius <= 0 || this.currentPPM <= 0 || this.W <= 0) {
      this.curveActive = false;
      return;
    }

    this.curveRadiusPx = this.curveRadius * this.currentPPM;
    const originX = -this.cameraX * this.currentPPM;
    const halfAngle = Math.min(Math.PI, Math.max(Math.abs(originX), Math.abs(this.W - originX)) / this.curveRadiusPx);
    const sagitta = this.curveRadiusPx * (1 - Math.cos(halfAngle));

    this.curveActive =
      sagitta >= 0.05 ||
      this.planetViewFrac > 0 ||
      this.baseGroundY + this.cameraY * this.currentPPM + this.curveRadiusPx < this.H;

    this.updateProjectionOrigin();
  }

  updateProjectionOrigin(): void {
    this.projectionOriginX = -this.cameraX * this.currentPPM;
    this.projectionOriginY = this.baseGroundY + this.cameraY * this.currentPPM;
    this.groundY = this.projectionOriginY;
    this.curveCentreX = this.projectionOriginX;
    this.curveCentreY = this.projectionOriginY + this.curveRadiusPx;
  }

  worldToScreen(physX: number, physY: number): { sx: number; sy: number } {
    const point = surfacePosition(physX, physY, this.curveRadius);
    return {
      sx: this.projectionOriginX + point.x * this.currentPPM,
      sy: this.projectionOriginY - point.y * this.currentPPM,
    };
  }

  surfaceNormalAngle(physX: number): number {
    return this.curveRadius > 0 ? physX / this.curveRadius : 0;
  }

  groundYAtPhysX(physX: number): number {
    return this.worldToScreen(physX, 0).sy;
  }

  toCanvasX(px: number): number {
    return this.worldToScreen(px, 0).sx;
  }

  toCanvas(px: number, py: number): { x: number; y: number } {
    const point = this.worldToScreen(px, py);
    return { x: point.sx, y: point.sy };
  }

  screenToSurface(screenX: number, screenY: number): { x: number; y: number } {
    const x = (screenX - this.projectionOriginX) / this.currentPPM;
    const y = (this.projectionOriginY - screenY) / this.currentPPM;
    if (!(this.curveRadius > 0)) return { x, y };
    let angle = Math.atan2(x, y + this.curveRadius);
    const focusAngle = (this.rocketCamera?.state.x ?? this.flightFocus.x) / this.curveRadius;
    angle += Math.round((focusAngle - angle) / (Math.PI * 2)) * Math.PI * 2;
    return {
      x: angle * this.curveRadius,
      y: (x * x + y * (2 * this.curveRadius + y)) / (Math.hypot(x, y + this.curveRadius) + this.curveRadius),
    };
  }
}
