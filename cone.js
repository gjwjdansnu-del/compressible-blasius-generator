const R_AIR = 287.05;
const MU_REF = 1.716e-5;
const T_REF = 273.15;

const rad = degrees => degrees * Math.PI / 180;

function derivatives(theta, state, gamma) {
  const [vr, vt] = state;
  const thermal = 0.5 * (gamma - 1) * (1 - vr * vr - vt * vt);
  const denominator = thermal - vt * vt;
  const numerator = vt * vt * vr - thermal * (2 * vr + vt / Math.tan(theta));
  return [vt, numerator / denominator];
}

function integrateToCone(beta, coneAngle, mach, gamma, returnState = false) {
  const mn = mach * Math.sin(beta);
  const densityRatio = (gamma + 1) * mn * mn / ((gamma - 1) * mn * mn + 2);
  const vScale = mach / Math.sqrt(mach * mach + 2 / (gamma - 1));
  let state = [vScale * Math.cos(beta), -vScale * Math.sin(beta) / densityRatio];
  const steps = Math.max(800, Math.ceil((beta - coneAngle) * 5000));
  const h = (coneAngle - beta) / steps;
  for (let i = 0; i < steps; i++) {
    const theta = beta + i * h;
    const k1 = derivatives(theta, state, gamma);
    const k2 = derivatives(theta + h / 2, state.map((v, j) => v + h * k1[j] / 2), gamma);
    const k3 = derivatives(theta + h / 2, state.map((v, j) => v + h * k2[j] / 2), gamma);
    const k4 = derivatives(theta + h, state.map((v, j) => v + h * k3[j]), gamma);
    state = state.map((v, j) => v + h * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) / 6);
    if (!state.every(Number.isFinite)) throw Error("Taylor–Maccoll integration diverged");
  }
  return returnState ? state : state[1];
}

function shockBracket(coneAngle, mach, gamma) {
  const lower = Math.max(Math.asin(1 / mach), coneAngle) + 1e-5;
  const upper = Math.PI / 2 - 1e-4;
  let previousBeta = lower;
  let previousResidual = integrateToCone(previousBeta, coneAngle, mach, gamma);
  for (let i = 1; i <= 240; i++) {
    const beta = lower + (upper - lower) * i / 240;
    let residual;
    try { residual = integrateToCone(beta, coneAngle, mach, gamma); }
    catch { previousBeta = beta; previousResidual = NaN; continue; }
    if (Number.isFinite(previousResidual) && residual * previousResidual <= 0) {
      return [previousBeta, beta];
    }
    previousBeta = beta;
    previousResidual = residual;
  }
  throw Error("No attached Taylor–Maccoll shock solution exists for these inputs");
}

export function taylorMaccoll({mach, temperatureK, pressurePa, coneHalfAngleDeg, gamma = 1.4, sutherlandK = 110.4}) {
  if (!(mach > 1)) throw Error("Taylor–Maccoll mode requires supersonic freestream Mach number");
  if (!(coneHalfAngleDeg > 0 && coneHalfAngleDeg < 45)) throw Error("Cone half-angle must be between 0 and 45 degrees");
  const theta = rad(coneHalfAngleDeg);
  let [lo, hi] = shockBracket(theta, mach, gamma);
  let rlo = integrateToCone(lo, theta, mach, gamma);
  for (let i = 0; i < 70; i++) {
    const mid = (lo + hi) / 2;
    const rm = integrateToCone(mid, theta, mach, gamma);
    if (rlo * rm <= 0) hi = mid;
    else { lo = mid; rlo = rm; }
  }
  const beta = (lo + hi) / 2;
  const [vr, vt] = integrateToCone(beta, theta, mach, gamma, true);
  const speedRatio = Math.hypot(vr, vt);
  const edgeMach = speedRatio / Math.sqrt(0.5 * (gamma - 1) * (1 - speedRatio * speedRatio));
  const totalTemperature = temperatureK * (1 + 0.5 * (gamma - 1) * mach * mach);
  const edgeTemperature = totalTemperature / (1 + 0.5 * (gamma - 1) * edgeMach * edgeMach);
  const mn = mach * Math.sin(beta);
  const totalPressureRatio =
    (((gamma + 1) * mn * mn) / ((gamma - 1) * mn * mn + 2)) ** (gamma / (gamma - 1)) *
    ((gamma + 1) / (2 * gamma * mn * mn - (gamma - 1))) ** (1 / (gamma - 1));
  const p0OverPinf = (1 + 0.5 * (gamma - 1) * mach * mach) ** (gamma / (gamma - 1));
  const edgePressure = pressurePa * p0OverPinf * totalPressureRatio /
    (1 + 0.5 * (gamma - 1) * edgeMach * edgeMach) ** (gamma / (gamma - 1));
  const edgeSpeed = edgeMach * Math.sqrt(gamma * R_AIR * edgeTemperature);
  const edgeDensity = edgePressure / (R_AIR * edgeTemperature);
  const edgeViscosity = MU_REF * (edgeTemperature / T_REF) ** 1.5 *
    (T_REF + sutherlandK) / (edgeTemperature + sutherlandK);
  return {
    shockAngleDeg: beta * 180 / Math.PI,
    edgeMach,
    edgeTemperatureK: edgeTemperature,
    edgePressurePa: edgePressure,
    edgeSpeedMS: edgeSpeed,
    edgeDensityKgM3: edgeDensity,
    edgeViscosityPaS: edgeViscosity,
    edgeUnitRe1M: edgeDensity * edgeSpeed / edgeViscosity,
  };
}

export function applySharpConeMangler(result) {
  const factor = 1 / Math.sqrt(3);
  for (const row of result.data) {
    row.y_m *= factor;
    row.du_dy_1_s /= factor;
    row.dT_dy_K_m /= factor;
    row.drho_dy_kg_m4 /= factor;
  }
  result.meta.solution_summary.delta99_m *= factor;
  result.meta.geometry = {
    type: "sharp circular cone",
    manglerWallNormalFactor: factor,
    assumptions: "straight sharp cone; zero angle of attack; constant edge conditions",
  };
  return result;
}
