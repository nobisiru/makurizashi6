import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../simulator/index.html", import.meta.url), "utf8");
const script = await readFile(new URL("../simulator/simulator.mjs", import.meta.url), "utf8");

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]));
const queriedIds = [...script.matchAll(/\$\("#([^"]+)"\)/g)].map((match) => match[1]);

for (const id of queriedIds) {
  assert.ok(htmlIds.has(id), `simulator.mjs references missing #${id}`);
}

assert.match(html, /id="throttleTrack"[^>]+role="slider"/, "throttle must be a continuous slider");
assert.match(html, /id="wheelZone"[^>]+role="application"/, "steering must use the circular wheel surface");
assert.doesNotMatch(html, />\s*(LEFT|RIGHT|GO|BRAKE)\s*</i, "button-like driving controls must not return");
assert.match(html, /暫定値/, "provisional calibration must be disclosed in the simulator");
assert.match(html, /ターン側へ360°回転/, "the one-revolution steering rule must be visible");
assert.match(html, /−1\.00[\s\S]*\+1\.00/, "wheel scale must show one turn in either direction");
assert.match(script, /accumulateWheelTurns/, "wheel gesture must accumulate multiple revolutions");
assert.match(script, /pointercapture/i, "touch controls must retain pointer capture while dragging");

console.log("REAL CONTROL RIG UI contract passed");
