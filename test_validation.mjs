import assert from "node:assert/strict";
import fs from "node:fs";
import {solveBaseflow} from "./solver.js";
import {applySharpConeMangler, taylorMaccoll} from "./cone.js";

const paper = JSON.parse(fs.readFileSync("./validation/figure4_tm.json", "utf8"));
const c = paper.conditions;
const gamma = 1.4;
const edge = taylorMaccoll({
  mach: c.M_inf,
  temperatureK: c.T_inf_K,
  pressurePa: c.p_inf_Pa,
  coneHalfAngleDeg: c.cone_half_angle_deg,
  gamma,
});
const uInf = c.M_inf * Math.sqrt(gamma * 287.05 * c.T_inf_K);

function interpolate(data, yMm, accessor) {
  if (yMm <= data[0].y_m * 1e3) return accessor(data[0]);
  if (yMm >= data[data.length - 1].y_m * 1e3) return accessor(data[data.length - 1]);
  const i = data.findIndex(row => row.y_m * 1e3 >= yMm);
  const a = data[i - 1], b = data[i];
  const q = (yMm - a.y_m * 1e3) / ((b.y_m - a.y_m) * 1e3);
  return accessor(a) * (1 - q) + accessor(b) * q;
}

function rmse(points, model, accessor) {
  return Math.sqrt(points.reduce((sum, [value, y]) => {
    const error = interpolate(model.data, y, accessor) - value;
    return sum + error * error;
  }, 0) / points.length);
}

for (const paperCase of paper.cases) {
  const model = applySharpConeMangler(solveBaseflow({
    caseName: "nasa_20200002932_fig4_tm",
    mach: edge.edgeMach,
    te: edge.edgeTemperatureK,
    x: paperCase.station_m,
    gamma,
    pr: 0.72,
    sutherland: 110.4,
    unitRe: edge.edgeUnitRe1M,
    wall: "Isothermal",
    tw: c.wall_temperature_K,
    etaMax: 12,
    points: 3001,
  }));
  const velocityRmse = rmse(
    paperCase.velocity_u_over_uinf_vs_y_mm, model, row => row.u_m_s / uInf
  );
  const temperatureRmse = rmse(
    paperCase.temperature_T_over_Tinf_vs_y_mm, model, row => row.T_K / c.T_inf_K
  );
  console.log(paperCase.station_m, {velocityRmse, temperatureRmse});
  assert.ok(velocityRmse < 0.03, `velocity RMSE too large at ${paperCase.station_m} m`);
  assert.ok(temperatureRmse < 0.05, `temperature RMSE too large at ${paperCase.station_m} m`);
}
