/**
 * renderer.ts — HTML5 Canvas 2D Facade
 *
 * Coordinates `SceneViewport`, `sky-scenery`, `ground-scenery`, `vehicle-sprites`,
 * and `character-overlay` behind the `Renderer` API used by the simulation loop,
 * `ScenePresenter`, and test suites.
 */
import type { RocketCameraRequest } from './camera.ts';
import type { NozzleData } from './nozzle_render.ts';
import type {
  Particle,
  RocketSprite,
  SceneCharacter,
  SceneCharacterPose,
  VectorState,
  WorkerPose,
} from './scene-types.ts';
import type { SurfacePoint } from './spherical-world.ts';
import { drawCharacter, drawSceneNotes, drawStickman } from './character-overlay.ts';
import { drawCrater, drawGasHole, drawGolfFlag, drawShockwave, drawWorld } from './ground-scenery.ts';
import {
  CANNON_BASE_X_M,
  CANNON_BASE_Y_M,
  DEFAULT_PPM,
  SceneViewport,
  TOWER_BASE_X_M,
  TOWER_HEIGHT_M,
} from './scene-viewport.ts';
import { createSceneryFeatures, generateFeatures } from './sky-scenery.ts';
import {
  drawBall,
  drawCannon,
  drawExhaust,
  drawFizzle,
  drawFlag,
  drawGhost,
  drawGhostMarker,
  drawLandedBall,
  drawLaunchTower,
  drawMuzzleFlash,
  drawNozzleInset,
  drawParticles,
  drawRocket,
  drawTrajectoryDot,
  drawVectors,
  getRocketPadPosition,
} from './vehicle-sprites.ts';

const vp = new SceneViewport();
const features = createSceneryFeatures();

export const Renderer = {
  DEFAULT_PPM,
  CANNON_BASE_X_M,
  CANNON_BASE_Y_M,
  TOWER_BASE_X_M,
  TOWER_HEIGHT_M,

  init: (cvs: HTMLCanvasElement) => vp.init(cvs, () => generateFeatures(features)),
  reset: () => vp.reset(),
  resize: () => vp.resize(),
  updateWorld: (dt: number) => vp.updateWorld(dt),
  setTargetGravity: (g: number) => vp.setTargetGravity(g),
  setTargetZoom: (ppm: number) => vp.setTargetZoom(ppm),
  setZoomImmediate: (ppm: number) => vp.setZoomImmediate(ppm),
  resetZoom: () => vp.resetZoom(),
  setViewTransitionDuration: (seconds: number) => vp.setViewTransitionDuration(seconds),
  setCameraTarget: (x: number) => vp.setCameraTarget(x),
  setCameraImmediate: (x: number) => vp.setCameraImmediate(x),
  resetCamera: () => vp.resetCamera(),
  setRocketCamera: (request: RocketCameraRequest) => vp.setRocketCamera(request),
  setCannonCamera: (points: readonly SurfacePoint[], radius: number) => vp.setCannonCamera(points, radius),
  setFlightFocus: (point: SurfacePoint) => vp.setFlightFocus(point),
  setManualZoom: (manual: boolean) => vp.setManualZoom(manual),
  isManualZoom: () => vp.inspection.active,
  zoomAt: (factor: number, from: { x: number; y: number }, to = from) => vp.inspection.zoom(factor, from, to),
  panView: (x: number, y: number) => vp.inspection.pan(x, y),
  centreView: (point: { x: number; y: number }) => vp.inspection.centre(point),
  setBarrelLength: (m: number) => vp.setBarrelLength(m),
  getBarrelLength: () => vp.barrelLengthM,

  clear: () => vp.clear(),
  drawWorld: () => drawWorld(vp, features),
  drawCannon: (angleDeg: number, recoilOffset: number) => drawCannon(vp, angleDeg, recoilOffset),
  drawBall: (physX: number, physY: number, squashX = 1, squashY = 1) => drawBall(vp, physX, physY, squashX, squashY),
  drawLandedBall: (physX: number) => drawLandedBall(vp, physX),
  drawTrajectoryDot: (physX: number, physY: number) => drawTrajectoryDot(vp, physX, physY),
  drawGhost: (points: readonly SurfacePoint[], options?: { color?: string }) => drawGhost(vp, points, options),
  drawGhostMarker: (x: number, y: number) => drawGhostMarker(vp, x, y),
  drawVectors: (state: VectorState) => drawVectors(vp, state),
  drawNozzleInset: (data: NozzleData) => drawNozzleInset(vp, data),
  drawGolfFlag: () => drawGolfFlag(vp),
  drawSceneNotes: (mode: 'cannon' | 'rocket', char: SceneCharacter | SceneCharacterPose | null) =>
    drawSceneNotes(vp, mode, char),
  drawFlag: (physX: number, shotNumber: number, springProgress: number) => drawFlag(vp, physX, shotNumber, springProgress),
  drawCrater: (physX: number) => drawCrater(vp, physX),
  drawGasHole: (physX: number) => drawGasHole(vp, physX),
  drawParticles: (particles: readonly Particle[]) => drawParticles(vp, particles),
  drawMuzzleFlash: (angleDeg: number, progress: number) => drawMuzzleFlash(vp, angleDeg, progress),
  drawShockwave: (physX: number, progress: number) => drawShockwave(vp, physX, progress),
  drawCharacter: (char: SceneCharacter | SceneCharacterPose | null) => drawCharacter(vp, char),
  drawStickman: (physX: number, physY: number, poseData: Pick<WorkerPose, 'pose' | 'timer' | 'direction'>) =>
    drawStickman(vp, physX, physY, poseData),
  drawLaunchTower: (angleDeg: number) => drawLaunchTower(vp, angleDeg),
  drawRocket: (rocketState: RocketSprite | null, angleDeg: number, epsilon: number) =>
    drawRocket(vp, rocketState, angleDeg, epsilon),
  drawExhaust: (physX: number, physY: number, theta: number, thrustFrac: number, epsilon?: number) =>
    drawExhaust(vp, physX, physY, theta, thrustFrac, epsilon),
  drawFizzle: (physX: number, physY: number, progress: number) => drawFizzle(vp, physX, physY, progress),

  toCanvasX: (px: number) => vp.toCanvasX(px),
  toCanvas: (px: number, py: number) => vp.toCanvas(px, py),
  screenToSurface: (screenX: number, screenY: number) => vp.screenToSurface(screenX, screenY),
  getCannonTipPhys: (angleDeg: number) => vp.getCannonTipPhys(angleDeg),
  getRocketPadPosition,
  isCurrentGas: () => vp.env.isGas,
  getGroundY: () => vp.groundY,
  getWidth: () => vp.W,
  getHeight: () => vp.H,
  getCurrentPPM: () => vp.currentPPM,
  getWholePlanetPPM: () => vp.getWholePlanetPPM(),
  getPlanetViewFrac: () => vp.planetViewFrac,
};
