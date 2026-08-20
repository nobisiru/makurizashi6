export const START_WINDOW = Object.freeze({ opensS: 0, closesS: 1 });
export const COURSE = Object.freeze({
  laps: 3,
  turnMarkDistanceM: 300,
  nominalLapM: 600,
  nominalRaceM: 1800,
  finishTimeLimitS: 30
});

const BOAT_COUNT = 6;

export function createCompetitionState({ startClockDurationS = 100 } = {}) {
  return {
    phase: "PIT_STOPPED",
    elapsedS: 0,
    startClockDurationS,
    pitOut: new Set(),
    courseByBoat: new Map(),
    firstFinishElapsedS: null,
    boats: Array.from({ length: BOAT_COUNT }, (_, index) => ({
      id: index + 1,
      status: "PIT_STOPPED",
      startTimingS: null,
      nextGate: "MARK_1",
      lap: 0,
      finishOrder: null,
      violations: []
    })),
    finishers: []
  };
}

function cloneCompetition(state) {
  return {
    ...state,
    pitOut: new Set(state.pitOut),
    courseByBoat: new Map(state.courseByBoat),
    boats: state.boats.map((boat) => ({ ...boat, violations: [...boat.violations] })),
    finishers: [...state.finishers]
  };
}

function getBoat(state, boatId) {
  const boat = state.boats[boatId - 1];
  if (!boat) throw new RangeError(`invalid boat id: ${boatId}`);
  return boat;
}

export function soundFanfare(state) {
  if (state.phase !== "PIT_STOPPED") throw new Error("fanfare can only sound while all boats are in the pit");
  const next = cloneCompetition(state);
  next.phase = "PIT_OUT";
  next.elapsedS = 0;
  return next;
}

export function registerPitOut(state, boatId) {
  if (state.phase !== "PIT_OUT") throw new Error("pit-out is only valid after the fanfare");
  const next = cloneCompetition(state);
  const boat = getBoat(next, boatId);
  boat.status = "WAITING";
  next.pitOut.add(boatId);
  if (next.pitOut.size === BOAT_COUNT) next.phase = "WAITING";
  return next;
}

export function assignEntryCourse(state, boatId, course) {
  if (state.phase !== "WAITING" && state.phase !== "START_RUN") {
    throw new Error("entry course can only be assigned during the waiting action");
  }
  if (!Number.isInteger(course) || course < 1 || course > BOAT_COUNT) throw new RangeError(`invalid course: ${course}`);
  const next = cloneCompetition(state);
  for (const [assignedBoat, assignedCourse] of next.courseByBoat) {
    if (assignedBoat !== boatId && assignedCourse === course) throw new Error(`course ${course} is already occupied`);
  }
  next.courseByBoat.set(boatId, course);
  return next;
}

export function advanceCompetitionClock(state, dtS) {
  if (dtS < 0) throw new RangeError("competition clock cannot run backward");
  const next = cloneCompetition(state);
  next.elapsedS += dtS;
  if ((next.phase === "WAITING" || next.phase === "PIT_OUT") && next.elapsedS >= next.startClockDurationS - 12) {
    next.phase = "START_RUN";
  }
  if (next.firstFinishElapsedS !== null && next.elapsedS - next.firstFinishElapsedS >= COURSE.finishTimeLimitS) {
    for (const boat of next.boats) {
      if (boat.status === "RACING") {
        boat.status = "TIME_LIMIT";
        boat.violations.push("FINISH_TIME_LIMIT");
      }
    }
    if (next.boats.every((boat) => ["FINISHED", "F", "L", "TIME_LIMIT"].includes(boat.status))) next.phase = "FINISHED";
  }
  return next;
}

export function startClockReadingS(state) {
  return state.elapsedS - state.startClockDurationS;
}

export function crossStartLine(state, boatId) {
  if (state.phase !== "START_RUN" && state.phase !== "RACING") throw new Error("start line is not active in this phase");
  const next = cloneCompetition(state);
  const boat = getBoat(next, boatId);
  if (["RACING", "FINISHED", "F", "L"].includes(boat.status)) return next;

  const timingS = startClockReadingS(next);
  boat.startTimingS = timingS;
  if (timingS < START_WINDOW.opensS) {
    boat.status = "F";
    boat.violations.push("FLYING");
  } else if (timingS >= START_WINDOW.closesS) {
    boat.status = "L";
    boat.violations.push("LATE_START");
  } else {
    boat.status = "RACING";
    next.phase = "RACING";
  }
  return next;
}

export function crossTurnMark(state, boatId, mark, { direction = "LEFT" } = {}) {
  if (mark !== 1 && mark !== 2) throw new RangeError(`invalid turn mark: ${mark}`);
  const next = cloneCompetition(state);
  const boat = getBoat(next, boatId);
  if (boat.status !== "RACING") throw new Error("only a legally started boat can round a mark");
  if (direction !== "LEFT") {
    boat.violations.push(`WRONG_WAY_MARK_${mark}`);
    return next;
  }
  const expected = boat.nextGate === "MARK_1" ? 1 : 2;
  if (mark !== expected) {
    boat.violations.push(`MISSED_MARK_${expected}`);
    return next;
  }
  if (mark === 1) {
    boat.nextGate = "MARK_2";
  } else {
    boat.lap += 1;
    boat.nextGate = boat.lap === COURSE.laps ? "FINISH" : "MARK_1";
  }
  return next;
}

export function crossFinishLine(state, boatId) {
  const next = cloneCompetition(state);
  const boat = getBoat(next, boatId);
  if (boat.status !== "RACING" || boat.nextGate !== "FINISH") {
    boat.violations.push("EARLY_FINISH_LINE");
    return next;
  }
  boat.status = "FINISHED";
  boat.finishOrder = next.finishers.length + 1;
  next.finishers.push(boatId);
  if (next.firstFinishElapsedS === null) next.firstFinishElapsedS = next.elapsedS;
  if (next.boats.every((entry) => ["FINISHED", "F", "L", "TIME_LIMIT"].includes(entry.status))) next.phase = "FINISHED";
  return next;
}

export function reportEngineStop(state, boatId) {
  const next = cloneCompetition(state);
  const boat = getBoat(next, boatId);
  if (["PIT_OUT", "WAITING", "START_RUN"].includes(next.phase)) boat.violations.push("ENGINE_STOPPED_DURING_WAITING");
  return next;
}
