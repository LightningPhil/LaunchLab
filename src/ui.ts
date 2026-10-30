import type { RocketDisplay } from './rocket-presentation.ts';
import { Physics } from './physics.ts';
import { RocketPropellants } from './rocket_propellants.ts';
import { RocketPhysics } from './rocket_physics.ts';
import { ENVIRONMENTS, resolveEnvironment } from './environment.ts';
import { orbitPathFeedback } from './orbit-feedback.ts';
import { getPlanetFact } from './planet-facts.ts';
import { installFactExplanations, updateFactLabels } from './fact-dialog.ts';
import { clampGravity } from './gravity-scale.ts';
import { getWorldArt } from './world-art.ts';
import { applyLaunchSettings, CANNON_DEFAULTS, ROCKET_DEFAULTS, EARTH_ORBIT_EXAMPLE, EARTH_STEERING_PRACTICE, setMixtureBounds } from './launch-settings.ts';
import { protectTouchRange } from './touch-range.ts';
import { formatNumber } from './number-format.ts';
import { requiredElement } from './dom.ts';
import { guidanceMode, type RocketConfig, type RocketState } from './rocket_physics.ts';
import type { ProjectileState } from './physics.ts';
import type { LaunchSettings } from './launch-settings.ts';

interface UICallbacks {
  onFire: () => void; onClear: () => void;
  onGravityChange?: (gravity:number) => void; onBarrelChange?: (length:number) => void;
  onModeChange?: (mode:'cannon'|'rocket') => void;
  onRocketLaunch?: () => void; onRocketClear?: () => void; onSetupChange?: () => void;
}
interface PostFlightSummary {
  range:number; maxHeight:number; flightTime:number; burnTime:number|null;
  dvTsiolkovsky:number; dvActual:number|null; burnoutSpeed?:number|null;
}

/**
 * ============================================================================
 * ui.ts — Control Panel Logic for Launch Lab
 * ============================================================================
 *
 * ROLE:  Manages all DOM controls: mode toggle, cannon sliders, rocket panel,
 *        planet buttons, fire/launch buttons, tooltips,
 *        live telemetry readouts, pre-launch rocket readouts and the energy
 *        bar. Reads from DOM, writes to DOM — never touches the canvas.
 *        It calls the pure physics modules only to compute pre-launch
 *        readouts; recorded flights are owned by main.ts / flight.ts.
 *
 * The `UI` object exported at the bottom is the public surface used by
 * main.ts; everything else in this file is private.
 * ============================================================================
 */

// ── DOM references (populated in init) ─────────────────────────────────────
var sliderAngle: HTMLInputElement, sliderMass: HTMLInputElement, sliderForce: HTMLInputElement, sliderBarrel: HTMLInputElement, forceMultiplier: HTMLSelectElement;
var valAngle: HTMLElement, valMass: HTMLElement, valForce: HTMLElement, valBarrel: HTMLElement;
var btnFire: HTMLButtonElement, btnClear: HTMLButtonElement;
var planetButtons: NodeListOf<HTMLButtonElement>;
var readVelocity: HTMLElement, readHeight: HTMLElement, readDistance: HTMLElement;
var readKE: HTMLElement, readPE: HTMLElement, readTME: HTMLElement;
var energyBarKE: HTMLElement, energyBarPE: HTMLElement;
var tooltipEl: HTMLElement;
var planetFactButton: HTMLButtonElement, planetFactButtonLabel: HTMLElement, planetFactDialog: HTMLDialogElement, planetFactCard: HTMLElement, planetFactArtwork: HTMLImageElement;

// Selected world's exact surface gravity, including Ganymede's 1.428 m/s².
var gravityValue = 9.81;

// Mode state
var currentMode: 'cannon' | 'rocket' = 'cannon'; // 'cannon' | 'rocket'
var modeButtons: NodeListOf<HTMLButtonElement>;
var cannonPanel: HTMLElement, rocketPanel: HTMLElement;

var onFire: UICallbacks["onFire"] | null = null;
var onClear: UICallbacks["onClear"] | null = null;
var onGravityChange: UICallbacks["onGravityChange"] | null = null;
var onBarrelChange: UICallbacks["onBarrelChange"] | null = null;
var onModeChange: UICallbacks["onModeChange"] | null = null;
var isFlightActive = false;  // Track flight state for mode toggle guard
var onRocketLaunch: UICallbacks["onRocketLaunch"] | null = null;
var onRocketClear: UICallbacks["onRocketClear"] | null = null;
var activeTooltipAnchor: HTMLElement | null = null;

// ── Rocket DOM references (populated in initRocketPanel) ───────────────────
var rocketPropSelect: HTMLSelectElement, propellantNote: HTMLElement;
var sliderRocketMR: HTMLInputElement, sliderRocketPc: HTMLInputElement, sliderRocketEps: HTMLInputElement, sliderRocketDt: HTMLInputElement;
var sliderRocketDryMass: HTMLInputElement, sliderRocketPropMass: HTMLInputElement, sliderRocketAngle: HTMLInputElement, propMassMultiplier: HTMLSelectElement;
var sliderRocketEtaC: HTMLInputElement, sliderRocketEtaN: HTMLInputElement;
var rocketGuidanceSelect: HTMLSelectElement;
var sliderPitchEnd: HTMLInputElement, sliderPitchT1: HTMLInputElement, sliderPitchT2: HTMLInputElement, sliderProgradeVmin: HTMLInputElement;
var guidancePitchSub: HTMLElement, guidanceProgradeSub: HTMLElement;
var guidanceOrbitSub: HTMLElement, sliderOrbitAltitude: HTMLInputElement, valOrbitAltitude: HTMLElement;
var efficiencySection: HTMLElement, efficiencyArrow: HTMLElement;
var btnLaunch: HTMLButtonElement, btnRocketClear: HTMLButtonElement;
var twWarning: HTMLElement, fizzleMessage: HTMLElement;
// Rocket value displays
var valRocketMR: HTMLElement, valRocketPc: HTMLElement, valRocketEps: HTMLElement, valRocketDt: HTMLElement;
var valRocketDryMass: HTMLElement, valRocketPropMass: HTMLElement, valRocketAngle: HTMLElement;
var valRocketEtaC: HTMLElement, valRocketEtaN: HTMLElement;
var valPitchEnd: HTMLElement, valPitchT1: HTMLElement, valPitchT2: HTMLElement, valProgradeVmin: HTMLElement;
// Rocket readout elements
var readRocketThrust: HTMLElement, readRocketMdot: HTMLElement, readRocketIsp: HTMLElement;
var readRocketTW: HTMLElement, readRocketBurn: HTMLElement, readRocketDV: HTMLElement;
var readRocketVelocity: HTMLElement, readRocketHeight: HTMLElement, readRocketRange: HTMLElement;
var readRocketProp: HTMLElement, readRocketImpulse: HTMLElement;
// Live flight extended readouts
var readRocketLiveThrust: HTMLElement, readRocketLiveMass: HTMLElement, readRocketLiveIsp: HTMLElement, readRocketLiveTW: HTMLElement;
// Propellant gauge elements
var propGaugeOx: HTMLElement, propGaugeFuel: HTMLElement;
// Post-flight summary elements
var postFlightSummary: HTMLElement;
var readPostRange: HTMLElement, readPostFlightTime: HTMLElement, readPostBurnTime: HTMLElement;
var readPostDvTsiolkovsky: HTMLElement, readPostDvActual: HTMLElement, readPostGravityLoss: HTMLElement;

// ── Initialisation ─────────────────────────────────────────────────────────

function init(callbacks: UICallbacks) {
  onFire = callbacks.onFire;
  onClear = callbacks.onClear;
  onGravityChange = callbacks.onGravityChange || null;
  onBarrelChange = callbacks.onBarrelChange || null;
  onModeChange = callbacks.onModeChange || null;
  onRocketLaunch = callbacks.onRocketLaunch || null;
  onRocketClear = callbacks.onRocketClear || null;
  // Once a flight has ended, the first edit starts a fresh setup. Otherwise
  // edited labels would describe the old recording when resuming/inspecting it.
  for (const event of ['input', 'change']) document.querySelector('.controls-scroll')!.addEventListener(event, () => {
    if (!isFlightActive) callbacks.onSetupChange?.();
  }, true);

  // Mode toggle
  cannonPanel = requiredElement('cannon-panel', 'section');
  rocketPanel = requiredElement('rocket-panel', 'section');
  modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');

  // Sliders
  sliderAngle = requiredElement('slider-angle', 'input');
  sliderMass = requiredElement('slider-mass', 'input');
  sliderForce = requiredElement('slider-force', 'input');
  forceMultiplier = requiredElement('force-multiplier', 'select');
  forceMultiplier.addEventListener('change', () => updateSliderDisplay(sliderForce, valForce, ' N'));
  sliderBarrel = requiredElement('slider-barrel', 'input');

  // Value readouts next to sliders
  valAngle = requiredElement('val-angle', 'output');
  valMass = requiredElement('val-mass', 'output');
  valForce = requiredElement('val-force', 'output');
  valBarrel = requiredElement('val-barrel', 'output');

  // Buttons
  btnFire = requiredElement('btn-fire', 'button');
  btnClear = requiredElement('btn-clear', 'button');

  // Planet buttons
  planetButtons = document.querySelectorAll<HTMLButtonElement>('.planet-btn');
  initWorldArtwork();
  initPlanetFacts();

  // Telemetry
  readVelocity = requiredElement('read-velocity', 'span');
  readHeight = requiredElement('read-height', 'span');
  readDistance = requiredElement('read-distance', 'span');
  readKE = requiredElement('read-ke', 'span');
  readPE = requiredElement('read-pe', 'span');
  readTME = requiredElement('read-tme', 'span');

  // Energy bar
  energyBarKE = requiredElement('energy-bar-ke', 'div');
  energyBarPE = requiredElement('energy-bar-pe', 'div');

  // Tooltip element
  tooltipEl = requiredElement('tooltip', 'div');

  // Wire up slider live updates
  wireSlider(sliderAngle, valAngle, '°');
  wireSlider(sliderMass, valMass, ' kg');
  wireSlider(sliderForce, valForce, ' N');
  wireSlider(sliderBarrel, valBarrel, ' m');

  // Set initial display values
  updateSliderDisplay(sliderAngle, valAngle, '°');
  updateSliderDisplay(sliderMass, valMass, ' kg');
  updateSliderDisplay(sliderForce, valForce, ' N');
  updateSliderDisplay(sliderBarrel, valBarrel, ' m');
  setGravity(gravityValue);

  // Fire button
  btnFire.addEventListener('click', function () {
    if (onFire && !btnFire.disabled) onFire();
  });

  // Clear button
  btnClear.addEventListener('click', function () {
    if (onClear) onClear();
  });

  // Planet buttons
  for (var i = 0; i < planetButtons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        if (isFlightActive) return;
        var g = parseFloat(btn.dataset.gravity ?? '');
        setGravity(g);
        highlightPlanet(btn.getAttribute('data-planet'));
        if (onGravityChange) onGravityChange(g);
        refreshPreLaunch();
      });
    })(planetButtons[i]);
  }

  // Tooltips
  wireTooltips();

  // Mode toggle buttons
  wireModeToggle();

  // Rocket panel controls
  initRocketPanel();
  applyLaunchSettings(document, 'cannon', CANNON_DEFAULTS);
  applyLaunchSettings(document, 'rocket', ROCKET_DEFAULTS);
  updateAllDisplays();
  refreshPreLaunch();
  document.querySelectorAll<HTMLInputElement>('.controls-scroll input[type="range"]').forEach(protectTouchRange);
  requiredElement('btn-cannon-settings-reset', 'button').addEventListener('click', () => resetSettings('cannon'));
  requiredElement('btn-rocket-settings-reset', 'button').addEventListener('click', () => resetSettings('rocket'));

  // Initial planet highlight
  highlightPlanet('earth');
}

// ── Mode toggle ────────────────────────────────────────────────────────────

function wireModeToggle() {
  for (var i = 0; i < modeButtons.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var newMode = btn.getAttribute('data-mode');
        if (newMode === currentMode) return;
        // Prevent mode switch during active flight
        if (isFlightActive) return;
        setMode(newMode);
      });
    })(modeButtons[i]);
  }
}

function setMode(newMode: string | null) {
  if (isFlightActive || (newMode !== 'cannon' && newMode !== 'rocket')) return;
  // Restoring a recorded flight in the current
  // mode must not re-run the mode-switch side effects (range clear, camera).
  if (newMode === currentMode) return;
  currentMode = newMode;
  // Update toggle button highlights
  for (var i = 0; i < modeButtons.length; i++) {
    var btn = modeButtons[i];
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-mode') === currentMode));
    if (btn.getAttribute('data-mode') === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  requiredElement('cannon-actions', 'div').hidden = currentMode !== 'cannon';
  requiredElement('rocket-actions', 'div').hidden = currentMode !== 'rocket';
  // Show/hide panels (the [hidden] rule in style.css does the display work)
  cannonPanel.hidden = currentMode !== 'cannon';
  rocketPanel.hidden = currentMode !== 'rocket';
  // A deep workshop scroll from one launcher must not hide the other's setup.
  document.querySelector<HTMLElement>('.controls-scroll')!.scrollTop = 0;
  // Notify main.ts
  if (onModeChange) onModeChange(currentMode);
}

// ── Slider helpers ─────────────────────────────────────────────────────────

function wireSlider(slider: HTMLInputElement, display: HTMLElement, unit: string) {
  slider.addEventListener('input', function () {
    updateSliderDisplay(slider, display, unit);
    // If barrel slider changes, trigger barrel animation
    if (slider === sliderBarrel) {
      if (onBarrelChange) onBarrelChange(parseFloat(slider.value));
    }
  });
}

/** Preserve the exact selected or recorded surface gravity in m/s². */
function setGravity(g: number) {
  gravityValue = clampGravity(g);
}

function currentGravity() {
  return gravityValue;
}

function updateSliderDisplay(slider: HTMLInputElement, display: HTMLElement, unit: string) {
  var v = parseFloat(slider.value);
  // Format nicely
  if (unit === '°') {
    display.textContent = formatNumber(v, 0) + unit;
  } else if (unit === ' N') {
    display.textContent = formatNumber(v * Number(forceMultiplier.value)) + unit;
    slider.setAttribute('aria-valuetext', display.textContent);
  } else {
    display.textContent = formatNumber(v, 1) + unit;
  }
}

// Preset gravities come from the shared ENVIRONMENTS table (single source of
// truth with the solver and renderer); index.html's data-gravity attributes are
// checked against it in tests/worlds.test.mjs.
var PLANET_GRAVITY_MAP = ENVIRONMENTS.map(function (environment) {
  return { name: environment.name, g: environment.gravity };
});

function findClosestPlanetName(g: number) {
  var best = PLANET_GRAVITY_MAP[0], bd = Math.abs(g - best.g);
  for (var i = 1; i < PLANET_GRAVITY_MAP.length; i++) {
    var d = Math.abs(g - PLANET_GRAVITY_MAP[i].g);
    if (d < bd) { bd = d; best = PLANET_GRAVITY_MAP[i]; }
  }
  return best.name;
}

function highlightNearestPlanet(g: number) {
  highlightPlanet(findClosestPlanetName(g));
}

// ── Planet buttons ─────────────────────────────────────────────────────────

function highlightPlanet(name: string | null) {
  for (var i = 0; i < planetButtons.length; i++) {
    var btn = planetButtons[i];
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-planet') === name));
    if (btn.getAttribute('data-planet') === name) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  var env = resolveEnvironment(currentGravity());
  var label = requiredElement('environment-label', 'span');
  if (label) label.textContent = (env.interpolated ? 'Custom world' : env.name[0].toUpperCase() + env.name.slice(1)) + ' · ' + formatNumber(env.gravity, 2) + ' m/s²';
  // A custom (interpolated) world has no fact card; the nearest preset stays
  // highlighted in the grid, but its facts would be misleading here.
  updatePlanetFactButton(env.interpolated ? null : env.name);
}

function initPlanetFacts() {
  planetFactButton = requiredElement('planet-fact-button', 'button');
  planetFactButtonLabel = requiredElement('planet-fact-button-label', 'span');
  planetFactDialog = requiredElement('planet-fact-dialog', 'dialog');
  planetFactCard = requiredElement('planet-fact-card', 'article');
  planetFactArtwork = requiredElement('planet-fact-artwork', 'img');
  installFactExplanations(planetFactDialog);
  planetFactButton.addEventListener('click', function () {
    const fact = getPlanetFact(planetFactButton.dataset.planet ?? '');
    if (!fact) return;
    const art = getWorldArt(fact.id);
    hideTooltip();
    planetFactCard.dataset.world = fact.id;
    planetFactCard.style.setProperty('--fact-accent', fact.accent);
    if (art && planetFactArtwork) planetFactArtwork.src = art.full;
    const fields = {
      'planet-fact-kind': fact.kind,
      'planet-fact-title': fact.name,
      'planet-fact-tagline': fact.tagline,
      'planet-fact-mass': fact.mass,
      'planet-fact-diameter': fact.diameter,
      'planet-fact-distance': fact.distance,
      'planet-fact-gravity': fact.gravity,
      'planet-fact-day': fact.dayLength,
      'planet-fact-year': fact.yearLength,
      'planet-fact-tilt': fact.axialTilt,
      'planet-fact-temp-average': fact.averageTemp,
      'planet-fact-temp-min': fact.minTemp,
      'planet-fact-temp-max': fact.maxTemp,
      'planet-fact-atmosphere': fact.atmosphere,
      'planet-fact-exploration': fact.exploration,
      'planet-fact-temperature-note': fact.temperatureNote,
    };
    Object.entries(fields).forEach(function ([id, text]) {
      const element = document.getElementById(id);
      if (element) element.textContent = text;
    });
    updateFactLabels(planetFactDialog, fact);
    planetFactDialog.showModal();
  });
  planetFactDialog.addEventListener('click', function (event) {
    if (event.target === planetFactDialog) planetFactDialog.close();
  });
}

function initWorldArtwork() {
  for (const button of planetButtons) {
    const id = button.dataset.planet ?? '';
    const art = getWorldArt(id);
    const icon = button.querySelector('.planet-icon');
    if (!art || !icon) continue;
    const image = document.createElement('img');
    image.src = art.mini;
    image.alt = '';
    image.width = 64;
    image.height = 64;
    image.decoding = 'async';
    icon.replaceChildren(image);
  }
}

function updatePlanetFactButton(name: string | null) {
  const fact = name ? getPlanetFact(name) : undefined;
  const art = fact ? getWorldArt(fact.id) : undefined;
  if (!planetFactButton || !planetFactButtonLabel) return;
  planetFactButton.disabled = !fact;
  planetFactButton.dataset.planet = fact?.id || '';
  planetFactButtonLabel.textContent = fact ? fact.name + ' facts' : 'World facts';
  // Pre-load the card artwork so the dialog opens complete. An empty src would
  // render a broken-image glyph, so clear the attribute instead.
  if (planetFactArtwork) {
    if (art) planetFactArtwork.src = art.full;
    else planetFactArtwork.removeAttribute('src');
  }
}

// ── Tooltips ───────────────────────────────────────────────────────────────

function wireTooltips() {
  var triggers = document.querySelectorAll<HTMLElement>('[data-tip]');
  for (var i = 0; i < triggers.length; i++) {
    (function (trigger) {
      if (trigger.dataset.tipWired) return;
      trigger.dataset.tipWired = 'true';
      trigger.setAttribute('aria-describedby', 'tooltip');
      trigger.setAttribute('aria-expanded', 'false');
      // Hover shows a transient tooltip that ignores the pointer, so moving
      // the mouse off the trigger closes it cleanly. Focus or click "pins" it
      // instead: a pinned tooltip accepts pointer events so long content can
      // be scrolled, and only closes on blur, Escape or an outside click.
      trigger.addEventListener('mouseenter', function () {
        if (activeTooltipAnchor === trigger && tooltipEl.classList.contains('pinned')) return;
        showTooltip(trigger, trigger.getAttribute('data-tip'), false);
      });
      trigger.addEventListener('mouseleave', function () {
        if (!tooltipEl.classList.contains('pinned')) hideTooltip();
      });
      trigger.addEventListener('focus', function () {
        showTooltip(trigger, trigger.getAttribute('data-tip'), true);
      });
      trigger.addEventListener('blur', function (event: FocusEvent) {
        // Clicking inside a pinned tooltip (e.g. its scrollbar) moves focus
        // onto the tooltip itself; that is not a dismissal.
        if (event.relatedTarget === tooltipEl) return;
        hideTooltip();
      });
      trigger.addEventListener('click', function (event) {
        event.stopPropagation();
        showTooltip(trigger, trigger.getAttribute('data-tip'), true);
      });
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') hideTooltip();
      });
    })(triggers[i]);
  }
  if (!tooltipEl.dataset.wired) {
    tooltipEl.dataset.wired = 'true';
    // Focusable (but not tabbable) so a pinned tooltip can take focus when
    // clicked without the trigger's blur handler dismissing it.
    tooltipEl.tabIndex = -1;
    tooltipEl.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideTooltip();
    });
    document.addEventListener('click', function (event) {
      if (tooltipEl.contains(event.target as Node)) return;
      hideTooltip();
    });
    document.addEventListener('scroll', function (event) {
      // Scrolling the tooltip's own overflow must not dismiss it.
      if (event.target === tooltipEl) return;
      hideTooltip();
    }, true);
    window.addEventListener('resize', hideTooltip);
  }
}

function showTooltip(anchor: HTMLElement, html: string | null, pinned: boolean) {
  if (activeTooltipAnchor && activeTooltipAnchor !== anchor) activeTooltipAnchor.setAttribute('aria-expanded', 'false');
  activeTooltipAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  tooltipEl.innerHTML = html ?? '';
  tooltipEl.classList.toggle('pinned', !!pinned);
  tooltipEl.style.display = 'block';

  // Position near anchor
  var rect = anchor.getBoundingClientRect();
  var tipW = tooltipEl.offsetWidth;
  var tipH = tooltipEl.offsetHeight;

  var left = rect.right + 8;
  var top = rect.top - tipH / 2 + rect.height / 2;

  // Keep on screen
  if (left + tipW > window.innerWidth - 10) {
    left = rect.left - tipW - 8;
  }
  left = Math.max(12, Math.min(left, window.innerWidth - tipW - 12));
  top = Math.max(12, Math.min(top, window.innerHeight - tipH - 12));

  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

function hideTooltip() {
  if (activeTooltipAnchor) activeTooltipAnchor.setAttribute('aria-expanded', 'false');
  activeTooltipAnchor = null;
  tooltipEl.classList.remove('pinned');
  tooltipEl.style.display = 'none';
}

// ── Rocket Panel Initialisation ────────────────────────────────────────────

function initRocketPanel() {
  // Grab all rocket DOM elements
  rocketPropSelect = requiredElement('rocket-propellant', 'select');
  propellantNote = requiredElement('propellant-note', 'p');

  sliderRocketMR = requiredElement('slider-rocket-mr', 'input');
  sliderRocketPc = requiredElement('slider-rocket-pc', 'input');
  sliderRocketEps = requiredElement('slider-rocket-eps', 'input');
  sliderRocketDt = requiredElement('slider-rocket-dt', 'input');
  sliderRocketDryMass = requiredElement('slider-rocket-drymass', 'input');
  sliderRocketPropMass = requiredElement('slider-rocket-propmass', 'input');
  propMassMultiplier = requiredElement('rocket-propellant-multiplier', 'select');
  propMassMultiplier.addEventListener('change', () => {
    updateRocketSliderDisplay(sliderRocketPropMass, valRocketPropMass, ' kg');
    refreshPreLaunch();
  });
  sliderRocketAngle = requiredElement('slider-rocket-angle', 'input');
  sliderRocketEtaC = requiredElement('slider-rocket-etac', 'input');
  sliderRocketEtaN = requiredElement('slider-rocket-etan', 'input');

  valRocketMR = requiredElement('val-rocket-mr', 'output');
  valRocketPc = requiredElement('val-rocket-pc', 'output');
  valRocketEps = requiredElement('val-rocket-eps', 'output');
  valRocketDt = requiredElement('val-rocket-dt', 'output');
  valRocketDryMass = requiredElement('val-rocket-drymass', 'output');
  valRocketPropMass = requiredElement('val-rocket-propmass', 'output');
  valRocketAngle = requiredElement('val-rocket-angle', 'output');
  valRocketEtaC = requiredElement('val-rocket-etac', 'output');
  valRocketEtaN = requiredElement('val-rocket-etan', 'output');

  rocketGuidanceSelect = requiredElement('rocket-guidance', 'select');
  guidancePitchSub = requiredElement('guidance-pitch-sub', 'div');
  guidanceProgradeSub = requiredElement('guidance-prograde-sub', 'div');
  guidanceOrbitSub = requiredElement('guidance-orbit-sub', 'div');
  sliderOrbitAltitude = requiredElement('slider-rocket-orbit-altitude', 'input');
  valOrbitAltitude = requiredElement('val-rocket-orbit-altitude', 'output');

  sliderPitchEnd = requiredElement('slider-rocket-pitch-end', 'input');
  sliderPitchT1 = requiredElement('slider-rocket-pitch-t1', 'input');
  sliderPitchT2 = requiredElement('slider-rocket-pitch-t2', 'input');
  sliderProgradeVmin = requiredElement('slider-rocket-prograde-vmin', 'input');

  valPitchEnd = requiredElement('val-rocket-pitch-end', 'output');
  valPitchT1 = requiredElement('val-rocket-pitch-t1', 'output');
  valPitchT2 = requiredElement('val-rocket-pitch-t2', 'output');
  valProgradeVmin = requiredElement('val-rocket-prograde-vmin', 'output');

  efficiencySection = requiredElement('efficiency-section', 'div');
  efficiencyArrow = requiredElement('efficiency-arrow', 'span');

  btnLaunch = requiredElement('btn-launch', 'button');
  btnRocketClear = requiredElement('btn-rocket-clear', 'button');
  twWarning = requiredElement('tw-warning', 'p');
  fizzleMessage = requiredElement('fizzle-message', 'p');

  // Readout elements
  readRocketThrust = requiredElement('read-rocket-thrust', 'span');
  readRocketMdot = requiredElement('read-rocket-mdot', 'span');
  readRocketIsp = requiredElement('read-rocket-isp', 'span');
  readRocketTW = requiredElement('read-rocket-tw', 'span');
  readRocketBurn = requiredElement('read-rocket-burn', 'span');
  readRocketDV = requiredElement('read-rocket-dv', 'span');
  readRocketVelocity = requiredElement('read-rocket-velocity', 'span');
  readRocketHeight = requiredElement('read-rocket-height', 'span');
  readRocketRange = requiredElement('read-rocket-range', 'span');
  readRocketProp = requiredElement('read-rocket-prop', 'span');
  readRocketImpulse = requiredElement('read-rocket-impulse', 'span');

  // Live flight extended readouts
  readRocketLiveThrust = requiredElement('read-rocket-live-thrust', 'span');
  readRocketLiveMass = requiredElement('read-rocket-live-mass', 'span');
  readRocketLiveIsp = requiredElement('read-rocket-live-isp', 'span');
  readRocketLiveTW = requiredElement('read-rocket-live-tw', 'span');

  // Propellant gauge
  propGaugeOx = requiredElement('prop-gauge-ox', 'div');
  propGaugeFuel = requiredElement('prop-gauge-fuel', 'div');

  // Post-flight summary
  postFlightSummary = requiredElement('post-flight-summary', 'section');
  readPostRange = requiredElement('read-post-range', 'span');
  readPostFlightTime = requiredElement('read-post-flighttime', 'span');
  readPostBurnTime = requiredElement('read-post-burntime', 'span');
  readPostDvTsiolkovsky = requiredElement('read-post-dv-tsiolkovsky', 'span');
  readPostDvActual = requiredElement('read-post-dv-actual', 'span');
  readPostGravityLoss = requiredElement('read-post-gravity-loss', 'span');

  // Populate propellant dropdown from registry
  populatePropellantDropdown();

  // Wire rocket sliders with live pre-launch update
  wireRocketSlider(sliderRocketMR, valRocketMR, '');
  wireRocketSlider(sliderRocketPc, valRocketPc, ' bar');
  wireRocketSlider(sliderRocketEps, valRocketEps, '');
  wireRocketSlider(sliderRocketDt, valRocketDt, ' mm');
  wireRocketSlider(sliderRocketDryMass, valRocketDryMass, ' kg');
  wireRocketSlider(sliderRocketPropMass, valRocketPropMass, ' kg');
  wireRocketSlider(sliderRocketAngle, valRocketAngle, '°');
  wireRocketSlider(sliderRocketEtaC, valRocketEtaC, '');
  wireRocketSlider(sliderRocketEtaN, valRocketEtaN, '');

  // Guidance sub-panel sliders
  wireRocketSlider(sliderPitchEnd, valPitchEnd, '°');
  wireRocketSlider(sliderPitchT1, valPitchT1, ' s');
  wireRocketSlider(sliderPitchT2, valPitchT2, ' s');
  wireRocketSlider(sliderProgradeVmin, valProgradeVmin, ' m/s');
  wireRocketSlider(sliderOrbitAltitude, valOrbitAltitude, ' km');
  for (const id of ['rocket-angle', 'rocket-pitch-end', 'rocket-prograde-vmin', 'rocket-pitch-t1', 'rocket-pitch-t2', 'rocket-cutoff']) {
    const precise = requiredElement('number-' + id, 'input');
    const range = requiredElement('slider-' + id, 'input');
    const commit = () => {
      if (!Number.isFinite(precise.valueAsNumber)) { precise.value = range.value; return; }
      range.value = precise.value;
      range.dispatchEvent(new Event('input', { bubbles: true }));
      precise.value = range.value;
    };
    // Commit complete numbers, including browser autofill, on blur. Reordering
    // the turn while typing a prefix ("1" on the way to "120") would move the
    // other time unexpectedly. Range controls still update continuously.
    precise.addEventListener('change', commit);
    precise.addEventListener('blur', commit);
    precise.addEventListener('keydown', event => { if (event.key === 'Enter') commit(); });
  }
  requiredElement('slider-rocket-cutoff', 'input').addEventListener('input', refreshPreLaunch);
  for (const [id, adjustment] of [['cutoff-earlier', -.5], ['cutoff-later', .5], ['cutoff-full-tank', 0]] as const) {
    requiredElement(id, 'button').addEventListener('click', () => {
      if (isFlightActive) return;
      const range = requiredElement('slider-rocket-cutoff', 'input');
      const current = Number(range.value) || RocketPhysics.computePreLaunch(getRocketValues(), currentGravity()).burnTime;
      range.value = adjustment === 0 ? '0' : String(Math.max(.1, (Number.isFinite(current) ? current : 0) + adjustment));
      range.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }
  requiredElement('btn-steering-practice', 'button').addEventListener('click', () => {
    if (isFlightActive) return;
    onRocketClear?.();
    restoreFlightConfig('rocket', EARTH_STEERING_PRACTICE);
    requiredElement('steering-practice-note', 'p').textContent = 'Ready on Earth. Fly this plan first, then try stopping 1 second earlier. Compare the lowest point of the two paths. All settings remain yours to change.';
  });
  requiredElement('btn-orbit-example', 'button').addEventListener('click', () => {
    if (isFlightActive) return;
    onRocketClear?.();
    restoreFlightConfig('rocket', EARTH_ORBIT_EXAMPLE);
    requiredElement('orbit-example-note', 'p').textContent = 'Ready! Earth, a suitable rocket and Orbit assist are selected. Now press Lift off — the rocket will steer itself.';
    requiredElement('rocket-guidance-panel', 'section').classList.add('orbit-example-loaded');
  });

  // Guidance mode dropdown
  rocketGuidanceSelect.addEventListener('change', function () {
    updateGuidanceSubPanels();
    refreshPreLaunch();
  });

  // Propellant dropdown change
  rocketPropSelect.addEventListener('change', function () {
    onPropellantChange();
    refreshPreLaunch();
  });

  // Efficiency collapse toggle
  var effToggle = requiredElement('efficiency-toggle', 'button');
  effToggle.addEventListener('click', function () {
    var isOpen = !efficiencySection.classList.contains('rocket-efficiency-hidden');
    efficiencySection.classList.toggle('rocket-efficiency-hidden', isOpen);
    efficiencyArrow.classList.toggle('open', !isOpen);
    effToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  // Launch button
  btnLaunch.addEventListener('click', function () {
    if (onRocketLaunch && !btnLaunch.disabled) onRocketLaunch();
  });

  // Rocket clear button
  btnRocketClear.addEventListener('click', function () {
    if (onRocketClear) onRocketClear();
  });

  // Set initial slider display values
  updateRocketSliderDisplay(sliderRocketMR, valRocketMR, '');
  updateRocketSliderDisplay(sliderRocketPc, valRocketPc, ' bar');
  updateRocketSliderDisplay(sliderRocketEps, valRocketEps, '');
  updateRocketSliderDisplay(sliderRocketDt, valRocketDt, ' mm');
  updateRocketSliderDisplay(sliderRocketDryMass, valRocketDryMass, ' kg');
  updateRocketSliderDisplay(sliderRocketPropMass, valRocketPropMass, ' kg');
  updateRocketSliderDisplay(sliderRocketAngle, valRocketAngle, '°');
  updateRocketSliderDisplay(sliderRocketEtaC, valRocketEtaC, '');
  updateRocketSliderDisplay(sliderRocketEtaN, valRocketEtaN, '');
  updateRocketSliderDisplay(sliderPitchEnd, valPitchEnd, '°');
  updateRocketSliderDisplay(sliderPitchT1, valPitchT1, ' s');
  updateRocketSliderDisplay(sliderPitchT2, valPitchT2, ' s');
  updateRocketSliderDisplay(sliderProgradeVmin, valProgradeVmin, ' m/s');

  // Set initial guidance sub-panel visibility
  updateGuidanceSubPanels();

  // Wire tooltips again to pick up new rocket panel tooltip triggers
  wireTooltips();

  // Initial pre-launch computation
  refreshPreLaunch();
}

// ── Propellant dropdown population ─────────────────────────────────────────

function populatePropellantDropdown() {
  var registry = RocketPropellants.REGISTRY;
  var lastCategory = '';
  let group: HTMLOptGroupElement | undefined;
  for (var i = 0; i < registry.length; i++) {
    var p = registry[i];
    // Add category optgroup
    if (!group || p.category !== lastCategory) {
      group = document.createElement('optgroup');
      group.label = p.category.charAt(0).toUpperCase() + p.category.slice(1);
      rocketPropSelect.appendChild(group);
      lastCategory = p.category;
    }
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    group.appendChild(opt);
  }
  // Default to LOX/RP-1
  rocketPropSelect.value = 'LOX_RP1';
  onPropellantChange();
}

function onPropellantChange() {
  var prop = RocketPropellants.getById(rocketPropSelect.value);
  if (!prop) return;

  // Update MR slider bounds
  setMixtureBounds(sliderRocketMR, prop.id);
  updateRocketSliderDisplay(sliderRocketMR, valRocketMR, '');

  // Update info note
  propellantNote.textContent = 'Illustrative performance model. ' + prop.notes.join(' ') +
    ' Mixture ratio changes the tank split; chemistry stays fixed for this pair.';
}

// ── Guidance sub-panel toggling ────────────────────────────────────────────

function updateGuidanceSubPanels() {
  var mode = rocketGuidanceSelect.value;
  const explanations: Record<string, string> = {
    fixed: 'Keep the same angle above the local horizon. Useful for hops and comparing launch angles; a timed turn gives you more control over an orbit.',
    pitch_program: 'You choose when to turn, where to point and when to stop. The rocket follows these commands without correcting its path. Times use the flight clock, not real waiting time.',
    prograde_lock: 'Start at your launch angle, then point along the direction of travel above your chosen speed. Gravity bends that path. If speed falls below the threshold, the launch angle is used again.',
    orbit_assist: 'Start upright, turn sideways and adjust thrust automatically. The engine stops when the orbit is reached. Load the assisted Earth example below for a suitable rocket.',
  };
  requiredElement('steering-help', 'p').textContent = explanations[mode] || explanations.fixed;
  guidanceOrbitSub.classList.toggle('guidance-sub-hidden', mode !== 'orbit_assist');
  requiredElement('guidance-cutoff-sub', 'div').hidden = mode === 'orbit_assist';
  requiredElement('steering-plan', 'figure').hidden = mode === 'orbit_assist';
  if (mode === 'orbit_assist') {
    sliderRocketAngle.value = '90'; updateRocketSliderDisplay(sliderRocketAngle, valRocketAngle, '°');
  }
  sliderRocketAngle.disabled = isFlightActive || mode === 'orbit_assist';
  requiredElement('number-rocket-angle', 'input').disabled = sliderRocketAngle.disabled;
  if (mode === 'pitch_program') {
    guidancePitchSub.classList.remove('guidance-sub-hidden');
  } else {
    guidancePitchSub.classList.add('guidance-sub-hidden');
  }
  if (mode === 'prograde_lock') {
    guidanceProgradeSub.classList.remove('guidance-sub-hidden');
  } else {
    guidanceProgradeSub.classList.add('guidance-sub-hidden');
  }
}

// ── Rocket slider helpers ──────────────────────────────────────────────────

function wireRocketSlider(slider: HTMLInputElement, display: HTMLElement, unit: string) {
  if (!slider || !display) return;
  slider.addEventListener('input', function () {
    // Keep the turn interval ordered without allowing an accidental instant flip.
    if (slider === sliderPitchT1 && Number(sliderPitchT1.value) >= Number(sliderPitchT2.value)) {
      sliderPitchT2.value = String(Number(sliderPitchT1.value) + .1);
      updateRocketSliderDisplay(sliderPitchT2, valPitchT2, ' s');
    }
    if (slider === sliderPitchT2 && Number(sliderPitchT2.value) <= Number(sliderPitchT1.value)) {
      sliderPitchT1.value = String(Number(sliderPitchT2.value) - .1);
      updateRocketSliderDisplay(sliderPitchT1, valPitchT1, ' s');
    }
    updateRocketSliderDisplay(slider, display, unit);
    refreshPreLaunch();
  });
}

function updateRocketSliderDisplay(slider: HTMLInputElement, display: HTMLElement, unit: string) {
  var v = parseFloat(slider.value);
  if (slider === sliderRocketPropMass) v *= Number(propMassMultiplier.value);
  if (unit === '°') {
    display.textContent = formatNumber(v, Number(slider.step) < 1 ? 1 : 0) + unit;
  } else if (unit === ' bar' || unit === ' mm' || unit === ' kg' || unit === ' km' || unit === ' m/s' || unit === ' %') {
    display.textContent = formatNumber(v, 0) + unit;
  } else if (unit === ' s') {
    display.textContent = formatNumber(v, 1) + unit;
  } else {
    // No unit — format based on step precision
    var step = parseFloat(slider.step) || 1;
    if (step < 0.1) {
      display.textContent = formatNumber(v, 2);
    } else if (step < 1) {
      display.textContent = formatNumber(v, 1);
    } else {
      display.textContent = formatNumber(v, 0);
    }
  }
}

// ── Get rocket values ──────────────────────────────────────────────────────

function getRocketValues(): Required<Omit<RocketConfig, 'gravity' | 'Pa_Pa' | 'environment'>> & {environment:NonNullable<RocketConfig['environment']>;Pa_Pa:number} {
  var environment = resolveEnvironment(currentGravity());
  return {
    propellantId: rocketPropSelect.value,
    MR: parseFloat(sliderRocketMR.value),
    Pc_bar: parseFloat(sliderRocketPc.value),
    epsilon: parseFloat(sliderRocketEps.value),
    throatDia_mm: parseFloat(sliderRocketDt.value),
    dryMass: parseFloat(sliderRocketDryMass.value),
    propMass: parseFloat(sliderRocketPropMass.value) * Number(propMassMultiplier.value),
    propMassMultiplier: Number(propMassMultiplier.value),
    launchAngle: parseFloat(sliderRocketAngle.value),
    guidanceMode: guidanceMode(rocketGuidanceSelect.value),
    orbitAltitudeKm: Number(sliderOrbitAltitude.value),
    cutoffTime: Number(requiredElement('slider-rocket-cutoff', 'input').value),
    etaC: parseFloat(sliderRocketEtaC.value),
    etaN: parseFloat(sliderRocketEtaN.value),
    Pa_Pa: environment.surfacePressure,
    environment: environment,
    planetRadius: environment.radius,
    // Guidance sub-parameters
    pitchEnd: parseFloat(sliderPitchEnd.value),
    pitchT1: parseFloat(sliderPitchT1.value),
    pitchT2: parseFloat(sliderPitchT2.value),
    progradeVmin: parseFloat(sliderProgradeVmin.value)
  };
}

function getRocketZoomSettings() {
  return { marginPercent: 15, durationSeconds: 3 };
}

// ── Live pre-launch readout refresh ────────────────────────────────────────

function refreshPreLaunch() {
  var vals = getRocketValues();
  var gravity = currentGravity();
  var pre = RocketPhysics.computePreLaunch(vals, gravity);

  // Full-run measurements come from the actual recorded flight. In particular,
  // an arbitrary prediction horizon must never masquerade as a reached apex.
  updatePreLaunchReadouts(pre);
  updateSteeringPlan(vals, pre);
  const assisted = vals.guidanceMode === 'orbit_assist';
  const note = requiredElement('orbit-plan-note', 'p');
  note.hidden = !assisted;
  const environment = resolveEnvironment(gravity);
  const speed = Math.sqrt(gravity * environment.radius ** 2 / (environment.radius + vals.orbitAltitudeKm * 1000));
  const world = environment.interpolated ? 'this world' : environment.name[0].toUpperCase() + environment.name.slice(1);
  note.textContent = `${formatNumber(vals.orbitAltitudeKm)} km above ${world} needs about ${formatNumber(speed)} m/s sideways. Your engine and fuel still do the work. Air drag is not modelled.`;
  requiredElement('orbit-example-note', 'p').textContent = '1. Load this example. 2. Press Lift off. It selects Earth and a rocket ready for a 200 km orbit.';
  requiredElement('steering-practice-note', 'p').textContent = 'Load a capable rocket and an editable turn-and-cutoff plan. Fly it, then change one setting and compare.';
  requiredElement('rocket-guidance-panel', 'section').classList.remove('orbit-example-loaded');
}

function updateSteeringPlan(config: RocketConfig, pre: ReturnType<typeof RocketPhysics.computePreLaunch>) {
  for (const id of ['rocket-angle', 'rocket-pitch-end', 'rocket-prograde-vmin', 'rocket-pitch-t1', 'rocket-pitch-t2', 'rocket-cutoff']) {
    const precise = requiredElement('number-' + id, 'input');
    if (document.activeElement !== precise) precise.value = requiredElement('slider-' + id, 'input').value;
  }
  const mode = config.guidanceMode;
  const cutoff = config.cutoffTime ?? 0;
  const fuelTime = pre.burnTime;
  const end = Math.max(.1, Math.min(cutoff > 0 ? cutoff : Infinity, Number.isFinite(fuelTime) ? fuelTime : 600));
  const stop = cutoff > 0 && cutoff < fuelTime
    ? `Stop at ${formatNumber(cutoff, 1)} s, keeping unused fuel.`
    : `Burn until the tank is empty${Number.isFinite(fuelTime) ? ` (about ${formatNumber(fuelTime, 1)} s)` : ''}.`;
  const turn = `Hold ${formatNumber(config.launchAngle, 1)}° until ${formatNumber(config.pitchT1 ?? 5, 1)} s; turn to ${formatNumber(config.pitchEnd ?? 45, 1)}° by ${formatNumber(config.pitchT2 ?? 20, 1)} s.`;
  requiredElement('steering-plan-summary', 'p').textContent = (mode === 'pitch_program' ? turn
    : mode === 'prograde_lock' ? `Launch at ${formatNumber(config.launchAngle, 1)}°; follow your motion above ${formatNumber(config.progradeVmin ?? 10)} m/s.`
    : `Hold ${formatNumber(config.launchAngle, 1)}° above the horizon.`) + ' ' + stop;
  const svg = requiredElement('steering-plan', 'figure').querySelector('svg')!;
  svg.style.display = mode === 'prograde_lock' ? 'none' : '';
  const guidance = RocketPhysics.buildGuidance(config);
  const initial = RocketPhysics.createRocketState(config);
  const times = [...new Set([0, Math.min(end, config.pitchT1 ?? 5), Math.min(end, config.pitchT2 ?? 20), end])].sort((a, b) => a - b);
  const path = times.map((time, i) => `${i ? 'L' : 'M'}${30 + 236 * time / end},${66 - guidance.getAngle({ ...initial, time }) * .6}`).join(' ');
  svg.querySelector('#steering-plan-line')!.setAttribute('d', path);
  svg.querySelector('#steering-cutoff-line')!.setAttribute('visibility', cutoff > 0 && cutoff < fuelTime ? 'visible' : 'hidden');
  svg.querySelector('#steering-plan-end')!.textContent = formatNumber(end, 1) + ' s';
  svg.querySelector('title')!.textContent = requiredElement('steering-plan-summary', 'p').textContent;
  const environment = config.environment!;
  const circular = Math.sqrt(environment.gravity * environment.radius);
  let check = 'Try one change per flight. Earlier turning trades height for sideways speed; later cutoff adds speed but can overshoot.';
  if (mode === 'orbit_assist') check = 'Orbit assist steers, throttles and stops for you. Your rocket still needs enough thrust and fuel.';
  else if (!pre.canLaunch) check = 'This rocket cannot lift off with these settings. Increase upward thrust or reduce its mass.';
  else if (mode === 'prograde_lock' && config.launchAngle === 90) check = 'A vertical launch has no sideways motion to follow. Tilt the launch angle below 90° to begin a gravity turn.';
  else if (mode === 'pitch_program' && cutoff > 0 && cutoff <= (config.pitchT2 ?? 20)) check = 'Your engine stops before the turn finishes. Only the part of the turn before cutoff can change the flight path.';
  else if (cutoff > 0 && cutoff >= fuelTime) check = 'Fuel runs out before this timer can stop the engine. Choose an earlier cutoff to leave fuel in the tank.';
  else if (pre.deltaV < circular) check = `This tank has only about ${formatNumber(pre.deltaV)} m/s of ideal speed change. Near-surface circular speed here is about ${formatNumber(circular)} m/s, before climb and gravity losses. For Earth practice, load the capable rocket above.`;
  else if (mode === 'pitch_program' && (config.pitchEnd ?? 45) > 15) check = 'Your final angle keeps much of the thrust pointed upward. For orbit practice, finish closer to the horizon to build sideways speed.';
  else if (mode === 'fixed') check = 'Holding a steep angle mainly gains height. Use Timed turn to choose a separate climb and sideways burn.';
  requiredElement('steering-plan-check', 'p').textContent = check;
}

function updatePreLaunchReadouts(pre: ReturnType<typeof RocketPhysics.computePreLaunch>) {
  if (!pre) return;

  readRocketThrust.textContent = formatSI(pre.thrust) + 'N';
  readRocketMdot.textContent = formatNumber(pre.mdot, 3) + ' kg/s';
  readRocketIsp.textContent = formatNumber(pre.Isp, 1) + ' s';

  // T/W with colour coding
  readRocketTW.textContent = formatNumber(pre.tw, 2);
  var canLaunch = pre.canLaunch !== undefined ? pre.canLaunch : pre.tw * Math.sin(getRocketValues().launchAngle * Math.PI / 180) > 1;
  readRocketTW.className = 'readout-value ' + (!canLaunch ? 'rocket-tw-warn' : 'rocket-tw-ok');

  // T/W warning banner & button caution
  if (!canLaunch) {
    twWarning.textContent = pre.flowRegime === 'unchoked'
      ? 'Chamber pressure is too low for choked nozzle flow in this atmosphere. Try higher chamber pressure.'
      : pre.thrust <= 0
        ? 'This nozzle cannot produce thrust in this atmosphere. Try higher chamber pressure or a smaller expansion ratio.'
      : 'Too heavy for this engine. In the workshop, increase throat diameter or chamber pressure; or try less propellant and a steeper launch.';
    twWarning.classList.remove('tw-warning-hidden');
    btnLaunch.classList.add('caution');
  } else {
    twWarning.classList.add('tw-warning-hidden');
    btnLaunch.classList.remove('caution');
  }

  readRocketBurn.textContent = isFinite(pre.burnTime) ? formatNumber(pre.burnTime, 1) + ' s' : '---';
  readRocketDV.textContent = formatNumber(pre.deltaV, 0) + ' m/s';
}

// ── Rocket flight readouts (live during flight) ────────────────────────────

function updateRocketReadouts(state: RocketState | null, launchX?: number) {
  if (!state) {
    resetRocketReadouts();
    return;
  }
  var spd = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
  readRocketVelocity.textContent = formatNumber(spd, 1) + ' m/s';
  readRocketHeight.textContent = formatNumber(Math.max(0, state.y), 1) + ' m';
  var origin = launchX !== undefined && Number.isFinite(launchX) ? launchX : 0;
  readRocketRange.textContent = formatNumber(state.x - origin, 1) + ' m';
  const fuelDigits = state.mPropInitial >= 10000 ? 0 : 1;
  readRocketProp.textContent = formatNumber(state.mProp, fuelDigits) + ' / ' + formatNumber(state.mPropInitial, fuelDigits) + ' kg';
  readRocketImpulse.textContent = formatSI(state.totalImpulse) + 'N\u00B7s';
  const orbit = orbitPathFeedback(state, currentGravity());
  const orbitReadout = requiredElement('rocket-orbit-readout', 'div');
  orbitReadout.hidden = !orbit.visible;
  requiredElement('rocket-orbit-caption', 'p').textContent = orbit.caption;
  requiredElement('read-rocket-periapsis', 'span').textContent = orbit.lowest;
  requiredElement('read-rocket-apoapsis', 'span').textContent = orbit.highest;
  requiredElement('rocket-orbit-note', 'p').textContent = orbit.note;

  // Extended live readouts
  if (readRocketLiveThrust) {
    readRocketLiveThrust.textContent = state.engineOn
      ? formatSI(state.thrustMagnitude) + 'N'
      : '0 N';
  }
  if (readRocketLiveMass) {
    readRocketLiveMass.textContent = formatNumber(state.mass, 1) + ' kg';
  }
  if (readRocketLiveIsp) {
    readRocketLiveIsp.textContent = state.engineOn && state.Isp > 0
      ? formatNumber(state.Isp, 1) + ' s'
      : '\u2014';
  }
  if (readRocketLiveTW) {
    var surfaceG = currentGravity();
    var altitude = Math.max(0, state.y);
    var localG = state.planetRadius > 0
      ? surfaceG * Math.pow(state.planetRadius / (state.planetRadius + altitude), 2)
      : surfaceG;
    var tw = state.mass > 0 && state.engineOn
      ? state.thrustMagnitude / (state.mass * localG)
      : 0;
    readRocketLiveTW.textContent = tw > 0 ? formatNumber(tw, 2) : '\u2014';
    readRocketLiveTW.className = 'readout-value ' + (tw > 0 && tw < 1 ? 'rocket-tw-warn' : (tw >= 1 ? 'rocket-tw-ok' : ''));
  }

  // Propellant gauge
}

function updateRocketFuel(display: RocketDisplay) {
  const gauge = requiredElement('prop-gauge', 'div');
  const percent = display.fraction * 100;
  propGaugeOx.style.width = (percent * display.oxidiserFraction) + '%';
  propGaugeFuel.style.width = (percent * (1 - display.oxidiserFraction)) + '%';
  const fuelDigits = display.total >= 10000 ? 0 : 1;
  readRocketProp.textContent = formatNumber(display.remaining, fuelDigits) + ' / ' + formatNumber(display.total, fuelDigits) + ' kg';
  gauge.setAttribute('aria-valuenow', percent.toFixed(1));
  gauge.setAttribute('aria-valuetext', Math.round(percent) + '% remaining; ' + display.label);
  const status = requiredElement('read-rocket-engine', 'p');
  if (status.textContent !== display.label) status.textContent = display.label;
}

function resetRocketReadouts() {
  requiredElement('rocket-orbit-readout', 'div').hidden = true;
  readRocketVelocity.textContent = '---';
  readRocketHeight.textContent = '---';
  readRocketRange.textContent = '---';
  readRocketProp.textContent = '---';
  readRocketImpulse.textContent = '---';
  if (readRocketLiveThrust) readRocketLiveThrust.textContent = '---';
  if (readRocketLiveMass) readRocketLiveMass.textContent = '---';
  if (readRocketLiveIsp) readRocketLiveIsp.textContent = '---';
  if (readRocketLiveTW) {
    readRocketLiveTW.textContent = '---';
    readRocketLiveTW.className = 'readout-value';
  }
  if (propGaugeOx) propGaugeOx.style.width = '0%';
  if (propGaugeFuel) propGaugeFuel.style.width = '0%';
  hideFizzleMessage();
  hidePostFlightSummary();
}

// ── Fizzle message ─────────────────────────────────────────────────────────

function showFizzleMessage(tw: number) {
  if (!fizzleMessage) return;
  fizzleMessage.textContent = 'Upward thrust / weight was ' + formatNumber(tw, 2) +
    '. The upward thrust must exceed the weight for immediate lift-off. Try less mass, more thrust, or a steeper angle.';
  fizzleMessage.classList.remove('fizzle-message-hidden');
}

function hideFizzleMessage() {
  if (!fizzleMessage) return;
  fizzleMessage.classList.add('fizzle-message-hidden');
}

// ── Post-flight summary ──────────────────────────────────────────────────────

/**
 * Show the post-flight summary panel with computed results.
 * @param {Object} data { range, maxHeight, flightTime, burnTime, dvTsiolkovsky, dvActual, burnoutSpeed? }
 *   burnoutSpeed is the speed at motor cut-off; omit it when the rocket never
 *   burnt out (dvActual is then used as the fallback).
 */
function showPostFlightSummary(data: PostFlightSummary) {
  if (!postFlightSummary) return;
  readPostRange.textContent = formatNumber(data.range, 1) + ' m';
  readPostFlightTime.textContent = formatNumber(data.flightTime, 1) + ' s';
  readPostBurnTime.textContent = data.burnTime !== null && Number.isFinite(data.burnTime) ? formatNumber(data.burnTime, 1) + ' s' : 'No burnout';
  var idealDv = data.dvTsiolkovsky;
  // A collision while powered is not burnout. Keep the missing measurement
  // missing instead of fabricating a zero-speed burnout from the impact state.
  var burnoutSpeed = data.burnoutSpeed !== undefined ? data.burnoutSpeed : data.dvActual;
  readPostDvTsiolkovsky.textContent = Number.isFinite(idealDv) ? formatNumber(idealDv, 0) + ' m/s' : '—';
  readPostDvActual.textContent = burnoutSpeed !== null && Number.isFinite(burnoutSpeed) ? formatNumber(burnoutSpeed, 0) + ' m/s' : 'No burnout';
  readPostGravityLoss.textContent = Number.isFinite(idealDv) && burnoutSpeed !== null && Number.isFinite(burnoutSpeed)
    ? formatNumber(idealDv - burnoutSpeed) + ' m/s'
    : '—';
  postFlightSummary.classList.remove('post-flight-hidden');
}

function hidePostFlightSummary() {
  if (!postFlightSummary) return;
  postFlightSummary.classList.add('post-flight-hidden');
}

// ── SI formatting helper ───────────────────────────────────────────────────

function formatSI(value: number) {
  if (value >= 1e6) return formatNumber(value / 1e6, 2) + ' M';
  if (value >= 1e3) return formatNumber(value / 1e3, 1) + ' k';
  return formatNumber(value, 1) + ' ';
}

// ── Get current cannon values ──────────────────────────────────────────────

function getValues() {
  return {
    angle: parseFloat(sliderAngle.value),
    mass: parseFloat(sliderMass.value),
    force: parseFloat(sliderForce.value) * Number(forceMultiplier.value),
    forceMultiplier: Number(forceMultiplier.value),
    barrelLength: parseFloat(sliderBarrel.value),
    gravity: currentGravity()
  };
}

// ── Update telemetry readouts ──────────────────────────────────────────────

function updateReadouts(state: Pick<ProjectileState, 'x' | 'y' | 'vx' | 'vy'> | null, energy: ReturnType<typeof Physics.computeEnergy> | null, maxTME?: number) {
  if (!state) {
    readVelocity.textContent = '---';
    readHeight.textContent = '---';
    readDistance.textContent = '---';
    readKE.textContent = '---';
    readPE.textContent = '---';
    readTME.textContent = '---';
    energyBarKE.style.width = '0%';
    energyBarPE.style.width = '0%';
    return;
  }

  var spd = Physics.speed(state);
  readVelocity.textContent = formatNumber(spd, 1) + ' m/s';
  readHeight.textContent = formatNumber(Math.max(0, state.y), 1) + ' m';
  readDistance.textContent = formatNumber(state.x, 1) + ' m';

  if (energy) {
    readKE.textContent = formatNumber(energy.ke, 0) + ' J';
    readPE.textContent = formatNumber(energy.pe, 0) + ' J';
    readTME.textContent = formatNumber(energy.tme, 0) + ' J';

    // Energy bar: divide by launch TME so bar shows conservation visually
    var denom = (maxTME && maxTME > 0) ? maxTME : energy.tme;
    if (denom > 0) {
      var kePct = Math.min(100, (energy.ke / denom) * 100);
      var pePct = Math.min(100, (energy.pe / denom) * 100);
      energyBarKE.style.width = kePct + '%';
      energyBarPE.style.width = pePct + '%';
    }
  }
}

function resetReadouts() {
  updateReadouts(null, null);
}

// ── Flight active state ────────────────────────────────────────────────────

function setFlightActive(active: boolean) {
  if (isFlightActive === active) return;
  isFlightActive = active;
  if (active && requiredElement('rocket-guidance-panel', 'section')?.classList.contains('orbit-example-loaded')) {
    requiredElement('orbit-example-note', 'p').textContent = 'Earth orbit example loaded. Orbit assist steers the rocket and stops the engine when the orbit is reached.';
  }
  // The :disabled pseudo-class carries the styling; no extra class is needed.
  btnFire.disabled = active;
  if (btnLaunch) btnLaunch.disabled = active;
  // Disable/enable mode toggle during flight
  for (var i = 0; i < modeButtons.length; i++) {
    modeButtons[i].disabled = active;
  }
  // A recorded flight has one immutable setup. Changing gravity or engine
  // controls beneath it would make the labels disagree with the animation.
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
    '.controls-scroll input, .controls-scroll select, .planet-btn, #btn-orbit-example, #btn-steering-practice, .steering-adjust button'
  ).forEach(function (control) { control.disabled = active; });
  if (sliderRocketAngle) sliderRocketAngle.disabled = active || rocketGuidanceSelect.value === 'orbit_assist';
  requiredElement('number-rocket-angle', 'input').disabled = sliderRocketAngle.disabled;
  var note = requiredElement('flight-lock-note', 'p');
  if (note) note.hidden = !active;
  if (active) hideTooltip();
}

// Restore labels as well as values when replaying a saved configuration.
// These setters notify the same environment/barrel/mode listeners as editing
// the controls. The main loop can suppress scene transitions during restore.
function restoreFlightConfig(mode: 'cannon' | 'rocket', config: LaunchSettings) {
  if (isFlightActive) return;
  setMode(mode);
  applyLaunchSettings(document, mode, mode === 'rocket' ? { cutoffTime: 0, ...config } : config);
  if (config.gravity !== undefined && Number.isFinite(config.gravity)) setGravity(config.gravity);
  if (mode === 'rocket') onPropellantChange();
  updateAllDisplays();
  updateGuidanceSubPanels();
  var gravity = currentGravity();
  highlightNearestPlanet(gravity);
  if (onGravityChange) onGravityChange(gravity);
  if (mode === 'cannon' && onBarrelChange) onBarrelChange(parseFloat(sliderBarrel.value));
  refreshPreLaunch();
}

function resetSettings(mode: 'cannon' | 'rocket') {
  // Cancel recording/playback and unlock first, just like the existing Reset.
  // Keep the selected world and the other launcher's experiment intact.
  if (mode === 'cannon') onClear?.(); else onRocketClear?.();
  applyLaunchSettings(document, mode, mode === 'cannon' ? CANNON_DEFAULTS : ROCKET_DEFAULTS);
  if (mode === 'rocket') onPropellantChange();
  updateAllDisplays(); updateGuidanceSubPanels(); refreshPreLaunch();
  if (mode === 'cannon') onBarrelChange?.(CANNON_DEFAULTS.barrelLength);
  hideTooltip();
}

function updateAllDisplays() {
  ([
    [sliderAngle, valAngle, '°'], [sliderMass, valMass, ' kg'], [sliderForce, valForce, ' N'],
    [sliderBarrel, valBarrel, ' m']
  ] satisfies [HTMLInputElement, HTMLElement, string][]).forEach(function ([slider, display, unit]) { updateSliderDisplay(slider, display, unit); });
  ([
    [sliderRocketMR, valRocketMR, ''], [sliderRocketPc, valRocketPc, ' bar'],
    [sliderRocketEps, valRocketEps, ''], [sliderRocketDt, valRocketDt, ' mm'],
    [sliderRocketDryMass, valRocketDryMass, ' kg'], [sliderRocketPropMass, valRocketPropMass, ' kg'],
    [sliderRocketAngle, valRocketAngle, '°'], [sliderRocketEtaC, valRocketEtaC, ''],
    [sliderRocketEtaN, valRocketEtaN, ''], [sliderPitchEnd, valPitchEnd, '°'],
    [sliderPitchT1, valPitchT1, ' s'], [sliderPitchT2, valPitchT2, ' s'],
    [sliderProgradeVmin, valProgradeVmin, ' m/s'], [sliderOrbitAltitude, valOrbitAltitude, ' km']
  ] satisfies [HTMLInputElement, HTMLElement, string][]).forEach(function ([slider, display, unit]) { updateRocketSliderDisplay(slider, display, unit); });
}


// ── Expose namespace ──────────────────────────────────────────────────────
export const UI = {
  init: init,
  getValues: getValues,
  restoreFlightConfig: restoreFlightConfig,
  getRocketValues: getRocketValues,
  getRocketZoomSettings: getRocketZoomSettings,
  updateReadouts: updateReadouts,
  updateRocketReadouts: updateRocketReadouts,
  updateRocketFuel: updateRocketFuel,
  resetRocketReadouts: resetRocketReadouts,
  showPostFlightSummary: showPostFlightSummary,
  hidePostFlightSummary: hidePostFlightSummary,
  showFizzleMessage: showFizzleMessage,
  hideFizzleMessage: hideFizzleMessage,
  refreshPreLaunch: refreshPreLaunch,
  resetReadouts: resetReadouts,
  setFlightActive: setFlightActive,
  highlightNearestPlanet: highlightNearestPlanet
};
