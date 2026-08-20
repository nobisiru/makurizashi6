import {
  SPEC,
  TAU,
  accumulateWheelTurns,
  clamp,
  createBoatState,
  leverOpening,
  mpsToKmh,
  stepBoat,
  toDegrees
} from "./boat-model.mjs";

const $ = (selector) => document.querySelector(selector);
const canvas = $("#water");
const context = canvas.getContext("2d");
const wheelZone = $("#wheelZone");
const wheel = $("#wheel");
const throttleTrack = $("#throttleTrack");
const throttleLever = $("#throttleLever");

let state = createBoatState();
let throttle = 0;
let wheelTurns = 0;
let wheelPointer = null;
let previousWheelAngle = 0;
let throttlePointer = null;
let previousFrame = performance.now();

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}
addEventListener("resize", resizeCanvas);
resizeCanvas();

function wheelAngleFromEvent(event) {
  const rect = wheelZone.getBoundingClientRect();
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
}

wheelZone.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  wheelPointer = event.pointerId;
  previousWheelAngle = wheelAngleFromEvent(event);
  wheelZone.setPointerCapture(event.pointerId);
});
wheelZone.addEventListener("pointermove", (event) => {
  if (event.pointerId !== wheelPointer) return;
  event.preventDefault();
  const nextAngle = wheelAngleFromEvent(event);
  wheelTurns = accumulateWheelTurns(wheelTurns, previousWheelAngle, nextAngle);
  previousWheelAngle = nextAngle;
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => wheelZone.addEventListener(type, (event) => {
  if (event.pointerId === wheelPointer) wheelPointer = null;
}));

function setThrottleFromPointer(event) {
  const rect = throttleTrack.getBoundingClientRect();
  throttle = leverOpening(event.clientY, rect.top + 17, rect.bottom - 17);
}
throttleTrack.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  throttlePointer = event.pointerId;
  throttleTrack.setPointerCapture(event.pointerId);
  setThrottleFromPointer(event);
});
throttleTrack.addEventListener("pointermove", (event) => {
  if (event.pointerId !== throttlePointer) return;
  event.preventDefault();
  setThrottleFromPointer(event);
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((type) => throttleTrack.addEventListener(type, (event) => {
  if (event.pointerId !== throttlePointer) return;
  throttlePointer = null;
  throttle = 0;
}));

wheelZone.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") wheelTurns = clamp(wheelTurns - .05, -SPEC.steering.lockTurns, SPEC.steering.lockTurns);
  if (event.key === "ArrowRight") wheelTurns = clamp(wheelTurns + .05, -SPEC.steering.lockTurns, SPEC.steering.lockTurns);
  if (event.key === "Home") wheelTurns = 0;
});
throttleTrack.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) event.preventDefault();
  if (event.key === "ArrowUp") throttle = clamp(throttle + .05, 0, 1);
  if (event.key === "ArrowDown") throttle = clamp(throttle - .05, 0, 1);
  if (event.key === "Home") throttle = 0;
  if (event.key === "End") throttle = 1;
});
throttleTrack.addEventListener("keyup", (event) => {
  if (["ArrowUp", "ArrowDown", "End"].includes(event.key)) throttle = 0;
});

function updateControls() {
  const leverBottom = 16;
  const leverTravel = 156;
  throttleLever.style.bottom = `${leverBottom + throttle * leverTravel}px`;
  $("#throttleFill").style.height = `${throttle * leverTravel}px`;
  $("#leverPercent").textContent = `${Math.round(throttle * 100)}%`;
  throttleTrack.setAttribute("aria-valuenow", String(Math.round(throttle * 100)));
  wheel.style.transform = `rotate(${wheelTurns * 360}deg)`;
  const wheelPercent = wheelTurns / SPEC.steering.lockTurns;
  const fill = $("#wheelScaleFill");
  fill.style.left = wheelPercent < 0 ? `${50 + wheelPercent * 50}%` : "50%";
  fill.style.width = `${Math.abs(wheelPercent) * 50}%`;
  $("#steerState").textContent = Math.abs(wheelTurns) < .02 ? "CENTER" : wheelTurns < 0 ? "LEFT" : "RIGHT";
}

function updateTelemetry() {
  $("#speed").textContent = mpsToKmh(state.speedMps).toFixed(1);
  $("#rpm").textContent = Math.round(state.rpm).toLocaleString("ja-JP");
  $("#throttleValue").textContent = `${Math.round(state.throttle * 100)}%`;
  $("#wheelValue").textContent = state.wheelTurns.toFixed(2);
  $("#motorAngle").textContent = `${toDegrees(state.motorAngleRad).toFixed(1)}°`;
  $("#heading").textContent = `${((toDegrees(state.headingRad) % 360) + 360).toFixed(1)}°`;
  $("#position").textContent = `${state.xM.toFixed(1)} / ${state.yM.toFixed(1)}m`;
  $("#distance").textContent = `${state.distanceM.toFixed(1)}m`;
}

function drawWater(now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const grid = 34;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#123b48");
  gradient.addColorStop(1, "#061b26");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#b5edf016";
  context.lineWidth = 1;
  const offsetX = ((-state.xM * 3) % grid + grid) % grid;
  const offsetY = ((state.yM * 3) % grid + grid) % grid;
  for (let x = offsetX; x < width; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = offsetY; y < height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  for (let y = 12; y < height; y += 14) {
    context.strokeStyle = `rgba(170,235,239,${.025 + y / height * .035})`;
    context.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const waveY = y + Math.sin(x * .045 + now * .0014 + y * .05) * 2;
      x ? context.lineTo(x, waveY) : context.moveTo(x, waveY);
    }
    context.stroke();
  }

  const centerX = width / 2;
  const centerY = height * .56;
  const angle = state.headingRad + Math.PI / 2;
  const boatLength = 62;
  const boatWidth = 25;
  if (state.speedMps > .4) {
    const wakeLength = 18 + state.speedMps * 4.3;
    context.save();
    context.translate(centerX, centerY);
    context.rotate(angle);
    const wake = context.createLinearGradient(0, 12, 0, wakeLength);
    wake.addColorStop(0, "#e8ffffa8");
    wake.addColorStop(1, "#e8ffff00");
    context.fillStyle = wake;
    context.beginPath();
    context.moveTo(-boatWidth / 2, 15);
    context.lineTo(-boatWidth * 1.8, wakeLength);
    context.lineTo(boatWidth * 1.8, wakeLength);
    context.lineTo(boatWidth / 2, 15);
    context.fill();
    context.restore();
  }
  context.save();
  context.translate(centerX, centerY);
  context.rotate(angle);
  context.fillStyle = "#ebf0e9";
  context.beginPath();
  context.moveTo(0, -boatLength / 2);
  context.lineTo(boatWidth / 2, boatLength * .28);
  context.lineTo(boatWidth * .42, boatLength / 2);
  context.lineTo(-boatWidth * .42, boatLength / 2);
  context.lineTo(-boatWidth / 2, boatLength * .28);
  context.closePath();
  context.fill();
  context.fillStyle = "#d93d43";
  context.fillRect(-boatWidth * .32, -3, boatWidth * .64, boatLength * .32);
  context.strokeStyle = "#ffbb62";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, boatLength * .34);
  context.lineTo(Math.sin(state.motorAngleRad) * 19, boatLength * .6);
  context.stroke();
  context.restore();
}

function reset() {
  state = createBoatState();
  throttle = 0;
  wheelTurns = 0;
  previousFrame = performance.now();
  updateControls();
  updateTelemetry();
}
$("#reset").addEventListener("click", reset);

function frame(now) {
  const dt = Math.min((now - previousFrame) / 1000, .05);
  previousFrame = now;
  updateControls();
  state = stepBoat(state, { throttle, wheelTurns }, dt);
  updateTelemetry();
  drawWater(now);
  requestAnimationFrame(frame);
}
reset();
requestAnimationFrame(frame);
