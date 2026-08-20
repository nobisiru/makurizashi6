import assert from "node:assert/strict";
import {
  SPEC,
  accumulateWheelTurns,
  createBoatState,
  leverOpening,
  mpsToKmh,
  shortestAngleDelta,
  simulate,
  toDegrees
} from "../simulator/boat-model.mjs";

const near = (actual, expected, tolerance, label) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}±${tolerance}, got ${actual}`);
};

near(shortestAngleDelta(Math.PI - .05, -Math.PI + .05), .1, 1e-9, "angle unwrap forward");
near(shortestAngleDelta(-Math.PI + .05, Math.PI - .05), -.1, 1e-9, "angle unwrap backward");
near(accumulateWheelTurns(0, 0, Math.PI), .5, 1e-9, "half wheel turn");
near(accumulateWheelTurns(1.7, 0, Math.PI), SPEC.steering.lockTurns, 1e-9, "wheel lock clamp");
near(leverOpening(100, 100, 300), 1, 1e-9, "lever full");
near(leverOpening(200, 100, 300), .5, 1e-9, "lever half");
near(leverOpening(300, 100, 300), 0, 1e-9, "lever idle");

const stopped = simulate({ durationS: 10, controls: { throttle: 0, wheelTurns: 0 } });
assert.ok(mpsToKmh(stopped.speedMps) < .05, "boat must stay stopped at zero throttle");
assert.ok(stopped.distanceM < .02, "stopped boat must not creep through the pit");

const fullSpeed = simulate({ durationS: 30, controls: { throttle: 1, wheelTurns: 0 } });
assert.ok(mpsToKmh(fullSpeed.speedMps) >= 77, `full throttle too slow: ${mpsToKmh(fullSpeed.speedMps)}`);
assert.ok(mpsToKmh(fullSpeed.speedMps) <= 82.5, `full throttle too fast: ${mpsToKmh(fullSpeed.speedMps)}`);
assert.ok(Math.abs(toDegrees(fullSpeed.headingRad) + 90) < .1, "centered wheel must preserve heading");

const accelerated = simulate({ durationS: 12, controls: { throttle: 1, wheelTurns: 0 } });
const coasted = simulate({ durationS: 3, state: accelerated, controls: { throttle: 0, wheelTurns: 0 } });
assert.ok(coasted.speedMps < accelerated.speedMps - 2.5, "lever release must cause material water-drag deceleration");
assert.ok(coasted.rpm < accelerated.rpm - 1500, "rpm must fall after lever release");

const zeroSpeedSteer = simulate({ durationS: 5, controls: { throttle: 0, wheelTurns: -SPEC.steering.lockTurns } });
assert.ok(Math.abs(zeroSpeedSteer.headingRad + Math.PI / 2) < .001, "steering at zero speed must not rotate the boat");

const leftTurn = simulate({
  durationS: 10,
  controls: (_state, time) => time < 4 ? { throttle: 1, wheelTurns: 0 } : { throttle: .62, wheelTurns: -SPEC.steering.lockTurns }
});
assert.ok(toDegrees(leftTurn.headingRad) < -125, `left lock must change heading: ${toDegrees(leftTurn.headingRad)}`);
assert.ok(Math.abs(leftTurn.lateralMps) > .15, "turning must create lateral slip");

const halfThrottle = simulate({ durationS: 30, controls: { throttle: .5, wheelTurns: 0 } });
assert.ok(halfThrottle.speedMps > 0 && halfThrottle.speedMps < fullSpeed.speedMps, "continuous lever input must produce intermediate speed");

console.log("REAL CONTROL RIG physics acceptance passed");
