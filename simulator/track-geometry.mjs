import { SPEC } from "./boat-model.mjs";
import { crossFinishLine, crossStartLine, crossTurnMark, registerPitOut } from "./race-rules.mjs";

export const TRACK = Object.freeze({
  status: "mixed",
  mark1: Object.freeze({ xM: 150, yM: 0 }),
  mark2: Object.freeze({ xM: -150, yM: 0 }),
  pitGate: Object.freeze({ xM: -205, yMinM: -95, yMaxM: -35, direction: "RIGHT" }),
  startFinish: Object.freeze({ xM: -100, yMinM: -58, yMaxM: -4, direction: "RIGHT" }),
  mark1Exit: Object.freeze({ xM: 128, yMinM: 4, yMaxM: 58, direction: "LEFT" }),
  mark2Exit: Object.freeze({ xM: -128, yMinM: -58, yMaxM: -4, direction: "RIGHT" })
});

export function bowPoint(boat) {
  const halfLength = SPEC.hull.lengthM / 2;
  return {
    xM: boat.xM + Math.cos(boat.headingRad) * halfLength,
    yM: boat.yM + Math.sin(boat.headingRad) * halfLength
  };
}

export function hullVertices(boat) {
  const halfLength = SPEC.hull.lengthM / 2;
  const halfWidth = SPEC.hull.widthM / 2;
  const forward = { x: Math.cos(boat.headingRad), y: Math.sin(boat.headingRad) };
  const side = { x: -forward.y, y: forward.x };
  return [
    { xM: boat.xM + forward.x * halfLength + side.x * halfWidth, yM: boat.yM + forward.y * halfLength + side.y * halfWidth },
    { xM: boat.xM + forward.x * halfLength - side.x * halfWidth, yM: boat.yM + forward.y * halfLength - side.y * halfWidth },
    { xM: boat.xM - forward.x * halfLength + side.x * halfWidth, yM: boat.yM - forward.y * halfLength + side.y * halfWidth },
    { xM: boat.xM - forward.x * halfLength - side.x * halfWidth, yM: boat.yM - forward.y * halfLength - side.y * halfWidth }
  ];
}

function sensorX(boat, sensor, direction) {
  if (sensor === "BOW") return bowPoint(boat).xM;
  const xs = hullVertices(boat).map((point) => point.xM);
  return direction === "RIGHT" ? Math.max(...xs) : Math.min(...xs);
}

export function crossesDirectedGate(previousBoat, currentBoat, gate, { sensor = "BOW" } = {}) {
  const previousX = sensorX(previousBoat, sensor, gate.direction);
  const currentX = sensorX(currentBoat, sensor, gate.direction);
  const crossed = gate.direction === "RIGHT"
    ? previousX < gate.xM && currentX >= gate.xM
    : previousX > gate.xM && currentX <= gate.xM;
  if (!crossed) return false;
  const point = sensor === "BOW" ? bowPoint(currentBoat) : currentBoat;
  return point.yM >= gate.yMinM && point.yM <= gate.yMaxM;
}

export function judgeBoatMovement(competition, boatId, previousBoat, currentBoat) {
  const boatRule = competition.boats[boatId - 1];
  if (!boatRule) throw new RangeError(`invalid boat id: ${boatId}`);

  if (boatRule.status === "PIT_STOPPED" && crossesDirectedGate(previousBoat, currentBoat, TRACK.pitGate)) {
    return registerPitOut(competition, boatId);
  }
  if (boatRule.status === "WAITING" && crossesDirectedGate(previousBoat, currentBoat, TRACK.startFinish)) {
    return crossStartLine(competition, boatId);
  }
  if (boatRule.status !== "RACING") return competition;
  if (boatRule.nextGate === "MARK_1" && crossesDirectedGate(previousBoat, currentBoat, TRACK.mark1Exit)) {
    return crossTurnMark(competition, boatId, 1, { direction: "LEFT" });
  }
  if (boatRule.nextGate === "MARK_2" && crossesDirectedGate(previousBoat, currentBoat, TRACK.mark2Exit)) {
    return crossTurnMark(competition, boatId, 2, { direction: "LEFT" });
  }
  if (boatRule.nextGate === "FINISH" && crossesDirectedGate(previousBoat, currentBoat, TRACK.startFinish, { sensor: "HULL" })) {
    return crossFinishLine(competition, boatId);
  }
  return competition;
}
