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
  if (run.mode !== 'rocket' || run.config.guidanceMode !== 'orbit_assist' || run.outcome !== 'impact') return null;
  const end = run.samples[run.samples.length - 1];
  const cause = end.mProp <= 1e-8 ? 'Fuel ran out before the path cleared the world.'
    : 'The rocket returned to the surface before reaching a safe orbit.';
  return `${cause} Highest altitude: ${formatNumber(run.maxHeight / 1000, 1)} km. Try the Earth orbit example in Guidance, or adjust the fuel and engine together: extra fuel also adds weight.`;
}
