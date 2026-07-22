import fs from "node:fs";
import {solveBaseflow} from "../solver.js";

const common={caseName:"oz_kara_figure3",x:.1,gamma:1.4,pr:.72,sutherland:110.4,unitRe:1e6,etaMax:12,points:4001,wall:"Adiabatic",tw:300};
const cases={
  M2p8:solveBaseflow({...common,mach:2.8,te:121.11}),
  M4p5:solveBaseflow({...common,mach:4.5,te:61.584}),
};
fs.mkdirSync(new URL("../validation/",import.meta.url),{recursive:true});
fs.writeFileSync(new URL("../validation/flat_plate_web_results.json",import.meta.url),JSON.stringify(cases));
