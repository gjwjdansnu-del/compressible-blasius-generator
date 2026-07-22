import assert from "node:assert/strict";
import {solveBaseflow} from "./solver.js";
const base={caseName:"test",x:.1,gamma:1.4,pr:.72,sutherland:110.4,unitRe:1e6,etaMax:12,points:2001,tw:300};
for(const c of[
  {...base,mach:2.8,te:121.11,wall:"Adiabatic"},
  {...base,mach:4.5,te:61.584,wall:"Adiabatic"},
  {...base,mach:5,te:83.5,unitRe:2.52e6,wall:"Isothermal"},
]){const r=solveBaseflow(c);assert.ok(r.meta.solution_summary.boundary_residual_max<1e-7);assert.ok(r.data.every(d=>Number.isFinite(d.u_over_ue)&&d.T_over_Te>0&&Number.isFinite(d.d2u_dy2_1_m_s)&&Number.isFinite(d.d2T_dy2_K_m2)));console.log(c.mach,c.wall,r.meta.solution_summary)}
