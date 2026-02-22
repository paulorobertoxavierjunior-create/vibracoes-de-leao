/* Vibração de Leão — Prova Vale 10 (Demo GitHub Pages)
   - Login simples (nome)
   - Tela incentivo + treino de microfone (8 barras)
   - Metas simples que geram tokens (demo)
   - Prova com questões muito básicas
   - Tentativas ilimitadas, guarda maior nota
*/

const STORE = {
  STUDENT: "lion_student",
  BEST: "lion_best_scores",
  TOKENS: "lion_tokens",
  TRAIN: "lion_train_state"
};

// ========= CONFIG PRINCIPAL =========
// Ajuste a data da prova aqui (formato YYYY-MM-DD)
const DUE_DATE = "2026-03-05";

// Troque aqui pelo nome real da sua logo no repositório
const LOGO_SRC = "logo.jpg";

// Treino máximo (5 min)
const TRAIN_MAX_SEC = 5 * 60;

// Alvos (linhas) das métricas (0..1)
const TARGETS = {
  presenca: 0.68,
  impulso: 0.55,
  fluxo: 0.62,
  constancia: 0.60,
  pausaOk: 0.50,
  entonacao: 0.55,
  foco: 0.60,
  harmonia: 0.65
};

// ========= UTIL =========
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR");
}
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
function mmss(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

// ========= STATE =========
let student = readJSON(STORE.STUDENT, null);
let tokensObj = readJSON(STORE.TOKENS, { tokens: 0, updatedAt: Date.now() });
let best = readJSON(STORE.BEST, {}); // { levelId: bestScore10 }
let currentLevel = 0;
let currentQ = 0;
let answers = {}; // {qId: optionIndex}

// ========= UI REFS =========
const elLogo = document.getElementById("logoImg");

const screenLogin = document.getElementById("screenLogin");
const screenWelcome = document.getElementById("screenWelcome");
const screenExam = document.getElementById("screenExam");
const screenResult = document.getElementById("screenResult");

const pillDue = document.getElementById("pillDue");
const pillBest = document.getElementById("pillBest");
const pillLevel = document.getElementById("pillLevel");

const studentName = document.getElementById("studentName");
const studentClass = document.getElementById("studentClass");
const btnConnect = document.getElementById("btnConnect");

const welcomeText = document.getElementById("welcomeText");
const kpi1 = document.getElementById("kpi1");
const kpi2 = document.getElementById("kpi2");

const btnGoExam = document.getElementById("btnGoExam");

// Treino (microfone)
const btnMic = document.getElementById("btnMic");
const btnStartTrain = document.getElementById("btnStartTrain");
const btnStopTrain = document.getElementById("btnStopTrain");
const trainStatus = document.getElementById("trainStatus");
const trainTimer = document.getElementById("trainTimer");
const trainToken = document.getElementById("trainToken");
const barsWrap = document.getElementById("bars");

const m1 = document.getElementById("m1");
const m2 = document.getElementById("m2");
const m3 = document.getElementById("m3");
const m1ok = document.getElementById("m1ok");
const m2ok = document.getElementById("m2ok");
const m3ok = document.getElementById("m3ok");

// Prova
const examKpi = document.getElementById("examKpi");
const examKpi2 = document.getElementById("examKpi2");
const questionBox = document.getElementById("questionBox");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnFinish = document.getElementById("btnFinish");
const btnResetStudent = document.getElementById("btnResetStudent");

// Resultado
const resultText = document.getElementById("resultText");
const resKpi1 = document.getElementById("resKpi1");
const resKpi2 = document.getElementById("resKpi2");
const btnRetry = document.getElementById("btnRetry");
const btnBackHome = document.getElementById("btnBackHome");

// ========= DADOS DA PROVA (BEM BÁSICO) =========
const LEVELS = [
  {
    id: "nivel1",
    name: "Nível 1 — Conceitos",
    questions: [
      {
        id: "q1",
        text: "O que é um algoritmo?",
        options: [
          "Uma sequência de passos para resolver um problema",
          "Um tipo de computador",
          "Um cabo de internet",
          "Uma tela do celular"
        ],
        correct: 0
      },
      {
        id: "q2",
        text: "O que é um bit?",
        options: [
          "Uma unidade básica de informação (0 ou 1)",
          "Um tipo de bateria",
          "Um aplicativo de música",
          "Um teclado"
        ],
        correct: 0
      },
      {
        id: "q3",
        text: "Para que serve uma linguagem de programação?",
        options: [
          "Para dar instruções ao computador",
          "Para fazer o computador dormir",
          "Para aumentar o volume do celular",
          "Para trocar a cor do monitor"
        ],
        correct: 0
      }
    ]
  },
  {
    id: "nivel2",
    name: "Nível 2 — Lógica simples",
    questions: [
      {
        id: "q4",
        text: "Se eu digo: 'Repita 3 vezes: Olá', isso é um exemplo de…",
        options: ["Repetição (laço)", "Erro", "Imagem", "Senha"],
        correct: 0
      },
      {
        id: "q5",
        text: "Se eu digo: 'Se estiver chovendo, pegue guarda-chuva', isso é…",
        options: ["Condição (se/então)", "Som", "Tela", "Cálculo avançado"],
        correct: 0
      }
    ]
  },
  {
    id: "nivel3",
    name: "Nível 3 — Pensamento computacional",
    questions: [
      {
        id: "q6",
        text: "Qual é a melhor forma de resolver um problema grande?",
        options: [
          "Dividir em partes menores (decomposição)",
          "Fazer tudo de uma vez sem pensar",
          "Esperar alguém fazer",
          "Apagar tudo e desistir"
        ],
        correct: 0
      },
      {
        id: "q7",
        text: "O que é 'debug'?",
        options: [
          "Encontrar e corrigir erros",
          "Aumentar a memória do celular",
          "Trocar a capa do notebook",
          "Desenhar um gráfico bonito"
        ],
        correct: 0
      }
    ]
  }
];

// ========= TREINO: 8 BARRAS (heurística visual simples) =========
// Atenção: isso não é “métrica clínica”. É visual/educacional.
const METRICS = [
  { key: "presenca", label: "Presença" },
  { key: "impulso", label: "Impulso" },
  { key: "fluxo", label: "Fluxo" },
  { key: "constancia", label: "Constância" },
  { key: "pausaOk", label: "Pausa OK" },
  { key: "entonacao", label: "Entonação" },
  { key: "foco", label: "Foco" },
  { key: "harmonia", label: "Harmonia" }
];

let audioCtx = null;
let analyser = null;
let micStream = null;
let rafId = null;
let training = false;

let trainStartedAt = 0;
let trainAccumulated = 0; // tempo acumulado (pausar/retomar)
let lastFrameAt = 0;

let meta1Sec = 0;
let meta2Sec = 0;
let meta3Sec = 0;
let meta1Done = false;
let meta2Done = false;
let meta3Done = false;

const smooth = {
  rms: 0,
  zcr: 0,
  low: 0,
  mid: 0,
  high: 0
};

function rmsFromTimeDomain(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

// Zero Crossing Rate proxy (ritmo/“agitação” do sinal)
function zcrFromTimeDomain(buf) {
  let z = 0;
  let prev = buf[0] - 128;
  for (let i = 1; i < buf.length; i++) {
    const cur = buf[i] - 128;
    if ((prev >= 0 && cur < 0) || (prev < 0 && cur >= 0)) z++;
    prev = cur;
  }
  return z / buf.length;
}

function bandAvg(freq, fromHz, toHz, sampleRate) {
  const nyq = sampleRate / 2;
  const from = Math.floor((fromHz / nyq) * freq.length);
  const to = Math.floor((toHz / nyq) * freq.length);
  let sum = 0, n = 0;
  for (let i = Math.max(0, from); i <= Math.min(freq.length - 1, to); i++) {
    sum += freq[i];
    n++;
  }
  return n ? (sum / n) / 255 : 0;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function metricsFromAudio(timeData, freqData) {
  const rms = clamp01(rmsFromTimeDomain(timeData) * 2.8); // ganho p/ visual
  const zcr = clamp01(zcrFromTimeDomain(timeData) * 8.0);

  // bandas simples
  const low = clamp01(bandAvg(freqData, 80, 250, audioCtx.sampleRate) * 1.25);
  const mid = clamp01(bandAvg(freqData, 250, 1200, audioCtx.sampleRate) * 1.25);
  const high = clamp01(bandAvg(freqData, 1200, 3500, audioCtx.sampleRate) * 1.25);

  // suavização
  smooth.rms = lerp(smooth.rms, rms, 0.12);
  smooth.zcr = lerp(smooth.zcr, zcr, 0.10);
  smooth.low = lerp(smooth.low, low, 0.10);
  smooth.mid = lerp(smooth.mid, mid, 0.10);
  smooth.high = lerp(smooth.high, high, 0.10);

  // Heurísticas educativas (0..1)
  const presenca = clamp01(smooth.rms);
  const impulso = clamp01(smooth.rms * 0.65 + smooth.low * 0.35);
  const fluxo = clamp01(0.65 * (1 - smooth.zcr) + 0.35 * smooth.rms); // menos “tremedeira”, mais fluxo
  const constancia = clamp01(1 - Math.abs(smooth.rms - rms) * 2.2); // estabilidade do nível
  const pausaOk = clamp01(1 - smooth.rms); // quanto mais baixo o rms, mais “pausa”
  const entonacao = clamp01(0.45 * smooth.high + 0.55 * smooth.mid);
  const foco = clamp01(0.55 * smooth.mid + 0.45 * (1 - smooth.high)); // reduz chiado
  const harmonia = clamp01((presenca + fluxo + constancia) / 3);

  return { presenca, impulso, fluxo, constancia, pausaOk, entonacao, foco, harmonia };
}

function renderBars(values) {
  METRICS.forEach(m => {
    const fill = document.querySelector(`[data-fill="${m.key}"]`);
    const val = document.querySelector(`[data-val="${m.key}"]`);
    const v = values[m.key] ?? 0;
    if (fill) fill.style.width = `${Math.round(v * 100)}%`;
    if (val) val.textContent = (v * 100).toFixed(0) + "%";
  });
}

function ensureBarsUI() {
  if (!barsWrap) return;
  barsWrap.innerHTML = METRICS.map(m => {
    const targetPct = Math.round((TARGETS[m.key] ?? 0.65) * 100);
    return `
      <div class="barItem">
        <div class="barTop">
          <div class="barName">${m.label}</div>
          <div class="barVal" data-val="${m.key}">0%</div>
        </div>
        <div class="track">
          <div class="fill" data-fill="${m.key}"></div>
        </div>
        <div class="target" style="--target:${targetPct}%"></div>
        <div class="muted" style="margin-top:6px;font-size:12px">Meta: ${targetPct}%</div>
      </div>
    `;
  }).join("");
}

function updateTrainUI() {
  const total = training ? (trainAccumulated + (Date.now() - trainStartedAt) / 1000) : trainAccumulated;
  const clamped = Math.min(TRAIN_MAX_SEC, total);
  trainTimer.textContent = `Tempo: ${mmss(clamped)} / ${mmss(TRAIN_MAX_SEC)}`;
  trainToken.textContent = `Tokens: ${tokensObj.tokens}`;
}

function awardTokenOnce() {
  tokensObj.tokens = (tokensObj.tokens || 0) + 1;
  tokensObj.updatedAt = Date.now();
  writeJSON(STORE.TOKENS, tokensObj);
  updateTrainUI();
}

function metaTick(values, dtSec) {
  // Meta 1: Presença >= alvo por 15s
  if (!meta1Done) {
    if ((values.presenca ?? 0) >= TARGETS.presenca) meta1Sec += dtSec;
    else meta1Sec = Math.max(0, meta1Sec - dtSec * 0.6);
    if (meta1Sec >= 15) {
      meta1Done = true;
      m1ok.textContent = "concluída ✅ +1 token";
      awardTokenOnce();
    }
    m1.textContent = `${Math.min(15, Math.floor(meta1Sec))}/15s`;
  }

  // Meta 2: Fluxo >= alvo por 15s
  if (!meta2Done) {
    if ((values.fluxo ?? 0) >= TARGETS.fluxo) meta2Sec += dtSec;
    else meta2Sec = Math.max(0, meta2Sec - dtSec * 0.6);
    if (meta2Sec >= 15) {
      meta2Done = true;
      m2ok.textContent = "concluída ✅ +1 token";
      awardTokenOnce();
    }
    m2.textContent = `${Math.min(15, Math.floor(meta2Sec))}/15s`;
  }

  // Meta 3: Harmonia >= alvo por 20s
  if (!meta3Done) {
    if ((values.harmonia ?? 0) >= TARGETS.harmonia) meta3Sec += dtSec;
    else meta3Sec = Math.max(0, meta3Sec - dtSec * 0.6);
    if (meta3Sec >= 20) {
      meta3Done = true;
      m3ok.textContent = "concluída ✅ +1 token";
      awardTokenOnce();
    }
    m3.textContent = `${Math.min(20, Math.floor(meta3Sec))}/20s`;
  }
}

async function enableMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;

    const src = audioCtx.createMediaStreamSource(micStream);
    src.connect(analyser);

    trainStatus.textContent = "Treino: microfone OK";
    btnStartTrain.disabled = false;
  } catch (e) {
    alert("Falha ao acessar microfone. Verifique permissões do navegador.");
  }
}

function startTrain() {
  if (!analyser || training) return;

  training = true;
  trainStartedAt = Date.now();
  lastFrameAt = performance.now();

  btnStartTrain.disabled = true;
  btnStopTrain.disabled = false;
  trainStatus.textContent = "Treino: rodando";

  const timeData = new Uint8Array(analyser.fftSize);
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  const loop = () => {
    rafId = requestAnimationFrame(loop);

    const now = performance.now();
    const dt = Math.min(0.2, (now - lastFrameAt) / 1000);
    lastFrameAt = now;

    // tempo total (pausar/retomar) com teto de 5min
    const total = trainAccumulated + (Date.now() - trainStartedAt) / 1000;
    if (total >= TRAIN_MAX_SEC) {
      stopTrain();
      trainStatus.textContent = "Treino: finalizado (5 min)";
      return;
    }

    analyser.getByteTimeDomainData(timeData);
    analyser.getByteFrequencyData(freqData);

    const values = metricsFromAudio(timeData, freqData);

    renderBars(values);
    metaTick(values, dt);
    updateTrainUI();
  };

  loop();
}

function stopTrain() {
  if (!training) return;
  training = false;

  const elapsed = (Date.now() - trainStartedAt) / 1000;
  trainAccumulated = Math.min(TRAIN_MAX_SEC, trainAccumulated + elapsed);

  btnStartTrain.disabled = trainAccumulated >= TRAIN_MAX_SEC;
  btnStopTrain.disabled = true;

  trainStatus.textContent = "Treino: pausado";
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  updateTrainUI();
}

function resetTrainState() {
  training = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  trainAccumulated = 0;
  meta1Sec = meta2Sec = meta3Sec = 0;
  meta1Done = meta2Done = meta3Done = false;

  m1ok.textContent = "não concluída";
  m2ok.textContent = "não concluída";
  m3ok.textContent = "não concluída";
  m1.textContent = "0/15s";
  m2.textContent = "0/15s";
  m3.textContent = "0/20s";

  trainStatus.textContent = "Treino: aguardando";
  btnStartTrain.disabled = true; // só libera após mic
  btnStopTrain.disabled = true;

  renderBars({
    presenca: 0, impulso: 0, fluxo: 0, constancia: 0,
    pausaOk: 0, entonacao: 0, foco: 0, harmonia: 0
  });

  updateTrainUI();
}

// ========= PROVA =========
function levelByIndex(i) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i))];
}

function calcScore10(levelId) {
  const level = LEVELS.find(l => l.id === levelId);
  if (!level) return 0;

  const total = level.questions.length;
  let correct = 0;
  for (const q of level.questions) {
    const a = answers[q.id];
    if (typeof a === "number" && a === q.correct) correct++;
  }
  // Nota 0..10
  return Math.round((correct / total) * 10);
}

function updateHeaderPills() {
  pillDue.textContent = `Prova: ${fmtDate(DUE_DATE)}`;

  const level = levelByIndex(currentLevel);
  const bestScore = best[level.id] ?? 0;
  pillBest.textContent = `Melhor: ${bestScore}/10`;
  pillLevel.textContent = `Nível: ${currentLevel + 1}/${LEVELS.length}`;
}

function showScreen(name) {
  [screenLogin, screenWelcome, screenExam, screenResult].forEach(s => s.classList.add("hidden"));
  if (name === "login") screenLogin.classList.remove("hidden");
  if (name === "welcome") screenWelcome.classList.remove("hidden");
  if (name === "exam") screenExam.classList.remove("hidden");
  if (name === "result") screenResult.classList.remove("hidden");
}

function renderWelcome() {
  const n = student?.name || "Aluno";
  welcomeText.textContent = `${n}, aqui você pode treinar e depois fazer a prova. Se não tirar 10, você tenta de novo e melhora.`;

  const level = levelByIndex(currentLevel);
  const b = best[level.id] ?? 0;

  kpi1.textContent =
`ALUNO
nome: ${student?.name || "-"}
turma: ${student?.className || "-"}
tokens: ${tokensObj.tokens || 0}`;

  kpi2.textContent =
`PROVA
nível atual: ${level.name}
data: ${fmtDate(DUE_DATE)}
melhor nota: ${b}/10`;

  updateHeaderPills();
  updateTrainUI();
}

function renderQuestion() {
  const level = levelByIndex(currentLevel);
  const q = level.questions[currentQ];

  // KPIs
  const bestScore = best[level.id] ?? 0;
  examKpi.textContent =
`NÍVEL
${level.name}
Questão: ${currentQ + 1}/${level.questions.length}`;

  examKpi2.textContent =
`SEU MELHOR
${bestScore}/10
Tentativas: ilimitadas`;

  // Botões
  btnPrev.disabled = currentQ === 0;
  btnNext.classList.toggle("hidden", currentQ === level.questions.length - 1);
  btnFinish.classList.toggle("hidden", currentQ !== level.questions.length - 1);

  // Render
  questionBox.innerHTML = `
    <div class="qCard">
      <h3 class="qTitle">${q.text}</h3>
      <div class="options">
        ${q.options.map((opt, idx) => {
          const checked = answers[q.id] === idx ? "checked" : "";
          return `
            <label class="opt">
              <input type="radio" name="${q.id}" value="${idx}" ${checked} />
              <div>${opt}</div>
            </label>
          `;
        }).join("")}
      </div>
      <p class="muted" style="margin:10px 0 0;font-size:12px">
        Dica: não precisa ser “gênio”. Precisa aprender <b>um degrau por vez</b>.
      </p>
    </div>
  `;

  // bind radios
  questionBox.querySelectorAll(`input[name="${q.id}"]`).forEach(r => {
    r.addEventListener("change", () => {
      answers[q.id] = Number(r.value);
    });
  });
}

function finishExam() {
  const level = levelByIndex(currentLevel);
  const score = calcScore10(level.id);

  // atualiza melhor nota
  const prevBest = best[level.id] ?? 0;
  if (score > prevBest) {
    best[level.id] = score;
    writeJSON(STORE.BEST, best);
  }

  // progressão simples:
  // - se tirou >= 8, libera próximo nível (se existir)
  // - se tirou 10, ganha 1 token (demo)
  let msg = `Você tirou ${score}/10 no ${level.name}.`;
  if (score === 10) {
    tokensObj.tokens = (tokensObj.tokens || 0) + 1;
    tokensObj.updatedAt = Date.now();
    writeJSON(STORE.TOKENS, tokensObj);
    msg += " Nota máxima! ✅ Você ganhou +1 token (demo).";
  }
  if (score >= 8 && currentLevel < LEVELS.length - 1) {
    currentLevel++;
    msg += " Você liberou o próximo nível. 🚀";
  } else if (score < 8) {
    msg += " Dica: tente de novo. Repetir é estudar com inteligência. 🙂";
  }

  // Resultado
  resultText.textContent = msg;

  resKpi1.textContent =
`RESULTADO
nota: ${score}/10
melhor no nível: ${(best[level.id] ?? score)}/10`;

  resKpi2.textContent =
`PROGRESSO
nível atual: ${currentLevel + 1}/${LEVELS.length}
tokens: ${tokensObj.tokens || 0}`;

  updateHeaderPills();
  showScreen("result");
}

function resetStudent() {
  if (!confirm("Trocar aluno? Isso limpa nome/turma neste dispositivo.")) return;

  localStorage.removeItem(STORE.STUDENT);
  student = null;

  // mantém best e tokens (opcional). Se quiser zerar tudo, descomente:
  // localStorage.removeItem(STORE.BEST);
  // localStorage.removeItem(STORE.TOKENS);

  location.reload();
}

// ========= NAV =========
function connect() {
  const name = (studentName.value || "").trim();
  const className = (studentClass.value || "").trim();
  if (!name) {
    alert("Digite seu nome.");
    return;
  }
  student = { id: uid(), name, className, connectedAt