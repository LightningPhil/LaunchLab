# Expanded orrery: data, layout and validation

The **More bodies** checkbox starts off. The familiar Sun, planets, Pluto, Moon, Ganymede and Charon remain the initial selection. Turning it on shows **46 moons in total**, **16 named main-belt bodies** and **nine additional Kuiper belt bodies**. The option is retained while opening and closing the dialog, and starts off again on a new page load.

## Implementation plan

1. Package a curated, offline catalogue of moons with published JPL orbital elements and physical radii, plus individual JPL SBDB asteroid and Kuiper object solutions. Keep the source values, epochs and reference frames available for inspection and regeneration.
2. Separate orbital physics from display spacing. At True scale use measured sizes, elliptical distances, inclinations, nodes and date-driven Kepler phases. At Even spacing assign each visible moon a separate concentric lane around its planet. Preserve its orbital direction and angular phase while circularising radial distance.
3. Reserve every planet's full moon-system footprint before calculating the next heliocentric lane. Include Saturn's complete rings. Allocate named asteroids and Kuiper objects separate lanes ordered by semimajor axis, enlarge each belt to contain them, and retain equal edge gaps between regions. Blend both positions and sizes through the existing slider.
4. Reveal extra names as bodies become large enough on screen; keep the selected body in the name filters. A planet's **View moon system** frames the entire family. Labels follow their bodies along outward orbital rays; camera depth determines which name is in front. The Explore menu groups families and named belt bodies. Hidden objects are excluded from labels, picking, orbit visibility and texture updates. On narrow screens, requesting a close-up dismisses the details card to expose the stage.
5. Verify physical geometry, epochs, retrograde direction, display gaps, slider invariance and independent reference vectors. Check the controls and layouts in a browser, then run the full test suite and web build.

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

The additional Kuiper objects are **Haumea, Makemake, Quaoar, Orcus, Varuna, Salacia, Varda, Ixion and Arrokoth**. Pluto remains in the default selection. Haumea and Makemake are labelled dwarf planets; the other additions are labelled Kuiper belt objects. Each has its own selectable sphere, full inclined elliptical orbit and date-driven phase. Their moons, rings and nonspherical shapes are not resolved.

At Even spacing, both belts reserve separate lanes ordered by semimajor axis. Each outer-body lane includes the body's displayed radius, with a 0.12-unit gap between neighbours. The Kuiper belt particle band expands to contain those lanes. Fit system includes the largest added aphelion at True scale and the full widened belt at Even spacing, interpolating those extents through the slider. Disabling More bodies while inspecting an added outer object returns the selection to the Kuiper belt.

The moon catalogue deliberately uses bodies with both orbital and physical data in JPL's published tables. It represents the major families and several smaller companions, rather than every known or provisional moon. Surface colours and the small-body spheres are illustrative. The existing local textures continue to serve mapped worlds; added bodies do not borrow another world's surface map or fetch images at runtime.

## Sources and orbital treatment

Moon and asteroid data were retrieved on **13 October 2026**; the additional Kuiper body data on **14 October 2026**. The exact selected source rows and full-precision asteroid values are retained in [`tools/orrery-orbit-sources.json`](../tools/orrery-orbit-sources.json). [`src/orrery-catalogue.ts`](../src/orrery-catalogue.ts) is generated from that snapshot.

- [JPL planetary satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/): semimajor axes, eccentricities, inclinations, arguments of periapsis, ascending nodes, mean anomalies, periods, reference epochs and local-plane poles.
- [JPL satellite physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/): mean radii, converted to diameters.
- [JPL SBDB API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html): each named small body's J2000 heliocentric elements, its individual TDB Julian-date epoch, mean motion, diameter and rotation period. Mean longitude is built from `M + ω + Ω`; longitude of perihelion is `ω + Ω`. Phase advances from that object's epoch, rather than assuming that all rows refer to J2000.
- [JPL NAIF planetary constants](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc): equatorial pole orientations for Uranus and Pluto. Uranus's moons use the angular-momentum pole opposite its IAU north pole, RA 77.311°, Dec +15.175°; Pluto uses RA 132.993°, Dec −6.163°. The orientation is checked against independent moon vectors.

SBDB does not publish diameters for most of the selected Kuiper objects. Explicit supplements and their sources are stored in the snapshot rather than inferred from brightness:

| Body | Spherical diameter used | Primary size source |
| --- | --- | --- |
| Haumea | 1430 km | [JPL mean radius](https://ssd.jpl.nasa.gov/planets/phys_par.html), doubled |
| Makemake | 1428 km | [JPL mean radius](https://ssd.jpl.nasa.gov/planets/phys_par.html), doubled |
| Quaoar | 1070 km | [Fornasier et al. 2013](https://arxiv.org/abs/1305.0449), primary excluding Weywot |
| Orcus | 917 km | [Fornasier et al. 2013](https://arxiv.org/abs/1305.0449), primary excluding Vanth |
| Varuna | 900 km | SBDB physical parameter, an older estimate with ±140 km uncertainty |
| Salacia | 854 km | [Fornasier et al. 2013](https://arxiv.org/abs/1305.0449), primary excluding Actaea |
| Varda | 740 km | [Souami et al. 2020](https://arxiv.org/abs/2008.04818), area-equivalent occultation diameter |
| Ixion | 696.78 km | [Kilic et al. 2026](https://arxiv.org/abs/2601.09639), area-equivalent occultation diameter |
| Arrokoth | 18 km | [Hofgartner et al. 2021](https://www.sciencedirect.com/science/article/pii/S0019103520301147), volume-equivalent diameter |

These sizes are approximate and use different spherical-equivalence conventions. Haumea's elongation and Arrokoth's contact-binary shape are represented by simple spheres. SBDB rotation estimates are used where supplied; Ixion's arbitrary surface spin is explicitly marked Illustrative in its details. Surface axes and colours are illustrative for all additions.

Ecliptic satellite elements directly use the J2000 ecliptic. For equatorial and local Laplace elements, JPL measures the node from the reference plane's ascending node on the ICRF equator. The model constructs that plane's orthonormal basis from its RA/Dec pole, rotates the orbital coordinates into ICRF, and then rotates into the J2000 ecliptic using obliquity 23.439291111°. The final renderer conversion is `(X, Z, −Y)` for a right-handed Y-up scene. Inclinations beyond 90° naturally reverse orbital direction. Inner-moon reference poles also orient their parent planet and Saturn's rings, so the illustrated rings and moon planes agree.

## Stable radial labels

Labels use each object's projected orbital centre: its parent planet for a moon, and the Sun for planets, named belt bodies and belt regions. Radial lines attach to the centres of the text rectangles. Each label centre stays a fixed distance from its object at a given zoom: the object's displayed radius, plus half the label's diagonal, plus nine pixels of clearance. This bounding-circle clearance works at every angle, so rectangular text cannot distort the path and no part of a label can enter its own object. The Sun has a stable diagonal offset. The same calculation applies at all zoom and spacing settings; moon labels no longer switch between parent-centred and body-centred placement.

There are no collision candidates or compass slots. Passing bodies and labels, selection and opening a details card cannot change a label's position. Labels may overlap. Names nearer to the current camera are drawn above more distant ones, using opaque backgrounds to keep the foreground name readable. Selection changes the highlight, without promoting a distant name in front of a nearer one. Toolbar, information card and stage hints retain their UI layers. At the viewport boundary, labels clip instead of jumping to a different side.

When viewing an orbit edge on, its projected radius can reach zero at conjunction. Normalising that vector would flip a label instantly by 180 degrees. The label retains its last unit heading at zero and turns gradually towards the outward ray afterwards. Turning slows within 12 projected pixels of the orbital centre and is bounded at large angle changes; ordinary orbital motion follows the radial direction immediately. The leader never shrinks into the object. Explicit date jumps and view resets start with a fresh heading. Foreground spheres mask only the covered portions of labels and leaders, using solid body radii and excluding Saturn's rings. The remaining caption stays at full opacity and keeps its position even when its body is hidden.

`tests/orrery-labels.test.mjs` checks radial alignment through a complete orbit, constant centre offsets and full rectangle clearance at every angle, centre-attached leader endpoints, continuity at quadrant boundaries and zero-radius conjunctions, depth ordering and stable ties, partial foreground masks and overlapping-silhouette unions, translation with camera panning, and clipping without repositioning. Browser verification also confirmed that selecting Titan and opening its details in a paused Saturn close-up changed none of the visible labels' positions or depth ranks, and that labels remain fixed when paused after edge-on motion. Dense top and edge views and the narrow phone layout were inspected.

## Accuracy limits

The optional Lagrange-point overlay uses a circular three-body construction oriented to the current pair. Its model, display-scale mapping, data and independent JPL checks are documented in [Gravity and optics lessons](gravity-and-optics.md).

These are **fixed, approximate Kepler ellipses**, appropriate for showing orbit shape, scale, family structure and motion. They are not precision satellite ephemerides. They omit nodal/apsidal precession, moon resonances, mutual perturbations and planetary perturbations of small bodies. Rounded mean-element phases can differ from numerical ephemerides even at the source epoch, and phase errors grow with time. The giant planets retain the existing long-term planetary approximation; its 1000–3000 interval does **not** guarantee moon or small-body positions throughout those dates. UTC still approximates dynamical time.

The [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) specifically recommends mean elements over extrapolating instantaneous satellite osculating elements. JPL also warns that the mean tables describe orbit geometry and do not provide accurate ephemerides. Use [Horizons](https://ssd.jpl.nasa.gov/horizons/) for observation, conjunction, eclipse or navigation calculations. These limits are explained in the in-app model panel and selected-body notes.

Added moon surface spins are illustrative and are not a claim that every moon is tidally locked. Pluto's small moons are drawn around Pluto without resolving the Pluto–Charon barycentre and their circumbinary perturbations. Co-orbital and resonant companions get separate display lanes for readability at Even spacing; their physical-scale paths may share or cross orbital regions. Background belt particles remain representative circular orbits and are separate from the named bodies.

## Refresh and verify

Run `node tools/prepare-orrery-orbits.mjs` to retrieve the selected sources again. Requests are serial to comply with JPL's API usage requirements. Run `node tools/prepare-orrery-orbits.mjs --cached` to regenerate the catalogue from the checked-in snapshot without any network access. The importer rejects missing sizes, incomplete records and non-J2000 small-body frames. The web build packages the catalogue locally.

`--extend-kuiper` refreshes just the outer-body records while retaining the existing moon and asteroid snapshot. All nine added SBDB solutions currently use epoch JD 2461200.5 TDB. [`tests/fixtures/orrery-kuiper-horizons.json`](../tests/fixtures/orrery-kuiper-horizons.json) records independent heliocentric Horizons vectors at those epochs, including the exact query parameters. The converted elements agree within 1.8×10⁻⁹ AU (about 0.3 km); the regression tolerance is 10⁻⁷ AU. This checks the epoch, phase and frame conversion, without claiming long-term Kepler accuracy.

`tests/orrery-expanded-system.test.mjs` checks catalogue identities, physical elliptical extrema, period closure, epoch propagation, retrograde motion, finite positions at the supported date/slider bounds, invariant True-scale positions and sizes, and clearance of complete planet systems and individual moon, asteroid and Kuiper body lanes. `tests/fixtures/orrery-horizons.json` contains independent planet-centred J2000 geometric vectors queried from Horizons for the Moon, Ganymede, Titania, Triton and Charon. These validate the three reference-frame paths; tolerances explicitly include mean-element approximation error and are not claimed as present-day positional accuracy.

Browser verification covers the default-off state, the complete expanded Explore menu, Saturn's moon-system close-up, hiding a selected moon, the True scale / 50% / Even spacing endpoints, named asteroid and Kuiper object selection, label and orbit switches, and the compact phone layout.

The label-mask regression was also checked visually at the Earth–Moon conjunction on 19 January 2000, 00:14:24 UTC: the Moon is hidden, while the label remains in the DOM at opacity 1 with only its covered upper portion masked. Clicking that masked portion selects Earth. A crowded edge-on Saturn view exercises multiple simultaneous mask layers, and the phone layout retains the More bodies control and outer-body details without horizontal overflow.
