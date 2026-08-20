import assert from "node:assert/strict";
import {
  COURSE,
  advanceCompetitionClock,
  assignEntryCourse,
  createCompetitionState,
  crossFinishLine,
  crossStartLine,
  crossTurnMark,
  registerPitOut,
  reportEngineStop,
  soundFanfare,
  startClockReadingS
} from "../simulator/race-rules.mjs";

assert.equal(COURSE.laps, 3);
assert.equal(COURSE.nominalRaceM, 1800);
assert.equal(COURSE.turnMarkDistanceM, 300);
assert.equal(COURSE.finishTimeLimitS, 30);

const pit = createCompetitionState();
assert.equal(pit.phase, "PIT_STOPPED");
assert.ok(pit.boats.every((boat) => boat.status === "PIT_STOPPED"));
assert.throws(() => registerPitOut(pit, 1), /after the fanfare/);

let waiting = soundFanfare(pit);
for (let boatId = 1; boatId <= 6; boatId += 1) waiting = registerPitOut(waiting, boatId);
assert.equal(waiting.phase, "WAITING");
for (let boatId = 1; boatId <= 6; boatId += 1) waiting = assignEntryCourse(waiting, boatId, boatId);
assert.throws(() => assignEntryCourse(waiting, 6, 1), /already occupied/);

const stoppedEngine = reportEngineStop(waiting, 2);
assert.deepEqual(stoppedEngine.boats[1].violations, ["ENGINE_STOPPED_DURING_WAITING"]);

const startRun = advanceCompetitionClock(waiting, 88);
assert.equal(startRun.phase, "START_RUN");
assert.equal(startClockReadingS(startRun), -12);

const startAt = (timingS) => advanceCompetitionClock(startRun, 12 + timingS);
assert.equal(crossStartLine(startAt(-.01), 1).boats[0].status, "F");
assert.equal(crossStartLine(startAt(0), 1).boats[0].status, "RACING");
assert.equal(crossStartLine(startAt(.999), 1).boats[0].status, "RACING");
assert.equal(crossStartLine(startAt(1), 1).boats[0].status, "L");

let race = crossStartLine(startAt(.15), 1);
const missed = crossTurnMark(race, 1, 2);
assert.deepEqual(missed.boats[0].violations, ["MISSED_MARK_1"]);
const wrongWay = crossTurnMark(race, 1, 1, { direction: "RIGHT" });
assert.deepEqual(wrongWay.boats[0].violations, ["WRONG_WAY_MARK_1"]);

for (let lap = 1; lap <= 3; lap += 1) {
  race = crossTurnMark(race, 1, 1);
  race = crossTurnMark(race, 1, 2);
  assert.equal(race.boats[0].lap, lap);
}
assert.equal(race.boats[0].nextGate, "FINISH");
race = crossFinishLine(race, 1);
assert.equal(race.boats[0].status, "FINISHED");
assert.equal(race.boats[0].finishOrder, 1);

let timeLimited = race;
for (let boatId = 2; boatId <= 6; boatId += 1) timeLimited = crossStartLine(timeLimited, boatId);
timeLimited = advanceCompetitionClock(timeLimited, 30);
assert.ok(timeLimited.boats.slice(1).every((boat) => boat.status === "TIME_LIMIT"));
assert.equal(timeLimited.phase, "FINISHED");

console.log("BOAT RACE competition sequence acceptance passed");
