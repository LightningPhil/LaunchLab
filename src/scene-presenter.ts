/**
 * scene-presenter.ts — Scene Camera Framing & Composite Frame Drawing
 *
 * Owns per-mode zoom memory, setup/flight camera framing (`frameCannonSetup`,
 * `fitRun`), and the composite `drawScene()` pass that sends recorded state,
 * surface FX, crew, vehicles, nozzle inset, and vectors to `Renderer`.
 */
import { compatibleRuns, sampleFlight, type FlightRecord, type FlightSample } from './flight.ts';
import { resolveEnvironment } from './environment.ts';
import { cannonSceneTop, cannonSceneWidth, cannonSetupZoom } from './camera.ts';
import type { ProjectileState } from './physics.ts';
import { RocketPropellants } from './rocket_propellants.ts';
import { RocketPhysics, type RocketState } from './rocket_physics.ts';
import { Renderer } from './renderer.ts';
import { UI } from './ui.ts';
import { drawSetupNozzle, isSetupNozzleVisible } from './responsive-layout.ts';
import type { FlightDeck } from './flight-deck.ts';
import type { CannonStage } from './cannon-stage.ts';
import type { SceneFx } from './scene-fx.ts';
import type { CharacterStage } from './character-stage.ts';
import type { RocketDisplay } from './rocket-presentation.ts';

export const DEFAULT_VIEW_TRANSITION_SECONDS = 1.2;
export const DEFAULT_CANNON_VIEW_SECONDS = 2.0;
const DEFAULT_ROCKET_ZOOM_MARGIN = 0.15;
const DEFAULT_CANNON_ZOOM_MARGIN = 0.2;

export type ActiveRocketView = RocketState & {
  phase: 'flight' | 'fizzle' | 'fizzle_done';
  maxThrust: number;
  fizzleProgress: number;
};

export interface SceneDrawContext {
  mode: 'cannon' | 'rocket';
  gravity: number;
  viewActive: boolean;
  reducedMotion: boolean;
  deck: FlightDeck;
  cannonStage: CannonStage;
  sceneFx: SceneFx;
  characterStage: CharacterStage;
  trajectoryDots: readonly { x: number; y: number }[];
  activeBall: ProjectileState | null;
  activeRocket: ActiveRocketView | null;
  displayedFlightState: FlightSample | null;
  rocketDisplay: RocketDisplay;
}

export class ScenePresenter {
  private maxRangeMetres = 0;
  private maxHeightMetres = 2;
  private cannonZoomState = { maxRange: 0, maxHeight: 2, ppm: 80 };
  private rocketZoomState = { maxRange: 0, maxHeight: 2, ppm: 80 };
  private setupWidth = 0;
  private setupHeight = 0;

  resetZoomMemory(mode: 'cannon' | 'rocket'): void {
    this.maxRangeMetres = 0;
    this.maxHeightMetres = 2;
    Renderer.setViewTransitionDuration(mode === 'cannon' ? DEFAULT_CANNON_VIEW_SECONDS : DEFAULT_VIEW_TRANSITION_SECONDS);
    Renderer.resetZoom();
    Renderer.resetCamera();
    if (mode === 'cannon') {
      this.cannonZoomState = { maxRange: 0, maxHeight: 2, ppm: Renderer.DEFAULT_PPM };
    } else {
      this.rocketZoomState = { maxRange: 0, maxHeight: 2, ppm: Renderer.DEFAULT_PPM };
    }
  }

  switchModeCamera(previousMode: 'cannon' | 'rocket', nextMode: 'cannon' | 'rocket'): void {
    const savePPM = Renderer.getCurrentPPM();
    if (previousMode === 'cannon') {
      this.cannonZoomState = { maxRange: this.maxRangeMetres, maxHeight: this.maxHeightMetres, ppm: savePPM };
    } else {
      this.rocketZoomState = { maxRange: this.maxRangeMetres, maxHeight: this.maxHeightMetres, ppm: savePPM };
    }

    if (nextMode === 'cannon') {
      this.maxRangeMetres = this.cannonZoomState.maxRange;
      this.maxHeightMetres = this.cannonZoomState.maxHeight;
      Renderer.setViewTransitionDuration(DEFAULT_CANNON_VIEW_SECONDS);
      Renderer.setTargetZoom(this.cannonZoomState.ppm);
      Renderer.resetCamera();
    } else {
      this.maxRangeMetres = this.rocketZoomState.maxRange;
      this.maxHeightMetres = this.rocketZoomState.maxHeight;
      Renderer.setViewTransitionDuration(DEFAULT_VIEW_TRANSITION_SECONDS);
      Renderer.setZoomImmediate(this.rocketZoomState.ppm);
      Renderer.resetCamera();
      const tw = Renderer.TOWER_BASE_X_M || 1.5;
      const vw = Renderer.getWidth() / this.rocketZoomState.ppm;
      Renderer.setCameraImmediate(tw - vw / 2);
    }
  }

  frameCannonSetup(mode: 'cannon' | 'rocket', viewActive: boolean, busy: boolean, cannonStage: CannonStage): void {
    if (mode !== 'cannon' || viewActive || busy || Renderer.isManualZoom()) return;
    const values = UI.getValues();
    const envelope = cannonStage.setupEnvelope(values);
    const width = Renderer.getWidth();
    const height = Renderer.getHeight();
    const zoom = cannonSetupZoom({
      width: cannonSceneWidth(width, height),
      height,
      topInset: cannonSceneTop(width, height),
      lengths: envelope.lengths,
      angles: envelope.angles,
      rebuilding: envelope.rebuilding,
      defaultPPM: Renderer.DEFAULT_PPM,
      baseX: Renderer.CANNON_BASE_X_M,
      baseY: Renderer.CANNON_BASE_Y_M,
    });
    if ((width !== this.setupWidth || height !== this.setupHeight) && Renderer.getCurrentPPM() > zoom) {
      Renderer.setZoomImmediate(zoom);
    }
    this.setupWidth = width;
    this.setupHeight = height;
    Renderer.setTargetZoom(zoom);
  }

  private computeNeededZoom(rangeMetres: number, maxHeight: number, marginFraction = DEFAULT_ROCKET_ZOOM_MARGIN): number {
    const cW = cannonSceneWidth(Renderer.getWidth(), Renderer.getHeight());
    const gY = Math.max(1, Renderer.getGroundY() - cannonSceneTop(Renderer.getWidth(), Renderer.getHeight()));
    const fitFraction = 1 / (1 + Math.max(0, marginFraction));
    const horizPPM = (cW * fitFraction) / Math.max(1, rangeMetres);
    const vertPPM = (gY * fitFraction) / Math.max(0.5, maxHeight);
    return Math.min(Renderer.DEFAULT_PPM, Math.max(1e-9, Math.min(horizPPM, vertPPM)));
  }

  fitRun(run: FlightRecord, deck: FlightDeck, reducedMotion: boolean, reset = true): void {
    const baseline = compatibleRuns(run, deck.baseline) ? deck.baseline : null;
    this.maxRangeMetres = Math.max(1, run.maxX, baseline?.maxX || 0) - Math.min(0, run.minX, baseline?.minX || 0);
    this.maxHeightMetres = Math.max(2, run.maxHeight, baseline?.maxHeight || 0);
    if (reset) Renderer.resetCamera();
    const margin = run.mode === 'rocket' ? UI.getRocketZoomSettings().marginPercent / 100 : DEFAULT_CANNON_ZOOM_MARGIN;
    const duration = run.mode === 'rocket' ? UI.getRocketZoomSettings().durationSeconds : DEFAULT_CANNON_VIEW_SECONDS;
    Renderer.setViewTransitionDuration(reducedMotion ? 0.01 : duration);
    Renderer.setTargetZoom(
      run.mode === 'cannon' ? this.computeNeededZoom(this.maxRangeMetres, this.maxHeightMetres, margin) : Renderer.DEFAULT_PPM
    );
    if (run.mode === 'cannon' && run.minX < 0) Renderer.setCameraTarget(run.minX - 1);
    if (run.mode === 'cannon') {
      Renderer.setCannonCamera([...run.samples, ...(baseline?.samples || [])], run.config.planetRadius ?? 0);
    }
  }

  drawScene(c: SceneDrawContext): void {
    const { deck, cannonStage, sceneFx, characterStage } = c;
    Renderer.clear();
    Renderer.drawWorld();

    if (deck.run && c.viewActive) {
      if (deck.ghost && compatibleRuns(deck.run, deck.baseline) && deck.baseline!.id !== deck.run.id) {
        Renderer.drawGhost(deck.baseline!.samples);
        const ghost = sampleFlight(deck.baseline!, Math.min(deck.clock.time, deck.baseline!.duration));
        Renderer.drawGhostMarker(ghost.x, ghost.y);
      }
      if (deck.prediction) Renderer.drawGhost(deck.run.samples, { color: '#e5cf83' });
    }
    if (resolveEnvironment(c.gravity).name === 'earth') Renderer.drawGolfFlag();
    for (const dot of c.trajectoryDots) Renderer.drawTrajectoryDot(dot.x, dot.y);

    const drawSurfaceDetail = Renderer.getPlanetViewFrac() < 0.5;
    if (drawSurfaceDetail) {
      for (const shot of sceneFx.shots) {
        if (shot.isGas) Renderer.drawGasHole(shot.x);
        else {
          Renderer.drawCrater(shot.x);
          Renderer.drawLandedBall(shot.x);
        }
        Renderer.drawFlag(shot.x, shot.number, shot.flagSpring);
      }
    }

    if (characterStage.character) Renderer.drawCharacter(characterStage.character);
    if (drawSurfaceDetail && sceneFx.impactShockwaveProgress >= 0 && sceneFx.impactShockwaveProgress <= 1) {
      Renderer.drawShockwave(sceneFx.impactShockwaveX, sceneFx.impactShockwaveProgress);
    }

    if (c.mode === 'cannon') {
      if (drawSurfaceDetail) {
        const crew = cannonStage.getCrew(Renderer.CANNON_BASE_X_M);
        if (crew) for (const worker of crew) Renderer.drawStickman(worker.x, worker.y, worker);
        const cannonAngle = cannonStage.effectiveAngle(UI.getValues().angle);
        Renderer.drawCannon(cannonAngle, cannonStage.recoilOffset);
        if (cannonStage.flashProgress >= 0 && cannonStage.flashProgress <= 1) {
          Renderer.drawMuzzleFlash(cannonAngle, cannonStage.flashProgress);
        }
      }
      if (c.activeBall) Renderer.drawBall(c.activeBall.x, c.activeBall.y, 1, 1);
    } else {
      const rVals = UI.getRocketValues();
      const rAngle = rVals.launchAngle;
      const rEps = rVals.epsilon;
      if (drawSurfaceDetail) Renderer.drawLaunchTower(rAngle);

      const rocket = c.activeRocket;
      if (rocket && rocket.phase === 'flight') {
        if (rocket.engineOn && rocket.thrustMagnitude > 0) {
          const thrustFrac = rocket.thrustMagnitude / (rocket.maxThrust || rocket.thrustMagnitude);
          Renderer.drawExhaust(rocket.x, rocket.y, (rocket.theta * Math.PI) / 180, thrustFrac, rEps);
        }
        Renderer.drawRocket(rocket, rAngle, rEps);
      } else if (rocket && (rocket.phase === 'fizzle' || rocket.phase === 'fizzle_done')) {
        const pad = Renderer.getRocketPadPosition(rAngle, rEps);
        Renderer.drawRocket({ phase: rocket.phase }, rAngle, rEps);
        if (rocket.phase === 'fizzle') {
          Renderer.drawExhaust(pad.x, pad.y, (rAngle * Math.PI) / 180, 0.5, rEps);
          Renderer.drawFizzle(pad.x, pad.y, rocket.fizzleProgress || 0);
        }
      } else if (sceneFx.landedRocket) {
        if (drawSurfaceDetail) Renderer.drawCrater(sceneFx.landedRocket.x);
        Renderer.drawRocket({ phase: 'flight', x: sceneFx.landedRocket.x, y: 0.6, theta: 8 }, 8, sceneFx.landedRocket.epsilon);
      } else if (!sceneFx.rocketLanded) {
        Renderer.drawRocket({ phase: 'pad' }, rAngle, rEps);
      }
    }

    if (c.mode === 'rocket' && (Renderer.getWidth() > 680 || isSetupNozzleVisible())) {
      const nzVals = UI.getRocketValues();
      const nzPre = RocketPhysics.computePreLaunch(nzVals, c.gravity);
      const nzProp = RocketPropellants.getById(nzVals.propellantId);
      const nzPh = nzProp ? nzProp.placeholder : { gamma: 1.2, Tc_K: 3000 };
      const engineDisplay = c.rocketDisplay;
      const liveNozzle =
        c.viewActive && deck.run?.mode === 'rocket' && c.displayedFlightState && 'mProp' in c.displayedFlightState
          ? c.displayedFlightState
          : null;
      const nozzleData = {
        throatDia_mm: nzVals.throatDia_mm,
        epsilon: nzVals.epsilon,
        Pc_bar: nzVals.Pc_bar,
        MR: nzVals.MR,
        At: nzPre.At,
        mdot: (liveNozzle?.mdot || 0) * engineDisplay.output,
        thrust: (liveNozzle?.thrustMagnitude || 0) * engineDisplay.output,
        Isp: nzPre.Isp,
        cStar: nzPre.cStar,
        Cf: nzPre.Cf,
        flowRegime: liveNozzle?.flowRegime || 'off',
        effectiveEpsilon: liveNozzle?.effectiveEpsilon || nzPre.effectiveEpsilon,
        gamma: nzPh.gamma,
        Tc_K: nzPh.Tc_K,
        Pa_Pa: liveNozzle?.Pa_Pa ?? nzVals.Pa_Pa,
        Pc_Pa: nzPre.Pc_Pa,
        output: engineDisplay.output,
        engineLabel: engineDisplay.label,
        worldTime: c.reducedMotion ? 0 : engineDisplay.time,
      };
      Renderer.drawNozzleInset(nozzleData);
      drawSetupNozzle(nozzleData);
    }

    const vectorTarget = c.activeBall ?? c.activeRocket;
    if (deck.vectors && vectorTarget) Renderer.drawVectors(vectorTarget);
    Renderer.drawParticles(sceneFx.particles);
    Renderer.drawSceneNotes(c.mode, characterStage.character);
  }
}
