/* Lion Vibes — app.js (static, GitHub Pages)
   - 8 barras ao vivo (WebAudio)
   - metas com “tracinho” + decay
   - tokens (localStorage)
   - prova vale 10 (repete, guarda maior nota)
   - salvar relatório (últimos 5 min) no localStorage
*/

const LS = {
  tokens: "lv_tokens",
  best: "lv_best_score",
  reports: "lv_reports",
  quiz: "lv_quiz_state"
};

const MAX_REPORTS = 10;
const WINDOW_SEC = 300; // últimos 5 minutos
const FPS = 12;         // atualização das barras
const DT = 1 / FPS;

const ui = {
  bars: document.getElementById("bars"),
  pillTokens: document.getElementById("pillTokens"),
  pillMic: document.getElementById("pillMic"),
  pillGoal: document.getElementById("pillGoal"),
  coachText: document.getElementById("coachText"),

  studentName: document.getElementById("studentName"),
  mode: document.getElementById("mode"),
  btnMic: document.getElementById("btnMic"),
  btnPause: document.getElementById("btnPause"),
  btnStop: document.getElementById("btnStop"),
  btnSave: document.getElementById("btnSave"),

  testDate: document.getElementById("testDate"),
  level: document.getElementById("level"),
  btnStartQuiz: document.getElementById("btnStartQuiz"),
  btnResetBest: document.getElementById("btnResetBest"),
  quizBox: document.getElementById("quizBox"),
  qTitle: document.getElementById("qTitle"),
  choices: document.getElementById("choices"),
  btnSubmit: document.getElementById("btnSubmit"),
  btnNext: document.getElementById("btnNext"),
  quizResult: document.getElementById("quizResult"),
  bestText: document.getElementById("bestText")
};

function nowTs(){ return Date.now(); }
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function fmt1(x){ return (Math.round(x * 100) / 100).toFixed(2); }
function readJSON(key, fallback){
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return fallback; }
}
function writeJSON(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function getTokens(){ return Number(localStorage.getItem(LS.tokens) || "0"); }
function setTokens(v){ localStorage.setItem(LS.tokens, String(Math.max(0, Math.floor(v)))); renderTokens(); }
function addTokens(n){ setTokens(getTokens() + n); }
function renderTokens(){ ui.pillTokens.textContent = `Tokens: ${getTokens()}`; }

/* ---------- BARRAS ---------- */

const METRICS = [
  { id:"presence",  name:"Presença",        goal: 0.55 },
  { id:"impulse",   name:"Impulso",         goal: 0.45 },
  { id:"flow",      name:"Fluxo",           goal: 0.50 },
  { id:"const",     name:"Constância",      goal: 0.55 },
  { id:"pause",     name:"Pausa",           goal: 0.55 },
  { id:"inton",     name:"Entonação",       goal: 0.45 },
  { id:"focus",     name:"Foco",            goal: 0.50 },
  { id:"harmony",   name:"Harmonia",        goal: 0.55 }
];

let barState = METRICS.map(m => ({
  id: m.id,
  name: m.name,
  goal: m.goal,
  val: 0,
  vis: 0,       // valor “com decay” (visual)
  hold: 0       // segundos acima da meta
}));

function buildBars(){
  ui.bars.innerHTML = "";
  for (const m of barState){
    const row = document.createElement("div");
    row.className = "barRow";
    row.innerHTML = `
      <div class="barLbl">${m.name}</div>
      <div class="barTrack">
        <div class="barFill" id="fill_${m.id}"></div>
        <div class="barGoal" id="goal_${m.id}"></div>
      </div>
      <div class="barVal" id="val_${m.id}">0.00</div>
    `;
    ui.bars.appendChild(row);
  }
  layoutGoals();
}

function layoutGoals(){
  for (const m of barState){
    const g = document.getElementById(`goal_${m.id}`);
    if (g){
      g.style.left = `${Math.round(m.goal * 100)}%`;
    }
  }
}

/* ---------- AUDIO ENGINE (WebAudio) ---------- */

let audio = {
  ctx: null,
  stream: null,
  src: null,
  analyser: null,
  data: null,
  running: false,
  paused: true
};

async function startMic(){
  if (audio.running && !audio.paused) return;

  try{
    if (!audio.ctx){
      audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audio.ctx.state === "suspended"){
      await audio.ctx.resume();
    }
    if (!audio.stream){
      audio.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    }
    if (!audio.src){
      audio.src = audio.ctx.createMediaStreamSource(audio.stream);
    }
    if (!audio.analyser){
      audio.analyser = audio.ctx.createAnalyser();
      audio.analyser.fftSize = 2048;
      audio.analyser.smoothingTimeConstant = 0.75;
      audio.data = new Float32Array(audio.analyser.fftSize);
      audio.src.connect(audio.analyser);
    }

    audio.running = true;
    audio.paused = false;
    ui.pillMic.textContent = "Mic: ativo";
    ui.pillMic.className = "pill ok";
    ui.btnMic.textContent = "Microfone ativo";
    ui.btnMic.disabled = true;

  }catch(err){
    console.error(err);
    ui.pillMic.textContent = "Mic: bloqueado";
    ui.pillMic.className = "pill warn";
    ui.btnMic.disabled = false;
    ui.btnMic.textContent = "Ativar microfone";
    ui.coachText.textContent = "Permita o microfone no navegador (HTTPS). Se estiver no celular, tente Chrome e recarregue a página.";
  }
}

function pauseMic(){
  if (!audio.running) return;
  audio.paused = true;
  ui.pillMic.textContent = "Mic: pausado";
  ui.pillMic.className = "pill warn";
  ui.btnMic.disabled = false;
  ui.btnMic.textContent = "Retomar microfone";
}

function stopAll(){
  audio.paused = true;
  audio.running = false;

  // zera barras com decay suave
  for (const m of barState){
    m.val = 0;
    m.vis = 0;
    m.hold = 0;
  }
  renderBars();

  ui.pillMic.textContent = "Mic: pausado";
  ui.pillMic.className = "pill warn";
  ui.btnMic.disabled = false;
  ui.btnMic.textContent = "Ativar microfone";
  ui.coachText.textContent = "Sessão encerrada. Você pode salvar um relatório (últimos 5 min) e começar de novo.";
}

function computeFeatures(){
  if (!audio.analyser || audio.paused) return null;

  audio.analyser.getFloatTimeDomainData(audio.data);

  // RMS (volume)
  let sumSq = 0;
  let zc = 0;
  for (let i=1; i<audio.data.length; i++){
    const x = audio.data[i];
    sumSq += x*x;
    if ((audio.data[i-1] >= 0 && x < 0) || (audio.data[i-1] < 0 && x >= 0)) zc++;
  }
  const rms = Math.sqrt(sumSq / audio.data.length);

  // proxies simples (não clínicos)
  const energy = clamp01(rms * 12);               // normalização
  const zcr = clamp01((zc / audio.data.length) * 6); // “agitação” / entonação proxy

  // “silêncio” proxy (quanto menor rms, maior silêncio)
  const silence = clamp01(1 - (rms * 18));

  return { rms, energy, zcr, silence };
}

/* ---------- LÓGICA DAS MÉTRICAS (heurística) ---------- */

function updateMetrics(feat){
  // base: energia e silêncio
  const e = feat ? feat.energy : 0;
  const s = feat ? feat.silence : 1;
  const z = feat ? feat.zcr : 0;

  // modo ajusta metas (sem “métrica escondida”, só comportamento)
  const mode = ui.mode.value;

  // 8 métricas (0..1) — heurística amigável
  let presence   = clamp01((0.55 * (1 - z)) + (0.45 * (1 - s)));     // menos “nervoso” + menos silêncio extremo
  let impulse    = clamp01(0.50 * e + 0.20 * z + 0.30 * (1 - s));    // energia presente
  let flow       = clamp01(0.55 * (1 - s) + 0.45 * (1 - Math.abs(z - 0.35))); // fala contínua sem “serrote”
  let constant   = clamp01(1 - Math.abs(e - 0.45));                  // estabilidade de energia
  let pause      = clamp01(1 - Math.abs(s - 0.35));                  // pausas moderadas
  let inton      = clamp01(1 - Math.abs(z - 0.35));                  // variação moderada
  let focus      = clamp01(0.60 * constant + 0.40 * flow);
  let harmony    = clamp01(0.45 * presence + 0.30 * pause + 0.25 * focus);

  // ajustes por modo
  if (mode === "presenca"){
    // favorece calma
    impulse *= 0.9;
    inton   *= 0.95;
    presence = clamp01(presence * 1.05);
    harmony  = clamp01(harmony * 1.05);
  } else if (mode === "foco"){
    // favorece constância
    constant = clamp01(constant * 1.08);
    focus    = clamp01(focus * 1.08);
    pause    = clamp01(pause * 0.95);
  } else if (mode === "pausa"){
    // favorece pausa consciente
    pause    = clamp01(pause * 1.10);
    presence = clamp01(presence * 1.02);
    flow     = clamp01(flow * 0.95);
  }

  const values = [presence, impulse, flow, constant, pause, inton, focus, harmony];
  for (let i=0; i<barState.length; i++){
    barState[i].val = values[i];
  }
}

function applyDecay(){
  // decay visual: sobe rápido, cai devagar
  const up = 0.35;
  const down = 0.07;

  for (const m of barState){
    if (m.val >= m.vis) {
      m.vis = m.vis + (m.val - m.vis) * up;
    } else {
      m.vis = m.vis - (m.vis - m.val) * down;
    }
    m.vis = clamp01(m.vis);

    // hold se acima da meta
    if (m.vis >= m.goal) m.hold += DT;
    else m.hold = Math.max(0, m.hold - DT * 0.6);
  }
}

function renderBars(){
  for (const m of barState){
    const fill = document.getElementById(`fill_${m.id}`);
    const val = document.getElementById(`val_${m.id}`);
    if (fill) fill.style.width = `${Math.round(m.vis * 100)}%`;
    if (val) val.textContent = fmt1(m.vis);
  }
}

/* ---------- METAS + TOKEN (3 metas) ---------- */

let goalState = {
  earned: 0,
  lastEarnTs: 0
};

function updateGoalsAndCoach(){
  // metas: cumprir 3 condições simples por ~4s cada
  // 1) Presença acima da meta por 4s
  // 2) Constância acima da meta por 4s
  // 3) Harmonia acima da meta por 4s
  const needHold = 4.0;

  const pres = barState[0];
  const cons = barState[3];
  const harm = barState[7];

  let earned = 0;
  if (pres.hold >= needHold) earned++;
  if (cons.hold >= needHold) earned++;
  if (harm.hold >= needHold) earned++;

  goalState.earned = earned;
  ui.pillGoal.textContent = `Meta: ${earned}/3`;

  // se completou as 3, dá 1 token e reseta holds (com cooldown)
  const cooldownMs = 8000;
  const okToPay = (nowTs() - goalState.lastEarnTs) > cooldownMs;

  if (earned >= 3 && okToPay){
    goalState.lastEarnTs = nowTs();
    addTokens(1);

    // reseta para “o cara ter que fazer de novo”
    for (const m of barState) m.hold = 0;

    ui.coachText.textContent =
      "✅ Mandou bem. Você completou 3 metas de estabilidade e ganhou 1 token. Repita tentando manter mais suave, sem pressa.";
    return;
  }

  // coach textual simples (não médico)
  if (!audio.running || audio.paused){
    ui.coachText.textContent =
      "Ative o microfone. Fale 20–30s. Tente manter as barras acima do tracinho (meta) sem forçar.";
    return;
  }

  if (earned === 0){
    ui.coachText.textContent =
      "Comece devagar. Fale com calma, sem correr. Respire e retome. Procure estabilidade (subir e ficar).";
  } else if (earned === 1){
    ui.coachText.textContent =
      "Boa. Agora tente manter por mais alguns segundos. Menos pressa, mais constância.";
  } else if (earned === 2){
    ui.coachText.textContent =
      "Quase lá. Só manter! Respire, fale com clareza e deixe a curva estabilizar.";
  } else {
    ui.coachText.textContent =
      "✅ Metas completas. Se não cair, você ganha token (tem um pequeno cooldown).";
  }
}

/* ---------- BUFFER (últimos 5 min) para relatório ---------- */

let ring = []; // {t, vals:[8]}
function pushRing(){
  const t = nowTs();
  const vals = barState.map(m => m.vis);
  ring.push({ t, vals });

  // mantém só WINDOW_SEC
  const minT = t - WINDOW_SEC * 1000;
  while (ring.length && ring[0].t < minT) ring.shift();
}

function saveReport(){
  // relatório simples: pega resumo + série
  const name = (ui.studentName.value || "").trim();
  const mode = ui.mode.value;

  const series = ring.slice(0); // clone
  if (!series.length){
    alert("Sem dados ainda. Ative o microfone e fale um pouco antes de salvar.");
    return;
  }

  // médias
  const avg = new Array(8).fill(0);
  for (const p of series){
    for (let i=0; i<8; i++) avg[i] += p.vals[i];
  }
  for (let i=0; i<8; i++) avg[i] /= series.length;

  const report = {
    id: `lv_${nowTs()}`,
    createdAt: new Date().toISOString(),
    name,
    mode,
    tokensAtSave: getTokens(),
    avg,
    series
  };

  let reports = readJSON(LS.reports, []);
  reports.unshift(report);
  reports = reports.slice(0, MAX_REPORTS);
  writeJSON(LS.reports, reports);

  alert("Relatório salvo no dispositivo (localStorage). Abra 'Relatórios' para ver.");
}

/* ---------- PROVA VALE 10 (iniciante real) ---------- */

const BANK = [
  // Nível 0
  [
    {
      q: "O que é um algoritmo?",
      a: 1,
      c: [
        "Um tipo de computador",
        "Um passo a passo para resolver um problema",
        "Um cabo de internet",
        "Um aplicativo de celular"
      ],
      tip: "Algoritmo é uma receita: passos em ordem."
    },
    {
      q: "Um bit é:",
      a: 2,
      c: [
        "Uma letra do teclado",
        "Um arquivo de vídeo",
        "A menor unidade de informação (0 ou 1)",
        "Um botão do mouse"
      ],
      tip: "Computadores trabalham com 0 e 1."
    },
    {
      q: "Para que serve uma linguagem de programação?",
      a: 0,
      c: [
        "Para dar instruções ao computador de forma organizada",
        "Para aumentar o volume do microfone",
        "Para desenhar no Canva",
        "Para conectar no Wi-Fi"
      ],
      tip: "É o jeito humano de escrever instruções."
    },
    {
      q: "O que significa 'entrada' em um programa?",
      a: 3,
      c: [
        "O final do código",
        "A bateria do celular",
        "A tela do computador",
        "Informações que o programa recebe (ex: nome, número)"
      ],
      tip: "Entrada = o que chega; saída = o que o programa entrega."
    }
  ],
  // Nível 1
  [
    {
      q: "Qual é a ordem correta de um algoritmo simples?",
      a: 0,
      c: [
        "Entrada → Processamento → Saída",
        "Saída → Entrada → Processamento",
        "Processamento → Saída → Entrada",
        "Entrada → Saída → Processamento"
      ],
      tip: "Primeiro recebe, depois pensa, depois mostra."
    },
    {
      q: "Se eu quiser repetir uma ação várias vezes, eu uso:",
      a: 2,
      c: [
        "Uma cor",
        "Um emoji",
        "Um laço/repetição (loop)",
        "Um print da tela"
      ],
      tip: "Loop repete. Ex: repetir 10 vezes."
    },
    {
      q: "Um 'bug' é:",
      a: 1,
      c: [
        "Uma música",
        "Um erro no programa (comportamento inesperado)",
        "Um tipo de teclado",
        "Um botão do GitHub"
      ],
      tip: "Bug é erro. Corrigir é depurar."
    },
    {
      q: "Em um 'se... então...', isso é:",
      a: 3,
      c: [
        "Um desenho",
        "Um arquivo",
        "Um cabo",
        "Uma condição/decisão (if/else)"
      ],
      tip: "Condição decide qual caminho seguir."
    }
  ],
  // Nível 2 (JS inicial)
  [
    {
      q: "No JavaScript, para mostrar algo na tela do console, usamos:",
      a: 2,
      c: [
        "print()",
        "echo()",
        "console.log()",
        "say()"
      ],
      tip: "console.log('Olá') é o básico do básico."
    },
    {
      q: "Qual é um exemplo de variável?",
      a: 0,
      c: [
        "let idade = 15;",
        "if (idade) {}",
        "for (i=0;i<10;i++){}",
        "function(){}"
      ],
      tip: "Variável guarda um valor."
    },
    {
      q: "Qual é a ideia de uma função?",
      a: 1,
      c: [
        "Escolher uma cor",
        "Reusar um bloco de passos com um nome",
        "Aumentar o Wi-Fi",
        "Salvar um print"
      ],
      tip: "Função = um “mini algoritmo” reaproveitável."
    },
    {
      q: "Um comentário em JS começa com:",
      a: 3,
      c: [
        "##",
        "@@",
        "$$",
        "//"
      ],
      tip: "// isso é um comentário"
    }
  ]
];

let quiz = {
  running: false,
  level: 0,
  idx: 0,
  score: 0,
  answers: [],
  order: []
};

function loadBest(){
  const best = readJSON(LS.best, null);
  if (!best){
    ui.bestText.textContent = "Ainda não há melhor nota salva.";
    return;
  }
  ui.bestText.innerHTML =
    `Maior nota: <b>${best.best10}</b> / 10 • Tentativas: <b>${best.tries}</b> • Última: <b>${new Date(best.lastAt).toLocaleString()}</b>`;
}

function resetBest(){
  localStorage.removeItem(LS.best);
  loadBest();
  alert("Melhor nota zerada (apenas neste dispositivo).");
}

function startQuiz(){
  const lvl = Number(ui.level.value || "0");
  quiz.running = true;
  quiz.level = lvl;
  quiz.idx = 0;
  quiz.score = 0;
  quiz.answers = [];

  // ordem fixa por enquanto (pode randomizar depois)
  quiz.order = BANK[lvl].map((_, i) => i);

  ui.quizBox.style.display = "block";
  ui.quizResult.style.display = "none";
  ui.btnNext.style.display = "none";
  ui.btnSubmit.style.display = "inline-block";

  renderQuestion();
}

function renderQuestion(){
  const q = BANK[quiz.level][quiz.order[quiz.idx]];
  ui.qTitle.textContent = `Questão ${quiz.idx + 1} / ${quiz.order.length} — ${q.q}`;
  ui.choices.innerHTML = "";

  q.c.forEach((txt, i) => {
    const div = document.createElement("label");
    div.className = "choice";
    div.innerHTML = `<input type="radio" name="q" value="${i}"> <div>${txt}</div>`;
    ui.choices.appendChild(div);
  });
}

function submitAnswer(){
  const sel = ui.choices.querySelector('input[name="q"]:checked');
  if (!sel){
    alert("Escolha uma alternativa.");
    return;
  }

  const chosen = Number(sel.value);
  const q = BANK[quiz.level][quiz.order[quiz.idx]];
  const ok = chosen === q.a;

  if (ok) quiz.score++;

  ui.quizResult.style.display = "block";
  ui.quizResult.innerHTML =
    `<div style="font-weight:950">${ok ? "✅ Acertou" : "❌ Errou"}</div>
     <div class="muted" style="margin-top:4px">${q.tip}</div>`;

  ui.btnSubmit.style.display = "none";
  ui.btnNext.style.display = "inline-block";
}

function nextQuestion(){
  ui.quizResult.style.display = "none";
  ui.btnSubmit.style.display = "inline-block";
  ui.btnNext.style.display = "none";

  quiz.idx++;
  if (quiz.idx >= quiz.order.length){
    finishQuiz();
    return;
  }
  renderQuestion();
}

function finishQuiz(){
  quiz.running = false;

  // nota vale 10
  const total = quiz.order.length;
  const raw = quiz.score / total;       // 0..1
  const grade10 = Math.round(raw * 10); // inteiro 0..10

  // salva melhor nota
  let best = readJSON(LS.best, { best10: 0, tries: 0, lastAt: nowTs() });
  best.tries = (best.tries || 0) + 1;
  best.lastAt = nowTs();
  if (grade10 > (best.best10 || 0)) best.best10 = grade10;
  writeJSON(LS.best, best);
  loadBest();

  // incentivo de token: se tirou 10, ganha 1 token (demo)
  if (grade10 === 10) addTokens(1);

  ui.quizBox.style.display = "block";
  ui.qTitle.textContent = "Prova finalizada";
  ui.choices.innerHTML = "";

  ui.quizResult.style.display = "block";
  ui.quizResult.innerHTML =
    `<div style="font-weight:950">Sua nota: ${grade10} / 10</div>
     <div class="muted" style="margin-top:4px">
       Você pode refazer quantas vezes quiser. O sistema guarda a maior nota.
       ${grade10 === 10 ? "<br><b>✅ Nota 10! Você ganhou 1 token (demo).</b>" : ""}
     </div>`;

  ui.btnSubmit.style.display = "none";
  ui.btnNext.style.display = "none";
}

/* ---------- LOOP PRINCIPAL ---------- */

function tick(){
  const feat = computeFeatures();
  updateMetrics(feat);
  applyDecay();
  renderBars();
  updateGoalsAndCoach();

  // buffer pra relatório
  if (audio.running && !audio.paused){
    pushRing();
  }

  setTimeout(tick, Math.round(1000 / FPS));
}

/* ---------- INIT ---------- */

function init(){
  // data default: hoje
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  ui.testDate.value = `${yyyy}-${mm}-${dd}`;

  buildBars();
  renderTokens();
  loadBest();

  ui.btnMic.addEventListener("click", startMic);
  ui.btnPause.addEventListener("click", () => {
    if (!audio.running) return;
    if (audio.paused) sta