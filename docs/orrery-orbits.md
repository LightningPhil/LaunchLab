# Expanded orrery: data, layout and validation

The **More moons & asteroids** checkbox starts off. The familiar Sun, planets, Pluto, Moon, Ganymede and Charon remain the initial selection. Turning it on shows **46 moons in total** and **16 named main-belt bodies**. The option is retained while opening and closing the dialog, and starts off again on a new page load.

## Implementation plan

1. Package a curated, offline catalogue of moons with published JPL orbital elements and physical radii, plus individual JPL SBDB asteroid solutions. Keep the source values, epochs and reference frames available for inspection and regeneration.
2. Separate orbital physics from display spacing. At True scale use measured sizes, elliptical distances, inclinations, nodes and date-driven Kepler phases. At Even spacing assign each visible moon a separate concentric lane around its planet. Preserve its orbital direction and angular phase while circularising radial distance.
3. Reserve every planet's full moon-system footprint before calculating the next heliocentric lane. Include Saturn's complete rings. Allocate named asteroids separate lanes ordered by semimajor axis, enlarge the belt to contain them, and retain equal edge gaps between regions. Blend both positions and sizes through the existing slider.
4. Reveal extra names as bodies become large enough on screen; always prioritise the selected body. A planet's **View moon system** frames the entire family. At close range moon labels follow their own positions. The Explore menu groups families and named belt bodies. Hidden objects are excluded from labels, picking, orbit visibility and texture updates. On narrow screens, requesting a close-up dismisses the details card to expose the stage.
5. Verify physical geometry, epochs, retrograde direction, display gaps, slider invariance and independent reference vectors. Check the controls and layouts in a browser, then run the full test suite and both builds.

## Included objects

| Family | Moons |
| --- | --- |
| Earth | Moon |
| Mars | Phobos, Deimos |
| Jupiter | Metis, Adrastea, Amalthea, Thebe, Io, Europa, Ganymede, Callisto, Himalia |
| Saturn | Pan, Atlas, Prometheus, Pandora, Epimetheus, Janus, Mimas, Enceladus, Tethys, Dione, Helene, Rhea, Titan, Hyperion, Iapetus, Phoebe |
| Uranus | Miranda, Ariel, Umbriel, Titania, Oberon |
| Neptune | Naiad, Thalassa, Despina, Galatea, Larissa, Proteus, Triton, Nereid |
| Pluto | Charon, Styx, Nix, Kerberos, Hydra |

The belt contains Ceres (a dwarf planet), Pallas, Juno, Vesta, Iris, Hygiea, Eunomia, Psyche, Themis, Euphrosyne, 52 Europa, Sylvia, Davida, Interamnia, Gaspra and Ida. Numbered asteroid identities are separate from moon identities; Jupiter's Europa and asteroid 52 Europa can be selected independently.

The moon catalogue deliberately uses bodies with both orbital and physical data in JPL's published tables. It represents the major families and several smaller companions, rather than every known or provisional moon. Surface colours and the small-body spheres are illustrative. The existing local textures continue to serve mapped worlds; added bodies do not borrow another world's surface map or fetch images at runtime.

## Sources and orbital treatment

Data were retrieved on **13 October 2026**. The exact selected source rows and full-precision asteroid values are retained in [`tools/orrery-orbit-sources.json`](../tools/orrery-orbit-sources.json). [`src/orrery-catalogue.ts`](../src/orrery-catalogue.ts) is generated from that snapshot.

- [JPL planetary satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/): semimajor axes, eccentricities, inclinations, arguments of periapsis, ascending nodes, mean anomalies, periods, reference epochs and local-plane poles.
- [JPL satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/): mean radii, converted to diameters.
- [JPL SBDB API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html): each named asteroid's J2000 heliocentric elements, its individual TDB Julian-date epoch, mean motion, diameter and rotation period. Mean longitude is built from `M + ω + Ω`; longitude of perihelion is `ω + Ω`. Phase advances from that asteroid's epoch, rather than assuming that all rows refer to J2000.
- [JPL NAIF planetary constants](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc): equatorial pole orientations for Uranus and Pluto. Uranus's moons use the angular-momentum pole opposite its IAU north pole, RA 77.311°, Dec +15.175°; Pluto uses RA 132.993°, Dec −6.163°. The orientation is checked against independent moon vectors.

Ecliptic satellite elements directly use the J2000 ecliptic. For equatorial and local Laplace elements, JPL measures the node from the reference plane's ascending node on the ICRF equator. The model constructs that plane's orthonormal basis from its RA/Dec pole, rotates the orbital coordinates into ICRF, and then rotates into the J2000 ecliptic using obliquity 23.439291111°. The final renderer conversion is `(X, Z, −Y)` for a right-handed Y-up scene. Inclinations beyond 90° naturally reverse orbital direction. Inner-moon reference poles also orient their parent planet and Saturn's rings, so the illustrated rings and moon planes agree.

## Accuracy limits

These are **fixed, approximate Kepler ellipses**, appropriate for showing orbit shape, scale, family structure and motion. They are not precision satellite ephemerides. They omit nodal/apsidal precession, moon resonances, mutual perturbations and planetary perturbations of asteroids. Rounded mean-element phases can differ from numerical ephemerides even at the source epoch, and phase errors grow with time. The giant planets retain the existing long-term planetary approximation; its 1000–3000 interval does **not** guarantee moon or asteroid positions throughout those dates. UTC still approximates dynamical time.

The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) specifically recommends mean elements over extrapolating instantaneous satellite osculating elements. JPL also warns that the mean tables describe orbit geometry and do not provide accurate ephemerides. Use [Horizons](https://ssd.jpl.nasa.gov/horizons/) for observation, conjunction, eclipse or navigation calculations. These limits are explained in the in-app model panel and selected-body notes.

Added moon surface spins are illustrative and are not a claim that every moon is tidally locked. Pluto's small moons are drawn around Pluto without resolving the Pluto–Charon barycentre and their circumbinary perturbations. Co-orbital and resonant companions get separate display lanes for readability at Even spacing; their physical-scale paths may share or cross orbital regions. Background belt particles remain representative circular orbits and are separate from the named bodies.

## Refresh and verify

Run `node tools/prepare-orrery-orbits.mjs` to retrieve the selected sources again. Requests are serial to comply with JPL's API usage requirements. Run `node tools/prepare-orrery-orbits.mjs --cached` to regenerate the catalogue from the checked-in snapshot without any network access. The importer rejects missing sizes, incomplete records and non-J2000 asteroid frames. Both regular and portable builds package the catalogue locally.

`tests/orrery-expanded-system.test.mjs` checks catalogue identities, physical elliptical extrema, period closure, epoch propagation, retrograde motion, finite positions at the supported date/slider bounds, invariant True-scale positions and sizes, and clearance of complete planet systems and individual moon/asteroid lanes. `tests/fixtures/orrery-horizons.json` contains independent planet-centred J2000 geometric vectors queried from Horizons for the Moon, Ganymede, Titania, Triton and Charon. These validate the three reference-frame paths; tolerances explicitly include mean-element approximation error and are not claimed as present-day positional accuracy.

Browser verification covers the default-off state, the complete expanded Explore menu, Saturn's moon-system close-up, hiding a selected moon, the True scale / 50% / Even spacing endpoints, named asteroid selection, label and orbit switches, and the compact phone layout.
