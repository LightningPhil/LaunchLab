import type { Article } from './content.ts';

/** Original, layered lessons. Mathematical and numerical sources are recorded
 * alongside the models in docs/gravity-and-optics.md. */
export const SCIENCE_ARTICLES:Article[]=[
  {
    id:'escape-velocity',title:'Escape velocity',group:'The science of flight',kind:'Energy / gravity / a journey without returning',lab:'escape',
    description:'How fast is fast enough? Change the world, launch height and speed, then follow the energy.',
    stats:[['Earth, near the surface','About 11.2 km/s'],['Compared with circular speed','√2 times as fast'],['Does a heavier probe need more speed?','No, in this ideal model']],
    levels:[
      {heading:'A throw that never comes back.',paragraphs:[
        'Throw a ball upwards and gravity slows it down. A faster throw takes it higher. In an imaginary world without air or obstacles, a sufficiently fast throw could keep travelling outwards forever. The smallest starting speed that allows that is called escape speed, or escape velocity.',
        'Try Earth and the Moon in the experiment. Switching worlds keeps the speed slider in the same position, but changes the speed in km/s: each world has its own escape threshold. The midpoint is just enough to escape; the maximum is twice that speed. A heavier probe needs more energy, but it does not need a higher escape speed. We are testing a single push followed by coasting.',
      ],takeaway:'Escape is a question of enough energy, not reaching a boundary where gravity switches off.'},
      {heading:'Spend speed to climb out of a gravity well.',paragraphs:[
        'Gravity gets weaker with distance, but it does not suddenly end. As an outward-moving probe climbs, its kinetic energy becomes gravitational potential energy. With too little energy it reaches a highest point, stops moving outwards, and returns.',
        'At exactly escape speed, the probe keeps slowing as it travels farther away. Its speed approaches zero only at infinite distance. Above escape speed, some speed remains even very far from the world. The curve shows the outward part of a radial coast; it ends at the turning point for a returning flight.',
        'Starting higher lowers the escape threshold because part of the climb is already behind you. Circular orbit is a different task: at the same radius its speed is escape speed divided by √2, and it must point sideways. A straight-up launch at that speed returns. Escaping the Moon also does not automatically mean escaping Earth, or escaping the Sun.',
      ],takeaway:'Compare the same starting speed on two worlds, then change height while keeping the world fixed.'},
      {heading:'Let energy do the bookkeeping.',paragraphs:[
        'We choose gravitational potential energy to be zero infinitely far away. Near a spherical world it is negative: energy must be supplied to climb away. Add kinetic and potential energy to find whether an unpowered, outward-moving probe can escape.',
        {label:'THE ESCAPE THRESHOLD',steps:[
          {expression:String.raw`E = \frac{1}{2}mv^2-\frac{GMm}{r}`,explanation:[String.raw`Here \(m\) is probe mass, \(M\) is world mass, \(G\) is the gravitational constant, \(r=R+h\) is distance from the world's centre, and \(v\) is speed. With kilograms, metres and seconds, \(E\) is in joules. Negative total energy means a bound motion.`]},
          {expression:String.raw`E=0\quad\Longrightarrow\quad v_{\mathrm{esc}}=\sqrt{\frac{2GM}{R+h}}`,explanation:[String.raw`Probe mass cancels. The threshold depends on the world's gravitational parameter \(GM\) and launch radius. At height \(h=0\), using surface gravity \(g\), this is \(\sqrt{2gR}\). This experiment uses Launch Lab's existing \(GM=gR^2\) for consistency with its launch worlds.`]},
          {expression:String.raw`v_{\infty}=\sqrt{v^2-v_{\mathrm{esc}}^2}\qquad(v>v_{\mathrm{esc}})`,explanation:['The leftover energy gives the speed far from an isolated world. This expression is meaningful for escaping trajectories; it is not an imaginary speed to assign to a returning probe.']},
        ]},
        'Air resistance, surface rotation, other worlds and further engine burns are omitted. Real rockets can leave gradually under continued thrust, so escape speed is not a rule that a rocket must exceed immediately at the launch pad. For gas giants and the Sun, the reference level is the same fictional platform used elsewhere in Launch Lab.',
      ],takeaway:'The energy threshold is independent of probe mass; the energy required is proportional to it.'},
    ],related:['rockets','earth','moon','lagrange-points'],sources:[
      ['OpenStax · Gravitational potential energy and escape speed','https://openstax.org/books/university-physics-volume-1/pages/13-3-gravitational-potential-energy-and-total-energy'],
      ['NASA · Orbits and Kepler’s laws','https://science.nasa.gov/solar-system/orbits-and-keplers-laws/'],
      ['NASA · Planetary fact sheets','https://nssdc.gsfc.nasa.gov/planetary/factsheet/'],
    ],
  },
  {
    id:'lagrange-points',title:'Lagrange points',group:'The science of flight',kind:'Two worlds / five places / a moving balance',lab:'lagrange',
    description:'Find the five special locations shared by two orbiting worlds. Nudge a probe and test what “stable” really means.',
    stats:[['Points for each pair','Five'],['On the line between the worlds','L1, L2 and L3'],['Ahead and behind the companion','L4 and L5']],
    levels:[
      {heading:'Keep up with two moving worlds.',paragraphs:[
        'Imagine watching Earth and the Moon from a camera that turns with them. The two worlds seem to stand still. In a simplified circular model, a tiny spacecraft can also stand still at five special places in that turning view. Those places are called Lagrange points.',
        'L1 is between the worlds, L2 is beyond the smaller world, and L3 is on the far side of the larger one. L4 leads the smaller world around its orbit and L5 follows it. They make two equilateral triangles with the worlds. Select a point, give a probe a small nudge, and see whether it stays nearby.',
      ],takeaway:'A Lagrange point belongs to a pair of worlds, and it moves as that pair orbits.'},
      {heading:'Balance does not always mean stability.',paragraphs:[
        'The spacecraft is still moving in an ordinary, non-turning view. Gravity supplies the acceleration that lets it keep pace with the pair. It is not sitting in a place with no gravity, and the two gravitational pulls do not generally cancel.',
        'L1, L2 and L3 are unstable: a small error can grow. Spacecraft operating near these points need course corrections. Small motions around L4 and L5 can remain bounded when the larger body is more than about 25 times as massive as its companion. Bounded does not mean the probe settles down; without friction, it can keep oscillating.',
        'Use Earth–Moon for a clear comparison between L1 and L4. Then try Pluto–Charon: its mass ratio makes even the triangular points unstable in this ideal model. Pin a run and change just one parameter. The close-up uses a fixed scale for that run and its comparison, so zooming cannot disguise a growing departure.',
        'The orrery uses the current direction and distance between the worlds to orient the same five-point construction. Real orbits are elliptical and feel other worlds, so those moving markers are an educational approximation. Webb’s path around Sun–Earth L2 is a controlled orbit near the point, not a spacecraft resting on an invisible object.',
      ],takeaway:'Test stability with a small disturbance, and distinguish a mathematical equilibrium from a real mission orbit.'},
      {heading:'Work in the rotating frame.',paragraphs:[
        'The circular restricted three-body problem keeps two massive bodies on circular orbits about their shared centre of mass. The probe is so light that it does not affect them. The experiment draws their orbital plane, with their separation used as the distance unit.',
        {label:'FINDING AN EQUILIBRIUM',steps:[
          {expression:String.raw`\mu=\frac{M_2}{M_1+M_2},\qquad x_1=-\mu,\quad x_2=1-\mu`,explanation:['The smaller mass fraction is μ. Positions are measured from the barycentre, or centre of mass. We also choose time units so the frame’s angular speed is one; a full orbit then takes 2π time units.']},
          {expression:String.raw`0=x-\frac{(1-\mu)(x+\mu)}{|x+\mu|^3}-\frac{\mu(x-1+\mu)}{|x-1+\mu|^3}`,explanation:['For a stationary point on the x-axis, the effective acceleration is zero. The first term comes from using the turning frame; the other two are gravitational. Solving separately in the three intervals gives L1, L2 and L3. We solve this numerically rather than using a small-companion approximation.']},
          {expression:String.raw`L_{4,5}=\left(\frac12-\mu,\ \pm\frac{\sqrt3}{2}\right),\qquad 27\mu(1-\mu)<1`,explanation:['The coordinates form equilateral triangles. The inequality is the criterion for linear stability of the triangular points. In a moving experiment the rotating-frame equations also contain Coriolis terms, which are essential for the nearby paths.']},
        ]},
        'The probe follows both gravitational fields plus the centrifugal and Coriolis terms in this rotating frame. The simulation checks its Jacobi constant, an energy-like conserved quantity, and repeats the calculation with stricter numerical settings. A very sensitive forecast stops if those calculations cease to agree closely. This numerical disagreement is separate from the probe’s physical departure from its point. Close approaches end at a world’s model surface. Other planets, radiation pressure, eccentricity and thruster corrections are omitted; finite disturbances can leave the neighbourhood even near a linearly stable point.',
      ],takeaway:'The five points are exact equilibria of a particular model, not permanent parking places guaranteed by the whole Solar System.'},
    ],related:['escape-velocity','solar-system','moon','telescopes'],sources:[
      ['ESA · What are Lagrange points?','https://www.esa.int/Enabling_Support/Operations/What_are_Lagrange_points'],
      ['Orbital Mechanics & Astrodynamics · Circular restricted three-body problem','https://orbital-mechanics.space/the-n-body-problem/circular-restricted-three-body-problem.html'],
      ['JPL / NAIF · Mass parameters','https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc'],
      ['NASA · Webb’s orbit around L2','https://science.nasa.gov/mission/webb/orbit/'],
    ],
  },
  {
    id:'telescopes',title:'Telescopes: lenses & mirrors',group:'Light & discovery',kind:'Refractors / reflectors / light / detail',lab:'telescope',
    description:'Build an ideal telescope. Follow the light, separate a pair of stars, and discover why magnification is only part of the story.',
    stats:[['Refractor','Collects light with a lens'],['Reflector','Collects light with a mirror'],['Double the aperture','Four times the collecting area']],
    levels:[
      {heading:'Collect more light. See finer detail.',paragraphs:[
        'A telescope gathers light and brings it together into an image. A refracting telescope uses a large front lens to bend the light. A reflecting telescope uses a curved mirror. “Reflector” and “mirror-based telescope” describe the same family. The example here is a Newtonian reflector, whose small diagonal mirror directs light towards an eyepiece at the side.',
        'The aperture is the width of the main lens or mirror. Make it larger and the telescope can collect more light and distinguish smaller details. Change the eyepiece to magnify the image. Can a stronger eyepiece separate two stars that a small aperture blurs together? Try it and compare the results.',
      ],takeaway:'A telescope’s job is to collect light and reveal detail, as well as make an image look bigger.'},
      {heading:'Three lengths, three different jobs.',paragraphs:[
        'Aperture sets the collecting area and the ideal angular resolution. Objective focal length describes how far the main lens or mirror brings parallel incoming light to a focus. Eyepiece focal length sets how much that image is magnified: a shorter eyepiece gives more magnification with the same objective.',
        'In this tool, the star profiles use a fixed angular scale. Changing the eyepiece changes the magnification reading but does not change the telescope’s ability to distinguish the stars. Increasing aperture narrows each diffraction pattern. Compare the same two stars before and after doubling the aperture; the angular separation has not changed.',
        'A basic single lens bends colours by different amounts, which can make coloured fringes. Real refractors use combinations of lenses to reduce this chromatic aberration. A primary mirror does not separate colours in that way, although mirrors can have other optical errors. The ideal curves here assume perfect monochromatic optics, so they do not simulate those errors.',
        'A Newtonian reflector’s secondary mirror blocks some light. Its diameter fraction is the obstruction setting. It reduces collecting area and changes the diffraction rings. A 20% diameter obstruction blocks 4% of the area, not 20%. Real coatings, supports, alignment, atmospheric turbulence and the observer’s eye also matter.',
      ],takeaway:'Pin a telescope, change one parameter, and compare magnification, collecting area and diffraction separately.'},
      {heading:'Separate image size from angular resolution.',paragraphs:[
        'Light behaves as a wave. Even a flawless telescope does not turn a distant point into an infinitely small point: a circular aperture produces a diffraction pattern with a bright central disc and rings. Our two equally bright, mutually incoherent stars add their intensities.',
        {label:'THREE USEFUL TELESCOPE RELATIONSHIPS',steps:[
          {expression:String.raw`|M|=\frac{f_{\mathrm{objective}}}{f_{\mathrm{eyepiece}}}`,explanation:['Both focal lengths must use the same units. A 1000 mm objective and 20 mm eyepiece give 50× angular magnification. This is its magnitude; the simplest astronomical telescope also inverts the image.']},
          {expression:String.raw`\theta_{\mathrm{R}}\simeq1.22\frac{\lambda}{D}`,explanation:['This is the Rayleigh angle in radians for an unobstructed circular aperture of diameter D at wavelength λ. Use matching length units. Smaller angles mean finer separation. It is a reference criterion, not a sharp boundary at which every observer suddenly sees two stars.']},
          {expression:String.raw`A=\frac{\pi D^2}{4}\left(1-\epsilon^2\right)`,explanation:['The obstruction fraction ε is secondary-mirror diameter divided by primary-mirror diameter; it is zero for our refractor. Area and total collected light fall by ε². A larger obstruction also redistributes light into diffraction rings, which the annular-aperture profile includes.']},
        ]},
        'The listed Rayleigh angle remains an unobstructed-aperture reference, even for the reflector. Its actual plotted profile uses the chosen central obstruction. Profiles are normalised per star to compare shape; collecting area is reported separately, so equal-height peaks do not claim equal brightness. Exit pupil equals aperture divided by magnification. A pupil wider than the observer’s eye wastes some of the collected light; atmospheric seeing can dominate resolution long before the ideal limit.',
      ],takeaway:'Bigger magnification enlarges what the optics already deliver; aperture, wavelength and optical quality determine the available detail.'},
    ],related:['lagrange-points','sun','solar-system'],sources:[
      ['OpenStax · Telescopes','https://openstax.org/books/astronomy/pages/6-1-telescopes'],
      ['OpenStax · Microscopes and telescopes','https://openstax.org/books/university-physics-volume-3/pages/2-8-microscopes-and-telescopes'],
      ['OpenStax · Circular apertures and resolution','https://openstax.org/books/university-physics-volume-3/pages/4-5-circular-apertures-and-resolution'],
      ['NASA · Telescope optics teaching guide','https://science.nasa.gov/wp-content/uploads/2024/08/ngsttelescope-guide.pdf'],
    ],
  },
];
