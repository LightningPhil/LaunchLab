import './gravity-turn-lab.css';
import {
  TURN_MAX_KICK,
  TURN_PITCH_TIME,
  TURN_PRESETS,
  gravityTurnFlight,
  interpolateTurnFrame,
  turnTelemetry,
  type TurnFlight,
  type TurnFrame,
  type TurnSettings,
} from './gravity-turn-model.ts';
import { drawTurnScene, type TurnView } from './gravity-turn-view.ts';
import { helpAttrs } from './science-help.ts';
import { number, output, rangeField } from './science-lab-ui.ts';

const END = 1000;
const CUTOFF_SINGLE = 520;
const CUTOFF_TWO = 380;
const KICK_START = 580;
const KICK_MID = 630;
const KICK_END = 680;
const DEFAULT = TURN_PRESETS[0];

const presetHelp: Record<string, string> = {
  'Elliptical orbit': 'A single 13° gravity-turn burn (0.56 units) with no second burn. It clears the planet, but forms an off-centre ellipse—planet at one focus, +2% R low on one side and +32% R high at apoapsis.',
  'Circularised': 'The exact same 13° ascent, plus a 0.015-unit second burn at apoapsis (the highest point). Adding sideways speed at the top lifts the opposite side so the orbit becomes centred on the planet.',
  'Transfer + kick': 'Classic two-burn orbital insertion: a gentler 9° turn climbs into a high suborbital transfer arc (+19% R) that would otherwise fall back, then circularises at apoapsis.',
  'Straight up': 'Zero pitch-over with the 0.56-unit burn. It climbs past +71% R, yet arrives at the top with zero sideways motion—so there is no horizontal path to circularise and it falls straight back.',
  'Short burn': 'A 13° pitch-over that shuts down early (0.45 units). Without a second burn its coast meets the surface; try clicking Match circular speed to rescue it near its peak.',
  'Hard turn': 'A steep 25° pitch-over. Gravity bends the flight below the horizon too early, steering the powered ascent back into the surface.',
};

export interface TurnSession {
  kind: 'gravity-turn';
  settings: TurnSettings;
  pinned?: TurnSettings;
  progress: number;
  view: TurnView;
}

function outcomeCopy(flight: TurnFlight): [string, string] {
  if (flight.outcome === 'orbit') {
    if (flight.circular) {
      return [
        'Circular orbit achieved',
        'The second burn at apoapsis raised the opposite side to match: the orbit now circles at nearly constant height around the planet’s centre.',
      ];
    }
    return [
      'Elliptical orbit achieved',
      'One burn from low altitude puts the planet at one focus of an off-centre ellipse. Fire a second burn at apoapsis (the highest point) to circularise it.',
    ];
  }
  if (flight.outcome === 'escape') {
    return ['Escapes the planet', 'Total orbital energy is non-negative: the coast leads outward without returning.'];
  }
  if (flight.outcome === 'powered-impact') {
    return ['Hits during the burn', 'Pitching too steeply bends the flight into the ground while the engine is still firing.'];
  }
  return [
    'Falls back to surface',
    flight.circulariseBurn !== null
      ? 'This transfer ellipse dips back into the planet—but it reaches a clean apoapsis first. Add a second burn at apoapsis to lift the low side into orbit.'
      : 'The coast meets the surface before completing an orbit, with no horizontal apoapsis available to circularise.',
  ];
}

function describeSettings(s: TurnSettings, f: TurnFlight): string {
  const kick = s.kickBurn ?? 0;
  const kickText = kick > 1e-5 ? ` + ${number(kick, 3)} apoapsis burn` : ', no 2nd burn';
  return `${s.pitch}° pitch, ${number(s.burn, 2)} burn${kickText} (${outcomeCopy(f)[0].toLowerCase()})`;
}

function findTimeFraction(frames: TurnFrame[], targetTime: number): number {
  if (frames.length < 2) return 0;
  const start = frames[0].time;
  const end = frames[frames.length - 1].time;
  if (targetTime <= start) return 0;
  if (targetTime >= end) return 1;
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].time <= targetTime) lo = mid;
    else hi = mid;
  }
  const span = frames[hi].time - frames[lo].time;
  const sub = span > 0 ? (targetTime - frames[lo].time) / span : 0;
  return (lo + sub) / (frames.length - 1);
}

function sampleSegment(frames: TurnFrame[], fraction: number): TurnFrame {
  const clamped = Math.max(0, Math.min(1, fraction));
  const index = clamped * (frames.length - 1);
  const previous = Math.floor(index);
  return interpolateTurnFrame(
    frames[previous],
    frames[Math.min(previous + 1, frames.length - 1)],
    index - previous,
  );
}

export function gravityTurnLabMarkup() {
  return `<section class="science-lab turn-lab" aria-labelledby="turn-lab-title">
    <header class="science-lab-head turn-head">
      <div>
        <p class="atlas-kicker">GRAVITY TURN &amp; APOAPSIS KICK</p>
        <h2 id="turn-lab-title">From an off-centre ellipse to a circular orbit</h2>
      </div>
      <span class="science-lab-badge">Ascent &amp; circularisation lab</span>
    </header>
    <div class="turn-workbench">
      <figure class="turn-figure">
        <div class="turn-stage-frame">
          <div class="turn-stage-bar">
            <span class="turn-phase-pill" data-turn-phase>On the pad</span>
            <div class="turn-switch" role="group" aria-label="Flight view">
              <button type="button" data-turn-view="ascent" aria-pressed="true" ${helpAttrs('Ascent close-up', 'Zoom into the launch pad and curved horizon to watch the pitch-over, local horizon line, and velocity vs gravity vectors. Includes a live whole-planet preview in the corner.')}>Ascent</button>
              <button type="button" data-turn-view="orbit" aria-pressed="false" ${helpAttrs('Whole-planet view', 'Step back to see the planet’s centre (+), the focus-offset ellipse, the second burn at apoapsis, and whether the final orbit is centred.')}>Whole planet</button>
            </div>
          </div>
          <canvas width="680" height="382" role="img" aria-label="Interactive gravity turn ascent, elliptical coast, and apoapsis circularisation canvas"></canvas>
        </div>
        <figcaption class="turn-legend">
          <span><i class="turn-key turn-key-burn"></i> 1st burn</span>
          <span hidden data-turn-kick-key><i class="turn-key turn-key-kick"></i> 2nd burn (apoapsis)</span>
          <span data-turn-coast-key><i class="turn-key turn-key-coast"></i> Elliptical coast</span>
          <span hidden data-turn-circular-key><i class="turn-key turn-key-circular"></i> Circular orbit</span>
          <span hidden data-turn-ghost-key><i class="turn-key turn-key-ghost"></i> Without 2nd burn</span>
          <span data-turn-ref-key><i class="turn-key turn-key-reference"></i> Same burn, straight up</span>
          <span hidden data-turn-pinned-key><i class="turn-key turn-key-pinned"></i> Pinned comparison</span>
          <span><i class="turn-key turn-key-velocity"></i> Velocity (<i>v</i>)</span>
          <span><i class="turn-key turn-key-gravity"></i> Gravity (<i>g</i>)</span>
        </figcaption>
      </figure>
      <div class="science-controls turn-controls">
        <fieldset class="turn-preset-group">
          <legend>Choose a flight</legend>
          <div class="turn-presets">${TURN_PRESETS.map((preset, i) => `<button type="button" data-turn-preset="${i}" aria-pressed="${i === 0}" ${helpAttrs(preset.name, presetHelp[preset.name] ?? '')}>${preset.name}</button>`).join('')}</div>
        </fieldset>
        ${rangeField('turn-pitch', 'Pitch-over from vertical', 0, 25, 1, DEFAULT.pitch)}
        ${rangeField('turn-burn', 'First burn cutoff', 0.4, 0.6, 0.005, DEFAULT.burn)}
        ${rangeField('turn-kick', 'Second burn at apoapsis', 0, TURN_MAX_KICK, 0.0001, DEFAULT.kickBurn)}
        <div class="turn-kick-presets" role="group" aria-label="Second burn shortcuts">
          <button type="button" data-turn-no-kick ${helpAttrs('Single burn only', 'Set the second burn to zero so the rocket coasts purely on the ellipse created by the first burn.')}>No 2nd burn</button>
          <button type="button" data-turn-circularise ${helpAttrs('Match circular speed at apoapsis', 'Calculate the exact prograde burn duration at the highest point (apoapsis) needed to bring sideways speed to 100% of local circular speed—centring the orbit around the planet.')}>Match circular speed</button>
        </div>
        <div class="science-actions turn-actions">
          <button type="button" data-pin>Pin comparison</button>
          <button type="button" data-reset>Reset</button>
        </div>
        <p class="science-comparison turn-comparison" data-comparison role="status">Pin a flight, then add a second burn at apoapsis to compare ellipse vs circle.</p>
      </div>
    </div>
    <div class="turn-transport">
      <button type="button" class="science-primary turn-play" data-turn-play ${helpAttrs('Launch or pause', 'Fly the gravity-turn ascent, pull back to whole-planet view to coast up to apoapsis, and watch the second burn circularise the orbit.')}>Launch</button>
      <div class="turn-timeline">
        <div class="turn-timeline-label">
          <label for="turn-timeline">Flight timeline</label>
          <output for="turn-timeline" data-turn-time>0.000 time units</output>
        </div>
        <input id="turn-timeline" type="range" min="0" max="${END}" step="1" value="0" aria-label="Scrub along the powered ascent, apoapsis burn, and orbital coast">
        <div class="turn-checkpoints" role="group" aria-label="Jump to a flight phase">
          <button type="button" data-turn-jump="pad" ${helpAttrs('On the pad', 'Rewind to liftoff at time zero.')}>Pad</button>
          <button type="button" data-turn-jump="pitch" ${helpAttrs('Pitch-over', 'Jump to t = 0.08, where the rocket tips slightly away from vertical to start the gravity turn.')}>Pitch-over</button>
          <button type="button" data-turn-jump="cutoff" ${helpAttrs('First engine cutoff', 'Inspect height, sideways speed, and flight-path angle at the end of the ascent burn.')}>1st cutoff</button>
          <button type="button" data-turn-jump="apoapsis" ${helpAttrs('Highest point (apoapsis)', 'Jump to apoapsis—where flight-path angle passes through 0° (horizontal) and a second burn raises the opposite side of the orbit.')}>Apoapsis</button>
          <button type="button" data-turn-jump="end" ${helpAttrs('End of coast', 'Jump to one complete orbit—or where a returning coast meets the surface.')}>Coast end</button>
        </div>
      </div>
    </div>
    <dl class="turn-metrics" aria-label="Telemetry at the selected point">
      <div tabindex="0" ${helpAttrs('Height above surface', 'Instantaneous altitude above the surface as a percentage of planetary radius R. On an ellipse this rises and falls; on a circularised orbit it stays nearly constant.')}>
        <dt>Height <small>% of planet radius</small></dt>
        <dd data-turn-height>0%</dd>
      </div>
      <div tabindex="0" ${helpAttrs('Sideways speed', 'Horizontal velocity divided by local circular speed √(μ/r). At apoapsis of an ellipse this is below 100%; firing the second burn brings it to 100% so the rocket stays at that height.')}>
        <dt>Sideways speed <small>% of circular speed</small></dt>
        <dd data-turn-speed>0%</dd>
      </div>
      <div tabindex="0" ${helpAttrs('Flight-path angle', 'Angle of velocity relative to the local horizon. It passes through 0° at apoapsis and stays near 0° all the way around a circular orbit.')}>
        <dt>Flight-path angle <small>From local horizon</small></dt>
        <dd data-turn-angle>—</dd>
      </div>
      <div tabindex="0" ${helpAttrs('Lowest vs highest coast altitude', 'Compares periapsis (lowest point) and apoapsis (highest point) of the final coast. When both match, the orbit is circular and centred on the planet.')}>
        <dt>Orbit low · high <small data-turn-shape-note>Periapsis vs apoapsis</small></dt>
        <dd data-turn-apsides>—</dd>
      </div>
    </dl>
    <div class="turn-outcome" role="status">
      <span aria-hidden="true" class="turn-outcome-icon" data-turn-icon>◎</span>
      <div><strong data-turn-result></strong><p data-turn-detail></p></div>
    </div>
    <p class="science-challenge turn-challenge"><strong>Try this:</strong> Select <b>Elliptical orbit</b> and click <b>Whole planet</b>—notice how the planet’s centre (<b>+</b>) sits at one focus, with a low periapsis and high apoapsis. Now click <b>Match circular speed</b> (or <b>Circularised</b>) to fire a second burn at the highest point, then try <b>Transfer + kick</b> to circularise a suborbital climb.</p>
    <details class="science-model-note turn-model-note">
      <summary>What does this experiment assume?</summary>
      <p>A rocket over a non-rotating, airless spherical planet (radius <i>R</i> = 1 and surface gravity <i>g</i><sub>0</sub> = 1 in model units), with constant thrust and constant mass flow during burns. At <i>t</i> = 0.08 the velocity tilts by the pitch-over angle; afterwards thrust aligns with velocity while gravity bends the path. Coast segments follow exact two-body Keplerian motion. When a second burn is added, it straddles the coast’s apoapsis (highest point) along the prograde velocity vector, raising periapsis on the opposite side of the planet.</p>
    </details>
  </section>`;
}

export function mountGravityTurnLab(root: HTMLElement, saved?: TurnSession) {
  const query = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const canvas = query<HTMLCanvasElement>('canvas');
  const pitch = query<HTMLInputElement>('#turn-pitch');
  const burn = query<HTMLInputElement>('#turn-burn');
  const kick = query<HTMLInputElement>('#turn-kick');
  const noKickButton = query<HTMLButtonElement>('[data-turn-no-kick]');
  const circulariseButton = query<HTMLButtonElement>('[data-turn-circularise]');
  const timeline = query<HTMLInputElement>('#turn-timeline');
  const play = query<HTMLButtonElement>('[data-turn-play]');
  const pinButton = query<HTMLButtonElement>('[data-pin]');
  const resetButton = query<HTMLButtonElement>('[data-reset]');
  const comparisonLabel = query('[data-comparison]');
  const kickLegend = query('[data-turn-kick-key]');
  const coastLegend = query('[data-turn-coast-key]');
  const circularLegend = query('[data-turn-circular-key]');
  const ghostLegend = query('[data-turn-ghost-key]');
  const refLegend = query('[data-turn-ref-key]');
  const pinnedLegend = query('[data-turn-pinned-key]');
  const presets = [...root.querySelectorAll<HTMLButtonElement>('[data-turn-preset]')];
  const views = [...root.querySelectorAll<HTMLButtonElement>('[data-turn-view]')];
  const jumps = [...root.querySelectorAll<HTMLButtonElement>('[data-turn-jump]')];
  const cutoffButton = query<HTMLButtonElement>('[data-turn-jump="cutoff"]');
  const apoapsisButton = query<HTMLButtonElement>('[data-turn-jump="apoapsis"]');
  const endButton = query<HTMLButtonElement>('[data-turn-jump="end"]');
  const phaseLabel = query('[data-turn-phase]');
  const timeLabel = query('[data-turn-time]');
  const heightLabel = query('[data-turn-height]');
  const speedLabel = query('[data-turn-speed]');
  const angleLabel = query('[data-turn-angle]');
  const apsidesLabel = query('[data-turn-apsides]');
  const shapeNote = query('[data-turn-shape-note]');
  const result = query('[data-turn-result]');
  const detail = query('[data-turn-detail]');
  const icon = query('[data-turn-icon]');
  const outcome = query('.turn-outcome');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  const { signal } = listeners;

  let settings: TurnSettings = saved?.settings
    ? { pitch: saved.settings.pitch, burn: saved.settings.burn, kickBurn: saved.settings.kickBurn ?? 0 }
    : { pitch: DEFAULT.pitch, burn: DEFAULT.burn, kickBurn: DEFAULT.kickBurn };
  let pinned: TurnSettings | undefined = saved?.pinned ? { ...saved.pinned } : undefined;
  let pinnedFlight: TurnFlight | undefined = pinned ? gravityTurnFlight(pinned) : undefined;
  let view: TurnView = saved?.view ?? 'ascent';
  let progress = saved?.progress ?? 0;
  let flight = gravityTurnFlight(settings);
  let reference = straightReference();
  let animation: number | undefined;
  let lastTime = 0;

  function straightReference() {
    return settings.pitch === 0 ? [] : gravityTurnFlight({ pitch: 0, burn: settings.burn, kickBurn: 0 }).ascent;
  }

  const hasSecondBurn = () => flight.kickArc.length > 1;
  const hasAnyCoast = () => flight.coast.length > 0 || flight.transfer.length > 0;

  function cutoffPoint(): number {
    if (!hasAnyCoast()) return END;
    return hasSecondBurn() ? CUTOFF_TWO : CUTOFF_SINGLE;
  }

  function pitchPoint(): number {
    return (TURN_PITCH_TIME / flight.cutoff.time) * cutoffPoint();
  }

  function apoapsisPointOnTimeline(): number | null {
    if (hasSecondBurn()) return KICK_MID;
    if (!flight.apoapsisPoint || flight.coast.length < 2) return null;
    const frac = findTimeFraction(flight.coast, flight.apoapsisPoint.time);
    return Math.round(CUTOFF_SINGLE + frac * (END - CUTOFF_SINGLE));
  }

  function apsidesSummary(): { value: string; note: string } {
    if (flight.outcome === 'powered-impact') {
      return { value: 'Hits in burn', note: 'No free coast' };
    }
    if (flight.outcome === 'escape') {
      return { value: 'Unbound (∞)', note: 'Escapes gravity' };
    }
    if (flight.outcome === 'orbit' && flight.periapsis !== null && flight.apoapsis !== null) {
      const low = `+${number(Math.max(0, flight.periapsis) * 100)}%`;
      const high = `+${number(Math.max(0, flight.apoapsis) * 100)}%`;
      const ecc = flight.eccentricity !== null ? number(flight.eccentricity, 3) : '0';
      return {
        value: `${low} · ${high}`,
        note: flight.circular ? `Circular (e = ${ecc})` : `Ellipse (e = ${ecc})`,
      };
    }
    const high = flight.apoapsis !== null ? `+${number(Math.max(0, flight.apoapsis) * 100)}%` : '0%';
    return { value: `Surface · ${high}`, note: 'Suborbital peak' };
  }

  function outcomeGlyph(): string {
    if (flight.outcome === 'orbit') return flight.circular ? '◯' : '⬭';
    if (flight.outcome === 'escape') return '↗';
    if (flight.outcome === 'powered-impact') return '✕';
    return '↶';
  }

  function evaluateTimelineState(p: number): {
    frame: TurnFrame;
    powered: boolean;
    secondBurnActive: boolean;
    phase: string;
  } {
    const cut = cutoffPoint();
    if (p <= 0) {
      return { frame: flight.ascent[0], powered: false, secondBurnActive: false, phase: 'On the pad' };
    }
    if (!hasAnyCoast()) {
      const frame = sampleSegment(flight.ascent, p / END);
      const phase = p >= END ? outcomeCopy(flight)[0] : settings.pitch && p >= pitchPoint() - 0.5 ? 'Powered gravity turn' : 'Vertical ascent';
      return { frame, powered: p < END, secondBurnActive: false, phase };
    }
    if (p < cut) {
      const frame = sampleSegment(flight.ascent, p / cut);
      const phase = settings.pitch && p >= pitchPoint() - 0.5 ? '1st burn · Gravity turn' : '1st burn · Vertical ascent';
      return { frame, powered: true, secondBurnActive: false, phase };
    }
    if (!hasSecondBurn()) {
      const frame = sampleSegment(flight.coast, (p - cut) / (END - cut));
      const phase = p >= END
        ? (flight.outcome === 'orbit' ? 'One elliptical orbit' : outcomeCopy(flight)[0])
        : 'Engine off · Elliptical coast';
      return { frame, powered: false, secondBurnActive: false, phase };
    }
    if (p < KICK_START) {
      const frame = sampleSegment(flight.transfer, (p - cut) / (KICK_START - cut));
      return { frame, powered: false, secondBurnActive: false, phase: 'Coasting up to apoapsis' };
    }
    const kickEnd = flight.coast.length > 0 ? KICK_END : END;
    if (p < kickEnd) {
      const frame = sampleSegment(flight.kickArc, (p - KICK_START) / (kickEnd - KICK_START));
      return { frame, powered: true, secondBurnActive: true, phase: '2nd burn · Circularising at apoapsis' };
    }
    if (flight.coast.length === 0) {
      return {
        frame: flight.kickArc[flight.kickArc.length - 1],
        powered: false,
        secondBurnActive: false,
        phase: outcomeCopy(flight)[0],
      };
    }
    const frame = sampleSegment(flight.coast, (p - KICK_END) / (END - KICK_END));
    const phase = p >= END
      ? (flight.circular ? 'One circular orbit complete' : flight.outcome === 'orbit' ? 'One orbit complete' : outcomeCopy(flight)[0])
      : flight.circular ? 'Engine off · Circular orbit' : 'Engine off · Post-burn coast';
    return { frame, powered: false, secondBurnActive: false, phase };
  }

  function draw() {
    const { frame, powered, secondBurnActive, phase } = evaluateTimelineState(progress);
    const { altitude, sidewaysRatio, angle } = turnTelemetry(frame);
    const direction =
      angle === null ? '—'
      : Math.abs(angle) < 0.05 ? '0° (level)'
      : `${number(Math.abs(angle))}° ${angle < 0 ? 'below' : 'above'}`;
    const summary = apsidesSummary();

    phaseLabel.textContent = phase;
    timeLabel.textContent = `${number(frame.time, 3)} time units`;
    heightLabel.textContent = `${number(Math.max(0, altitude) * 100)}%`;
    speedLabel.textContent = `${number(Math.max(0, sidewaysRatio) * 100)}%`;
    angleLabel.textContent = direction;
    apsidesLabel.textContent = summary.value;
    shapeNote.textContent = summary.note;

    timeline.value = String(Math.round(progress));
    timeline.setAttribute('aria-valuetext', `${phase}, ${timeLabel.textContent}`);
    timeline.style.setProperty('--turn-progress', `${(progress / END) * 100}%`);

    kickLegend.hidden = !hasSecondBurn();
    circularLegend.hidden = !flight.circular;
    coastLegend.hidden = flight.circular && !hasSecondBurn();
    ghostLegend.hidden = flight.unburnedCoast.length === 0;
    refLegend.hidden = view !== 'ascent' || reference.length === 0;
    pinnedLegend.hidden = !pinnedFlight;

    const pPt = Math.round(pitchPoint());
    const cPt = cutoffPoint();
    const aPt = apoapsisPointOnTimeline();
    for (const btn of jumps) {
      const target =
        btn.dataset.turnJump === 'pad' ? 0
        : btn.dataset.turnJump === 'pitch' ? pPt
        : btn.dataset.turnJump === 'cutoff' ? cPt
        : btn.dataset.turnJump === 'apoapsis' ? (aPt ?? -999)
        : END;
      btn.classList.toggle('is-current', Math.abs(Math.round(progress) - target) <= 4);
    }

    drawTurnScene(canvas, {
      view,
      flight,
      reference,
      pinned: pinnedFlight,
      frame,
      powered,
      secondBurnActive,
    });
  }

  function playbackLabel() {
    if (motion.matches) play.textContent = progress === END ? 'Back to pad' : 'Next phase';
    else if (animation !== undefined) play.textContent = 'Pause';
    else play.textContent = progress === 0 ? 'Launch' : progress === END ? 'Replay' : 'Resume';
    play.dataset.helpSuppressed = String(animation !== undefined);
  }

  function setView(next: TurnView) {
    view = next;
    for (const button of views) button.setAttribute('aria-pressed', String(button.dataset.turnView === view));
  }

  function stop() {
    if (animation !== undefined) cancelAnimationFrame(animation);
    animation = undefined;
    playbackLabel();
  }

  function refreshComparison() {
    comparisonLabel.textContent =
      pinned && pinnedFlight
        ? `Pinned: ${describeSettings(pinned, pinnedFlight)}.`
        : 'Pin a flight, then add a second burn at apoapsis to compare ellipse vs circle.';
  }

  function refreshSettings() {
    const kickVal = settings.kickBurn ?? 0;
    pitch.value = String(settings.pitch);
    burn.value = String(settings.burn);
    kick.value = String(kickVal);
    output(root, 'turn-pitch', `${settings.pitch}°`);
    output(root, 'turn-burn', `${number(settings.burn, 3)} time units`);
    output(root, 'turn-kick', kickVal <= 1e-5 ? 'Off (0)' : `${number(kickVal, 3)} time units`);

    noKickButton.setAttribute('aria-pressed', String(kickVal <= 1e-5));
    const canCircularise = flight.circulariseBurn !== null && flight.circulariseBurn > 0;
    circulariseButton.disabled = !canCircularise;
    circulariseButton.setAttribute(
      'aria-pressed',
      String(canCircularise && Math.abs(kickVal - flight.circulariseBurn!) < 4e-4),
    );

    for (const [i, button] of presets.entries()) {
      const preset = TURN_PRESETS[i];
      const matches =
        settings.pitch === preset.pitch &&
        Math.abs(settings.burn - preset.burn) < 1e-4 &&
        Math.abs(kickVal - preset.kickBurn) < 4e-4;
      button.setAttribute('aria-pressed', String(matches));
    }

    const apoPt = apoapsisPointOnTimeline();
    apoapsisButton.hidden = apoPt === null;
    apoapsisButton.textContent = hasSecondBurn() ? '2nd burn' : 'Apoapsis';
    endButton.hidden = !hasAnyCoast();
    cutoffButton.textContent = !hasAnyCoast() ? 'Contact' : hasSecondBurn() ? '1st cutoff' : 'Cutoff';

    const [title, explanation] = outcomeCopy(flight);
    icon.textContent = outcomeGlyph();
    result.textContent = `Forecast · ${title}`;
    detail.textContent = explanation;
    outcome.dataset.outcome = flight.circular ? 'circular' : flight.outcome;
    refreshComparison();
    setView(view);
    playbackLabel();
    draw();
  }

  function configure(next: TurnSettings, options?: { view?: TurnView; progress?: number }) {
    stop();
    settings = { pitch: next.pitch, burn: next.burn, kickBurn: next.kickBurn ?? 0 };
    flight = gravityTurnFlight(settings);
    reference = straightReference();
    view = options?.view ?? 'ascent';
    progress = options?.progress ?? 0;
    refreshSettings();
  }

  function configureKick(nextKick: number) {
    stop();
    settings = { ...settings, kickBurn: Math.max(0, Math.min(TURN_MAX_KICK, nextKick)) };
    flight = gravityTurnFlight(settings);
    reference = straightReference();
    view = 'orbit';
    progress = END;
    refreshSettings();
  }

  function seek(point: number, nextView?: TurnView) {
    stop();
    progress = point;
    if (nextView) setView(nextView);
    playbackLabel();
    draw();
  }

  function tick(now: number) {
    const before = progress;
    const cut = cutoffPoint();
    progress = Math.min(END, progress + Math.min(now - lastTime, 50) / 8.2);
    lastTime = now;
    if (hasAnyCoast() && before < cut && progress >= cut) setView('orbit');
    draw();
    if (progress === END) stop();
    else animation = requestAnimationFrame(tick);
  }

  play.addEventListener('click', () => {
    if (motion.matches) {
      const pPt = Math.round(pitchPoint());
      const cPt = cutoffPoint();
      const aPt = apoapsisPointOnTimeline();
      if (progress === END) seek(0, 'ascent');
      else if (progress < pPt) seek(pPt, 'ascent');
      else if (progress < cPt) seek(cPt, 'ascent');
      else if (aPt !== null && progress < aPt) seek(aPt, 'orbit');
      else seek(END, 'orbit');
      return;
    }
    if (animation !== undefined) { stop(); return; }
    if (progress === END) seek(0, 'ascent');
    lastTime = performance.now();
    animation = requestAnimationFrame(tick);
    playbackLabel();
  }, { signal });

  pinButton.addEventListener('click', () => {
    pinned = { ...settings };
    pinnedFlight = gravityTurnFlight(pinned);
    refreshComparison();
    draw();
  }, { signal });

  resetButton.addEventListener('click', () => {
    pinned = undefined;
    pinnedFlight = undefined;
    configure({ pitch: DEFAULT.pitch, burn: DEFAULT.burn, kickBurn: DEFAULT.kickBurn });
  }, { signal });

  noKickButton.addEventListener('click', () => configureKick(0), { signal });
  circulariseButton.addEventListener('click', () => {
    if (flight.circulariseBurn !== null) configureKick(flight.circulariseBurn);
  }, { signal });

  for (const [i, button] of presets.entries()) {
    button.addEventListener('click', () => {
      const preset = TURN_PRESETS[i];
      configure(
        { pitch: preset.pitch, burn: preset.burn, kickBurn: preset.kickBurn },
        preset.kickBurn > 0 ? { view: 'orbit', progress: END } : { view: 'ascent', progress: 0 },
      );
    }, { signal });
  }
  for (const button of views) {
    button.addEventListener('click', () => {
      setView(button.dataset.turnView === 'orbit' ? 'orbit' : 'ascent');
      draw();
    }, { signal });
  }
  for (const button of jumps) {
    button.addEventListener('click', () => {
      const aPt = apoapsisPointOnTimeline();
      switch (button.dataset.turnJump) {
        case 'pad': seek(0, 'ascent'); break;
        case 'pitch': seek(Math.round(pitchPoint()), 'ascent'); break;
        case 'cutoff': seek(cutoffPoint(), 'ascent'); break;
        case 'apoapsis': if (aPt !== null) seek(aPt, 'orbit'); break;
        case 'end': seek(END, 'orbit'); break;
      }
    }, { signal });
  }
  for (const input of [pitch, burn]) {
    input.addEventListener('input', () => {
      configure({ pitch: pitch.valueAsNumber, burn: burn.valueAsNumber, kickBurn: settings.kickBurn ?? 0 });
    }, { signal });
  }
  kick.addEventListener('input', () => configureKick(kick.valueAsNumber), { signal });
  timeline.addEventListener('input', () => seek(timeline.valueAsNumber), { signal });
  motion.addEventListener('change', stop, { signal });
  const resize = new ResizeObserver(draw);
  resize.observe(canvas);
  refreshSettings();

  return {
    dispose(): TurnSession {
      stop();
      resize.disconnect();
      listeners.abort();
      return { kind: 'gravity-turn', settings, pinned, progress, view };
    },
  };
}
