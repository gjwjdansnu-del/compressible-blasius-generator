# Compressible Blasius Base-Flow Generator

A serverless browser application for generating zero-pressure-gradient,
compressible flat-plate and straight sharp-cone similarity profiles. The
application includes the Oz--Kara Figure 3 flat-plate cases and the NASA
20200002932 Figure 4 sharp-cone Taylor--Maccoll/Mangler reproduction case.
It renders profiles, streamwise delta-99 growth, and a dimensional schematic.

Sharp-cone mode accepts either constant edge conditions directly or freestream
conditions that are converted once with the Taylor--Maccoll equations. The
Mangler transformation maps the similarity solution to the physical cone-normal
coordinate. Streamwise-varying edge conditions, blunt noses, angle of attack,
and entropy-layer effects are outside the model scope.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. No Python solver or application server is used at
runtime; all numerical work is performed in the browser.

## Numerical method

The browser implementation integrates the Oz--Kara similarity equations and
Taylor--Maccoll equations using fourth-order Runge--Kutta integration. Missing
wall conditions are solved with damped Newton shooting. CSV and metadata files
are created locally. First- and second-order physical wall-normal derivatives
of velocity and temperature are evaluated analytically from the similarity ODE
state and included in the generated data for later LST use.

## Validation scope

The adiabatic formulation is benchmarked against the BL2D markers reported in
Oz & Kara (2021), Figure 3, and the browser solver is regression-tested against
the SciPy `solve_bvp` implementation used in the local validation project.
Custom isothermal conditions remain available, but are not claimed as an
independent validation benchmark.

The flat-plate browser result can be regenerated and plotted directly against
the digitized BL2D reference with:

```bash
node tools/export_flat_plate_validation.mjs
python3 tools/plot_flat_plate_validation.py
```

The resulting plot and error metrics are written to `validation/`.

The NASA Figure 4 digitization is stored in `validation/figure4_tm.json` and
can be regenerated with `tools/extract_figure4_tm.py`. `npm test` verifies the
Taylor--Maccoll edge state and checks all eight velocity/temperature overlays at
surface stations 0.2, 0.4, 0.6, and 0.8 m.
