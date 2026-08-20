const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const defaultSave = {
  tune: { balance: 54, part: "turn" }, strategy: "inside", money: 840000, fans: 840,
  races: 11, wins: 2, tutorialSeen: false,
  settings: { sound: true, haptic: true, reduceMotion: false }
};
let save = structuredClone(defaultSave);
try { save = { ...save, ...JSON.parse(localStorage.getItem("wave-crown-v4") || "{}") }; } catch (_) {}
save.tune = { ...defaultSave.tune, ...(save.tune || {}) };
save.settings = { ...defaultSave.settings, ...(save.settings || {}) };

const persist = () => localStorage.setItem("wave-crown-v4", JSON.stringify(save));
const haptic = (pattern) => { if (save.settings.haptic && navigator.vibrate) navigator.vibrate(pattern); };
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.remove("show"); void el.offsetWidth; el.classList.add("show"); }

const audio = {
  ctx: null, engine: null, engineGain: null,
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
  },
  tone(freq = 440, length = .08, type = "sine", volume = .035, delay = 0) {
    if (!save.settings.sound || !this.ctx) return;
    const start = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, start); gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(.0001, start + length);
    osc.connect(gain).connect(this.ctx.destination); osc.start(start); osc.stop(start + length);
  },
  ui() { this.tone(720, .045, "triangle", .025); },
  count(n) { this.tone(n === 0 ? 920 : 540, n === 0 ? .24 : .08, "square", .035); },
  startEngine() {
    if (!save.settings.sound || !this.ctx || this.engine) return;
    this.engine = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
    this.engine.type = "sawtooth"; this.engine.frequency.value = 70; this.engineGain.gain.value = .0001;
    const filter = this.ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 320;
    this.engine.connect(filter).connect(this.engineGain).connect(this.ctx.destination); this.engine.start();
  },
  updateEngine(speed, throttle) {
    if (!this.engine || !this.ctx) return;
    this.engine.frequency.setTargetAtTime(62 + speed * 2.2, this.ctx.currentTime, .06);
    this.engineGain.gain.setTargetAtTime(!save.settings.sound ? .0001 : throttle ? .032 : .008, this.ctx.currentTime, .08);
  },
  stopEngine() { if (this.engine) { try { this.engine.stop(); } catch (_) {} this.engine = null; this.engineGain = null; } },
  burst() { this.tone(130, .35, "sawtooth", .06); this.tone(760, .2, "triangle", .035, .05); },
  result(win) { this.stopEngine(); [0, .12, .24].forEach((d, i) => this.tone((win ? [523,659,784] : [392,440,523])[i], .45, "triangle", .04, d)); }
};

function openScreen(id) {
  $$(".screen,.race-screen").forEach((el) => el.classList.remove("active"));
  $("#" + id).classList.add("active");
  $(".nav").style.display = id === "race" ? "none" : "flex";
  $$(".nav [data-go]").forEach((button) => button.classList.toggle("active", button.dataset.go === id));
  window.scrollTo(0, 0); audio.ui();
}
$$('[data-go]').forEach((button) => button.addEventListener("click", () => openScreen(button.dataset.go)));

function updateProfile() {
  $("#fansTotal").textContent = save.fans.toLocaleString("ja-JP");
  $("#moneyTotal").textContent = `¥${Math.round(save.money / 1000)}K`;
  $("#winRate").textContent = `${((save.wins / Math.max(1, save.races)) * 100).toFixed(1)}%`;
}
updateProfile();

$("#enterGame").addEventListener("click", () => {
  audio.init(); if (audio.ctx?.state === "suspended") audio.ctx.resume(); audio.ui(); haptic(20);
  $("#splash").classList.remove("active"); $("#gameShell").hidden = false; openScreen("dock");
  if (!save.tutorialSeen) setTimeout(() => startTutorial(), 420);
});

const tutorialPages = [
  ["01","ピットから始まる","ファンファーレ後に6艇が一斉にピット離れ。アクセルを押し続けて水面へ出ます。"],
  ["02","大時計で合わせる","待機行動で進入コースと助走距離を決め、0.00〜0.99秒でスタートラインを通過します。"],
  ["03","減速して旋回","1・2マーク手前で減速し、左へ切りながらアクセルを戻す。これを3周します。"]
];
let tutorialIndex = 0;
function renderTutorial() {
  const [visual,title,text] = tutorialPages[tutorialIndex];
  $("#tutorialVisual").textContent = visual; $("#tutorialStep").textContent = `0${tutorialIndex + 1} / 03`; $("#tutorialTitle").textContent = title; $("#tutorialText").textContent = text;
  $$(".dots i").forEach((dot, i) => dot.classList.toggle("active", i === tutorialIndex));
  $("#tutorialNext").textContent = tutorialIndex === 2 ? "レースへ　→" : "次へ　→";
}
function startTutorial() { tutorialIndex = 0; renderTutorial(); $("#tutorial").hidden = false; }
$("#tutorialNext").addEventListener("click", () => {
  audio.ui();
  if (tutorialIndex < 2) { tutorialIndex++; renderTutorial(); }
  else { $("#tutorial").hidden = true; save.tutorialSeen = true; persist(); openScreen("entry"); }
});

function applySettings() {
  $("#soundToggle").checked = save.settings.sound; $("#hapticToggle").checked = save.settings.haptic; $("#motionToggle").checked = save.settings.reduceMotion;
  document.body.classList.toggle("reduce-motion", save.settings.reduceMotion);
}
applySettings();
$("#settingsButton").addEventListener("click", () => { applySettings(); $("#settings").hidden = false; });
$$('[data-close="settings"]').forEach((button) => button.addEventListener("click", () => $("#settings").hidden = true));
[["soundToggle","sound"],["hapticToggle","haptic"],["motionToggle","reduceMotion"]].forEach(([id,key]) => $("#"+id).addEventListener("change", (event) => { save.settings[key] = event.target.checked; applySettings(); persist(); audio.ui(); }));
$("#resetSave").addEventListener("click", () => { if (confirm("整備・賞金・戦績をすべて初期化しますか？")) { localStorage.removeItem("wave-crown-v4"); location.reload(); } });
$("#careerButton").addEventListener("click", () => toast(`SEASON 1　現在48位・残り8戦`));
$("#recordButton").addEventListener("click", () => toast(`${save.races}戦 ${save.wins}勝　獲得賞金 ¥${save.money.toLocaleString("ja-JP")}`));

const racers = [
  [1,"黒瀬 凪","A2","#f4f4f0","#17191d",".17","—"],[2,"南雲 澪","B1","#252930","#fff",".19","—"],
  [3,"YOU","B2","#e93c3c","#fff",".21","○"],[4,"東條 碧","A1","#3d77e8","#fff",".14","◎"],
  [5,"宇佐見 灯","A2","#e8d533","#17191d",".16","—"],[6,"城戸 渉","B1","#48a86b","#fff",".22","—"]
];
$("#racerList").innerHTML = racers.map((r) => `<div class="racer ${r[1] === "YOU" ? "you" : ""}"><span class="lane" style="background:${r[3]};color:${r[4]}">${r[0]}</span><span class="racer-name"><small>${r[2]}</small><b>${r[1]}</b></span><span class="st"><small>AVG ST</small><b>${r[5]}</b></span><span class="mood">${r[6]}</span></div>`).join("");

function updateTune() {
  const balance = Number($("#balance").value), centerBonus = Math.max(0, 10 - Math.abs(54 - balance) / 2), score = Math.round(68 + centerBonus);
  const bonuses = { launch:[5,0,0], turn:[0,0,6], top:[0,5,0] }[save.tune.part];
  const values = [74 + bonuses[0], 67 + bonuses[1], 81 + bonuses[2]];
  $("#balanceValue").textContent = `${balance - 50 >= 0 ? "+" : ""}${balance - 50}`; $("#score").textContent = score; $("#liveScore").textContent = score;
  ["launch","top","turn"].forEach((name,i) => { $("#"+name+"Stat").textContent = values[i]; $("#"+name+"Bar").style.width = `${values[i]}%`; });
}
$("#balance").value = save.tune.balance;
$$('[data-part]').forEach((button) => { button.classList.toggle("selected", button.dataset.part === save.tune.part); button.addEventListener("click", () => { $$('[data-part]').forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); save.tune.part = button.dataset.part; updateTune(); audio.ui(); }); });
$("#balance").addEventListener("input", updateTune);
$("#saveTune").addEventListener("click", () => { save.tune.balance = Number($("#balance").value); persist(); updateTune(); haptic(25); toast("整備内容を保存しました"); setTimeout(() => openScreen("dock"), 550); });
updateTune();

$$('[data-strategy]').forEach((button) => { button.classList.toggle("selected", button.dataset.strategy === save.strategy); button.addEventListener("click", () => { $$('[data-strategy]').forEach((item) => item.classList.remove("selected")); button.classList.add("selected"); save.strategy = button.dataset.strategy; persist(); audio.ui(); const copy = {inside:["差し","1マーク手前で内側へ寄せ、旋回出口から全開。"],attack:["まくり","外へ開き、速度を保ったまま大きく全速旋回。"],safe:["堅実","中央ラインを維持し、接触リスクを抑える。"]}[save.strategy]; $(".intel p").innerHTML = `<strong>${copy[0]}</strong>なら${copy[1]}`; }); });

/* LEGACY_RACE_ENGINE_DISABLED
const canvas = $("#raceCanvas"), ctx = canvas.getContext("2d");
let racePhase = "idle", pausedFrom = "idle", throttleOn = false, steer = 0, goAt = 0, raceStart = 0, previous = performance.now(), boostUntil = 0, wakeHitUntil = 0, flow = 0, lastRank = 3;
let startReaction = .21, startLabel = "GOOD", lineTotal = 0, lineSamples = 0, lapStarted = 0, laps = [], particles = [];
let player = { progress:0, lane:.5, speed:0 }, ai = [];

function resetRace() {
  audio.stopEngine(); racePhase = "countdown"; throttleOn = false; steer = 0; boostUntil = 0; wakeHitUntil = 0; flow = 0; lastRank = 3; particles = []; laps = []; lineTotal = 0; lineSamples = 0;
  player = {progress:0,lane:.5,speed:0};
  ai = [
    {progress:.020,lane:.14,speed:.126,color:"#f4f4f0",number:1},{progress:.012,lane:.29,speed:.123,color:"#252930",number:2},
    {progress:-.006,lane:.62,speed:.131,color:"#3979e8",number:4},{progress:-.015,lane:.77,speed:.128,color:"#e4d33a",number:5},{progress:-.024,lane:.91,speed:.121,color:"#48aa6d",number:6}
  ];
  $("#lap").textContent="1/3";$("#rank").textContent="3rd";$("#speed").textContent="0";$("#flowBar").style.width="0%";$("#flowValue").textContent="0";
  $("#throttle").disabled=true;$("#throttle").classList.remove("active");$("#throttle small").textContent="WAIT";$("#boost").disabled=true;$("#boost").classList.remove("ready");$("#speedLines").classList.remove("active");
}

function beginStartSequence() {
  resetRace(); openScreen("race"); let count = 3; $("#countdown").style.display="grid";$("#countdown small").textContent="START SEQUENCE";$("#countdown b").textContent=count;$("#raceTip").textContent="GOに合わせてスロットルをタップ";audio.count(count);
  const timer = setInterval(() => {
    if (racePhase !== "countdown") { clearInterval(timer); return; }
    count--;
    if (count === 0) {
      clearInterval(timer); goAt=performance.now();racePhase="await-start";$("#countdown small").textContent="";$("#countdown b").textContent="GO";$("#throttle").disabled=false;$("#throttle small").textContent="TAP NOW";audio.count(0);haptic([25,25,55]);
      setTimeout(()=>{ if(racePhase==="await-start") launchRace(1.20); },1200);
      setTimeout(()=>{ if(racePhase!=="countdown") $("#countdown").style.display="none"; },700);
    } else { $("#countdown b").textContent=count;audio.count(count);haptic(12); }
  },780);
}
$("#startRace").addEventListener("click",beginStartSequence);$("#retryRace").addEventListener("click",beginStartSequence);

function showStartFeedback(label,reaction) {
  const el=$("#startFeedback"), colors={PERFECT:"#48e6f2",GOOD:"#f3f7f5",LATE:"#ffb24b"};el.style.color=colors[label];el.innerHTML=`${label}<small style="display:block;font-size:12px">ST ${reaction.toFixed(2)}</small>`;el.classList.remove("show");void el.offsetWidth;el.classList.add("show");
}
function launchRace(reaction) {
  startReaction=reaction;startLabel=reaction<=.18?"PERFECT":reaction<=.38?"GOOD":"LATE";showStartFeedback(startLabel,reaction);racePhase="race";raceStart=performance.now();lapStarted=raceStart;previous=raceStart;throttleOn=true;
  const startBonus=startLabel==="PERFECT"?.035:startLabel==="GOOD"?.008:-.035;player.progress+=startBonus;
  $("#throttle").classList.add("active");$("#throttle small").textContent="FULL OPEN";$("#raceTip").textContent=save.strategy==="inside"?"1マークへ。内側の青いラインを狙え":"理想ラインを維持してFLOWを溜めろ";audio.startEngine();haptic(startLabel==="PERFECT"?[35,25,55]:25);
}
$("#throttle").addEventListener("click",()=>{
  if(racePhase==="await-start"){launchRace((performance.now()-goAt)/1000);return;}
  if(racePhase!=="race")return;throttleOn=!throttleOn;$("#throttle").classList.toggle("active",throttleOn);$("#throttle small").textContent=throttleOn?"FULL OPEN":"COAST";audio.ui();
});
function steerStart(value){return(event)=>{event.preventDefault();steer=value;haptic(8);};}function steerStop(){steer=0;}
$("#left").addEventListener("pointerdown",steerStart(-1));$("#right").addEventListener("pointerdown",steerStart(1));[$("#left"),$("#right")].forEach(button=>["pointerup","pointerleave","pointercancel"].forEach(name=>button.addEventListener(name,steerStop)));
$("#boost").addEventListener("click",()=>{if(racePhase!=="race"||flow<99)return;flow=0;boostUntil=performance.now()+1650;$("#boost").disabled=true;$("#boost").classList.remove("ready");$("#speedLines").classList.add("active");audio.burst();haptic([45,20,80]);setTimeout(()=>$("#speedLines").classList.remove("active"),1650);});

function pauseRace(){if(racePhase!=="race")return;pausedFrom=racePhase;racePhase="paused";$("#pause").hidden=false;audio.updateEngine(0,false);}$("#pauseRace").addEventListener("click",pauseRace);
$("#resumeRace").addEventListener("click",()=>{racePhase=pausedFrom;previous=performance.now();$("#pause").hidden=true;});
$("#restartRace").addEventListener("click",()=>{$("#pause").hidden=true;beginStartSequence();});
$("#retireRace").addEventListener("click",()=>{racePhase="idle";audio.stopEngine();$("#pause").hidden=true;openScreen("entry");});

function resizeCanvas(){const ratio=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio;canvas.style.width=innerWidth+"px";canvas.style.height=innerHeight+"px";ctx.setTransform(ratio,0,0,ratio,0,0);}addEventListener("resize",resizeCanvas);resizeCanvas();
const TAU=Math.PI*2,TRACK_X=620,TRACK_Y=238;
function trackPoint(progress,lane=.5){const a=((progress%1)+1)%1*TAU-Math.PI/2,rx=TRACK_X+(lane-.5)*92,ry=TRACK_Y+(lane-.5)*58,x=Math.cos(a)*rx,y=Math.sin(a)*ry;return{x,y,angle:Math.atan2(Math.cos(a)*ry,-Math.sin(a)*rx)};}
function projectWorld(target,camera,width,horizon,focal,cameraHeight,objectHeight=0){const fx=Math.cos(camera.angle),fy=Math.sin(camera.angle),rx=-fy,ry=fx,dx=target.x-camera.x,dy=target.y-camera.y,depth=dx*fx+dy*fy;if(depth<12)return null;const lateral=dx*rx+dy*ry,scale=focal/depth;return{x:width/2+lateral*scale,y:horizon+(cameraHeight-objectHeight)*scale,scale,depth};}
function spawnParticle(){const p=trackPoint(player.progress-.01,player.lane);particles.push({x:p.x+(Math.random()-.5)*10,y:p.y+(Math.random()-.5)*10,life:1,size:3+Math.random()*5});if(particles.length>100)particles.shift();}
function idealLane(progress){const p=((progress%1)+1)%1,inTurn=p<.22||(p>.48&&p<.72)||p>.97;if(!inTurn)return save.strategy==="attack"?.58:.45;return save.strategy==="inside"?.16:save.strategy==="attack"?.72:.42;}
function positionSuffix(n){return`${n}${n===1?"st":n===2?"nd":n===3?"rd":"th"}`;}
function callOvertake(rank){const el=$("#overtake");el.textContent=rank<lastRank?`OVERTAKE · ${positionSuffix(rank)}`:`POSITION DOWN · ${positionSuffix(rank)}`;el.classList.remove("show");void el.offsetWidth;el.classList.add("show");haptic(rank<lastRank?35:18);lastRank=rank;}
function finishRace(place,now){racePhase="finished";audio.result(place===1);const finalLap=(now-lapStarted)/1000;if(finalLap>1)laps.push(finalLap);const elapsed=(now-raceStart)/1000,best=laps.length?Math.min(...laps):elapsed/3,lineScore=Math.round(lineTotal/Math.max(1,lineSamples)*100),prize=place===1?320000:place<=3?180000:80000,fans=Math.max(12,72-place*10);
  save.races++;if(place===1)save.wins++;save.money+=prize;save.fans+=fans;persist();updateProfile();
  $("#place").textContent=place;$(".place i").textContent=place===1?"ST":place===2?"ND":place===3?"RD":"TH";$("#raceTime").textContent=elapsed.toFixed(2);$("#resultMessage").textContent=place===1?"水面を読み切った。完勝。":place<=3?"表彰台。あと一手で頂点。":"敗因はデータになる。次へ。";$("#prize").textContent=`¥${prize.toLocaleString("ja-JP")}`;$("#fans").textContent=`+${fans}`;$("#startGrade").textContent=startLabel;$("#startTime").textContent=startReaction.toFixed(2);$("#bestLap").textContent=best.toFixed(2);$("#lineScore").textContent=lineScore;$("#coachText").textContent=lineScore>=82?"理想ラインの維持が好結果につながった。次はスタート精度を伸ばそう。":startReaction>.4?"スタートの遅れが響いた。GO直後のタップを意識しよう。":"旋回で理想ラインを外れている。早めに内外へ寄せよう。";
  setTimeout(()=>openScreen("result"),650);
}

function updateRace(now,dt){
  if(racePhase==="await-start"||racePhase==="countdown")return;
  if(racePhase!=="race")return;
  const ideal=idealLane(player.progress),accuracy=clamp(1-Math.abs(player.lane-ideal)*1.75,0,1),tuneMax=.139+(save.tune.part==="top"?.010:0)+(save.strategy==="attack"?.003:0),boosting=now<boostUntil;
  player.speed+=((throttleOn?.46:-.32)+(boosting?.26:0))*dt;player.speed=clamp(player.speed,.025,tuneMax+(boosting?.032:0));player.lane=clamp(player.lane+steer*.62*dt,.04,.96);
  const linePenalty=Math.abs(player.lane-ideal)*(save.tune.part==="turn"?.012:save.strategy==="safe"?.014:.024);
  const wakeBoat=ai.find(boat=>{const gap=boat.progress-player.progress;return gap>.012&&gap<.072&&Math.abs(boat.lane-player.lane)<.14;});
  const wakePenalty=wakeBoat?.014:0;
  if(wakeBoat&&now>wakeHitUntil){wakeHitUntil=now+560;const alert=$("#wakeAlert");alert.classList.remove("show");void alert.offsetWidth;alert.classList.add("show");$("#raceTip").textContent=`${wakeBoat.number}号艇の引き波！ 左右へ外して加速を戻せ`;haptic([18,15,24]);}
  player.progress+=Math.max(.04,player.speed-linePenalty-wakePenalty)*dt;
  ai.forEach((boat,i)=>{const wobble=Math.sin(now/700+i)*.0025,catchup=boat.progress<player.progress-.18?.006:0;boat.progress+=(boat.speed+wobble+catchup)*dt;boat.lane=clamp(boat.lane+Math.sin(now/900+i)*.0007,.08,.94);});
  lineTotal+=accuracy;lineSamples++;flow=clamp(flow+(accuracy>.78&&throttleOn?23:-11)*dt,0,100);if(boosting)spawnParticle();if(throttleOn&&Math.random()<.55)spawnParticle();particles.forEach(p=>{p.life-=dt*.95;p.size+=dt*5;});particles=particles.filter(p=>p.life>0);
  const lap=Math.min(3,Math.floor(player.progress)+1);if(lap>laps.length+1){laps.push((now-lapStarted)/1000);lapStarted=now;audio.tone(820,.12,"triangle",.03);haptic([18,20,18]);toast(`LAP ${lap} · ${laps.at(-1).toFixed(2)}`);}
  const rank=1+ai.filter(boat=>boat.progress>player.progress).length;if(rank!==lastRank)callOvertake(rank);
  $("#lap").textContent=`${lap}/3`;$("#rank").textContent=positionSuffix(rank);$("#speed").textContent=Math.round(player.speed*770);$("#flowBar").style.width=`${flow}%`;$("#flowValue").textContent=Math.round(flow);const ready=flow>=99;$("#boost").disabled=!ready;$("#boost").classList.toggle("ready",ready);audio.updateEngine(Math.round(player.speed*770),throttleOn);
  if(player.progress>=3)finishRace(rank,now);
}

function drawWater(w,h,now){const water=ctx.createLinearGradient(0,0,0,h);water.addColorStop(0,"#03101b");water.addColorStop(.24,"#0c3042");water.addColorStop(.255,"#35606b");water.addColorStop(.27,"#0d3948");water.addColorStop(1,"#03141f");ctx.fillStyle=water;ctx.fillRect(0,0,w,h);const horizon=h*.265;ctx.fillStyle="#07151d";for(let x=-30;x<w+40;x+=35){const tower=7+((x*17%26)+26)%26;ctx.fillRect(x,horizon-tower,22,tower);if((x/35)%2===0){ctx.fillStyle="#8eeff522";ctx.fillRect(x+5,horizon-tower+5,2,2);ctx.fillStyle="#07151d";}}for(let y=horizon+8;y<h;y+=12){ctx.strokeStyle=`rgba(167,235,241,${Math.min(.16,.035+y/h*.07)})`;ctx.lineWidth=1;ctx.beginPath();for(let x=0;x<=w;x+=18){const waveY=y+Math.sin(x*.035+now*.0018+y*.07)*(1.5+y/h*2.2);x?ctx.lineTo(x,waveY):ctx.moveTo(x,waveY);}ctx.stroke();}}
function chaseCamera(){const p=trackPoint(player.progress,player.lane);return{x:p.x-Math.cos(p.angle)*92,y:p.y-Math.sin(p.angle)*92,angle:p.angle+steer*.035};}
function drawCourse(camera,w,h){const horizon=h*.265,focal=Math.max(210,w*.78);[{lane:.06,color:"#bfeff03c",size:1.2},{lane:"ideal",color:"#48e6f278",size:1.8},{lane:.94,color:"#bfeff032",size:1.2}].forEach(strip=>{ctx.strokeStyle=strip.color;ctx.lineWidth=strip.size;ctx.setLineDash(strip.lane==="ideal"?[8,10]:[2,10]);ctx.beginPath();let started=false;for(let i=0;i<=100;i++){const progress=player.progress+i*.0032,lane=strip.lane==="ideal"?idealLane(progress):strip.lane,p=projectWorld(trackPoint(progress,lane),camera,w,horizon,focal,62);if(!p||p.y>h*.94){started=false;continue;}started?ctx.lineTo(p.x,p.y):(ctx.moveTo(p.x,p.y),started=true);}ctx.stroke();});ctx.setLineDash([]);}
function drawWake(boat,camera,w,h,now){const horizon=h*.265,focal=Math.max(210,w*.78),pts=[];for(let i=1;i<=8;i++){const p=projectWorld(trackPoint(boat.progress-i*.006,boat.lane),camera,w,horizon,focal,62);if(p)pts.push(p);}if(pts.length<2)return;ctx.save();ctx.globalAlpha=.28+Math.sin(now*.01+boat.number)*.04;ctx.strokeStyle="#d9fbff";ctx.lineWidth=2;[-1,1].forEach(side=>{ctx.beginPath();pts.forEach((p,i)=>{const spread=side*(4+i*3.6);i?ctx.lineTo(p.x+spread,p.y+i*1.5):ctx.moveTo(p.x+spread,p.y);});ctx.stroke();});ctx.restore();}
function drawProjectedBoat(boat,camera,w,h){const horizon=h*.265,focal=Math.max(210,w*.78),p=projectWorld(trackPoint(boat.progress,boat.lane),camera,w,horizon,focal,62,6);if(!p||p.y>h*.91||p.scale<.18)return;const size=clamp(28*p.scale,7,54);ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor="#001018";ctx.shadowBlur=size*.55;ctx.fillStyle="#d8fbff8a";ctx.beginPath();ctx.moveTo(-size*.58,size*.14);ctx.lineTo(-size*1.18,size*.62);ctx.lineTo(size*1.18,size*.62);ctx.lineTo(size*.58,size*.14);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=boat.color;ctx.beginPath();ctx.moveTo(0,-size*.78);ctx.lineTo(size*.62,size*.45);ctx.lineTo(size*.42,size*.66);ctx.lineTo(-size*.42,size*.66);ctx.lineTo(-size*.62,size*.45);ctx.closePath();ctx.fill();ctx.fillStyle=boat.number===2?"#fff":"#061018";ctx.font=`900 ${Math.max(7,size*.42)}px system-ui`;ctx.textAlign="center";ctx.fillText(boat.number,0,size*.28);ctx.restore();}
function drawPlayerBoat(w,h,now){const bob=Math.sin(now*.012)*(1.5+player.speed*14),impact=now<wakeHitUntil?Math.sin(now*.12)*6:0,boatW=Math.min(128,w*.31),boatH=boatW*.63;ctx.save();ctx.translate(w/2+steer*11+impact,h*.76+bob);ctx.rotate(steer*.085+impact*.006);const wake=ctx.createLinearGradient(0,boatH*.25,0,boatH*1.6);wake.addColorStop(0,"#f1ffffbb");wake.addColorStop(1,"#bff7ff00");ctx.fillStyle=wake;ctx.beginPath();ctx.moveTo(-boatW*.34,boatH*.18);ctx.lineTo(-boatW*.78,boatH*1.45);ctx.lineTo(boatW*.78,boatH*1.45);ctx.lineTo(boatW*.34,boatH*.18);ctx.fill();ctx.fillStyle="#d8393f";ctx.beginPath();ctx.moveTo(0,-boatH*.66);ctx.lineTo(boatW*.48,boatH*.38);ctx.lineTo(boatW*.34,boatH*.65);ctx.lineTo(-boatW*.34,boatH*.65);ctx.lineTo(-boatW*.48,boatH*.38);ctx.closePath();ctx.fill();ctx.fillStyle="#f2f6f2";ctx.beginPath();ctx.ellipse(0,boatH*.1,boatW*.22,boatH*.25,0,0,TAU);ctx.fill();ctx.fillStyle="#08131b";ctx.font=`950 ${Math.round(boatW*.21)}px system-ui`;ctx.textAlign="center";ctx.fillText("3",0,boatH*.2);ctx.restore();}
function drawBuoys(camera,w,h){const horizon=h*.265,focal=Math.max(210,w*.78);[.25,.75].forEach(progress=>{const p=projectWorld(trackPoint(progress,-.12),camera,w,horizon,focal,62,12);if(!p||p.scale<.18||p.y>h)return;const size=clamp(9*p.scale,4,20);ctx.fillStyle="#ff542d";ctx.beginPath();ctx.ellipse(p.x,p.y,size*.72,size,0,0,TAU);ctx.fill();ctx.fillStyle="#ffb33f";ctx.fillRect(p.x-size*.1,p.y-size*3.2,size*.2,size*2.5);});}
function drawOnboard(w,now){const insetW=Math.min(212,w*.43),insetH=Math.min(128,Math.max(92,w*.255)),insetX=w-insetW-12,insetY=76,world=trackPoint(player.progress,player.lane),camera={x:world.x+Math.cos(world.angle)*4,y:world.y+Math.sin(world.angle)*4,angle:world.angle+steer*.07},horizon=insetY+insetH*.4,focal=insetW*.7;ctx.save();ctx.beginPath();ctx.roundRect(insetX,insetY,insetW,insetH,6);ctx.clip();const bg=ctx.createLinearGradient(0,insetY,0,insetY+insetH);bg.addColorStop(0,"#0a2634");bg.addColorStop(.39,"#2a5a69");bg.addColorStop(.4,"#0a3444");bg.addColorStop(1,"#05202d");ctx.fillStyle=bg;ctx.fillRect(insetX,insetY,insetW,insetH);ctx.save();ctx.translate(insetX,0);[.08,.5,.92].forEach((lane,index)=>{ctx.strokeStyle=index===1?"#5debf188":"#e1fbff2f";ctx.lineWidth=index===1?1.4:.8;ctx.setLineDash(index===1?[5,6]:[2,7]);ctx.beginPath();let started=false;for(let i=2;i<70;i++){const p=projectWorld(trackPoint(player.progress+i*.0029,lane),camera,insetW,horizon,focal,17);if(!p||p.y>insetY+insetH)continue;started?ctx.lineTo(p.x,p.y):(ctx.moveTo(p.x,p.y),started=true);}ctx.stroke();});ctx.setLineDash([]);[...ai].sort((a,b)=>b.progress-a.progress).forEach(boat=>{const p=projectWorld(trackPoint(boat.progress,boat.lane),camera,insetW,horizon,focal,17,3);if(!p||p.y>insetY+insetH||p.y<insetY)return;const size=clamp(11*p.scale,3,19);ctx.fillStyle="#e8ffff77";ctx.fillRect(p.x-size,p.y+size*.4,size*2,size*.28);ctx.fillStyle=boat.color;ctx.beginPath();ctx.moveTo(p.x,p.y-size);ctx.lineTo(p.x+size*.7,p.y+size*.65);ctx.lineTo(p.x-size*.7,p.y+size*.65);ctx.closePath();ctx.fill();});ctx.restore();const tilt=steer*4+(now<wakeHitUntil?Math.sin(now*.1)*5:0);ctx.save();ctx.translate(insetX+insetW/2,insetY+insetH+8);ctx.rotate(tilt*Math.PI/180);ctx.fillStyle="#d83b42";ctx.beginPath();ctx.moveTo(0,-insetH*.49);ctx.lineTo(insetW*.29,0);ctx.lineTo(-insetW*.29,0);ctx.closePath();ctx.fill();ctx.strokeStyle="#ffffff99";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-insetH*.42);ctx.lineTo(0,-insetH*.08);ctx.stroke();ctx.restore();ctx.restore();}
function drawRace(now){const w=innerWidth,h=innerHeight;drawWater(w,h,now);const camera=chaseCamera(),shake=now<wakeHitUntil&&!save.settings.reduceMotion?Math.sin(now*.11)*3:now<boostUntil&&!save.settings.reduceMotion?Math.sin(now*.08)*2:0;ctx.save();ctx.translate(shake,shake*.35);drawCourse(camera,w,h);ai.forEach(boat=>drawWake(boat,camera,w,h,now));[...ai].sort((a,b)=>b.progress-a.progress).forEach(boat=>drawProjectedBoat(boat,camera,w,h));drawBuoys(camera,w,h);drawPlayerBoat(w,h,now);ctx.restore();drawOnboard(w,now);}
function frame(now){const dt=Math.min((now-previous)/1000,.12);previous=now;updateRace(now,dt);if($("#race").classList.contains("active"))drawRace(now);requestAnimationFrame(frame);}requestAnimationFrame(frame);
*/

const canvas = $("#raceCanvas");
const ctx = canvas.getContext("2d");
const TAU = Math.PI * 2;
const START_WINDOW = 16;
const COURSE_HALF = 520;
const COURSE_RADIUS = 150;
const STRAIGHT = COURSE_HALF * 2;
const HALF_ARC = Math.PI * COURSE_RADIUS;
const COURSE_LENGTH = COURSE_HALF + HALF_ARC + STRAIGHT + HALF_ARC + COURSE_HALF;

let racePhase = "idle";
let pausedFrom = "idle";
let previous = performance.now();
let pausedAt = 0;
let sequenceId = 0;
let startZeroAt = 0;
let raceStart = 0;
let lapStarted = 0;
let startReaction = 0;
let startLabel = "—";
let steer = 0;
let throttleHeld = false;
let brakeHeld = false;
let lineTotal = 0;
let lineSamples = 0;
let wakeHitUntil = 0;
let lastRank = 3;
let laps = [];
let particles = [];
let player = { route: 0, progress: 0, lane: .42, speed: 0, leftPit: false };
let ai = [];

const preRoute = [
  { x: -620, y: 270 }, { x: -565, y: 250 }, { x: -500, y: 220 },
  { x: -440, y: 185 }, { x: -475, y: 118 }, { x: -535, y: 65 },
  { x: -455, y: 20 }, { x: -310, y: 62 }, { x: -160, y: 132 }, { x: 0, y: 150 }
];
const preSegments = [];
let preLength = 0;
for (let i = 0; i < preRoute.length - 1; i++) {
  const a = preRoute[i], b = preRoute[i + 1], length = Math.hypot(b.x - a.x, b.y - a.y);
  preSegments.push({ a, b, length, start: preLength });
  preLength += length;
}

function resizeCanvas() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * ratio;
  canvas.height = innerHeight * ratio;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
addEventListener("resize", resizeCanvas);
resizeCanvas();

function routePoint(route, lane = .5) {
  const distance = clamp(route, 0, 1) * preLength;
  const segment = preSegments.find((item) => distance <= item.start + item.length) || preSegments.at(-1);
  const t = clamp((distance - segment.start) / segment.length, 0, 1);
  const angle = Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x);
  const offset = (lane - .5) * 64;
  return {
    x: segment.a.x + (segment.b.x - segment.a.x) * t - Math.sin(angle) * offset,
    y: segment.a.y + (segment.b.y - segment.a.y) * t + Math.cos(angle) * offset,
    angle
  };
}

function trackPoint(progress, lane = .5) {
  let distance = (((progress % 1) + 1) % 1) * COURSE_LENGTH;
  let x, y, angle;
  if (distance < COURSE_HALF) {
    x = distance; y = COURSE_RADIUS; angle = 0;
  } else if ((distance -= COURSE_HALF) < HALF_ARC) {
    const a = Math.PI / 2 - distance / COURSE_RADIUS;
    x = COURSE_HALF + COURSE_RADIUS * Math.cos(a); y = COURSE_RADIUS * Math.sin(a); angle = a - Math.PI / 2;
  } else if ((distance -= HALF_ARC) < STRAIGHT) {
    x = COURSE_HALF - distance; y = -COURSE_RADIUS; angle = Math.PI;
  } else if ((distance -= STRAIGHT) < HALF_ARC) {
    const a = -Math.PI / 2 - distance / COURSE_RADIUS;
    x = -COURSE_HALF + COURSE_RADIUS * Math.cos(a); y = COURSE_RADIUS * Math.sin(a); angle = a - Math.PI / 2;
  } else {
    distance -= HALF_ARC;
    x = -COURSE_HALF + distance; y = COURSE_RADIUS; angle = 0;
  }
  const inside = (.5 - lane) * 88;
  return { x: x + Math.sin(angle) * inside, y: y - Math.cos(angle) * inside, angle };
}

function boatPoint(boat) {
  return racePhase === "race" || racePhase === "finished" ? trackPoint(boat.progress, boat.lane) : routePoint(boat.route, boat.lane);
}

function setRacePhase(label) {
  $("#racePhaseLabel").textContent = label;
}

function enableControls(enabled) {
  ["#left", "#right", "#throttle", "#brake"].forEach((id) => { $(id).disabled = !enabled; });
}

function resetControlVisuals() {
  throttleHeld = false; brakeHeld = false; steer = 0;
  ["#left", "#right", "#throttle", "#brake"].forEach((id) => $(id).classList.remove("active"));
}

function resetRace() {
  sequenceId++;
  audio.stopEngine();
  resetControlVisuals();
  racePhase = "fanfare";
  startZeroAt = 0; raceStart = 0; lapStarted = 0; startReaction = 0; startLabel = "—";
  lineTotal = 0; lineSamples = 0; wakeHitUntil = 0; lastRank = 3; laps = []; particles = [];
  player = { route: 0, progress: 0, lane: .42, speed: 0, leftPit: false };
  const specs = [
    [1, .10, .097, .12, "#f4f4f0"], [2, .27, .095, .18, "#252930"],
    [4, .60, .101, .08, "#3979e8"], [5, .77, .098, .16, "#e4d33a"], [6, .92, .094, .24, "#48aa6d"]
  ];
  ai = specs.map(([number, lane, raceSpeed, st, color], index) => ({
    number, lane, raceSpeed, st, color, route: -index * .006, progress: 0, speed: 0
  }));
  $("#lap").textContent = "—/3";
  $("#rank").textContent = "—";
  $("#speed").textContent = "0";
  $("#flowBar").style.width = "0%";
  $("#flowValue").textContent = "0";
  $(".flow small").textContent = "THROTTLE";
  $("#courseNumber").textContent = "3";
  $("#courseBadge").hidden = false;
  $("#startClock").hidden = false;
  $("#startClock").className = "start-clock";
  $("#startClockValue").textContent = "—";
  $("#startClock").querySelector("small").textContent = "FLYING START";
  $("#startClock").querySelector("em").textContent = "有効 0.00–0.99";
  $("#countdown").style.display = "grid";
  $("#countdown small").textContent = "RACE FANFARE";
  $("#countdown b").textContent = "READY";
  $("#raceTip").textContent = "ファンファーレ後、アクセルを押してピット離れ";
  enableControls(false);
  setRacePhase("PIT");
}

function playFanfare(id) {
  [392, 523, 659, 784, 1046].forEach((frequency, index) => audio.tone(frequency, .28, "triangle", .045, index * .23));
  setTimeout(() => {
    if (id !== sequenceId || racePhase !== "fanfare") return;
    racePhase = "approach";
    startZeroAt = performance.now() + START_WINDOW * 1000;
    previous = performance.now();
    setRacePhase("PIT OUT");
    $("#countdown small").textContent = "6 BOATS · PIT OUT";
    $("#countdown b").textContent = "GO";
    $("#raceTip").textContent = "アクセルを押し続けてピット離れ。オレンジブイを回れ";
    enableControls(true);
    audio.startEngine();
    haptic([25, 35, 55]);
    setTimeout(() => { if (id === sequenceId && racePhase === "approach") $("#countdown").style.display = "none"; }, 850);
  }, 1450);
}

function beginStartSequence() {
  resetRace();
  openScreen("race");
  const id = sequenceId;
  playFanfare(id);
}
$("#startRace").addEventListener("click", beginStartSequence);
$("#retryRace").addEventListener("click", beginStartSequence);

function bindHold(element, onStart, onEnd) {
  element.addEventListener("pointerdown", (event) => {
    if (element.disabled) return;
    event.preventDefault();
    try { element.setPointerCapture(event.pointerId); } catch (_) {}
    element.classList.add("active");
    onStart();
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => element.addEventListener(name, (event) => {
    event.preventDefault();
    element.classList.remove("active");
    onEnd();
  }));
}
bindHold($("#left"), () => { steer = -1; haptic(6); }, () => { steer = $("#right").classList.contains("active") ? 1 : 0; });
bindHold($("#right"), () => { steer = 1; haptic(6); }, () => { steer = $("#left").classList.contains("active") ? -1 : 0; });
bindHold($("#throttle"), () => { throttleHeld = true; brakeHeld = false; $("#brake").classList.remove("active"); }, () => { throttleHeld = false; });
bindHold($("#brake"), () => { brakeHeld = true; throttleHeld = false; $("#throttle").classList.remove("active"); }, () => { brakeHeld = false; });

addEventListener("keydown", (event) => {
  if (!["approach", "race"].includes(racePhase)) return;
  if (event.key === "ArrowLeft") steer = -1;
  if (event.key === "ArrowRight") steer = 1;
  if (event.key === " " || event.key === "ArrowUp") throttleHeld = true;
  if (event.key === "Shift" || event.key === "ArrowDown") brakeHeld = true;
});
addEventListener("keyup", (event) => {
  if (["ArrowLeft", "ArrowRight"].includes(event.key)) steer = 0;
  if (event.key === " " || event.key === "ArrowUp") throttleHeld = false;
  if (event.key === "Shift" || event.key === "ArrowDown") brakeHeld = false;
});

function positionSuffix(n) { return `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`; }

function updatePedalMeter(input) {
  $("#flowBar").style.width = `${Math.round(input * 100)}%`;
  $("#flowValue").textContent = Math.round(input * 100);
  $("#throttle small").textContent = throttleHeld ? "FULL" : "HOLD";
  $("#brake small").textContent = brakeHeld ? "ON" : "HOLD";
}

function updateApproach(now, dt) {
  const untilStart = (startZeroAt - now) / 1000;
  const input = brakeHeld ? 0 : throttleHeld ? 1 : player.leftPit ? .22 : 0;
  const target = brakeHeld ? .006 : input * .128;
  const response = target > player.speed ? .19 : brakeHeld ? .25 : .075;
  player.speed += clamp(target - player.speed, -response * dt, response * dt);
  player.route += player.speed * dt;
  player.lane = clamp(player.lane + steer * .34 * dt, .04, .96);
  if (player.route > .035) player.leftPit = true;
  const course = clamp(Math.round(player.lane * 5) + 1, 1, 6);
  $("#courseNumber").textContent = course;
  $("#speed").textContent = Math.round(player.speed * 560);
  updatePedalMeter(input);
  audio.updateEngine(Math.round(player.speed * 560), input > .55);

  ai.forEach((boat) => {
    const targetAt = startZeroAt + boat.st * 1000;
    const seconds = Math.max(.2, (targetAt - now) / 1000);
    const needed = clamp((1 - boat.route) / seconds, .02, .132);
    boat.speed += clamp(needed - boat.speed, -.12 * dt, .16 * dt);
    boat.route += boat.speed * dt;
  });

  const clock = $("#startClock");
  if (untilStart > 0) {
    $("#startClockValue").textContent = `-${untilStart.toFixed(2)}`;
    clock.className = `start-clock${untilStart < 3 ? " armed" : ""}`;
  } else {
    $("#startClockValue").textContent = `+${Math.abs(untilStart).toFixed(2)}`;
    clock.className = `start-clock ${untilStart >= -.99 ? "go" : "late"}`;
  }

  if (player.route > .05 && player.route < .38) {
    setRacePhase("PIT OUT");
    $("#raceTip").textContent = "小回り防止ブイを反時計回りに通過";
  } else if (player.route >= .38) {
    setRacePhase("WAITING");
    $("#raceTip").textContent = untilStart > 5 ? `待機行動：${course}コース・助走距離を調整` : "大時計を見て0.00〜0.99秒にライン通過";
  }

  if (player.route >= 1) {
    const timing = (now - startZeroAt) / 1000;
    if (timing < 0) disqualifyRace("FLYING", Math.abs(timing));
    else if (timing >= 1) disqualifyRace("LATE", timing);
    else launchFlyingStart(timing, now);
  } else if (untilStart < -1) {
    disqualifyRace("LATE", Math.abs(untilStart));
  }
}

function launchFlyingStart(timing, now) {
  startReaction = timing;
  startLabel = timing <= .12 ? "PERFECT" : timing <= .25 ? "GOOD" : "SAFE";
  racePhase = "race";
  raceStart = now;
  lapStarted = now;
  previous = now;
  player.progress = 0;
  player.speed = clamp(player.speed * .82, .045, .095);
  ai.forEach((boat) => {
    boat.progress = clamp((timing - boat.st) * boat.raceSpeed, -.035, .035);
    boat.speed = boat.raceSpeed * .88;
  });
  setRacePhase("RACE");
  $("#lap").textContent = "1/3";
  $("#startClock").className = "start-clock locked";
  $("#startClock").querySelector("small").textContent = "START TIMING";
  $("#startClockValue").textContent = `.${String(Math.round(timing * 100)).padStart(2, "0")}`;
  $("#startClock").querySelector("em").textContent = startLabel;
  $("#courseBadge").hidden = true;
  const feedback = $("#startFeedback");
  feedback.style.color = startLabel === "PERFECT" ? "#48e6f2" : "#f3f7f5";
  feedback.innerHTML = `${startLabel}<small style="display:block;font-size:12px">ST ${timing.toFixed(2)}</small>`;
  feedback.classList.remove("show"); void feedback.offsetWidth; feedback.classList.add("show");
  $("#raceTip").textContent = "1マーク手前で減速。左へ切りながら再加速";
  haptic(startLabel === "PERFECT" ? [35, 22, 65] : 28);
}

function disqualifyRace(type, timing) {
  if (["disqualified", "finished"].includes(racePhase)) return;
  racePhase = "disqualified";
  resetControlVisuals();
  enableControls(false);
  audio.stopEngine();
  setRacePhase(type === "FLYING" ? "F" : "L");
  const feedback = $("#startFeedback");
  feedback.style.color = "#ff5a4f";
  feedback.innerHTML = `${type}<small style="display:block;font-size:12px">${type === "FLYING" ? "F" : "L"} ${timing.toFixed(2)}</small>`;
  feedback.classList.remove("show"); void feedback.offsetWidth; feedback.classList.add("show");
  $("#raceTip").textContent = type === "FLYING" ? "0秒より前にラインを通過しました" : "1秒以内にラインへ届きませんでした";
  haptic([80, 45, 80]);
  save.races++; persist(); updateProfile();
  setTimeout(() => {
    $("#place").textContent = type === "FLYING" ? "F" : "L";
    $(".place i").textContent = "";
    $("#raceTime").textContent = "—";
    $("#resultMessage").textContent = type === "FLYING" ? "勇み足。大時計より早かった。" : "出遅れ。助走の組み立てを見直そう。";
    $("#prize").textContent = "¥0"; $("#fans").textContent = "+0";
    $("#startGrade").textContent = type;
    $("#startTime").textContent = type === "FLYING" ? `F.${String(Math.round(timing * 100)).padStart(2, "0")}` : "L";
    $("#bestLap").textContent = "—"; $("#lineScore").textContent = "—";
    $("#coachText").textContent = type === "FLYING" ? "アクセルを戻して助走速度を落とし、0秒を待ってラインを切ろう。" : "ピット離れ後の加速を早め、十分な助走距離を確保しよう。";
    openScreen("result");
  }, 1150);
}

function inTurn(progress) {
  const p = ((progress % 1) + 1) % 1;
  return (p > .145 && p < .34) || (p > .645 && p < .84);
}

function idealLane(progress) {
  const p = ((progress % 1) + 1) % 1;
  const turn = inTurn(p);
  if (!turn) return save.strategy === "attack" ? .58 : .42;
  return save.strategy === "inside" ? .15 : save.strategy === "attack" ? .68 : .34;
}

function callOvertake(rank) {
  const el = $("#overtake");
  el.textContent = rank < lastRank ? `OVERTAKE · ${positionSuffix(rank)}` : `POSITION DOWN · ${positionSuffix(rank)}`;
  el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  haptic(rank < lastRank ? 32 : 16); lastRank = rank;
}

function spawnParticle() {
  const point = trackPoint(player.progress - .008, player.lane);
  particles.push({ x: point.x + (Math.random() - .5) * 12, y: point.y + (Math.random() - .5) * 12, life: 1, size: 3 + Math.random() * 5 });
  if (particles.length > 90) particles.shift();
}

function updateRace(now, dt) {
  if (racePhase === "approach") { updateApproach(now, dt); return; }
  if (racePhase !== "race") return;
  const input = brakeHeld ? 0 : throttleHeld ? 1 : .27;
  const turn = inTurn(player.progress);
  const ideal = idealLane(player.progress);
  const accuracy = clamp(1 - Math.abs(player.lane - ideal) * 1.9, 0, 1);
  const tunedTop = .103 + (save.tune.part === "top" ? .006 : 0);
  let target = brakeHeld ? .025 : .038 + input * (tunedTop - .038);
  const steerForTurn = clamp(-steer, 0, 1);
  if (turn) {
    const overSpeed = Math.max(0, input - .72) * .018;
    const noTurn = Math.max(0, .58 - steerForTurn) * .025;
    target -= overSpeed + noTurn;
  }
  const acceleration = target > player.speed ? (.074 + (save.tune.part === "launch" ? .014 : 0)) : brakeHeld ? .18 : .065;
  player.speed += clamp(target - player.speed, -acceleration * dt, acceleration * dt);
  player.lane = clamp(player.lane + steer * (turn ? .31 : .20) * dt, .035, .97);
  const lineDrag = Math.abs(player.lane - ideal) * (turn ? .018 : .006);
  const wakeBoat = ai.find((boat) => {
    const gap = boat.progress - player.progress;
    return gap > .008 && gap < .055 && Math.abs(boat.lane - player.lane) < .13;
  });
  const wakeDrag = wakeBoat ? .014 : 0;
  if (wakeBoat && now > wakeHitUntil) {
    wakeHitUntil = now + 620;
    const alert = $("#wakeAlert"); alert.classList.remove("show"); void alert.offsetWidth; alert.classList.add("show");
    $("#raceTip").textContent = `${wakeBoat.number}号艇の引き波。ラインを外して加速を戻せ`;
    haptic([18, 15, 26]);
  }
  player.progress += Math.max(.024, player.speed - lineDrag - wakeDrag) * dt;
  ai.forEach((boat, index) => {
    const p = ((boat.progress % 1) + 1) % 1;
    const aiTurn = inTurn(p);
    const pace = boat.raceSpeed - (aiTurn ? .011 : 0) + Math.sin(now * .0012 + index) * .0015;
    boat.speed += clamp(pace - boat.speed, -.07 * dt, .06 * dt);
    boat.progress += boat.speed * dt;
    const targetLane = aiTurn ? .13 + index * .14 : .18 + index * .15;
    boat.lane += (targetLane - boat.lane) * dt * .72;
  });
  lineTotal += accuracy; lineSamples++;
  if (throttleHeld && Math.random() < .58) spawnParticle();
  particles.forEach((particle) => { particle.life -= dt * .9; particle.size += dt * 5; });
  particles = particles.filter((particle) => particle.life > 0);
  const lap = Math.min(3, Math.floor(player.progress) + 1);
  if (lap > laps.length + 1) {
    laps.push((now - lapStarted) / 1000); lapStarted = now;
    audio.tone(820, .12, "triangle", .03); haptic([18, 20, 18]); toast(`LAP ${lap} · ${laps.at(-1).toFixed(2)}`);
  }
  const rank = 1 + ai.filter((boat) => boat.progress > player.progress).length;
  if (rank !== lastRank) callOvertake(rank);
  const coursePhase = ((player.progress % 1) + 1) % 1;
  setRacePhase(coursePhase < .12 ? "1M APPROACH" : coursePhase < .34 ? "1M TURN" : coursePhase < .62 ? "BACK STRAIGHT" : coursePhase < .84 ? "2M TURN" : "HOME STRAIGHT");
  $("#lap").textContent = `${lap}/3`; $("#rank").textContent = positionSuffix(rank);
  $("#speed").textContent = Math.round(player.speed * 760);
  updatePedalMeter(input);
  audio.updateEngine(Math.round(player.speed * 760), input > .55);
  if (turn) $("#raceTip").textContent = brakeHeld ? "減速できている。左へ切り、出口でアクセル" : "ターン中：左を保持し、出口へ艇を向ける";
  else if (!wakeBoat) $("#raceTip").textContent = "直線はアクセル全開。次のマーク手前で減速";
  if (player.progress >= 3) finishRace(rank, now);
}

function finishRace(place, now) {
  racePhase = "finished";
  resetControlVisuals(); enableControls(false); audio.result(place === 1);
  const finalLap = (now - lapStarted) / 1000;
  if (finalLap > 1) laps.push(finalLap);
  const elapsed = (now - raceStart) / 1000;
  const best = laps.length ? Math.min(...laps) : elapsed / 3;
  const lineScore = Math.round(lineTotal / Math.max(1, lineSamples) * 100);
  const prize = place === 1 ? 320000 : place <= 3 ? 180000 : 80000;
  const fans = Math.max(12, 72 - place * 10);
  save.races++; if (place === 1) save.wins++; save.money += prize; save.fans += fans; persist(); updateProfile();
  $("#place").textContent = place; $(".place i").textContent = place === 1 ? "ST" : place === 2 ? "ND" : place === 3 ? "RD" : "TH";
  $("#raceTime").textContent = elapsed.toFixed(2);
  $("#resultMessage").textContent = place === 1 ? "3周を制した。完勝。" : place <= 3 ? "表彰台。ターンに勝機がある。" : "敗因はスタートか旋回か。次へ。";
  $("#prize").textContent = `¥${prize.toLocaleString("ja-JP")}`; $("#fans").textContent = `+${fans}`;
  $("#startGrade").textContent = startLabel; $("#startTime").textContent = startReaction.toFixed(2);
  $("#bestLap").textContent = best.toFixed(2); $("#lineScore").textContent = lineScore;
  $("#coachText").textContent = lineScore >= 82 ? "マーク手前の減速と出口の再加速が噛み合った。" : startReaction > .4 ? "スタートが慎重すぎた。助走速度を少し上げよう。" : "ターン入口で早めに減速し、左を保持して内へ寄せよう。";
  setTimeout(() => openScreen("result"), 650);
}

function pauseRace() {
  if (!["approach", "race"].includes(racePhase)) return;
  pausedFrom = racePhase; pausedAt = performance.now(); racePhase = "paused"; $("#pause").hidden = false; audio.updateEngine(0, false); resetControlVisuals();
}
$("#pauseRace").addEventListener("click", pauseRace);
$("#resumeRace").addEventListener("click", () => {
  const pausedFor = performance.now() - pausedAt;
  if (pausedFrom === "approach") startZeroAt += pausedFor;
  if (pausedFrom === "race") { raceStart += pausedFor; lapStarted += pausedFor; }
  racePhase = pausedFrom; previous = performance.now(); $("#pause").hidden = true;
});
$("#restartRace").addEventListener("click", () => { $("#pause").hidden = true; beginStartSequence(); });
$("#retireRace").addEventListener("click", () => { sequenceId++; racePhase = "idle"; audio.stopEngine(); $("#pause").hidden = true; openScreen("entry"); });

function projectWorld(target, camera, width, horizon, focal, cameraHeight, objectHeight = 0) {
  const fx = Math.cos(camera.angle), fy = Math.sin(camera.angle), rx = -fy, ry = fx;
  const dx = target.x - camera.x, dy = target.y - camera.y;
  const depth = dx * fx + dy * fy;
  if (depth < 10) return null;
  const lateral = dx * rx + dy * ry, scale = focal / depth;
  return { x: width / 2 + lateral * scale, y: horizon + (cameraHeight - objectHeight) * scale, scale, depth };
}

function aheadPoint(offset, lane) {
  if (racePhase === "race" || racePhase === "finished") return trackPoint(player.progress + offset, lane);
  const route = player.route + offset * 1.7;
  return route <= 1 ? routePoint(route, lane) : trackPoint((route - 1) * .18, lane);
}

function chaseCamera() {
  const point = boatPoint(player);
  const distance = racePhase === "approach" && player.route < .08 ? 82 : 112;
  return { x: point.x - Math.cos(point.angle) * distance, y: point.y - Math.sin(point.angle) * distance, angle: point.angle + steer * .045 };
}

function drawWater(w, h, now) {
  const water = ctx.createLinearGradient(0, 0, 0, h);
  water.addColorStop(0, "#020b14"); water.addColorStop(.24, "#143b4a"); water.addColorStop(.255, "#5b7780"); water.addColorStop(.27, "#123c4b"); water.addColorStop(1, "#03151f");
  ctx.fillStyle = water; ctx.fillRect(0, 0, w, h);
  const horizon = h * .255;
  ctx.fillStyle = "#07151d";
  for (let x = -30; x < w + 40; x += 34) {
    const tower = 7 + ((x * 17 % 26) + 26) % 26; ctx.fillRect(x, horizon - tower, 22, tower);
  }
  for (let y = horizon + 8; y < h; y += 12) {
    ctx.strokeStyle = `rgba(180,238,243,${Math.min(.17, .03 + y / h * .08)})`; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= w; x += 18) {
      const waveY = y + Math.sin(x * .035 + now * .0018 + y * .07) * (1.5 + y / h * 2.2);
      x ? ctx.lineTo(x, waveY) : ctx.moveTo(x, waveY);
    }
    ctx.stroke();
  }
}

function drawCourse(camera, w, h) {
  const horizon = h * .255, focal = Math.max(230, w * .82);
  [{ lane: .04, color: "#d8f7f83b", width: 1.1 }, { lane: "ideal", color: "#4ce9f284", width: 1.9 }, { lane: .96, color: "#d8f7f832", width: 1.1 }].forEach((strip) => {
    ctx.strokeStyle = strip.color; ctx.lineWidth = strip.width; ctx.setLineDash(strip.lane === "ideal" ? [8, 10] : [2, 11]); ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 120; i++) {
      const offset = i * .0028;
      const lane = strip.lane === "ideal" ? (racePhase === "race" ? idealLane(player.progress + offset) : player.lane) : strip.lane;
      const projected = projectWorld(aheadPoint(offset, lane), camera, w, horizon, focal, 61);
      if (!projected || projected.y > h * .93) { started = false; continue; }
      started ? ctx.lineTo(projected.x, projected.y) : (ctx.moveTo(projected.x, projected.y), started = true);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawMarker(point, camera, w, h, color = "#ff5b31", tall = true) {
  const horizon = h * .255, focal = Math.max(230, w * .82);
  const projected = projectWorld(point, camera, w, horizon, focal, 61, tall ? 12 : 4);
  if (!projected || projected.scale < .12 || projected.y > h) return;
  const size = clamp(10 * projected.scale, 3, 22);
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(projected.x, projected.y, size * .72, size, 0, 0, TAU); ctx.fill();
  if (tall) { ctx.fillStyle = "#fff3dc"; ctx.fillRect(projected.x - size * .1, projected.y - size * 3.1, size * .2, size * 2.5); }
}

function drawStartLine(camera, w, h) {
  const horizon = h * .255, focal = Math.max(230, w * .82);
  const inner = projectWorld(trackPoint(0, .02), camera, w, horizon, focal, 61);
  const outer = projectWorld(trackPoint(0, .98), camera, w, horizon, focal, 61);
  if (!inner || !outer) return;
  ctx.strokeStyle = "#ffffffcc"; ctx.lineWidth = 3; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(inner.x, inner.y); ctx.lineTo(outer.x, outer.y); ctx.stroke(); ctx.setLineDash([]);
}

function drawWake(boat, camera, w, h, now) {
  const horizon = h * .255, focal = Math.max(230, w * .82), points = [];
  for (let i = 1; i <= 9; i++) {
    const world = racePhase === "race" ? trackPoint(boat.progress - i * .0055, boat.lane) : routePoint(boat.route - i * .006, boat.lane);
    const projected = projectWorld(world, camera, w, horizon, focal, 61); if (projected) points.push(projected);
  }
  if (points.length < 2) return;
  ctx.save(); ctx.globalAlpha = .3 + Math.sin(now * .01 + boat.number) * .04; ctx.strokeStyle = "#e5fdff"; ctx.lineWidth = 2;
  [-1, 1].forEach((side) => { ctx.beginPath(); points.forEach((point, index) => { const spread = side * (4 + index * 3.5); index ? ctx.lineTo(point.x + spread, point.y + index * 1.5) : ctx.moveTo(point.x + spread, point.y); }); ctx.stroke(); });
  ctx.restore();
}

function drawProjectedBoat(boat, camera, w, h) {
  const horizon = h * .255, focal = Math.max(230, w * .82);
  const projected = projectWorld(boatPoint(boat), camera, w, horizon, focal, 61, 6);
  if (!projected || projected.y > h * .92 || projected.scale < .14) return;
  const size = clamp(29 * projected.scale, 7, 58);
  ctx.save(); ctx.translate(projected.x, projected.y); ctx.shadowColor = "#001018"; ctx.shadowBlur = size * .55;
  ctx.fillStyle = "#e8ffff8a"; ctx.beginPath(); ctx.moveTo(-size * .58, size * .14); ctx.lineTo(-size * 1.2, size * .62); ctx.lineTo(size * 1.2, size * .62); ctx.lineTo(size * .58, size * .14); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = boat.color; ctx.beginPath(); ctx.moveTo(0, -size * .8); ctx.lineTo(size * .64, size * .45); ctx.lineTo(size * .42, size * .67); ctx.lineTo(-size * .42, size * .67); ctx.lineTo(-size * .64, size * .45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = boat.number === 2 ? "#fff" : "#061018"; ctx.font = `900 ${Math.max(7, size * .42)}px system-ui`; ctx.textAlign = "center"; ctx.fillText(boat.number, 0, size * .29); ctx.restore();
}

function drawPlayerBoat(w, h, now) {
  const bob = Math.sin(now * .012) * (1 + player.speed * 15);
  const impact = now < wakeHitUntil ? Math.sin(now * .12) * 6 : 0;
  const boatW = Math.min(132, w * .32), boatH = boatW * .63;
  ctx.save(); ctx.translate(w / 2 + steer * 13 + impact, h * .755 + bob); ctx.rotate(steer * .09 + impact * .006);
  const wake = ctx.createLinearGradient(0, boatH * .25, 0, boatH * 1.7); wake.addColorStop(0, "#f1ffffc8"); wake.addColorStop(1, "#bff7ff00"); ctx.fillStyle = wake;
  ctx.beginPath(); ctx.moveTo(-boatW * .34, boatH * .18); ctx.lineTo(-boatW * .82, boatH * 1.55); ctx.lineTo(boatW * .82, boatH * 1.55); ctx.lineTo(boatW * .34, boatH * .18); ctx.fill();
  ctx.fillStyle = "#d8393f"; ctx.beginPath(); ctx.moveTo(0, -boatH * .68); ctx.lineTo(boatW * .49, boatH * .38); ctx.lineTo(boatW * .34, boatH * .66); ctx.lineTo(-boatW * .34, boatH * .66); ctx.lineTo(-boatW * .49, boatH * .38); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2f6f2"; ctx.beginPath(); ctx.ellipse(0, boatH * .1, boatW * .22, boatH * .25, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = "#08131b"; ctx.font = `950 ${Math.round(boatW * .21)}px system-ui`; ctx.textAlign = "center"; ctx.fillText("3", 0, boatH * .2); ctx.restore();
}

function drawDock(camera, w, h) {
  if (racePhase === "race") return;
  const horizon = h * .255, focal = Math.max(230, w * .82);
  for (let i = 0; i < 7; i++) {
    const point = { x: -650 + i * 25, y: 305, angle: 0 };
    const projected = projectWorld(point, camera, w, horizon, focal, 61, 6);
    if (!projected) continue;
    const size = clamp(22 * projected.scale, 5, 42); ctx.fillStyle = i % 2 ? "#ced8d7" : "#ef6b47"; ctx.fillRect(projected.x - size / 2, projected.y, size, size * .25);
  }
}

function drawOnboard(w, now) {
  const insetW = Math.min(212, w * .43), insetH = Math.min(128, Math.max(92, w * .255));
  const insetX = w - insetW - 12, insetY = 76, world = boatPoint(player);
  const camera = { x: world.x + Math.cos(world.angle) * 5, y: world.y + Math.sin(world.angle) * 5, angle: world.angle + steer * .075 };
  const horizon = insetY + insetH * .4, focal = insetW * .72;
  ctx.save(); ctx.beginPath(); ctx.roundRect(insetX, insetY, insetW, insetH, 6); ctx.clip();
  const bg = ctx.createLinearGradient(0, insetY, 0, insetY + insetH); bg.addColorStop(0, "#0a2634"); bg.addColorStop(.39, "#356572"); bg.addColorStop(.4, "#0a3444"); bg.addColorStop(1, "#05202d"); ctx.fillStyle = bg; ctx.fillRect(insetX, insetY, insetW, insetH);
  ctx.save(); ctx.translate(insetX, 0);
  [.05, .5, .95].forEach((lane, index) => {
    ctx.strokeStyle = index === 1 ? "#5debf18c" : "#e1fbff31"; ctx.lineWidth = index === 1 ? 1.4 : .8; ctx.setLineDash(index === 1 ? [5, 6] : [2, 7]); ctx.beginPath(); let started = false;
    for (let i = 2; i < 72; i++) {
      const point = projectWorld(aheadPoint(i * .0029, lane), camera, insetW, horizon, focal, 17);
      if (!point || point.y > insetY + insetH) continue;
      started ? ctx.lineTo(point.x, point.y) : (ctx.moveTo(point.x, point.y), started = true);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  [...ai].sort((a, b) => (b.progress || b.route) - (a.progress || a.route)).forEach((boat) => {
    const point = projectWorld(boatPoint(boat), camera, insetW, horizon, focal, 17, 3);
    if (!point || point.y > insetY + insetH || point.y < insetY) return;
    const size = clamp(11 * point.scale, 3, 19); ctx.fillStyle = "#e8ffff77"; ctx.fillRect(point.x - size, point.y + size * .4, size * 2, size * .28);
    ctx.fillStyle = boat.color; ctx.beginPath(); ctx.moveTo(point.x, point.y - size); ctx.lineTo(point.x + size * .7, point.y + size * .65); ctx.lineTo(point.x - size * .7, point.y + size * .65); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  const tilt = steer * 5 + (now < wakeHitUntil ? Math.sin(now * .1) * 5 : 0); ctx.save(); ctx.translate(insetX + insetW / 2, insetY + insetH + 8); ctx.rotate(tilt * Math.PI / 180);
  ctx.fillStyle = "#d83b42"; ctx.beginPath(); ctx.moveTo(0, -insetH * .5); ctx.lineTo(insetW * .3, 0); ctx.lineTo(-insetW * .3, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#ffffffaa"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -insetH * .43); ctx.lineTo(0, -insetH * .08); ctx.stroke(); ctx.restore(); ctx.restore();
}

function drawRace(now) {
  const w = innerWidth, h = innerHeight; drawWater(w, h, now); const camera = chaseCamera();
  const shake = now < wakeHitUntil && !save.settings.reduceMotion ? Math.sin(now * .11) * 3 : 0;
  ctx.save(); ctx.translate(shake, shake * .35); drawCourse(camera, w, h); drawDock(camera, w, h);
  if (racePhase !== "race") drawMarker({ x: -455, y: 185 }, camera, w, h, "#ff8b31", false);
  drawMarker(trackPoint(.172, -.12), camera, w, h); drawMarker(trackPoint(.672, -.12), camera, w, h); drawStartLine(camera, w, h);
  ai.forEach((boat) => drawWake(boat, camera, w, h, now)); [...ai].sort((a, b) => (b.progress || b.route) - (a.progress || a.route)).forEach((boat) => drawProjectedBoat(boat, camera, w, h));
  drawPlayerBoat(w, h, now); ctx.restore(); drawOnboard(w, now);
}

function frame(now) {
  const dt = Math.min((now - previous) / 1000, .1); previous = now;
  updateRace(now, dt);
  if ($("#race").classList.contains("active")) drawRace(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
