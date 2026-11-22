/**
 * main.ts — Entry Point & Animation Loop Coordinator for Launch Lab
 *
 * Wires the physics solvers, FlightDeck, Renderer, UI, LabAudio, CannonStage,
 * SceneFx, CharacterStage, and ScenePresenter together. Every flight is
 * recorded once by `recordFlight()` and played back through `FlightDeck`'s
 * clock; nothing here integrates physics at render rate.
 */
import './style.css';
import { FlightDeck } from './flight-deck.ts';
import { recordFlight, sampleFlight, type CannonFlightConfig, type FlightRecord, type FlightSample, type RocketFlightConfig } from './flight.ts';
import { resolveEnvironment } from './environment.ts';
import { Physics, type ProjectileState } from './physics.ts';
import { RocketPhysics, type RocketState } from './rocket_physics.ts';
import { Renderer } from './renderer.ts';
import { ZoomControls } from './zoom-controls.ts';
import { UI } from './ui.ts';
import { rocketDisplay } from './rocket-presentation.ts';
import { installWiki, isWikiOpen } from './wiki/wiki.ts';
import { installManual, isManualOpen } from './manual.ts';
import { installResponsiveLayout } from './responsive-layout.ts';
import { installWelcome, isWelcomeOpen } from './welcome.ts';
import { requiredElement } from './dom.ts';
import { LabAudio } from './lab-audio.ts';
import { CannonStage } from './cannon-stage.ts';
import { SceneFx } from './scene-fx.ts';
import { CharacterStage } from './character-stage.ts';
import { ScenePresenter, type ActiveRocketView } from './scene-presenter.ts';

let checkOrreryOpen = () => false;
const isReadingOpen = () => isWelcomeOpen() || isWikiOpen() || isManualOpen() || checkOrreryOpen();
const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => reducedMotionQuery.matches;

let canvas: HTMLCanvasElement;
let deck: FlightDeck;
let zoomControls: ZoomControls;
let audio: LabAudio;
const cannonStage = new CannonStage();
const sceneFx = new SceneFx();
const characterStage = new CharacterStage();
const presenter = new ScenePresenter();

let currentMode: 'cannon' | 'rocket' = 'cannon';
let currentGravity = 9.81;
let currentPlanetRadius = 0;
let launchTME = 0;
let lastTime = 0;
let flightBuild: AbortController | null = null;
let displayedFlightState: FlightSample | null = null;
let viewActive = false;
let endDelivered = false;
let lastFlightTime = 0;
let activeBall: ProjectileState | null = null;
let activeRocket: ActiveRocketView | null = null;
let rocketMaxThrust = 0;
let rocketFizzleTimer = 0;
let rocketFizzleDuration = 0;
let trajectoryDots: { x: number; y: number }[] = [];

const setupLocked = () => !!deck && (deck.busy || (viewActive && !!deck.run && deck.clock.time < deck.run.duration));
function currentRocketDisplay() {
  const run = viewActive && deck?.run?.mode === 'rocket' ? deck.run : null;
  const config = run?.config || UI.getRocketValues();
  const liveRocket = run && displayedFlightState && 'mProp' in displayedFlightState ? displayedFlightState : null;
  return rocketDisplay(liveRocket, { propMass: config.propMass, MR: config.MR },
    run?.outcome, run?.events.find(event => event.kind === 'burnout')?.time);
}
const syncEngineAudio = () => audio.syncEngine(viewActive && !deck.clock.paused && !!activeRocket?.engineOn, currentRocketDisplay().output);
const clearLandingPresentation = () => { sceneFx.clearLanding(); UI.hidePostFlightSummary(); };
const startFizzlePresentation = () => { rocketFizzleTimer = 0; rocketFizzleDuration = reducedMotion() ? 0.01 : 1.6; };

function setSceneAriaLabel(mode: 'cannon' | 'rocket'): void {
  canvas.setAttribute('aria-label', mode === 'rocket'
    ? 'Rocket flight scene. Live measurements are available in the setup panel.'
    : 'Cannon flight scene. Live measurements are available in the setup panel.');
}

function showLaunchFailure(run: FlightRecord, verticalTw: number): void {
  const world = (run.config.environment ?? resolveEnvironment(run.config.gravity)).name;
  const name = world[0].toUpperCase() + world.slice(1);
  deck.message(`No lift-off on ${name}: upward thrust is ${verticalTw.toFixed(2)}× weight. Open Setup to adjust or reset rocket settings.`, true);
}

async function fire(): Promise<void> {
  if (currentMode !== 'cannon' || setupLocked()) return;
  const vals = UI.getValues();
  const environment = resolveEnvironment(vals.gravity);
  const config = { ...vals, environment, planetRadius: environment.radius };
  cannonStage.snapTo(vals.barrelLength, vals.angle);
  Renderer.setBarrelLength(vals.barrelLength);
  const tip = Renderer.getCannonTipPhys(vals.angle);
  const speed = Physics.computeLaunchVelocity(vals.force, vals.mass, vals.barrelLength);
  const initial = Physics.createProjectile(tip.x, tip.y, speed, vals.angle, vals.mass, config.planetRadius);
  await beginFlight('cannon', config, initial);
}

async function rocketLaunch(): Promise<void> {
  if (currentMode !== 'rocket' || setupLocked()) return;
  const gravity = UI.getValues().gravity;
  const environment = resolveEnvironment(gravity);
  const vals = { ...UI.getRocketValues(), gravity, environment, planetRadius: environment.radius };
  const initial = RocketPhysics.createRocketState(vals);
  const pad = Renderer.getRocketPadPosition(vals.launchAngle, vals.epsilon);
  initial.x = pad.x; initial.y = pad.y;
  const theta = initial.x / vals.planetRadius;
  initial.wx = (vals.planetRadius + initial.y) * Math.sin(theta);
  initial.wy = (vals.planetRadius + initial.y) * Math.cos(theta);
  UI.hideFizzleMessage(); UI.hidePostFlightSummary();
  await beginFlight('rocket', vals, initial);
}

function handleCannonLanding(ball: ProjectileState): void {
  sceneFx.recordCannonLanding(ball.x, Renderer.isCurrentGas());
  const finalState = { ...ball, y: 0, vx: 0, vy: 0 };
  UI.updateReadouts(finalState, Physics.computeEnergy(finalState, currentGravity), launchTME);
  activeBall = null;
  UI.setFlightActive(false);
  characterStage.checkCannonSquash(ball.x);
}

function handleRocketLanding(state: RocketState): void {
  const run = deck.run!;
  if (run.mode !== 'rocket') return;
  sceneFx.recordRocketLanding(state.x, run.config.epsilon, state.impactSpeed, Renderer.isCurrentGas());
  UI.updateRocketReadouts(state, run.launchX);
  UI.showPostFlightSummary({
    range: state.x - run.launchX, maxHeight: run.maxHeight, flightTime: run.duration,
    burnTime: state.burnoutTime ?? state.time, dvTsiolkovsky: state.idealDeltaV,
    dvActual: state.burnoutSpeed, burnoutSpeed: state.burnoutSpeed,
  });
  activeRocket = null;
  audio.stopEngineLoop();
  UI.setFlightActive(false);
}

function clearRange(): void {
  flightBuild?.abort(); flightBuild = null;
  characterStage.resetReaction();
  viewActive = false; endDelivered = false;
  deck?.reset();

  const vals = UI.getValues();
  cannonStage.snapTo(vals.barrelLength, vals.angle, true);
  Renderer.setBarrelLength(vals.barrelLength);
  sceneFx.resetAll();
  trajectoryDots = [];
  activeBall = null; activeRocket = null;
  rocketFizzleTimer = 0; rocketFizzleDuration = 0;

  audio.stopEngineLoop();
  presenter.resetZoomMemory(currentMode);

  UI.setFlightActive(false);
  UI.resetReadouts();
  if (currentMode === 'rocket') UI.resetRocketReadouts();
}

function applyWorldGravity(g: number): void {
  currentGravity = g;
  currentPlanetRadius = resolveEnvironment(g).radius;
  Renderer.setTargetGravity(g);
  UI.highlightNearestPlanet(g);
  characterStage.syncToWorld(g, reducedMotion(), sceneFx.shots, sceneFx.landedRocket);
  if (currentMode === 'rocket') UI.refreshPreLaunch();
}

function onGravityChange(g: number): void {
  if (deck && (viewActive || sceneFx.shots.length || Renderer.isManualZoom())) clearRange();
  applyWorldGravity(g);
}

function onBarrelChange(newLen: number): void {
  cannonStage.onBarrelChange(newLen, UI.getValues().angle, !!activeBall, len => Renderer.setBarrelLength(len));
}

function beginFlight(mode: 'cannon', config: CannonFlightConfig, initial: ProjectileState): Promise<void>;
function beginFlight(mode: 'rocket', config: RocketFlightConfig, initial: RocketState): Promise<void>;
async function beginFlight(mode: 'cannon' | 'rocket', config: CannonFlightConfig | RocketFlightConfig, initial: ProjectileState | RocketState): Promise<void> {
  characterStage.cancelBusiness();
  flightBuild?.abort();
  characterStage.resetReaction();
  const controller = new AbortController(); flightBuild = controller;
  viewActive = false; activeBall = null; activeRocket = null;
  audio.stopEngineLoop();
  deck.prepare(); UI.setFlightActive(true);
  try {
    const run = mode === 'cannon'
      ? await recordFlight('cannon', config as CannonFlightConfig, initial as ProjectileState, controller.signal)
      : await recordFlight('rocket', config as RocketFlightConfig, initial as RocketState, controller.signal);
    if (controller.signal.aborted) return;
    flightBuild = null; deck.load(run);
    if (isReadingOpen()) deck.clock.paused = true;
    currentGravity = config.gravity; currentPlanetRadius = config.planetRadius ?? 0;
    launchTME = Physics.computeEnergy(initial, config.gravity).tme;
    rocketMaxThrust = 'thrustMagnitude' in initial ? initial.thrustMagnitude || 0 : 0;
    viewActive = true; endDelivered = false; lastFlightTime = -1;
    clearLandingPresentation(); trajectoryDots = [];
    presenter.fitRun(run, deck, reducedMotion());
    if (run.mode === 'rocket' && run.outcome === 'no-liftoff') {
      deck.clock.time = run.duration; deck.clock.paused = true;
      sceneFx.emitFizzleSmoke(initial.x, 0.2);
      const pre = RocketPhysics.computePreLaunch(run.config, run.config.gravity);
      UI.showFizzleMessage(pre.verticalTw ?? pre.tw);
      showLaunchFailure(run, pre.verticalTw ?? pre.tw);
      audio.playSadTrombone();
      startFizzlePresentation();
    } else if (run.mode === 'cannon') {
      cannonStage.triggerFireEffect();
      audio.playCannonBoom();
      sceneFx.emitCannonSmoke(initial.x, initial.y, run.config.angle ?? 45);
      characterStage.startle(false, run.duration);
    } else {
      characterStage.startle(true, run.duration);
    }
    updateRecordedFlight(0); syncEngineAudio();
  } catch (error) {
    if (controller.signal.aborted) return;
    flightBuild = null; deck.busy = false;
    deck.message('This configuration could not be simulated. Reset or adjust the launch settings.', true);
    deck.update(); UI.setFlightActive(false); console.error(error);
  }
}

function restoreRun(): void {
  const run = deck.run; if (!run) return;
  characterStage.resetReaction();
  flightBuild?.abort(); flightBuild = null;
  audio.stopEngineLoop();
  UI.setFlightActive(false);
  UI.restoreFlightConfig(run.mode, run.config, { silent: true });
  currentMode = run.mode;
  setSceneAriaLabel(currentMode);
  applyWorldGravity(run.config.gravity);
  currentPlanetRadius = run.config.planetRadius ?? currentPlanetRadius;
  const barrelLen = run.mode === 'cannon' ? run.config.barrelLength || 2 : 2;
  const angle = run.mode === 'cannon' ? run.config.angle ?? 45 : 45;
  cannonStage.snapTo(barrelLen, angle);
  Renderer.setBarrelLength(barrelLen);
  launchTME = Physics.computeEnergy(run.samples[0], currentGravity).tme;
  rocketMaxThrust = run.mode === 'rocket' ? run.samples[0].thrustMagnitude || 0 : 0;
  viewActive = true; endDelivered = false;
  lastFlightTime = deck.clock.time > 0 ? deck.clock.time : -1;
  clearLandingPresentation();
  if (run.mode === 'rocket' && run.outcome === 'no-liftoff') {
    const pre = RocketPhysics.computePreLaunch(run.config, run.config.gravity);
    UI.showFizzleMessage(pre.verticalTw ?? pre.tw);
    startFizzlePresentation();
  } else {
    UI.hideFizzleMessage();
    rocketFizzleTimer = 0; rocketFizzleDuration = 0;
  }
  presenter.fitRun(run, deck, reducedMotion());
  updateRecordedFlight(0);
  characterStage.ensureFlight(deck.run, viewActive, deck.clock.time);
}

function updateRecordedFlight(dt: number): void {
  const run = deck?.run;
  if (!run || !viewActive) { deck?.update(); return; }
  deck.clock.advance(dt, run);
  const time = deck.clock.time;
  const stride = Math.max(1, Math.ceil(run.samples.length / 2500));
  trajectoryDots = run.samples.filter((s, i) => s.time <= time && i % stride === 0);
  let state: FlightSample;
  if (run.mode === 'cannon') {
    const cannonState = sampleFlight(run, time);
    state = cannonState; displayedFlightState = cannonState;
    activeBall = cannonState; activeRocket = null;
    UI.updateReadouts(cannonState, Physics.computeEnergy(cannonState, currentGravity), launchTME);
  } else {
    const rocketState = sampleFlight(run, time);
    state = rocketState; displayedFlightState = rocketState;
    activeBall = null;
    const fizzling = run.outcome === 'no-liftoff' && rocketFizzleTimer < rocketFizzleDuration;
    activeRocket = {
      ...rocketState,
      phase: run.outcome === 'no-liftoff' ? (fizzling ? 'fizzle' : 'fizzle_done') : 'flight',
      maxThrust: rocketMaxThrust,
      fizzleProgress: rocketFizzleDuration > 0 ? Math.min(1, rocketFizzleTimer / rocketFizzleDuration) : 1,
    };
    UI.updateRocketReadouts(rocketState, run.launchX);
    const settings = UI.getRocketZoomSettings();
    Renderer.setViewTransitionDuration(reducedMotion() ? 0.01 : settings.durationSeconds);
    const horizon = Math.max(0.4, settings.durationSeconds * 0.6) * deck.clock.rate;
    const ahead = Array.from({ length: 5 }, (_, index) => sampleFlight(run, time + (horizon * (index + 1)) / 5));
    if (run.orbit && time >= run.orbit.initial.time) {
      ahead.push(...run.samples.filter((point, index) => point.time >= run.orbit!.initial.time && index % 16 === 0));
    }
    const contact = time >= run.duration && run.outcome === 'impact';
    Renderer.setRocketCamera({
      state: contact ? { ...rocketState, y: 0.6, theta: 8 } : rocketState, ahead,
      launchX: run.launchX, radius: run.config.planetRadius ?? 0,
      epsilon: run.config.epsilon, margin: settings.marginPercent / 100,
    });
  }
  if (time > lastFlightTime) {
    for (const event of run.events) {
      if (event.kind === 'end' || (event.kind === 'launch' && run.outcome === 'no-liftoff')) continue;
      if (event.time > lastFlightTime && event.time <= time) {
        if (event.kind !== 'launch') deck.message(event.label);
        characterStage.react(event.kind, currentGravity, deck.banter);
        if (event.kind === 'burnout') { audio.stopEngineLoop(); audio.playBurnoutSound(); }
      }
    }
    characterStage.maybeReactToFastCoast(deck.clock.rate, currentGravity, deck.banter);
  }
  lastFlightTime = time;
  if (time >= run.duration) {
    if (!endDelivered) {
      endDelivered = true;
      if (run.outcome === 'impact') {
        if (run.mode === 'cannon') handleCannonLanding(state as ProjectileState);
        else handleRocketLanding(state as RocketState);
        characterStage.react('impact', currentGravity, deck.banter);
        characterStage.inspectLanding(state.x, run.mode, currentPlanetRadius);
      }
      audio.stopEngineLoop();
      UI.setFlightActive(false);
      if (run.mode === 'rocket' && run.outcome === 'no-liftoff') {
        const pre = RocketPhysics.computePreLaunch(run.config, run.config.gravity);
        showLaunchFailure(run, pre.verticalTw ?? pre.tw);
      } else deck.showResult();
    }
    if (run.outcome === 'impact') { activeBall = null; activeRocket = null; }
  } else {
    if (endDelivered) { clearLandingPresentation(); characterStage.resetReaction(); }
    endDelivered = false;
    UI.setFlightActive(true);
    characterStage.ensureFlight(deck.run, viewActive, deck.clock.time);
  }
  syncEngineAudio(); deck.update();
}

function loop(timestamp: number): void {
  if (!lastTime) lastTime = timestamp;
  const elapsed = Math.max(0, (timestamp - lastTime) / 1000);
  const dt = Math.min(elapsed, 0.05);
  lastTime = timestamp;
  if (document.hidden || isReadingOpen()) { requestAnimationFrame(loop); return; }
  if (rocketFizzleDuration > 0) rocketFizzleTimer = Math.min(rocketFizzleDuration, rocketFizzleTimer + elapsed);

  presenter.frameCannonSetup(currentMode, viewActive, deck.busy, cannonStage);
  updateRecordedFlight(elapsed);
  Renderer.setFlightFocus(viewActive && displayedFlightState ? displayedFlightState : { x: 1.5, y: 0 });
  const rocketEngine = currentRocketDisplay();
  if (currentMode === 'rocket') UI.updateRocketFuel(rocketEngine);
  if (currentMode === 'rocket' && !viewActive && !deck.busy) {
    const values = UI.getRocketValues();
    const pad = Renderer.getRocketPadPosition(values.launchAngle, values.epsilon);
    Renderer.setRocketCamera({
      state: pad, ahead: [{ x: Renderer.TOWER_BASE_X_M, y: Renderer.TOWER_HEIGHT_M }],
      launchX: pad.x, radius: currentPlanetRadius, epsilon: values.epsilon, margin: 0.15,
    });
  }

  Renderer.updateWorld(elapsed);
  zoomControls.update(viewActive ? deck.run : null,
    { x: currentMode === 'rocket' ? Renderer.TOWER_BASE_X_M : Renderer.CANNON_BASE_X_M, y: 0 });

  if (currentMode === 'cannon') {
    cannonStage.updateRecoilAndFlash(reducedMotion() ? 0 : dt);
    cannonStage.updateBarrel(dt, UI.getValues().angle, {
      onBarrelLength: len => Renderer.setBarrelLength(len),
      onClang: () => audio.playClangSound(),
    });
  }
  sceneFx.update(dt, reducedMotion());

  const crewBusy = !!flightBuild || (viewActive && !!deck.run && deck.clock.time < deck.run.duration) || characterStage.isFlightApproaching;
  characterStage.update(reducedMotion() ? 0 : dt, elapsed, {
    gravity: currentGravity, planetRadius: currentPlanetRadius, banterEnabled: deck.banter,
    reducedMotion: reducedMotion(), crewBusy, viewActive,
    flightPaused: !!deck.run && deck.clock.paused && deck.clock.time < deck.run.duration,
    vehicle: activeRocket?.phase === 'flight' ? activeRocket : activeBall,
    shots: sceneFx.shots, landedRocket: sceneFx.landedRocket,
  });
  characterStage.syncToWorld(currentGravity, reducedMotion(), sceneFx.shots, sceneFx.landedRocket);

  presenter.drawScene({
    mode: currentMode, gravity: currentGravity, viewActive, reducedMotion: reducedMotion(),
    deck, cannonStage, sceneFx, characterStage, trajectoryDots,
    activeBall, activeRocket, displayedFlightState, rocketDisplay: rocketEngine,
  });
  requestAnimationFrame(loop);
}

function boot(): void {
  canvas = requiredElement('sim-canvas', 'canvas');
  Renderer.init(canvas);

  audio = new LabAudio(
    () => !!deck?.sound && !isReadingOpen(),
    () => deck.message('Audio could not start. Toggle Sound again and check browser or device mute.', true)
  );

  UI.init({
    onFire: fire,
    onClear: clearRange,
    onGravityChange,
    onBarrelChange,
    onModeChange(mode) {
      if (deck) clearRange();
      const previous = currentMode;
      currentMode = mode;
      setSceneAriaLabel(mode);
      presenter.switchModeCamera(previous, mode);
    },
    onRocketLaunch: rocketLaunch,
    onRocketClear: clearRange,
    onSetupChange: () => { if (viewActive && !setupLocked()) clearRange(); },
  });

  deck = new FlightDeck(document.querySelector('.canvas-area')!, {
    errorContainer: document.querySelector('.launch-actions'),
    onSteeringDebrief: UI.setSteeringDebrief,
  });
  zoomControls = new ZoomControls(canvas);
  zoomControls.onAuto = () => {
    if (viewActive && deck.run) presenter.fitRun(deck.run, deck, reducedMotion(), false);
    else { Renderer.resetCamera(); Renderer.resetZoom(); }
  };
  deck.onSeek = () => {
    if (!deck.run) return;
    if (!viewActive) restoreRun();
    lastFlightTime = deck.clock.time;
    audio.stopEngineLoop(); updateRecordedFlight(0); syncEngineAudio();
    characterStage.ensureFlight(deck.run, viewActive, deck.clock.time);
  };
  deck.onReplay = () => { restoreRun(); syncEngineAudio(); };
  deck.onInspect = () => { Renderer.setManualZoom(true); canvas.focus({ preventScroll: true }); };
  deck.onSound = () => {
    if (deck.sound) void audio.unlock().then(ok => { if (ok) syncEngineAudio(); });
    else syncEngineAudio();
  };
  document.addEventListener('click', () => {
    if (deck.sound && !isReadingOpen() && !audio.isRunning) {
      void audio.unlock().then(ok => { if (ok) syncEngineAudio(); });
    }
  }, { capture: true });

  setSceneAriaLabel('cannon');
  Renderer.resize();
  window.addEventListener('resize', () => {
    Renderer.resize();
    if (viewActive && deck.run && !Renderer.isManualZoom()) presenter.fitRun(deck.run, deck, reducedMotion());
  });
  window.addEventListener('displaychange', () => Renderer.resize());
  new ResizeObserver(() => {
    if (viewActive && deck.run?.mode === 'cannon' && !Renderer.isManualZoom()) presenter.fitRun(deck.run, deck, reducedMotion());
  }).observe(canvas);

  const initValues = UI.getValues();
  cannonStage.init(initValues.barrelLength, initValues.angle);
  Renderer.setBarrelLength(initValues.barrelLength);
  currentGravity = initValues.gravity;
  currentPlanetRadius = resolveEnvironment(currentGravity).radius;
  characterStage.syncToWorld(currentGravity, reducedMotion(), sceneFx.shots, sceneFx.landedRocket);

  const pauseForReading = (open?: boolean) => {
    if (open === false) { lastTime = 0; return; }
    deck.clock.paused = true; audio.stopEngineLoop(); deck.update();
  };
  installWiki(pauseForReading);
  installManual(pauseForReading);
  const orreryButton = document.querySelector<HTMLButtonElement>('#open-orrery')!;
  orreryButton.addEventListener('click', async function loadOrrery() {
    orreryButton.disabled = true;
    try {
      const { installOrrery, isOrreryOpen } = await import('./orrery.ts');
      checkOrreryOpen = isOrreryOpen;
      installOrrery(pauseForReading);
      orreryButton.removeEventListener('click', loadOrrery);
      orreryButton.disabled = false;
      orreryButton.click();
    } catch {
      orreryButton.disabled = false;
      deck.message('The orrery could not start. Check that WebGL is available, then try again.', true);
    }
  });
  installResponsiveLayout();
  installWelcome(pauseForReading);
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
