/* Vibração de Leão · MVP Prova Vale 10
   Fluxo: Welcome -> ORAL (voz) -> ESCRITA (gabarito) -> Resultado
   Persistência: localStorage (melhor nota, histórico simples)
*/

const $ = (id) => document.getElementById(id);

const LS_KEY = "vdl_demo_v1";

const state = {
  user: { name: "", turma: "" },
  tokens: 0,
  oral: { idx: 0, items: [], answers: [] },
  written: { idx: 0, items: [], picks: [] },
  best: 0,
  dateStr: "",
  level: 1,
  recognition: null,
  lastTranscript: ""
};

function loadStore(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return { best: 0, history: [] };
    return JSON.parse(raw);
  }catch{
    return { best: 0, history: [] };
  }
}
function saveStore(store){
  localStorage.setItem(LS_KEY, JSON.stringify(store));
}

function todayBR(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function pickN(arr, n){
  return shuffle(arr).slice(0,n);
}

/* =========================
   BANCO BÁSICO (iniciante)
   ========================= */

// ORAL: respostas abertas (a gente não “corrige” pesado; é para treino e registro)
const ORAL_BANK = [
  { id:"o1", q:"Com suas palavras: o que você acha que é um algoritmo?" },
  { id:"o2", q:"Pra você, pra que serve aprender programação?" },
  { id:"o3", q:"O que significa “dar passos” para resolver um problema?" },
  { id:"o4", q:"O que é um computador, de forma simples?" },
  { id:"o5", q:"Se você não souber uma resposta, o que você pode fazer?" }
];

// ESCRITA: múltipla escolha, bem fácil, com variações
const WRITTEN_BANK = [
  {
    id:"w1",
    q:"Qual frase descreve melhor um algoritmo?",
    choices:[
      "Um passo a passo para resolver um problema",
      "Um tipo de teclado do computador",
      "Uma música que toca no celular",
      "Um desenho animado"
    ],
    correct:0
  },
  {
    id:"w2",
    q:"O que é um “bit” (bem simples)?",
    choices:[
      "Uma informação que pode ser 0 ou 1",
      "Um tipo de bateria de carro",
      "Um programa de edição de vídeo",
      "Uma tecla especial do teclado"
    ],
    correct:0
  },
  {
    id:"w3",
    q:"Qual é um exemplo de “entrada” (input) em um app?",
    choices:[
      "Você digitar seu nome",
      "A tela mostrar uma mensagem",
      "O app tocar um som",
      "A internet cair"
    ],
    correct:0
  },
  {
    id:"w4",
    q:"Qual é um exemplo de “saída” (output) em um app?",
    choices:[
      "A tela mostrar sua nota",
      "Você clicar em um botão",
      "Você falar no microfone",
      "Você abrir o app"
    ],
    correct:0
  },
  {
    id:"w5",
    q:"Em programação, “debugar” significa:",
    choices:[
      "Procurar e corrigir erros",
      "Deixar o computador mais pesado",
      "Apagar tudo e desistir",
      "Aumentar o volume do celular"
    ],
    correct:0
  },
  // variação com valores (a cada prova muda os números)
  {
    id:"w6",
    gen: true,
    make(){
      const a = randInt(1,9);
      const b = randInt(1,9);
      const sum = a + b;
      const wrong1 = sum + randInt(1,3);
      const wrong2 = sum - randInt(1,3);
      const wrong3 = sum + randInt(4,6);
      const choices = shuffle([String(sum), String(wrong1), String(wrong2), String(wrong3)]);
      const correct = choices.indexOf(String(sum));
      return {
        id:`w6_${a}_${b}`,
        q:`Se você somar ${a} + ${b}, qual é o resultado?`,
        choices,
        correct
      };
    }
  },
  {
    id:"w7",
    gen:true,
    make(){
      const n = randInt(2,9);
      const correctTxt = "Repetir um bloco de passos";
      const q = `Quando você repete uma ação ${n} vezes, isso é um exemplo de:`;
      const choices = shuffle([
        correctTxt,
        "Desligar o computador",
        "Apagar um arquivo",
        "Aumentar a tela"
      ]);
      return { id:`w7_${n}`, q, choices, correct: choices.indexOf(correctTxt) };
    }
  }
];

function randInt(min,max){
  return Math.floor(Math.random()*(max-min+1))+min;
}

/* =========================
   UI NAV
   ========================= */

function show(screenId){
  ["screenWelcome","screenOral","screenWritten","screenResult"].forEach(id=>{
    $(id).classList.toggle("hidden", id !== screenId);
  });
}

function updatePills(){
  $("pillDate").textContent = state.dateStr || "--/--/----";
  $("pillBest").textContent = (state.best ?? 0).toFixed(1);
  $("pillLevel").textContent = String(state.level ?? 1);
}

/* =========================
   ORAL (SpeechRecognition)
   ========================= */

function speechSupported(){
  return ("webkitSpeechRecognition" in window) || ("SpeechRecognition" in window);
}

function setupRecognition(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return null;
  const rec = new SR();
  rec.lang = "pt-BR";
  rec.interimResults = true;
  rec.continuous = true;
  return rec;
}

function startRec(){
  if(!state.recognition){
    state.recognition = setupRecognition();
    if(!state.recognition){
      $("oralHint").textContent = "Seu navegador não suporta reconhecimento de voz. Use a fala como treino e digite mentalmente — depois avance.";
      return;
    }

    state.recognition.onresult = (event) => {
      let txt = "";
      for(let i=event.resultIndex;i<event.results.length;i++){
        txt += event.results[i][0].transcript;
      }
      txt = (txt || "").trim();
      state.lastTranscript = txt;
      $("oralAnswer").textContent = txt || "…";
      $("btnConfirmOral").disabled = !txt;
    };

    state.recognition.onerror = (e) => {
      $("oralHint").textContent = `Falha no microfone/voz: ${e.error}. Verifique permissão do mic e tente de novo.`;
      stopRec();
    };

    state.recognition.onend = () => {
      $("btnRec").disabled = false;
      $("btnStopRec").disabled = true;
    };
  }

  $("oralHint").textContent = speechSupported()
    ? "Falando… (dica: fale perto do mic, sem pressa)"
    : "Seu navegador não suporta voz. Você pode pular.";

  try{
    state.lastTranscript = "";
    $("oralAnswer").textContent = "Ouvindo…";
    $("btnRec").disabled = true;
    $("btnStopRec").disabled = false;
    $("btnConfirmOral").disabled = true;
    state.recognition.start();
  }catch{
    // evita “already started”
  }
}

function stopRec(){
  try{ state.recognition && state.recognition.stop(); }catch{}
  $("btnRec").disabled = false;
  $("btnStopRec").disabled = true;
}

function oralCurrent(){
  return state.oral.items[state.oral.idx];
}

function renderOral(){
  $("txtTokens").textContent = String(state.tokens);
  $("txtOralPos").textContent = String(state.oral.idx + 1);
  $("txtOralTotal").textContent = String(state.oral.items.length);

  const item = oralCurrent();
  $("oralQuestion").textContent = item ? item.q : "Fim!";
  $("oralAnswer").textContent = "Toque em “Iniciar voz” e fale.";
  $("oralHint").textContent = speechSupported()
    ? "Dica: se estiver em dúvida, diga o que você pensa. Se não souber, diga “não sei” e avance."
    : "Voz indisponível. Você pode apenas pular e seguir.";

  $("btnConfirmOral").disabled = true;
  $("btnGoWritten").disabled = state.oral.idx < state.oral.items.length;
}

function confirmOral(){
  const item = oralCurrent();
  if(!item) return;

  const txt = (state.lastTranscript || "").trim();
  if(!txt) return;

  // Regra simples: se respondeu com algo >= 3 caracteres, ganha 1 token.
  // (Sem “correção” forte — é incentivo ao treino)
  const earned = txt.length >= 3 ? 1 : 0;
  state.tokens += earned;

  state.oral.answers.push({
    id: item.id,
    q: item.q,
    a: txt,
    tokens: earned
  });

  // próximo
  stopRec();
  state.oral.idx++;

  if(state.oral.idx >= state.oral.items.length){
    $("btnGoWritten").disabled = false;
    $("oralHint").textContent = "Etapa ORAL concluída. Você liberou a prova escrita ✅";
    $("btnRec").disabled = true;
    $("btnStopRec").disabled = true;
    $("btnConfirmOral").disabled = true;
    $("oralQuestion").textContent = "Concluído!";
    $("oralAnswer").textContent = "Agora vá para a ESCRITA.";
    return;
  }

  renderOral();
}

function skipOral(){
  const item = oralCurrent();
  if(!item) return;

  state.oral.answers.push({
    id: item.id,
    q: item.q,
    a: "(pulou / não sei)",
    tokens: 0
  });

  stopRec();
  state.oral.idx++;
  if(state.oral.idx >= state.oral.items.length){
    $("btnGoWritten").disabled = false;
    $("oralHint").textContent = "Etapa ORAL concluída. Você liberou a prova escrita ✅";
    $("btnRec").disabled = true;
    $("btnStopRec").disabled = true;
    $("btnConfirmOral").disabled = true;
    $("oralQuestion").textContent = "Concluído!";
    $("oralAnswer").textContent = "Agora vá para a ESCRITA.";
    return;
  }
  renderOral();
}

/* =========================
   WRITTEN
   ========================= */

function writtenCurrent(){
  return state.written.items[state.written.idx];
}

function renderWritten(){
  $("txtWPos").textContent = String(state.written.idx + 1);
  $("txtWTotal").textContent = String(state.written.items.length);

  const item = writtenCurrent();
  $("wQuestion").textContent = item.q;

  const wrap = $("wOptions");
  wrap.innerHTML = "";

  const picked = state.written.picks[state.written.idx];
  item.choices.forEach((c, i) => {
    const id = `opt_${state.written.idx}_${i}`;
    const div = document.createElement("label");
    div.className = "opt";
    div.innerHTML = `
      <input type="radio" name="wopt" id="${id}" ${picked===i ? "checked":""} />
      <div class="txt">${c}</div>
    `;
    div.addEventListener("click", () => {
      state.written.picks[state.written.idx] = i;
      $("btnNextW").disabled = false;
    });
    wrap.appendChild(div);
  });

  $("btnPrevW").disabled = state.written.idx === 0;
  $("btnNextW").disabled = (picked === undefined);
  $("txtScoreNow").textContent = computeScore().toFixed(1);
}

function computeScore(){
  let correct = 0;
  for(let i=0;i<state.written.items.length;i++){
    const item = state.written.items[i];
    const pick = state.written.picks[i];
    if(pick === item.correct) correct++;
  }
  const total = state.written.items.length || 1;
  return (correct/total) * 10;
}

function nextWritten(){
  const pick = state.written.picks[state.written.idx];
  if(pick === undefined) return;

  if(state.written.idx < state.written.items.length - 1){
    state.written.idx++;
    renderWritten();
  }else{
    // última — habilita finalizar naturalmente
    renderWritten();
  }
}

function prevWritten(){
  if(state.written.idx > 0){
    state.written.idx--;
    renderWritten();
  }
}

function finish(){
  const score = computeScore();

  // bônus simples: se completou tudo (sem undefined), +0.2 por token, limitado
  const doneAll = state.written.picks.every(v => v !== undefined);
  const bonus = doneAll ? clamp(state.tokens * 0.2, 0, 1.0) : 0;
  const finalScore = clamp(score + bonus, 0, 10);

  // salva melhor nota
  const store = loadStore();
  const best = Math.max(store.best || 0, finalScore);
  store.best = best;

  // histórico simples
  store.history = (store.history || []).slice(-9);
  store.history.push({
    ts: Date.now(),
    name: state.user.name || "Aluno",
    turma: state.user.turma || "",
    score: finalScore,
    base: score,
    bonus,
    tokens: state.tokens
  });
  saveStore(store);

  state.best = best;

  // resultado
  $("resName").textContent = state.user.name || "Aluno";
  $("resScore").textContent = finalScore.toFixed(1);
  $("resBest").textContent = best.toFixed(1);

  const summary = [
    `Base: ${score.toFixed(1)}/10`,
    `Bônus por foco (tokens): +${bonus.toFixed(1)}`,
    `Tokens ganhos: ${state.tokens}`,
    `Dica: refazer muda perguntas/valores → você aprende repetindo.`
  ].join(" · ");
  $("resSummary").textContent = summary;

  updatePills();
  show("screenResult");
}

/* =========================
   PROVA NOVA (gera conjunto)
   ========================= */

function newExamSet(){
  // ORAL: pega 3 perguntas aleatórias (iniciante)
  state.oral.items = pickN(ORAL_BANK, 3);
  state.oral.idx = 0;
  state.oral.answers = [];

  // ESCRITA: 5 questões (inclui 2 geradas)
  const fixed = WRITTEN_BANK.filter(x => !x.gen);
  const gens = WRITTEN_BANK.filter(x => x.gen);

  const chosenFixed = pickN(fixed, 3);
  const chosenGen = pickN(gens, 2).map(g => g.make());
  state.written.items = shuffle([...chosenFixed, ...chosenGen]);

  state.written.idx = 0;
  state.written.picks = new Array(state.written.items.length);

  // tokens reiniciam a cada prova
  state.tokens = 0;

  // nível simples: sobe conforme melhor nota
  state.level = state.best >= 9.5 ? 4 : state.best >= 8 ? 3 : state.best >= 6 ? 2 : 1;

  $("txtOralTotal").textContent = String(state.oral.items.length);
  $("txtWTotal").textContent = String(state.written.items.length);
}

/* =========================
   BOOT
   ========================= */

function boot(){
  state.dateStr = todayBR();

  const store = loadStore();
  state.best = store.best || 0;
  state.level = state.best >= 9.5 ? 4 : state.best >= 8 ? 3 : state.best >= 6 ? 2 : 1;

  updatePills();

  // Welcome
  $("btnStart").addEventListener("click", () => {
    const name = $("inpName").value.trim();
    if(!name){
      alert("Digite seu nome para começar.");
      return;
    }
    state.user.name = name;
    state.user.turma = $("inpClass").value.trim();

    // prepara prova
    newExamSet();

    // ORAL
    show("screenOral");
    $("btnGoWritten").disabled = true;
    $("btnRec").disabled = false;
    $("btnStopRec").disabled = true;
    renderOral();
  });

  // Oral events
  $("btnRec").addEventListener("click", startRec);
  $("btnStopRec").addEventListener("click", stopRec);
  $("btnConfirmOral").addEventListener("click", confirmOral);
  $("btnSkipOral").addEventListener("click", skipOral);

  $("btnGoWritten").addEventListener("click", () => {
    show("screenWritten");
    renderWritten();
  });

  // Written events
  $("btnPrevW").addEventListener("click", prevWritten);
  $("btnNextW").addEventListener("click", nextWritten);
  $("btnFinish").addEventListener("click", () => {
    // exige tudo respondido
    const doneAll = state.written.picks.every(v => v !== undefined);
    if(!doneAll){
      alert("Responda todas as questões para finalizar.");
      return;
    }
    finish();
  });

  $("btnRestart").addEventListener("click", () => {
    newExamSet();
    show("screenOral");
    $("btnGoWritten").disabled = true;
    $("btnRec").disabled = false;
    renderOral();
  });

  // Result events
  $("btnTryAgain").addEventListener("click", () => {
    newExamSet();
    show("screenOral");
    $("btnGoWritten").disabled = true;
    $("btnRec").disabled = false;
    renderOral();
  });

  $("btnBackHome").addEventListener("click", () => {
    // volta sem apagar melhor nota
    updatePills();
    show("screenWelcome");
  });

  // se Speech não suportado, deixa aviso
  if(!speechSupported()){
    console.warn("SpeechRecognition indisponível neste navegador.");
  }
}

boot(); 