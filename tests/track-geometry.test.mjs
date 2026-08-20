import assert from "node:assert/strict";
import { createBoatState } from "../simulator/boat-model.mjs";
import {
  TRACK,
  bowPoint,
  crossesDirectedGate,
  hullVertices,
  judgeBoatMovement
} from "../simulator/track-geometry.mjs";
import {
  advanceCompetitionClock,
  assignEntryCourse,
  createCompetitionState,
  registerPitOut,
  soundFanfare
} from "../simulator/race-rules.mjs";

const eastbound = (xM, yM) => createBoatState({ xM, yM, headingRad: 0 });
const westbound = (xM, yM) => createBoatState({ xM, yM, headingRad: Math.PI });

const bow = bowPoint(eastbound(0, 0));
assert.ok(bow.xM > 1.4 && bow.xM < 1.5, "bow sensor must use confirmed hull length");
assert.equal(hullVertices(eastbound(0, 0)).length, 4);

assert.equal(
  crossesDirectedGate(eastbound(-102, -30), eastbound(-101.3, -30), TRACK.startFinish),
  true,
  "start must trigger when the bow crosses, before the boat center"
);
assert.equal(
  crossesDirectedGate(eastbound(-102, 20), eastbound(-98, 20), TRACK.startFinish),
  false,
  "crossing outside the line segment must not count"
);
assert.equal(
  crossesDirectedGate(westbound(130, 25), westbound(126, 25), TRACK.mark1Exit),
  true,
  "mark 1 exit must be crossed westbound above the mark"
);

let rules = soundFanfare(createCompetitionState());
rules = judgeBoatMovement(rules, 1, eastbound(-208, -60), eastbound(-205.5, -60));
assert.equal(rules.boats[0].status, "WAITING", "physical pit-gate crossing must register pit-out");
for (let id = 2; id <= 6; id += 1) rules = registerPitOut(rules, id);
for (let id = 1; id <= 6; id += 1) rules = assignEntryCourse(rules, id, id);
rules = advanceCompetitionClock(rules, 100.15);
rules = judgeBoatMovement(rules, 1, eastbound(-102, -30), eastbound(-101.3, -30));
assert.equal(rules.boats[0].status, "RACING");
assert.ok(Math.abs(rules.boats[0].startTimingS - .15) < 1e-9);

for (let lap = 1; lap <= 3; lap += 1) {
  rules = judgeBoatMovement(rules, 1, westbound(130, 25), westbound(126, 25));
  rules = judgeBoatMovement(rules, 1, eastbound(-130, -25), eastbound(-126, -25));
  assert.equal(rules.boats[0].lap, lap);
}
assert.equal(rules.boats[0].nextGate, "FINISH");
rules = judgeBoatMovement(rules, 1, eastbound(-102, -30), eastbound(-101.3, -30));
assert.equal(rules.boats[0].status, "FINISHED", "hull crossing after three laps must finish");

console.log("BOAT RACE physical gate acceptance passed");
