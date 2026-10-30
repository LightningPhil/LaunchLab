import { classifyTrajectory } from './environment.ts';
import { formatNumber } from './number-format.ts';
import type { FlightRecord } from './flight.ts';

/** Describe the path a rocket would follow with its engine off. A trajectory
 * through the planet is a landing, not a reachable underground low point. */
export function orbitPathFeedback(state: any, gravity: number) {
  const path = classifyTrajectory({ ...state, engineOn: false }, gravity);
  const meetsSurface = path.periapsisAltitude !== null && path.periapsisAltitude <= 1;
  return {
    visible: state.planetRadius > 0 && state.launched !== false &&
      !['impact', 'no-liftoff'].includes(state.outcome),
    caption: state.engineOn ? 'If the engine stopped now' : path.kind === 'orbit' ? 'Orbit established · engine off' : 'Unpowered path',
    lowest: meetsSurface ? 'Meets the surface' : path.periapsisAltitude === null ? '—'
      : formatNumber(path.periapsisAltitude / 1000, 1) + ' km',
    highest: path.apoapsisAltitude === null ? 'Open path' : formatNumber(path.apoapsisAltitude / 1000, 1) + ' km',
    note: path.kind === 'escape' ? 'Heading away with enough energy to escape.'
      : meetsSurface ? state.engineOn ? 'More sideways speed is needed to miss the world.' : 'This path returns to the surface.'
      : 'The whole path clears the surface. Air drag is not modelled.',
  };
}

/** Advice follows the recorded outcome; never promise an orbit from fuel alone. */
export function orbitAttemptFeedback(run: FlightRecord): string | null {
  if (run.mode === 'rocket' && run.config.guidanceMode !== 'orbit_assist' && run.outcome === 'impact') return steeringAttemptFeedback(run);
  if (run.mode !== 'rocket' || run.config.guidanceMode !== 'orbit_assist' || run.outcome !== 'impact') return null;
  const end = run.samples[run.samples.length - 1];
  const cause = end.mProp <= 1e-8 ? 'Fuel ran out before the path cleared the world.'
    : 'The rocket returned to the surface before reaching a safe orbit.';
  return `${cause} Highest altitude: ${formatNumber(run.maxHeight / 1000, 1)} km. Use “Try an Earth orbit” in Rocket setup, or adjust the fuel and engine together: extra fuel also adds weight.`;
}

/** Debrief the actual attempt, not a prediction or a hidden steering change. */
export function steeringAttemptFeedback(run: FlightRecord): string | null {
  if (run.mode !== 'rocket' || run.config.guidanceMode === 'orbit_assist' ||
    (run.config.guidanceMode !== 'pitch_program' && run.config.guidanceMode !== 'prograde_lock' && !(run.config.cutoffTime! > 0))) return null;
  if (run.outcome === 'no-liftoff') return 'The upward thrust could not lift this rocket. Use a steeper launch angle, reduce mass or increase engine thrust before adjusting the turn.';
  const cutoff = run.samples.find(sample => sample.burnoutTime !== null && sample.burnoutTime !== undefined &&
    Math.abs(sample.time - sample.burnoutTime) < 1e-6);
  const measurements = cutoff ? `At engine cutoff: ${formatNumber(cutoff.y / 1000, 1)} km high, ${formatNumber(Math.abs(cutoff.vx))} m/s sideways and ${formatNumber(Math.abs(cutoff.vy))} m/s ${cutoff.vy >= 0 ? 'upward' : 'downward'}. ` : '';
  if (run.outcome === 'orbit' && run.orbit) {
    return measurements + `Your plan made an orbit: ${formatNumber(run.orbit.periapsisAltitude / 1000, 1)}–${formatNumber(run.orbit.apoapsisAltitude / 1000, 1)} km, with the engine off. Try changing cutoff by 0.5 s and compare the lowest and highest points. An oval orbit is a real success in this model.`;
  }
  if (run.outcome === 'escape') return measurements + 'The rocket gained enough energy to escape. For a closed orbit, try an earlier cutoff; adding more fuel or burning longer will not help.';
  if (run.outcome !== 'impact') return measurements + 'No orbit or landing was confirmed within this observation. Try a shorter burn and inspect the unpowered path.';
  let next: string;
  if (!cutoff) next = 'The rocket hit the surface while still burning. Try starting the turn later or finishing at a higher angle to stay clear of the ground.';
  else if (Math.abs(cutoff.vx) < Math.abs(cutoff.vy)) next = 'Most of the speed went into climbing or falling, rather than going around. Try turning earlier or finishing closer to 0° to build sideways speed.';
  else if (cutoff.vy < -100) next = 'The rocket was already falling at cutoff. Try turning later or pointing less far below the horizon.';
  else if (cutoff.cutoffReason === 'planned') next = 'The unpowered path still met the ground. Try stopping the engine 0.5 s later, then compare the lowest point. If extra burn only increases height, finish the turn closer to the horizon.';
  else next = 'Fuel ran out before the path cleared the ground. Try spending more of the burn near the horizon. If the rocket lacks the speed budget, load the Earth practice setup or adjust fuel and thrust together.';
  return measurements + `Highest altitude: ${formatNumber(run.maxHeight / 1000, 1)} km. ` + next;
}
