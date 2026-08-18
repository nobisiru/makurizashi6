const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const racers = [
  [1,"黒瀬 凪","A2","#f4f4f0","#17191d",".17","—"],
  [2,"南雲 澪","B1","#252930","#fff",".19","—"],
  [3,"YOU","B2","#e93c3c","#fff",".21","○"],
  [4,"東條 碧","A1","#3d77e8","#fff",".14","◎"],
  [5,"宇佐見 灯","A2","#e8d533","#17191d",".16","—"],
  [6,"城戸 渉","B1","#48a86b","#fff",".22","—"],
];

let tune = { balance: 54, part: "turn" };
try { tune = { ...tune, ...JSON.parse(localStorage.getItem("wave-crown-save") || "{}") }; } catch (_) {}

function openScreen(id) {
  $$(".screen,.race-screen").forEach((el) => el.classList.remove("active"));
  $("#" + id).classList.add("active");
  $(".nav").style.display = id === "race" ? "none" : "flex";
  window.scrollTo(0, 0);
}

$$('[data-go]').forEach((button) => button.addEventListener("click", () => openScreen(button.dataset.go)));
$("#sound").addEventListener("click", (event) => event.currentTarget.textContent = event.currentTarget.textContent === "♪" ? "×" : "♪");

$("#racerList").innerHTML = racers.map((r) => `<div class="racer ${r[1] === "YOU" ? "you" : ""}"><span class="lane" style="background:${r[3]};color:${r[4]}">${r[0]}</span><span class="racer-name"><small>${r[2]}</small><b>${r[1]}</b></span><span class="st"><small>AVG ST</small><b>${r[5]}</b></span><span class="mood">${r[6]}</span></div>`).join("");

function updateTune() {
  const balance = Number($("#balance").value);
  $("#balanceValue").textContent = `${balance - 50 >= 0 ? "+" : ""}${balance - 50}`;
  const score = Math.round(68 + Math.max(0, 10 - Math.abs(54 - balance) / 2));
  $("#score").textContent = score;
  $("#liveScore").textContent = score;
}
$("#balance").value = tune.balance;
$$('[data-part]').forEach((button) => {
  button.classList.toggle("selected", button.dataset.part === tune.part);
  button.addEventListener("click", () => {
    $$('[data-part]').forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
    tune.part = button.dataset.part;
  });
});
$("#balance").addEventListener("input", updateTune);
$("#saveTune").addEventListener("click", () => {
  tune.balance = Number($("#balance").value);
  localStorage.setItem("wave-crown-save", JSON.stringify(tune));
  $("#saveTune b").textContent = "整備を保存しました";
  setTimeout(() => $("#saveTune b").textContent = "この整備で決定", 1300);
});
updateTune();

const canvas = $("#raceCanvas");
const ctx = canvas.getContext("2d");
let running = false;
let throttleOn = false;
let steer = 0;
let startAt = 0;
let previous = performance.now();
let player = { progress: 0, lane: .5, speed: 0 };
let ai = [];

function resetRace() {
  running = false; throttleOn = false; steer = 0;
  player = { progress: 0, lane: .5, speed: 0 };
  ai = [
    { progress: .013, lane: .16, speed: .076, color: "#f4f4f0", number: 1 },
    { progress: .008, lane: .30, speed: .074, color: "#252930", number: 2 },
    { progress: -.006, lane: .62, speed: .079, color: "#3979e8", number: 4 },
    { progress: -.011, lane: .76, speed: .077, color: "#e4d33a", number: 5 },
    { progress: -.018, lane: .90, speed: .072, color: "#48aa6d", number: 6 },
  ];
  $("#lap").textContent = "1/3"; $("#rank").textContent = "3th"; $("#speed").textContent = "0";
  $("#throttle").disabled = true; $("#throttle").classList.remove("active"); $("#throttle small").textContent = "TAP TO OPEN";
}

$("#startRace").addEventListener("click", () => {
  resetRace(); openScreen("race");
  let count = 3;
  $("#countdown").style.display = "grid"; $("#countdown b").textContent = count;
  $("#raceTip").textContent = "スタートに合わせてスロットルを押せ";
  const timer = setInterval(() => {
    count -= 1;
    if (count === 0) {
      clearInterval(timer); $("#countdown").style.display = "none";
      running = true; startAt = performance.now(); previous = startAt;
      $("#throttle").disabled = false; $("#raceTip").textContent = "1マークへ。内側のブルーラインを狙え";
    } else $("#countdown b").textContent = count;
  }, 850);
});

$("#exitRace").addEventListener("click", () => { running = false; openScreen("entry"); });
$("#throttle").addEventListener("click", () => {
  throttleOn = !throttleOn; $("#throttle").classList.toggle("active", throttleOn);
  $("#throttle small").textContent = throttleOn ? "FULL OPEN" : "TAP TO OPEN";
});
function steerStart(value) { return (event) => { event.preventDefault(); steer = value; }; }
function steerStop() { steer = 0; }
$("#left").addEventListener("pointerdown", steerStart(-1)); $("#right").addEventListener("pointerdown", steerStart(1));
[$("#left"), $("#right")].forEach((button) => ["pointerup","pointerleave","pointercancel"].forEach((name) => button.addEventListener(name, steerStop)));

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * ratio; canvas.height = innerHeight * ratio;
  canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
addEventListener("resize", resize); resize();

function point(progress, lane, w, h) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return { x:w/2 + Math.cos(angle)*w*(.34+lane*.045), y:h*.46 + Math.sin(angle)*h*(.255+lane*.035), angle:angle+Math.PI/2 };
}
function boat(boatData, w, h, playerBoat = false) {
  const p = point(boatData.progress, boatData.lane, w, h);
  ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.angle);
  if (playerBoat) { ctx.shadowColor="#43e4f3"; ctx.shadowBlur=16; }
  ctx.fillStyle="#d7faff66"; ctx.beginPath(); ctx.moveTo(-5,10);ctx.lineTo(0,32);ctx.lineTo(5,10);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle=boatData.color;ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(8,9);ctx.lineTo(0,15);ctx.lineTo(-8,9);ctx.closePath();ctx.fill();
  ctx.fillStyle=boatData.number===2?"#fff":"#061018";ctx.font="900 8px system-ui";ctx.textAlign="center";ctx.fillText(boatData.number,0,6);ctx.restore();
}
function finish(place, time) {
  running = false; const suffix = place === 1 ? "ST" : place === 2 ? "ND" : place === 3 ? "RD" : "TH";
  $("#place").textContent=place;$(".place i").textContent=suffix;$("#raceTime").textContent=time.toFixed(2);
  $("#resultMessage").textContent=place===1?"初優勝。水面を制した。":place<=3?"表彰台。次は頂点へ。":"悔しさを、次の整備へ。";
  $("#prize").textContent=place===1?"¥320,000":place<=3?"¥180,000":"¥80,000";$("#fans").textContent=`+${72-place*10}`;
  setTimeout(()=>openScreen("result"),500);
}

function frame(now) {
  const w=innerWidth,h=innerHeight,dt=Math.min((now-previous)/1000,.25);previous=now;
  if(running){
    player.speed += (throttleOn ? (tune.part==="launch"?.34:.27) : -.20)*dt;
    player.speed=Math.max(.018,Math.min(.088+(tune.part==="top"?.008:0),player.speed));
    player.lane=Math.max(.05,Math.min(.95,player.lane+steer*.46*dt));
    const phase=((player.progress%1)+1)%1,inTurn=phase<.24||(phase>.48&&phase<.74)||phase>.98,ideal=inTurn?.26:.48;
    player.progress+=Math.max(.03,player.speed-Math.abs(player.lane-ideal)*(tune.part==="turn"?.010:.017))*dt;
    ai.forEach((b,i)=>b.progress+=(b.speed+Math.sin(now/880+i)*.002)*dt);
    const lap=Math.min(3,Math.floor(player.progress)+1),rank=1+ai.filter(b=>b.progress>player.progress).length;
    $("#lap").textContent=`${lap}/3`;$("#rank").textContent=`${rank}${rank===1?"st":rank===2?"nd":rank===3?"rd":"th"}`;$("#speed").textContent=Math.round(player.speed*930);
    if(player.progress>=3)finish(rank,(now-startAt)/1000);
  }
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,"#07151f");sky.addColorStop(.32,"#0b2634");sky.addColorStop(1,"#073244");ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  ctx.fillStyle="#a5e7ee14";for(let y=h*.22;y<h;y+=13)ctx.fillRect(0,y+Math.sin(now/500+y)*2,w,1);
  ctx.save();ctx.translate(w/2,h*.46);ctx.scale(1,.74);ctx.translate(-w/2,-h*.46);ctx.strokeStyle="#91ebf21f";ctx.lineWidth=w*.10;ctx.beginPath();ctx.ellipse(w/2,h*.46,w*.36,h*.27,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="#78eef4aa";ctx.lineWidth=1;ctx.setLineDash([7,8]);ctx.beginPath();ctx.ellipse(w/2,h*.46,w*.35,h*.262,0,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.setLineDash([]);
  ctx.fillStyle="#ff4b2b";[[w*.17,h*.46],[w*.83,h*.46]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffb130";ctx.fillRect(x-1,y-24,2,18);ctx.fillStyle="#ff4b2b";});
  [...ai].sort((a,b)=>a.progress-b.progress).forEach(b=>boat(b,w,h));boat({progress:player.progress,lane:player.lane,color:"#e73d3d",number:3},w,h,true);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
