import type { Article } from './content.ts';

export const GRAVITY_TURN_ARTICLE: Article = {
  id: 'gravity-turn',
  title: 'The gravity turn',
  group: 'The science of flight',
  kind: 'Launch / gravity / orbit',
  lab: 'gravity-turn',
  description: 'Rise from the pad, tip into the turn, coast to the highest point and fire a second burn to centre a circular orbit.',
  stats: [
    ['What starts the turn?', 'A pitch-over'],
    ['Shape after one burn', 'An off-centre ellipse'],
    ['How to make it circular', 'A second burn at apoapsis'],
  ],
  levels: [
    {
      heading: 'Climb, turn, then kick at the top.',
      paragraphs: [
        'Imagine throwing a ball from a high tower. It moves forward while gravity pulls it down. If you throw it fast enough above the air, the curved ground keeps dropping away beneath it. The ball keeps falling around the planet. That is an orbit.',
        'A rocket begins by climbing clear of the pad, then tips slightly to one side in a move called pitch-over. As it points along its direction of travel, gravity gently bends the climb towards the horizon while the engine builds sideways speed.',
        'Notice what happens after a single ascent burn in Elliptical orbit: the loop clears the planet, yet it is noticeably off-centre—skimming low near launch and swinging much higher on the far side. Gravity puts the planet’s centre at one focus of an ellipse, not in the middle. Firing a brief second burn right at the highest point (apoapsis) speeds the rocket up so the low side rises to match, turning the ellipse into a circle centred on the planet.',
      ],
      takeaway: 'The gravity turn builds height and sideways speed; a second burn at the highest point turns the off-centre ellipse into a circular orbit.',
    },
    {
      heading: 'Why one burn makes an ellipse—and two make a circle.',
      paragraphs: [
        'In an ideal gravity turn, thrust points along the velocity vector after pitch-over. Gravity slows the upward climb and curves the flight path towards the local horizon. Compare Straight up with Elliptical orbit: without pitch-over, the rocket climbs much higher during the burn yet reaches the top with zero sideways motion, so it falls straight back.',
        'Even a well-judged single burn finishes relatively close to the planet. Any closed two-body path must return through the state where the engine shut off, and by Kepler’s first law the planet’s centre sits at one focus of the ellipse. If the rocket is moving slightly faster than circular speed near cutoff (as in Elliptical orbit), it swings out to a high apoapsis on the opposite side before dipping back down. If cutoff happens earlier (as in Transfer + kick without its second burn), the rocket coasts up to a high apoapsis on a suborbital ellipse whose opposite side still intersects the surface.',
        'At apoapsis, radial motion drops to zero: the rocket is momentarily travelling parallel to the horizon beneath it, but slower than local circular speed at that height. Igniting the engine again along the velocity at apoapsis adds sideways speed where the rocket is highest. That raises periapsis on the opposite side of the world until both heights match in a centred circular orbit.',
        'Real orbital launchers—whether multistage vehicles or single-stage-to-orbit (SSTO) concepts—routinely divide ascent this way: a gravity-turn first burn into an elliptical transfer coast, followed by a circularisation burn at apoapsis.',
      ],
      takeaway: 'Apoapsis is where the flight levels out horizontally: adding speed there lifts the opposite side of the orbit.',
    },
    {
      heading: 'From gravity-turn ascent to apoapsis circularisation.',
      paragraphs: [
        String.raw`In a planar turn over a spherical planet, let \(\gamma\) be the flight-path angle above the local horizon, \(v\) the speed and \(r\) the radius from the planet’s centre. Ignore drag and planetary spin, and align thrust \(T\) with velocity after pitch-over. With gravitational parameter \(\mu=GM\):`,
        { label: 'FROM ASCENT TO CIRCULAR ORBIT', steps: [
          {
            expression: String.raw`\dot v=\frac{T}{m}-\frac{\mu}{r^2}\sin\gamma,\qquad \dot\gamma=\left(\frac{v}{r}-\frac{\mu}{vr^2}\right)\cos\gamma`,
            explanation: ['Gravity reduces the rate of speed gain on a climb and bends the path towards the horizon. The first angle term reflects the local horizon rotating beneath the rocket as it travels around the curved world; at circular speed with horizontal flight, the two terms cancel.'],
          },
          {
            expression: String.raw`v_c(r)=\sqrt{\frac{\mu}{r}},\qquad \varepsilon=\frac{v^2}{2}-\frac{\mu}{r},\qquad r_p=\frac{h^2}{\mu(1+e)},\qquad r_a=\frac{h^2}{\mu(1-e)}`,
            explanation: [String.raw`With specific angular momentum \(h=rv\cos\gamma\) and eccentricity \(e=\sqrt{1+2\varepsilon h^2/\mu^2}\), a bound coast (\(\varepsilon<0\)) traces an ellipse with the planet’s centre at one focus. Unless \(e=0\), \(r_p\) and \(r_a\) differ—and if \(r_p\le R\), the unpowered transfer ellipse meets the surface.`],
          },
          {
            expression: String.raw`v_a=\sqrt{\frac{\mu}{r_a}(1-e)}<v_c(r_a),\qquad \Delta v_{\mathrm{circ}}=\sqrt{\frac{\mu}{r_a}}-v_a`,
            explanation: [String.raw`At apoapsis (\(\gamma=0\), \(r=r_a\)), speed \(v_a\) falls short of local circular speed \(v_c(r_a)\). Applying a prograde impulse \(\Delta v_{\mathrm{circ}}\) (or a short finite burn straddling apoapsis) brings \(e\to 0\) and lifts periapsis to \(r_p=r_a\), centring the orbit on the planet.`],
          },
          {
            expression: String.raw`\Delta v_{\mathrm{ideal}}=v_{\mathrm{eff}}\ln\!\left(\frac{m_0}{m_f}\right)`,
            explanation: [String.raw`The rocket’s propellant budget must cover both the ascent burn (including gravity losses) and the apoapsis circularisation burn. In the lab, constant thrust and constant mass flow are integrated across both burns, joined by exact two-body Keplerian coasts.`],
          },
        ] },
        'Watch Sideways speed and Flight-path angle on the telemetry strip as you jump to Apoapsis: on an elliptical coast, the angle passes through 0° while sideways speed sits below 100% of circular speed. Clicking Match circular speed fires just enough engine time across apoapsis to bring sideways speed to 100%, locking height and flight-path angle steady all the way round.',
      ],
      takeaway: 'The gravity turn shapes the climb to apoapsis; a prograde burn at apoapsis equalises periapsis and centres the orbit.',
    },
  ],
  related: ['rockets', 'escape-velocity', 'earth'],
  sources: [
    ['NASA Glenn · Flight to orbit', 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/flight-to-orbit/'],
    ['MIT OpenCourseWare · Gravity turn and orbital dynamics', 'https://ocw.mit.edu/courses/16-512-rocket-propulsion-fall-2005/e49a0b602e0e2a7828ba86be8a8fba07_lecture_32.pdf'],
    ['MIT OpenCourseWare · Orbital transfers and circularisation', 'https://ocw.mit.edu/courses/16-07-dynamics-fall-2009/pages/lecture-notes/'],
    ['NASA Glenn · The ideal rocket equation', 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/'],
  ],
};
