import { Physics } from '../../src/physics.ts';
import { RocketPhysics } from '../../src/rocket_physics.ts';
import { ROCKET_DEFAULTS } from '../../src/launch-settings.ts';
import { recordFlight, sampleFlight, type FlightRecord } from '../../src/flight.ts';
import { planBallisticCoast, sampleBallisticCoast } from '../../src/ballistic-coast.ts';
import { planOrbitalCoast, sampleOrbitalCoast } from '../../src/orbital-coast.ts';
import { requiredElement } from '../../src/dom.ts';

/** Compiled by check, never executed. Each expected error must remain an error. */
export function verifyContracts(record: FlightRecord) {
  Physics.computeLaunchVelocity(500, 5, 2);
  // @ts-expect-error Physical quantities must be numbers.
  Physics.computeLaunchVelocity('500', 5, 2);
  const projectile = Physics.createProjectile(0, 0, 10, 45, 5, 6371000);
  const rocket = RocketPhysics.createRocketState({ ...ROCKET_DEFAULTS, planetRadius: 6371000 });
  // @ts-expect-error Guidance modes are a closed set.
  RocketPhysics.createRocketState({ ...ROCKET_DEFAULTS, guidanceMode: 'orbit-assit' });
  // @ts-expect-error A rocket configuration must include its engine and mass settings.
  void recordFlight('rocket', { gravity:9.81, planetRadius:6371000 }, projectile);
  if (record.mode === 'cannon') {
    void record.config.barrelLength;
    // @ts-expect-error A cannon record has no rocket propellant configuration.
    void record.config.propellantId;
    const sample = sampleFlight(record, 0);
    void sample.mass;
    // @ts-expect-error Cannon samples do not carry rocket propellant state.
    void sample.mProp;
    // @ts-expect-error Cannon sample arrays narrow to ProjectileState[].
    void record.samples[0].mProp;
  } else {
    void record.config.propellantId;
    // @ts-expect-error A rocket record has no cannon barrel configuration.
    void record.config.barrelLength;
    const sample = sampleFlight(record, 0);
    void sample.mProp;
    void record.samples[0].thrustMagnitude;
  }
  const ballistic = planBallisticCoast(projectile, 9.81);
  if (ballistic) {
    const coastSample = sampleBallisticCoast(ballistic, 1);
    void coastSample.mass;
    // @ts-expect-error Ballistic coast preserves the ProjectileState sample type.
    void coastSample.mProp;
  }
  const orbital = planOrbitalCoast(rocket, 9.81);
  if (orbital) {
    const orbitSample = sampleOrbitalCoast(orbital, 1);
    void orbitSample.mProp;
  }
  requiredElement('slider-mass', 'input').value = '5';
  // @ts-expect-error Text elements do not expose an input value.
  requiredElement('environment-label', 'p').value = 'Earth';
}
