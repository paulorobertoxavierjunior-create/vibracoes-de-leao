// Vibrações de Leão — app.js (raiz)
// Demo educacional: sem envio de áudio. Apenas métricas heurísticas locais + metadados anonimizados copiáveis.

const STORE = {
  BEST: "lv_best_score",
  LAST: "lv_last_score",
  HISTORY: "lv_history",
  TOKENS: "lv_tokens_demo",
  PROFILE: "lv_profile"
};

function readJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function writeJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function now(){ return Date.now(); }

function show(id){
  ["screenWelcome","screenIntro","screenOral","screenWritten","screenReport"].forEach(s=>{
    const el = document.getElementById(s);
    if(el) el.style.display = (s === id) ? "block" : "none";
  });
}

function fmtTime(sec){
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec/60)).padStart(2,"0");
  const s = String(sec%60).padStart(2,"0");
  return `${m}:${s}`;
}

function initTokens(){
  const t = Number(localStorage.getItem(STORE.TOKENS));
  if(Number.isFinite(t)) return t;
  localStorage.setItem(STORE.TOKENS, String(3)); // começa com 3 tokens demo
  return 3;
}
function setTokens(v){
  localStorage.setItem(STORE.TOKENS, String(Math.max(0, Math.floor(v))));
}
function getTokens(){
  return Number(localStorage.getItem(STORE.TOKENS) || "0");
}

function getBest(){ return Number(localStorage.getItem(STORE.BEST) || "0"); }
function setBest(v){ localStorage.setItem(STORE.BEST, String(v)); }

function getLast(){ return Number(localStorage.getItem(STORE.LAST) || "0"); }
function setLast(v){ localStorage.setItem(STORE.LAST, String(v)); }

function pushHistory(entry){
  const h = readJSON(STORE.HISTORY, []);
  h.unshift(entry);
  writeJSON(STORE.HISTORY, h.slice(0, 25));
}

function resetAll(){
  Object.values(STORE).forEach(k => localStorage.removeItem(k));
  initTokens();
  refreshPills();
  show("screenWelcome");
}

function refreshPills(){
  const best = getBest();
  const pillBest = document.getElementById("pillBest");
  if(pillBest) pillBest.textContent = `Melhor nota: ${best || "--"}/10`;
}

// ------------------------------
// Conteúdo (questões) - MUITO BÁSICO
// ------------------------------
const ORAL_POOL = [
  "Diga seu nome e sua idade.",
  "Explique com suas palavras: o que é um 'algoritmo'?",
  "Conte uma coisa que você aprendeu hoje (pode ser qualquer coisa).",
  "Conte de 10 até 1 devagar.",
  "Fale uma frase completa sobre um tema que você gosta."
];

const WRITTEN_POOL = [
  {
    q: "O que é um algoritmo?",
    a: [
      "Um passo a passo para resolver um problema.",
      "Um tipo de computador.",
      "Um aplicativo de celular.",
      "Uma peça de hardware."
    ],
    correct: 0
  },
  {
    q: "Qual destas opções é um exemplo de 'entrada' (input) em um programa?",
    a: ["Um número digitado pelo usuário.", "A tela do monitor.", "A bateria do celular.", "O cabo USB."],
    correct: 0
  },
  {
    q: "O que significa 'repetir' em programação (laço/loop)?",
    a: ["Fazer a mesma ação várias vezes.", "Desligar o computador.", "Salvar um arquivo.", "Conectar na internet."],
    correct: 0
  },
  {
    q: "O que é uma variável?",
    a: ["Um espaço para guardar um valor (número, texto, etc.).", "Uma impressora.", "Um vírus.", "Um tipo de teclado."],
    correct: 0
  },
  {
    q: "O que significa 'se... então...' (condicional)?",
    a: ["Tomar uma decisão baseada em uma condição.", "Aumentar o volume.", "Apertar um botão.", "Criar um arquivo."],
    correct: 0
  },
  {
    q: "Qual é a função de um 'bit'?",
    a: ["Representar informação como 0 ou 1.", "Guardar fotos em papel.", "Carregar o celular.", "Fazer som no microfone."],
    correct: 0
  }
];

function pickRandom(arr, n){
  const copy = arr.slice();
  for(let i=copy.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

// ------------------------------
// 8 Barras (métricas heurísticas)
// ------------------------------
const METRICS = [
  { id:"presenca",  name:"Presença",   hint:"atenção sustentada" },
  { id:"impulso",   name:"Impulso",    hint:"energia de fala" },
  { id:"fluxo",     name:"Fluxo",      hint:"continuidade" },
  { id:"constancia",name:"Constância", hint:"estabilidade" },
  { id:"pausa",     name:"Pausa ok",   hint:"respirar sem travar" },
  { id:"entonacao", name:"Entonação",  hint:"variação vocal" },
  { id:"foco",      name:"Foco",       hint:"menos dispersão" },
  { id:"harmonia",  name:"Harmonia",   hint:"equilíbrio geral" }
];

let barsUI = null;
function buildBars(){
  const root = document.getElementById("bars");
  if(!root) return;
  root.innerHTML = "";
  barsUI = {};
  METRICS.forEach(m=>{
    const row = document.createElement("div");
    row.className = "barRow";

    const name = document.createElement("div");
    name.className = "barName";
    name.textContent = m.name;

    const track = document.createElement("div");
    track.className = "track";

    const fill = document.createElement("div");
    fill.className = "fill";

    const target = document.createElement("div");
    target.className = "target"; // linha-meta (70%)

    track.appendChild(fill);
    track.appendChild(target);

    const val = document.createElement("div");
    val.className = "barVal";
    val.textContent = "0.00";

    row.appendChild(name);
    row.appendChild(track);
    row.appendChild(val);
    root.appendChild(row);

    barsUI[m.id] = { fill, val };
  });
}

const barState = {
  presenca:0, impulso:0, fluxo:0, constancia:0, pausa:0, entonacao:0, foco:0, harmonia:0
};
const barHold = { foco:0, constancia:0, harmonia:0 };
let goalsDone = { g1:false, g2:false, g3:false };
let rewardGiven = false;

function renderBars(){
  if(!barsUI) return;
  for(const k in barState){
    const v = clamp01(barState[k]);
    barsUI[k].fill.style.width = `${(v*100).toFixed(1)}%`;
    barsUI[k].val.textContent = v.toFixed(2);
  }

  // metas: manter acima de 0.70 por 8s (conta só quando mic/captura ativa)
  const TH = 0.70;
  const need = 8.0;

  const g1dot = document.getElementById("g1dot");
  const g2dot = document.getElementById("g2dot");
  const g3dot = document.getElementById("g3dot");

  if(goalsDone.g1) g1dot?.classList.add("ok");
  if(goalsDone.g2) g2dot?.classList.add("ok");
  if(goalsDone.g3) g3dot?.classList.add("ok");

  if(goalsDone.g1 && goalsDone.g2 && goalsDone.g3 && !rewardGiven){
    // +1 token demo
    setTokens(getTokens() + 1);
    rewardGiven = true;
    const pillToken = document.getElementById("pillToken");
    if(pillToken) pillToken.textContent = `Tokens (demo): ${getTokens()}`;
    alert("🔥 Metas completas! +1 token demo.");
  }
}

// suavização: sobe mais rápido, desce devagar
function approach(key, target, up=0.18, down=0.04){
  const cur = barState[key];
  const a = (target > cur) ? up : down;
  barState[key] = clamp01(cur + (target - cur) * a);
}

// ------------------------------
// CRS “pedagógico” (áudio) — heurísticas
// ------------------------------
let audioCtx=null, analyser=null, stream=null, src=null;
let timeData=null, freqData=null;
let raf=null;
let micOn=false;

let oralStartedAt=0;
let oralTimerInt=null;

const ORAL_MAX_QUESTIONS = 5;
const RECORD_SEC = 15;            // grava “janela” por resposta
const RECORD_MAX_TOTAL_SEC = 5*60; // último 5 min se quiser evoluir; aqui usamos 5x15s = 75s (leve)

let oralQuestions = [];
let oralIdx = 0;

// métricas agregadas (para relatório e metadados anonimizados)
const oralAgg = {
  samples:0,
  avgRms:0,
  avgSilence:0,
  avgVar:0,
  avgPitchProxy:0
};

function rmsFromTimeDomain(buf){
  let sum=0;
  for(let i=0;i<buf.length;i++){
    const v = (buf[i]-128)/128;
    sum += v*v;
  }
  return Math.sqrt(sum/buf.length);
}

function bandEnergy(freq, fromHz, toHz, sampleRate){
  const nyq = sampleRate/2;
  const from = Math.floor((fromHz/nyq) * freq.length);
  const to   = Math.floor((toHz/nyq) * freq.length);
  let sum=0, n=0;
  for(let i=Math.max(0,from); i<=Math.min(freq.length-1,to); i++){
    sum += freq[i];
    n++;
  }
  return n ? (sum/n)/255 : 0;
}

function pitchProxy(freq, sampleRate){
  // pico entre 90 e 350Hz (proxy)
  const nyq = sampleRate/2;
  const from = Math.floor((90/nyq) * freq.length);
  const to   = Math.floor((350/nyq) * freq.length);
  let max=0;
  for(let i=from;i<=to;i++) max = Math.max(max, freq[i]);
  return (max/255);
}

function updateAggregates(rms, silence, v, pp){
  const n = oralAgg.samples + 1;
  oralAgg.avgRms = (oralAgg.avgRms*oralAgg.samples + rms)/n;
  oralAgg.avgSilence = (oralAgg.avgSilence*oralAgg.samples + silence)/n;
  oralAgg.avgVar = (oralAgg.avgVar*oralAgg.samples + v)/n;
  oralAgg.avgPitchProxy = (oralAgg.avgPitchProxy*oralAgg.samples + pp)/n;
  oralAgg.samples = n;
}

let lastRms = 0;
function tickBars(){
  if(!micOn || !analyser) return;

  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const rms = clamp01(rmsFromTimeDomain(timeData) * 3.0); // ganho visual
  const low = bandEnergy(freqData, 80, 220, audioCtx.sampleRate);
  const mid = bandEnergy(freqData, 300, 1200, audioCtx.sampleRate);
  const high = bandEnergy(freqData, 1200, 3500, audioCtx.sampleRate);
  const pp = clamp01(pitchProxy(freqData, audioCtx.sampleRate));

  const variability = clamp01(Math.abs(rms - lastRms) * 6.0);
  lastRms = rms;

  const silenceThr = 0.03; // heurística fixa pra demo
  const silence = clamp01((silenceThr - rms)/silenceThr); // 0 falando -> 1 silêncio

  // mapeamento (heurístico, pedagógico):
  // presença/foco: estabilidade + energia moderada + pouco ruído extremo
  const focusTarget = clamp01((rms*0.55 + (1-variability)*0.45) * (0.75 + mid*0.25));
  const presTarget = clamp01((1-silence)*0.55 + (1-variability)*0.45);

  // impulso: energia geral
  const impTarget = clamp01(rms*0.9 + low*0.1);

  // fluxo: fala contínua (pouca pausa)
  const fluxoTarget = clamp01((1-silence)*0.75 + (1-variability)*0.25);

  // constância: pouca variação brusca
  const constTarget = clamp01(1 - variability);

  // pausa ok: nem “mudo total” nem “sem respirar” -> alvo perto de 0.35 de silêncio
  const pausaTarget = clamp01(1 - Math.abs(silence - 0.35)*1.7);

  // entonação: variação saudável (não zero)
  const entTarget = clamp01(pp*0.6 + variability*0.4);

  // harmonia: equilíbrio geral (média ponderada)
  const harmTarget = clamp01((focusTarget + presTarget + constTarget + pausaTarget)/4);

  approach("foco", focusTarget);
  approach("presenca", presTarget);
  approach("impulso", impTarget);
  approach("fluxo", fluxoTarget);
  approach("constancia", constTarget);
  approach("pausa", pausaTarget);
  approach("entonacao", entTarget);
  approach("harmonia", harmTarget);

  // metas (contagem de tempo acima da linha)
  const dt = 1/30; // approx (raf ~ 30-60fps; aqui “aproxima”)
  if(barState.foco >= 0.70) barHold.foco += dt; else barHold.foco = Math.max(0, barHold.foco - dt*0.5);
  if(barState.constancia >= 0.70) barHold.constancia += dt; else barHold.constancia = Math.max(0, barHold.constancia - dt*0.5);
  if(barState.harmonia >= 0.70) barHold.harmonia += dt; else barHold.harmonia = Math.max(0, barHold.harmonia - dt*0.5);

  if(!goalsDone.g1 && barHold.foco >= 8) goalsDone.g1 = true;
  if(!goalsDone.g2 && barHold.constancia >= 8) goalsDone.g2 = true;
  if(!goalsDone.g3 && barHold.harmonia >= 8) goalsDone.g3 = true;

  // agrega pro relatório (leve)
  updateAggregates(rms, silence, variability, pp);

  renderBars();
}

async function enableMic(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ audio:true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;

    src = audioCtx.createMediaStreamSource(stream);
    src.connect(analyser);

    timeData = new Uint8Array(analyser.fftSize);
    freqData = new Uint8Array(analyser.frequencyBinCount);

    micOn = true;
    const micState = document.getElementById("micState");
    if(micState) micState.textContent = "microfone: ligado ✅";
    document.getElementById("btnRecord").disabled = false;

    // loop
    const loop = ()=>{
      raf = requestAnimationFrame(loop);
      tickBars();
    };
    loop();
  }catch(e){
    alert("Falha ao acessar microfone. Verifique permissões do navegador.");
  }
}

function disableMic(){
  try{ if(raf) cancelAnimationFrame(raf); }catch{}
  raf = null;

  try{ src?.disconnect(); }catch{}
  try{ analyser?.disconnect?.(); }catch{}
  try{ audioCtx?.close(); }catch{}

  try{ stream?.getTracks()?.forEach(t=>t.stop()); }catch{}

  micOn = false;
  const micState = document.getElementById("micState");
  if(micState) micState.textContent = "microfone: desligado";
}

// ------------------------------
// Fase oral (controle)
// ------------------------------
function startOral(){
  oralQuestions = pickRandom(ORAL_POOL, ORAL_MAX_QUESTIONS);
  oralIdx = 0;

  // reset metas e barras
  METRICS.forEach(m => barState[m.id] = 0);
  barHold.foco = barHold.constancia = barHold.harmonia = 0;
  goalsDone = { g1:false, g2:false, g3:false };
  rewardGiven = false;

  // reset agregados
  oralAgg.samples=0; oralAgg.avgRms=0; oralAgg.avgSilence=0; oralAgg.avgVar=0; oralAgg.avgPitchProxy=0;

  updateOralUI();

  oralStartedAt = now();
  if(oralTimerInt) clearInterval(oralTimerInt);
  oralTimerInt = setInterval(()=>{
    const sec = (now() - oralStartedAt)/1000;
    const el = document.getElementById("oralTimer");
    if(el) el.textContent = `tempo: ${fmtTime(sec)}`;
  }, 300);

  const pillToken = document.getElementById("pillToken");
  if(pillToken) pillToken.textContent = `Tokens (demo): ${getTokens()}`;

  show("screenOral");
}

function updateOralUI(){
  const qTitle = document.getElementById("qTitle");
  const qText = document.getElementById("qText");
  const pill = document.getElementById("pillOralProgress");
  if(qTitle) qTitle.textContent = `Pergunta ${oralIdx+1}/${oralQuestions.length}`;
  if(qText) qText.textContent = oralQuestions[oralIdx] || "—";
  if(pill) pill.textContent = `Oral: ${oralIdx}/${oralQuestions.length}`;
}

function nextOral(){
  oralIdx++;
  const pill = document.getElementById("pillOralProgress");
  if(pill) pill.textContent = `Oral: ${Math.min(oralIdx, oralQuestions.length)}/${oralQuestions.length}`;

  if(oralIdx >= oralQuestions.length){
    // fim oral
    document.getElementById("btnToWritten").disabled = false;
    alert("✅ Fase oral concluída! Agora você pode ir para a fase escrita.");
    return;
  }
  updateOralUI();
}

function skipOral(){
  nextOral();
}

function endOral(){
  document.getElementById("btnToWritten").disabled = false;
  alert("Oral encerrada. Você pode seguir para a fase escrita.");
}

function recordAnswerWindow(){
  if(!micOn){
    alert("Ative o microfone primeiro.");
    return;
  }
  const btn = document.getElementById("btnRecord");
  btn.disabled = true;

  const micState = document.getElementById("micState");
  if(micState) micState.textContent = "microfone: gravando (15s)…";

  const start = now();
  const t = setInterval(()=>{
    const elapsed = (now()-start)/1000;
    if(elapsed >= RECORD_SEC){
      clearInterval(t);
      if(micState) micState.textContent = "microfone: ligado ✅";
      btn.disabled = false;
      nextOral();
    }
  }, 150);
}

// ------------------------------
// Fase escrita
// ------------------------------
let written = {
  items: [],
  idx: 0,
  answers: {}, // idx -> selected
  score: 0
};

function startWritten(){
  // consome 1 token (demo) para iniciar a prova escrita
  const tokens = getTokens();
  if(tokens <= 0){
    alert("Tokens (demo) acabaram. Refaça metas na fase oral para ganhar +1 token.");
    show("screenOral");
    return;
  }
  setTokens(tokens - 1);

  written.items = pickRandom(WRITTEN_POOL, 5);
  written.idx = 0;
  written.answers = {};
  written.score = 0;

  show("screenWritten");
  renderWritten();
}

function renderWritten(){
  const item = written.items[written.idx];
  document.getElementById("wTitle").textContent = `Questão ${written.idx+1}/${written.items.length}`;
  document.getElementById("wText").textContent = item.q;

  const wrap = document.getElementById("wOptions");
  wrap.innerHTML = "";

  item.a.forEach((txt, i)=>{
    const row = document.createElement("label");
    row.className = "opt";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "opt";
    radio.value = String(i);
    radio.checked = (written.answers[written.idx] === i);

    radio.addEventListener("change", ()=>{
      written.answers[written.idx] = i;
      document.getElementById("btnWNext").disabled = false;
      updateLiveScore();
    });

    const div = document.createElement("div");
    div.innerHTML = `<div style="font-weight:800">${String.fromCharCode(65+i)})</div><div class="muted">${txt}</div>`;

    row.appendChild(radio);
    row.appendChild(div);
    wrap.appendChild(row);
  });

  document.getElementById("btnWPrev").disabled = (written.idx === 0);
  document.getElementById("btnWNext").disabled = !(written.answers.hasOwnProperty(written.idx));
  updateLiveScore();
}

function updateLiveScore(){
  // score parcial baseado no que já marcou
  let s=0;
  for(let i=0;i<written.items.length;i++){
    if(written.answers.hasOwnProperty(i)){
      const correct = written.items[i].correct;
      if(written.answers[i] === correct) s++;
    }
  }
  written.score = s;
  document.getElementById("wScoreLive").textContent = `pontuação: ${s}`;
}

function nextWritten(){
  if(!written.answers.hasOwnProperty(written.idx)){
    alert("Marque uma alternativa para avançar.");
    return;
  }
  if(written.idx < written.items.length-1){
    written.idx++;
    renderWritten();
  }else{
    finishWritten();
  }
}

function prevWritten(){
  if(written.idx>0){
    written.idx--;
    renderWritten();
  }
}

function finishWritten(){
  updateLiveScore();

  const lastScore = Math.round((written.score / written.items.length) * 10); // escala 0..10
  setLast(lastScore);

  const best = Math.max(getBest(), lastScore);
  setBest(best);

  pushHistory({
    ts: now(),
    lastScore,
    best,
    oralAgg: { ...oralAgg },
    tokensLeft: getTokens()
  });

  refreshPills();
  buildReport();
  show("screenReport");
}

// ------------------------------
// Relatório + metadados anonimizados
// ------------------------------
function profile(){
  return {
    name: (document.getElementById("studentName")?.value || "").trim(),
    turma: (document.getElementById("studentClass")?.value || "").trim()
  };
}

function buildReport(){
  const p = profile();
  writeJSON(STORE.PROFILE, p);

  const best = getBest();
  const last = getLast();
  document.getElementById("kBest").textContent = `melhor: ${best}/10`;
  document.getElementById("kLast").textContent = `última: ${last}/10`;

  const meta = document.getElementById("reportMeta");
  meta.textContent = `Gerado em: ${new Date().toLocaleString()} • Tokens restantes (demo): ${getTokens()}`;

  const txt =
`VIBRAÇÕES DE LEÃO — RELATÓRIO (DEMO EDUCACIONAL)
Data/Hora: ${new Date().toLocaleString()}

Aluno (opcional):
- Nome: ${p.name || "(não informado)"}
- Turma: ${p.turma || "(não informado)"}

Resultados:
- Nota da última prova: ${last}/10
- Melhor nota registrada: ${best}/10

Fase oral (métricas heurísticas — sem áudio):
- Amostras: ${oralAgg.samples}
- Energia média (RMS proxy): ${oralAgg.avgRms.toFixed(4)}
- Silêncio médio (proxy): ${oralAgg.avgSilence.toFixed(4)}
- Variação média (proxy): ${oralAgg.avgVar.toFixed(4)}
- Entonação (pitch proxy): ${oralAgg.avgPitchProxy.toFixed(4)}

Leitura pedagógica sugerida (não clínica):
- Se o foco/constância caem muito, tente responder mais devagar e com pausas curtas.
- Se a energia estiver muito baixa, aproxi