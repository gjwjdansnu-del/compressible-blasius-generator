import {solveBaseflow} from "./solver.js";
import {applySharpConeMangler, taylorMaccoll} from "./cone.js";

const R_AIR = 287.05;
const $ = id => document.getElementById(id);
const defaults = {
  geometry: "Flat plate",
  conditionSource: "Direct edge conditions",
  caseName: "custom_baseflow",
  mach: 5,
  te: 100,
  pressure: 6878.1,
  coneAngle: 7,
  x: 0.1,
  gamma: 1.4,
  pr: 0.72,
  sutherland: 110.4,
  unitRe: 1e6,
  wall: "Adiabatic",
  tw: 300,
  etaMax: 12,
  points: 2001,
  validation: false,
};

const presets = {
  "Custom": {},
  "Validation | Oz-Kara Fig. 3 | M=2.8 | flat plate": {
    caseName: "oz_kara_M2p8_adiabatic", mach: 2.8, te: 121.11,
    unitRe: 1e6, wall: "Adiabatic",
  },
  "Validation | Oz-Kara Fig. 3 | M=4.5 | flat plate": {
    caseName: "oz_kara_M4p5_adiabatic", mach: 4.5, te: 61.584,
    unitRe: 1e6, wall: "Adiabatic",
  },
  "Validation | NASA 20200002932 Fig. 4 | sharp cone TM": {
    geometry: "Sharp cone",
    conditionSource: "Freestream + Taylor–Maccoll",
    caseName: "nasa_20200002932_fig4_tm",
    mach: 5.30,
    te: 201.4,
    pressure: 6878.1,
    unitRe: 13.42e6,
    coneAngle: 7,
    x: 0.2,
    wall: "Isothermal",
    tw: 393.44,
    validation: true,
  },
};

let result;
let activePreset = defaults;
for (const name of Object.keys(presets)) $("preset").add(new Option(name, name));
$("preset").value = Object.keys(presets)[2];

function fill(values) {
  activePreset = {...defaults, ...values};
  for (const key of Object.keys(defaults)) {
    if ($(key) && typeof activePreset[key] !== "boolean") $(key).value = activePreset[key];
  }
  interfaceState();
}

function interfaceState() {
  const cone = $("geometry").value === "Sharp cone";
  const freestream = cone && $("conditionSource").value === "Freestream + Taylor–Maccoll";
  $("conditionSourceWrap").hidden = !cone;
  $("coneAngleWrap").hidden = !cone;
  $("pressureWrap").hidden = !freestream;
  $("unitRe").disabled = freestream;
  $("tw").disabled = $("wall").value === "Adiabatic";
  $("machLabel").innerHTML = freestream ? "Freestream Mach number, M<sub>∞</sub>" : "Edge Mach number, M<sub>e</sub>";
  $("temperatureLabel").innerHTML = freestream ? "Freestream temperature, T<sub>∞</sub> [K]" : "Edge temperature, T<sub>e</sub> [K]";
  $("unitReLabel").textContent = freestream ? "Freestream unit Reynolds number [reference only]" : "Edge unit Reynolds number [1/m]";
  $("stationLabel").textContent = cone ? "Surface station, s [m]" : "Streamwise station, x [m]";
}

$("preset").onchange = () => fill(presets[$("preset").value]);
$("geometry").onchange = interfaceState;
$("conditionSource").onchange = interfaceState;
$("wall").onchange = interfaceState;
fill(presets[$("preset").value]);

function uiConfig() {
  const config = {};
  for (const key of ["mach", "te", "pressure", "coneAngle", "x", "gamma", "pr", "sutherland", "unitRe", "tw", "etaMax", "points"]) {
    config[key] = Number($(key).value);
  }
  config.points = Math.round(config.points);
  config.caseName = $("caseName").value.trim() || "baseflow";
  config.geometry = $("geometry").value;
  config.conditionSource = $("conditionSource").value;
  config.wall = $("wall").value;
  config.validation = activePreset.validation === true;
  return config;
}

function generateAtStation(ui, station = ui.x) {
  let edge = null;
  if (ui.geometry === "Sharp cone" && ui.conditionSource === "Freestream + Taylor–Maccoll") {
    edge = taylorMaccoll({
      mach: ui.mach,
      temperatureK: ui.te,
      pressurePa: ui.pressure,
      coneHalfAngleDeg: ui.coneAngle,
      gamma: ui.gamma,
      sutherlandK: ui.sutherland,
    });
  }
  const base = {
    caseName: ui.caseName,
    mach: edge?.edgeMach ?? ui.mach,
    te: edge?.edgeTemperatureK ?? ui.te,
    x: station,
    gamma: ui.gamma,
    pr: ui.pr,
    sutherland: ui.sutherland,
    unitRe: edge?.edgeUnitRe1M ?? ui.unitRe,
    wall: ui.wall,
    tw: ui.tw,
    etaMax: ui.etaMax,
    points: ui.points,
  };
  let generated = solveBaseflow(base);
  if (ui.geometry === "Sharp cone") generated = applySharpConeMangler(generated);
  generated.meta.requested_input = {...ui, x: station};
  if (edge) generated.meta.taylor_maccoll = edge;
  return generated;
}

function svgChart(data, key, title, xlabel) {
  const W = 240, H = 400, m = {l: 55, r: 12, t: 18, b: 48};
  const values = data.map(d => d[key]);
  const ys = data.map(d => d.y_m * 1e3);
  const xmin = Math.min(0, ...values), xmax = Math.max(...values) * 1.04;
  const ymax = Math.max(...ys) * 1.02;
  const sx = x => m.l + (x - xmin) / (xmax - xmin) * (W - m.l - m.r);
  const sy = y => H - m.b - y / ymax * (H - m.t - m.b);
  const path = data.map((d, i) => `${i ? "L" : "M"}${sx(d[key]).toFixed(2)},${sy(d.y_m * 1e3).toFixed(2)}`).join(" ");
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const y = i * ymax / 4, py = sy(y);
    grid += `<line x1="${m.l}" y1="${py}" x2="${W - m.r}" y2="${py}"/><text x="${m.l - 7}" y="${py + 4}" text-anchor="end">${y.toFixed(ymax < 10 ? 1 : 0)}</text>`;
  }
  return `<div class="chart"><h3>${title}</h3><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><g stroke="#e4e9e7" stroke-width="1">${grid}</g><g fill="#718086" font-size="9" font-family="monospace"><text transform="rotate(-90 12 ${H / 2})" x="12" y="${H / 2}">y [mm]</text><text x="${W / 2}" y="${H - 12}" text-anchor="middle">${xlabel}</text></g><path d="${path}" fill="none" stroke="#176b72" stroke-width="2.5"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="#758489"/><line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#758489"/></svg></div>`;
}

function schematic(delta = null, station = null, geometry = $("geometry").value) {
  const W = 760, H = 250, left = 55, right = 720;
  const cone = geometry === "Sharp cone";
  const wallStart = 190, wallEnd = cone ? 170 : 190;
  const x = station ?? Number($("x").value);
  const deltaMm = delta ? delta * 1e3 : null;
  let envelope = `M${left},${wallStart}`;
  for (let i = 0; i <= 60; i++) {
    const q = i / 60;
    const wall = wallStart + (wallEnd - wallStart) * q;
    envelope += ` L${left + (right - left) * q},${wall - (deltaMm ? 120 : 75) * Math.sqrt(q)}`;
  }
  const label = deltaMm ? `δ₉₉(${x.toPrecision(4)} m) = ${deltaMm.toFixed(4)} mm` : "δ₉₉(s) ∝ √s · generate for dimensional value";
  const title = cone ? "SHARP-CONE BOUNDARY-LAYER DEVELOPMENT" : "FLAT-PLATE BOUNDARY-LAYER DEVELOPMENT";
  const body = cone
    ? `<path d="M${left - 18},${wallStart} L${right + 15},${wallEnd} L${right + 15},${wallEnd + 25} Z" fill="#10232b"/>`
    : `<path d="M${left - 18},${wallStart} L${right + 15},${wallEnd}" stroke="#10232b" stroke-width="7"/>`;
  $("schematic").innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bl" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#68aaa6" stop-opacity=".38"/><stop offset="1" stop-color="#68aaa6" stop-opacity=".05"/></linearGradient><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#176b72"/></marker></defs><text x="24" y="25" font-family="monospace" font-size="11" fill="#66777d">${title}</text><path d="${envelope} L${right},${wallEnd} L${left},${wallStart} Z" fill="url(#bl)"/><path d="${envelope}" fill="none" stroke="#e9633b" stroke-width="3"/>${body}<path d="M26 69H165 M26 91H192 M26 113H220" stroke="#176b72" stroke-width="2" marker-end="url(#arrow)"/><text x="27" y="56" font-family="monospace" font-size="11" fill="#176b72">Uₑ</text><text x="${right - 8}" y="48" text-anchor="end" font-family="monospace" font-size="12" fill="#ad4226">${label}</text><text x="${right}" y="${wallEnd + 42}" text-anchor="end" font-family="monospace" font-size="11" fill="#66777d">${cone ? "s" : "x"} = ${x.toPrecision(4)} m</text><text x="24" y="235" font-family="monospace" font-size="9" fill="#849396">Vertical scale exaggerated; labelled δ₉₉ is dimensional.</text></svg>`;
}

function growthChart(summary, ui) {
  const W = 760, H = 260, m = {l: 70, r: 24, t: 20, b: 52};
  const xmax = ui.x, dmax = summary.delta99_m * 1e3;
  const sx = x => m.l + x / xmax * (W - m.l - m.r);
  const sy = d => H - m.b - d / (dmax * 1.08) * (H - m.t - m.b);
  let path = "";
  for (let i = 0; i <= 150; i++) path += `${i ? "L" : "M"}${sx(xmax * i / 150).toFixed(2)},${sy(dmax * Math.sqrt(i / 150)).toFixed(2)} `;
  let grid = "";
  for (let i = 0; i <= 4; i++) {
    const d = dmax * i / 4, py = sy(d);
    grid += `<line x1="${m.l}" y1="${py}" x2="${W - m.r}" y2="${py}"/><text x="${m.l - 8}" y="${py + 4}" text-anchor="end">${d.toFixed(2)}</text>`;
  }
  return `<h3>Boundary-layer growth along the ${ui.geometry === "Sharp cone" ? "cone" : "plate"}</h3><svg class="plot-export" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><g stroke="#e4e9e7">${grid}</g><path d="${path}" fill="none" stroke="#e9633b" stroke-width="3"/><circle cx="${sx(xmax)}" cy="${sy(dmax)}" r="5" fill="#10232b"/><g fill="#718086" font-size="10" font-family="monospace"><text x="${W / 2}" y="${H - 12}" text-anchor="middle">${ui.geometry === "Sharp cone" ? "s" : "x"} [m]</text><text transform="rotate(-90 15 ${H / 2})" x="15" y="${H / 2}">δ₉₉ [mm]</text><text x="${sx(xmax) - 8}" y="${sy(dmax) - 10}" text-anchor="end">${dmax.toFixed(4)} mm at ${ui.geometry === "Sharp cone" ? "s" : "x"}=${xmax.toPrecision(4)} m</text></g><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="#758489"/><line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#758489"/></svg>`;
}

function interpolate(data, yMm, accessor) {
  if (yMm <= data[0].y_m * 1e3) return accessor(data[0]);
  if (yMm >= data[data.length - 1].y_m * 1e3) return accessor(data[data.length - 1]);
  const index = data.findIndex(row => row.y_m * 1e3 >= yMm);
  const a = data[index - 1], b = data[index];
  const q = (yMm - a.y_m * 1e3) / ((b.y_m - a.y_m) * 1e3);
  return accessor(a) * (1 - q) + accessor(b) * q;
}

function comparisonChart(paperPoints, model, kind, station, free) {
  const W = 260, H = 330, m = {l: 52, r: 12, t: 24, b: 45};
  const temperature = kind === "temperature";
  const xmin = temperature ? 1 : 0, xmax = temperature ? 3 : 1;
  const sx = value => m.l + (value - xmin) / (xmax - xmin) * (W - m.l - m.r);
  const sy = value => H - m.b - value / 1.4 * (H - m.t - m.b);
  const paperPath = paperPoints.map(([value, y], i) => `${i ? "L" : "M"}${sx(value).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");
  const uInf = free.mach * Math.sqrt(free.gamma * R_AIR * free.temperatureK);
  const modelRows = model.data.filter((_, i) => i % 12 === 0).filter(row => row.y_m * 1e3 <= 1.4);
  const accessor = temperature ? row => row.T_K / free.temperatureK : row => row.u_m_s / uInf;
  const modelPath = modelRows.map((row, i) => `${i ? "L" : "M"}${sx(accessor(row)).toFixed(2)},${sy(row.y_m * 1e3).toFixed(2)}`).join(" ");
  return `<div class="validation-chart"><h4>${kind === "velocity" ? "u/U∞" : "T/T∞"} · s=${station} m</h4><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><g stroke="#e4e9e7"><line x1="${m.l}" y1="${sy(.4)}" x2="${W - m.r}" y2="${sy(.4)}"/><line x1="${m.l}" y1="${sy(.8)}" x2="${W - m.r}" y2="${sy(.8)}"/><line x1="${m.l}" y1="${sy(1.2)}" x2="${W - m.r}" y2="${sy(1.2)}"/></g><path d="${paperPath}" fill="none" stroke="#111" stroke-width="2"/><path d="${modelPath}" fill="none" stroke="#e9633b" stroke-width="2.2" stroke-dasharray="7 5"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}" stroke="#758489"/><line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}" stroke="#758489"/><g fill="#718086" font-size="9" font-family="monospace"><text x="${W / 2}" y="${H - 12}" text-anchor="middle">${temperature ? "T/T∞" : "u/U∞"}</text><text transform="rotate(-90 13 ${H / 2})" x="13" y="${H / 2}">y [mm]</text></g></svg></div>`;
}

function rmse(paperPoints, model, accessor) {
  const errors = paperPoints.map(([value, y]) => interpolate(model.data, y, accessor) - value);
  return Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
}

async function renderValidation(ui) {
  if (!ui.validation) { $("validationPanel").hidden = true; return; }
  const paper = await fetch("validation/figure4_tm.json?v=1").then(response => response.json());
  const free = {mach: ui.mach, temperatureK: ui.te, gamma: ui.gamma};
  const uInf = free.mach * Math.sqrt(free.gamma * R_AIR * free.temperatureK);
  const metrics = [], charts = [];
  for (const paperCase of paper.cases) {
    const model = generateAtStation(ui, paperCase.station_m);
    const velocityRmse = rmse(paperCase.velocity_u_over_uinf_vs_y_mm, model, row => row.u_m_s / uInf);
    const temperatureRmse = rmse(paperCase.temperature_T_over_Tinf_vs_y_mm, model, row => row.T_K / free.temperatureK);
    metrics.push(`<div><strong>${paperCase.station_m.toFixed(1)} m</strong><span>RMSE u: ${velocityRmse.toExponential(2)}</span><span>RMSE T: ${temperatureRmse.toExponential(2)}</span></div>`);
    charts.push(comparisonChart(paperCase.velocity_u_over_uinf_vs_y_mm, model, "velocity", paperCase.station_m, free));
    charts.push(comparisonChart(paperCase.temperature_T_over_Tinf_vs_y_mm, model, "temperature", paperCase.station_m, free));
  }
  $("validationMetrics").innerHTML = metrics.join("");
  $("validationCharts").innerHTML = charts.join("");
  $("validationPanel").hidden = false;
}

async function render(ui) {
  const data = result.data, summary = result.meta.solution_summary;
  $("output").hidden = false;
  schematic(summary.delta99_m, ui.x, ui.geometry);
  $("mRe").textContent = result.meta.derived_edge_conditions.unit_Re_1_m.toExponential(3);
  $("mDelta").textContent = (summary.delta99_m * 1e3).toFixed(4);
  $("mTw").textContent = summary.Tw_K.toFixed(2);
  $("mResidual").textContent = summary.boundary_residual_max.toExponential(1);
  const edge = result.meta.taylor_maccoll;
  if (edge) {
    $("edgeSummary").hidden = false;
    $("edgeSummary").innerHTML = `<strong>Taylor–Maccoll edge</strong><span>β=${edge.shockAngleDeg.toFixed(4)}°</span><span>Mₑ=${edge.edgeMach.toFixed(6)}</span><span>Tₑ=${edge.edgeTemperatureK.toFixed(3)} K</span><span>pₑ=${edge.edgePressurePa.toFixed(2)} Pa</span>`;
  } else $("edgeSummary").hidden = true;
  $("growthChart").innerHTML = growthChart(summary, ui);
  $("profileStation").textContent = `Profiles evaluated at ${ui.geometry === "Sharp cone" ? "s" : "x"} = ${ui.x.toPrecision(4)} m`;
  $("charts").innerHTML = svgChart(data, "u_over_ue", "Velocity", "u / Ue") + svgChart(data, "T_over_Te", "Temperature", "T / Te") + svgChart(data, "rho_over_rhoe", "Density", "ρ / ρe");
  document.querySelectorAll(".chart svg").forEach(svg => svg.classList.add("plot-export"));
  await renderValidation(ui);
}

$("generate").onclick = () => {
  const button = $("generate"), message = $("message"), ui = uiConfig();
  button.disabled = true;
  message.className = "message";
  message.textContent = "Solving the nonlinear boundary-value problem…";
  setTimeout(async () => {
    try {
      result = generateAtStation(ui);
      await render(ui);
      message.textContent = "Profile generated. Download files below.";
    } catch (error) {
      message.className = "message error";
      message.textContent = error.message;
    } finally { button.disabled = false; }
  }, 30);
};

const columns = ["eta", "y_bar", "y_m", "u_over_ue", "T_over_Te", "rho_over_rhoe", "mu_over_mue", "C", "u_m_s", "T_K", "rho_kg_m3", "mu_Pa_s", "p_Pa", "du_dy_1_s", "dT_dy_K_m", "drho_dy_kg_m4", "f", "fpp", "dT_deta"];
function download(blob, name) { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); }
function stem() { return result.meta.input.caseName.replace(/[^A-Za-z0-9_.-]+/g, "_"); }
$("csv").onclick = () => download(new Blob([[columns.join(","), ...result.data.map(row => columns.map(key => row[key]).join(","))].join("\n")], {type: "text/csv"}), stem() + "_baseflow.csv");
$("json").onclick = () => download(new Blob([JSON.stringify(result.meta, null, 2)], {type: "application/json"}), stem() + "_metadata.json");
$("png").onclick = () => {
  const svgs = [...document.querySelectorAll(".plot-export")], canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 1030;
  const context = canvas.getContext("2d"); context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
  let done = 0;
  svgs.forEach((svg, index) => {
    const image = new Image();
    image.onload = () => { if (index === 0) context.drawImage(image, 0, 0, 1200, 410); else context.drawImage(image, (index - 1) * 400, 410, 400, 620); if (++done === svgs.length) canvas.toBlob(blob => download(blob, stem() + "_profiles.png")); };
    image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  });
};

schematic();
