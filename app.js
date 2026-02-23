// Vibrações de Leão — app.js (raiz)
// Demo educacional: sem envio de áudio. Apenas métricas heurísticas locais + metadados anonimizados copiáveis.

const STORE = {
  BEST: "lv_best_score",
  LAST: "lv_last_score",
  HISTORY: "lv_history",
  TOKENS: "lv_tokens_demo",
  PROFILE: "lv_profile",
  COORD_BONUS: "lv_coord_bonus_used"
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
  ["screenWelcome","screenIntro","screenOral","screenWritten","screenReport","screenThanks"].forEach(s=>{
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

  const pillToken = document.getElementById("pillToken");
  if(pillToken) pillToken.textContent = `Tokens (demo): ${getTokens()}`;
}

// ------------------------------
// Conteúdo (questões) - MUITO BÁSICO (v1)
// (Depois a IA troca e adapta)
// ------------------------------
const ORAL_POOL = [
  "Diga seu nome e sua idade.",
  "Conte uma coisa boa que você aprendeu hoje.",
  "Explique com suas palavras: o que é um 'passo a passo'?",
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
// (visual: sobe rápido, desce devagar)
// Metas fáceis: manter acima de 0.65 por 4s
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
    target.className = "target"; // linha-meta

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

  const g1dot = document.getElementById("g1dot");
  const g2dot = document.getElementById("g2dot");
  const g3dot = document.getElementById("g3dot");

  if(goalsDone.g1) g1dot?.classList.add("ok");
  if(goalsDone.g2) g2dot?.classList.add("ok");
  if(goalsDone.g3) g3dot?.classList.add("ok");

  if(goalsDone.g1 && goalsDone.g2 && goalsDone.g3 && !rewardGiven){
    setTokens(getTokens() + 1);
    rewardGiven = true;
    refreshPills();
    alert("🔥 Metas completas! +1 token demo.");
  }
}

// suavização: sobe rápido, desce devagar (mín 4s “memória” visual)
function approach(key, target, up=0.24, down=0.05){
  const cur = barState[key];
  const a = (target > cur) ? up : down;
  barState[key] = clamp01(cur + (target - cur) * a);
}