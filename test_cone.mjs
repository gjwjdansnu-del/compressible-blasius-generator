import assert from "node:assert/strict";
import {taylorMaccoll} from "./cone.js";

const edge = taylorMaccoll({
  mach: 5.30,
  temperatureK: 201.4,
  pressurePa: 6878.1,
  coneHalfAngleDeg: 7,
});
assert.ok(edge.shockAngleDeg > 7 && edge.shockAngleDeg < 30);
assert.ok(edge.edgeMach > 4 && edge.edgeMach < 5.3);
assert.ok(edge.edgeTemperatureK > 201.4);
assert.ok(edge.edgePressurePa > 6878.1);
console.log(edge);
