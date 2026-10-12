# Planet surface artwork

The flight view and orrery share thirteen local equirectangular maps, upgraded on 2026-10-12. Resolution is selected automatically from each world's projected **physical pixel diameter**, including display scaling. No new controls are needed.

## Assets and resolution

Final assets live in `src/assets/orrery/`. All levels for a world come from the same source so geography and colour stay consistent during upgrades. No packaged image is upscaled beyond its source.

| Worlds | Map widths (height is half the width) | Source |
| --- | --- | --- |
| Earth, Mercury, Mars, Moon | 512 / 2,048 / 8,192 | Solar System Scope / INOVE |
| Sun, Venus atmosphere, Jupiter, Saturn | 512 / 2,048 / 4,096 | Solar System Scope / INOVE |
| Uranus, Neptune | 512 / 2,048 | Solar System Scope / INOVE |
| Pluto | 512 / 2,048 / 4,096 | NASA VTAD |
| Ganymede | 512 / 2,048 | NASA VTAD |
| Charon | 512 / 1,264 | NASA VTAD |

The [Solar System Scope maps](https://www.solarsystemscope.com/textures/) are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), with NASA-based imagery, adjusted colours and fictional gap filling. NASA VTAD maps are extracted from the [Pluto](https://science.nasa.gov/resource/pluto-3d-model/), [Ganymede](https://science.nasa.gov/resource/ganymede-3d-model/) and [Charon](https://science.nasa.gov/resource/charon-3d-model/) models. Their detailed and poorly mapped regions reflect available source coverage; they are visualization assets, not uniformly resolved scientific cartography. Full credits are in `THIRD_PARTY_NOTICES.txt`, also accessible in the app manual, and the orrery's About the model panel.

The shared LOD policy upgrades at 96 and 512 physical pixels, downgrades at 64 and 384 pixels to avoid flickering, and waits 300 ms before requesting the largest map. Existing textures stay visible while replacements load; failures retain a lower resolution. Unused detail resources are released after 15 seconds. The orrery also releases detail textures when closed and respects the GPU's maximum texture size. It uses sRGB, anisotropic filtering and trilinear mipmaps.

The launch view previously always projected the 512-wide map onto a fixed 640-pixel globe. It now projects the selected map onto a globe up to 2,048 pixels across, preserving the same world orientation and lighting. CPU projection yields in short chunks to keep launches and zoom responsive. Decodes/projections are serialized, source buffers are discarded after baking, obsolete jobs are cancelled, and at most three worlds are retained. All maps are bundled locally, including in the portable HTML build; no external texture server is needed at runtime.

`tools/world-texture-sources.json` records exact source URLs, native dimensions, credits and SHA-256 checksums. Re-export with Pillow using `python tools/prepare-orrery-textures.py CACHE_DIRECTORY --download`. Only GLB image extraction, downsampling and WebP encoding happen in this script. The earlier 1774×887 generated illustrations and their upsampled 2K variants have been replaced; `tools/orrery-texture-sources.json` preserves their historical prompts.

## Satellite motion

Moon, Ganymede and Charon use representative circular orbits with measured mean distances and periods from [JPL satellite mean elements](https://ssd.jpl.nasa.gov/sats/elem/) and diameters from [JPL physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/). Phases and orbital planes are illustrative; these are not date-accurate satellite ephemerides. Their surfaces rotate synchronously with the representative orbit. Normalised planet lanes reserve the complete moon system's footprint to retain clear gaps.
