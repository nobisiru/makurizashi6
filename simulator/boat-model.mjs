export const TAU = Math.PI * 2;

export const SPEC = Object.freeze({
  hull: Object.freeze({ lengthM: 2.895, widthM: 1.316, massKg: 69, status: "confirmed" }),
  motor: Object.freeze({ displacementCc: 396.9, powerKw: 23.5, massKg: 41, status: "mixed" }),
  propeller: Object.freeze({ diameterM: .187, pitchM: .215, massKg: .373, status: "confirmed" }),
  pilot: Object.freeze({ massKg: 52, status: "provisional" }),
  steering: Object.freeze({ lockTurns: 1.75, maxMotorAngleDeg: 30, status: "provisional" }),
  performance: Object.freeze({ topSpeedKmh: 80, idleRpm: 1500, maxRpm: 6600, status: "mixed" })
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const toRadians = (degrees) => degrees * Math.PI / 180;
export const toDegrees = (radians) => radians * 180 / Math.PI;
export const mpsToKmh = (mps) => mps * 3.6;

export function shortestAngleDelta(previous, current) {
  let delta = current - previous;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  return delta;
}

export function accumulateWheelTurns(turns, previousAngle, currentAngle, lockTurns = SPEC.steering.lockTurns) {
  const deltaTurns = shortestAngleDelta(previousAngle, currentAngle) / TAU;
  return clamp(turns + deltaTurns, -lockTurns, lockTurns);
}

export function leverOpening(pointerY, topY, bottomY) {
  if (bottomY <= topY) return 0;
  return clamp((bottomY - pointerY) / (bottomY - topY), 0, 1);
}

export function createBoatState(overrides = {}) {
  return {
    xM: 0,
    yM: 0,
    headingRad: -Math.PI / 2,
    yawRateRad: 0,
    speedMps: 0,
    lateralMps: 0,
    rpm: SPEC.performance.idleRpm,
    engineOpening: 0,
    throttle: 0,
    wheelTurns: 0,
    motorAngleRad: 0,
    distanceM: 0,
    elapsedS: 0,
    ...overrides
  };
}

export function stepBoat(previousState, controls, dtSeconds) {
  const dt = clamp(dtSeconds, 0, .05);
  const totalMassKg = SPEC.hull.massKg + SPEC.motor.massKg + SPEC.pilot.massKg;
  const maxSpeedMps = SPEC.performance.topSpeedKmh / 3.6;
  const throttle = clamp(controls.throttle ?? 0, 0, 1);
  const wheelTurns = clamp(controls.wheelTurns ?? 0, -SPEC.steering.lockTurns, SPEC.steering.lockTurns);
  const steerRatio = wheelTurns / SPEC.steering.lockTurns;
  const motorAngleRad = steerRatio * toRadians(SPEC.steering.maxMotorAngleDeg);

  const engineResponsePerSecond = throttle > previousState.engineOpening ? 2.1 : 4.8;
  const engineOpening = previousState.engineOpening + clamp(
    throttle - previousState.engineOpening,
    -engineResponsePerSecond * dt,
    engineResponsePerSecond * dt
  );
  const rpmTarget = SPEC.performance.idleRpm + (SPEC.performance.maxRpm - SPEC.performance.idleRpm) * Math.sqrt(engineOpening);
  const rpm = previousState.rpm + (rpmTarget - previousState.rpm) * clamp(dt * 4.2, 0, 1);

  const propulsivePowerW = SPEC.motor.powerKw * 1000 * .62;
  const staticThrustN = 900;
  const thrustN = engineOpening <= .001 ? 0 : Math.min(staticThrustN, propulsivePowerW / Math.max(3.5, previousState.speedMps)) * Math.pow(engineOpening, 1.18);
  const baseDragCoefficient = (propulsivePowerW / maxSpeedMps) / (maxSpeedMps * maxSpeedMps);
  const steeringDragFactor = 1 + Math.pow(Math.abs(steerRatio), 1.7) * .58;
  const dragN = baseDragCoefficient * previousState.speedMps * previousState.speedMps * steeringDragFactor;
  const longitudinalAcceleration = (thrustN - dragN) / totalMassKg;
  const speedMps = clamp(previousState.speedMps + longitudinalAcceleration * dt, 0, maxSpeedMps * 1.03);

  const turnAuthority = clamp(speedMps / 4, 0, 1);
  const baseTurnRadiusM = 6.2 + speedMps * .28;
  const targetYawRate = turnAuthority * speedMps / baseTurnRadiusM * Math.sin(motorAngleRad);
  const yawRateRad = previousState.yawRateRad + (targetYawRate - previousState.yawRateRad) * clamp(dt * 3.6, 0, 1);
  const headingRad = previousState.headingRad + yawRateRad * dt;
  const lateralTarget = speedMps * Math.abs(steerRatio) * .055 * -Math.sign(steerRatio || 1);
  const lateralMps = previousState.lateralMps + (lateralTarget - previousState.lateralMps) * clamp(dt * 2.7, 0, 1);

  const forwardX = Math.cos(headingRad) * speedMps;
  const forwardY = Math.sin(headingRad) * speedMps;
  const sideX = -Math.sin(headingRad) * lateralMps;
  const sideY = Math.cos(headingRad) * lateralMps;
  const traveledM = speedMps * dt;

  return {
    xM: previousState.xM + (forwardX + sideX) * dt,
    yM: previousState.yM + (forwardY + sideY) * dt,
    headingRad,
    yawRateRad,
    speedMps,
    lateralMps,
    rpm,
    engineOpening,
    throttle,
    wheelTurns,
    motorAngleRad,
    distanceM: previousState.distanceM + traveledM,
    elapsedS: previousState.elapsedS + dt
  };
}

export function simulate({ durationS, dtS = 1 / 120, state = createBoatState(), controls }) {
  let result = state;
  const steps = Math.ceil(durationS / dtS);
  for (let index = 0; index < steps; index++) {
    const input = typeof controls === "function" ? controls(result, index * dtS) : controls;
    result = stepBoat(result, input, dtS);
  }
  return result;
}
