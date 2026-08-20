import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class ClassList {
  constructor() { this.values = new Set(); }
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) {
    const next = force === undefined ? !this.values.has(item) : force;
    next ? this.values.add(item) : this.values.delete(item);
    return next;
  }
}

class FakeElement {
  constructor(selector) {
    this.selector = selector;
    this.classList = new ClassList();
    this.style = {};
    this.hidden = ["#tutorial", "#settings", "#pause", "#gameShell"].includes(selector);
    this.disabled = false;
    this.value = selector === "#balance" ? "54" : "";
    this.checked = true;
    this.textContent = "";
    this.innerHTML = "";
    this.dataset = {};
    this.listeners = new Map();
    this.offsetWidth = 100;
  }
  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  dispatch(type, extra = {}) {
    const event = { preventDefault() {}, pointerId: 1, target: this, ...extra };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
  }
  querySelector(selector) { return getElement(`${this.selector} ${selector}`); }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, right: 112, bottom: 112, width: 112, height: 112 }; }
  getContext() { return canvasContext; }
}

const elements = new Map();
function getElement(selector) {
  if (!elements.has(selector)) elements.set(selector, new FakeElement(selector));
  return elements.get(selector);
}

const canvasContext = new Proxy({}, {
  get(target, prop) {
    if (prop === "createLinearGradient") return () => ({ addColorStop() {} });
    if (prop === "measureText") return () => ({ width: 10 });
    if (!(prop in target)) target[prop] = () => {};
    return target[prop];
  },
  set(target, prop, value) { target[prop] = value; return true; }
});

let clock = 0;
const storage = new Map([["wave-crown-v4", JSON.stringify({ tutorialSeen: true })]]);
const document = {
  body: getElement("body"),
  querySelector: getElement,
  querySelectorAll: () => []
};
const sandbox = {
  console,
  document,
  navigator: { vibrate() {} },
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  },
  performance: { now: () => clock },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 2,
  requestAnimationFrame() {},
  addEventListener() {},
  setTimeout: (callback) => { callback(); return 1; },
  clearTimeout() {},
  confirm: () => false,
  structuredClone,
  location: { search: "", reload() {} },
  URLSearchParams,
  Math,
  Date
};
sandbox.window = { ...sandbox, AudioContext: undefined, webkitAudioContext: undefined, scrollTo() {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const source = fs.readFileSync(new URL("../game.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const referencedIds = new Set([...source.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/g)].map((match) => match[1]));
const missingIds = [...referencedIds].filter((id) => !ids.has(id));
assert.deepEqual(missingIds, [], `missing HTML ids: ${missingIds.join(", ")}`);
assert.equal(source.includes("LEGACY_RACE_ENGINE_DISABLED"), false, "legacy engine must be removed");
assert.equal((source.match(/function beginStartSequence/g) || []).length, 1, "one start sequence only");
assert.equal((source.match(/function updateRace/g) || []).length, 1, "one race loop only");
assert.equal((source.match(/function finishRace/g) || []).length, 1, "one finish handler only");
assert.match(html, /id="throttleTrack"[^>]+role="slider"/, "public race uses a continuous throttle lever");
assert.match(html, /id="raceWheelZone"[^>]+role="application"/, "public race uses the circular steering wheel");
assert.doesNotMatch(html, /id="(?:left|right|brake|throttle)"/, "legacy button controls must not return");
assert.match(html, /360度操舵ハンドル/, "the one-revolution steering rule is visible to assistive technology");
vm.runInContext(source, sandbox, { filename: "game.js" });

const state = (expression) => vm.runInContext(expression, sandbox);
const setInput = ({ throttle = 0, wheel = 0 }) => {
  vm.runInContext(`throttleCommand=${throttle};wheelTurns=${wheel}`, sandbox);
};
const tick = (seconds = 1 / 60) => {
  clock += seconds * 1000;
  vm.runInContext(`updateRace(${clock},${seconds})`, sandbox);
};
const begin = () => getElement("#startRace").dispatch("click");

assert.equal(getElement("#pause").hidden, true, "pause overlay starts hidden");
begin();
assert.equal(state("racePhase"), "approach", "fanfare leads to pit out");
assert.equal(state("player.speed"), 0, "boat is stopped in the pit");
getElement("#raceWheelZone").dispatch("pointerdown", { pointerId: 7, clientX: 112, clientY: 56 });
getElement("#raceWheelZone").dispatch("pointermove", { pointerId: 7, clientX: 56, clientY: 112 });
getElement("#raceWheelZone").dispatch("pointermove", { pointerId: 7, clientX: 0, clientY: 56 });
getElement("#raceWheelZone").dispatch("pointermove", { pointerId: 7, clientX: 56, clientY: 0 });
getElement("#raceWheelZone").dispatch("pointermove", { pointerId: 7, clientX: 112, clientY: 56 });
assert.ok(Math.abs(state("wheelTurns") - 1) < 1e-9, "one circular gesture accumulates exactly one wheel revolution");
getElement("#raceWheelZone").dispatch("pointerup", { pointerId: 7 });
setInput({});

for (let frames = 0; frames < 2400 && state("racePhase") === "approach"; frames++) {
  const until = state("(startZeroAt - performance.now()) / 1000");
  const remainingM = state("Math.max(0, 1 - player.route) * PRESTART_ROUTE_M");
  const speedMps = state("physicsSpeedMps");
  const desiredSeconds = Math.max(.2, until + .16);
  const neededMps = remainingM / desiredSeconds;
  setInput({ throttle: neededMps > speedMps + .28 ? 1 : neededMps < speedMps - .16 ? 0 : .42 });
  tick();
}
assert.equal(state("racePhase"), "race", "guided controls produce a legal flying start");
assert.ok(state("startReaction") >= 0 && state("startReaction") < 1, "start is inside 0.00–0.99");

for (let frames = 0; frames < 10000 && state("racePhase") === "race"; frames++) {
  const targetWheel = state("turnInfo(player.progress).targetWheel");
  const targetThrottle = state("turnInfo(player.progress).targetThrottle");
  setInput({ throttle: targetThrottle, wheel: targetWheel });
  tick();
}
assert.equal(state("racePhase"), "finished", "race reaches the finish after three laps");
assert.ok(state("player.progress") >= 3, "three complete laps are required");

begin();
setInput({ throttle: 1 });
for (let frames = 0; frames < 2200 && state("racePhase") === "approach"; frames++) tick();
assert.equal(state("racePhase"), "disqualified", "full throttle too early triggers flying");
assert.equal(getElement("#racePhaseLabel").textContent, "F");

begin();
setInput({});
for (let frames = 0; frames < 2200 && state("racePhase") === "approach"; frames++) tick();
assert.equal(state("racePhase"), "disqualified", "missing the line triggers late start");
assert.equal(getElement("#racePhaseLabel").textContent, "L");

console.log("WAVE CROWN runtime smoke tests passed");
