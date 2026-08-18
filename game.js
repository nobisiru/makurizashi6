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
  ["01","GOで全開","カウントが消えた瞬間にスロットルをタップ。反応速度が1マークの位置を決めます。"],
  ["02","2つの視点","追走カメラで全艇の位置を、右上の艇首カメラで旋回角と引き波を読みます。"],
  ["03","FLOW BURST","FLOWが100になったらバースト。追い抜きたい直線で使うと、勝負をひっくり返せます。"]
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

if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
