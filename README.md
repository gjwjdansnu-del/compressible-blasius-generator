# Compressible Blasius Base-Flow Generator

A serverless browser application for generating zero-pressure-gradient,
compressible flat-plate similarity profiles. The application includes the
Oz--Kara Figure 3 validation cases and Yin (2023) Figure 4 Case 1--3 presets.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>. No Python solver or application server is used at
runtime; all numerical work is performed in the browser.

## Numerical method

The browser implementation integrates the Oz--Kara similarity equations using
fourth-order Runge--Kutta integration and solves the two missing wall conditions
with damped Newton shooting. CSV and metadata files are created locally.

## Validation scope

The adiabatic formulation is benchmarked against the BL2D markers reported in
Oz & Kara (2021), Figure 3, and the browser solver is regression-tested against
the SciPy `solve_bvp` implementation used in the local validation project.
Isothermal Yin presets are available for reproduction but are not claimed as an
independent validation benchmark.
