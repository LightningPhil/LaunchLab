import { Physics } from '../../src/physics.ts';
import { RocketPhysics } from '../../src/rocket_physics.ts';
import { ROCKET_DEFAULTS } from '../../src/launch-settings.ts';
import { recordFlight, type FlightRecord } from '../../src/flight.ts';
import { requiredElement } from '../../src/dom.ts';

/** Compiled by check, never executed. Each expected error must remain an error. */
export function verifyContracts(record: FlightRecord) {
  Physics.computeLaunchVelocity(500, 5, 2);
  // @ts-expect-error Physical quantities must be numbers.
  Physics.computeLaunchVelocity('500', 5, 2);
  RocketPhysics.createRocketState(ROCKET_DEFAULTS);
  // @ts-expect-error Guidance modes are a closed set.
  RocketPhysics.createRocketState({ ...ROCKET_DEFAULTS, guidanceMode: 'orbit-assit' });
  // @ts-expect-error A rocket configuration must include its engine and mass settings.
  void recordFlight('rocket', { gravity:9.81, planetRadius:6371000 }, Physics.createProjectile(0, 0, 10, 45, 5));
  if (record.mode === 'cannon') {
    void record.config.barrelLength;
    // @ts-expect-error A cannon record has no rocket propellant configuration.
    void record.config.propellantId;
  } else {
    void record.config.propellantId;
    // @ts-expect-error A rocket record has no cannon barrel configuration.
    void record.config.barrelLength;
  }
  requiredElement('slider-mass', 'input').value = '5';
  // @ts-expect-error Text elements do not expose an input value.
  requiredElement('environment-label', 'p').value = 'Earth';
}
