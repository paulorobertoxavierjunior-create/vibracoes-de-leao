(function(){
  // gate simples: se quiser exigir código também no app, descomenta:
  // LION.gate.requirePasscodeOrRedirect("app.html");

  const MAX_REPORTS = 10;

  const pillStatus = document.getElementById("pillStatus");
  const pillTime = document.getElementById("pillTime");
  const pillTokens = document.getElementById("pillTokens");

  const btnStart = document.getElementById("btnStart");
  const btnPause = document.getElementById("btnPause");
  const btnStop = document.getElementById("btnStop");
  const btnExport = document.getElementById("btnExport");

  const goal = document.getElementById("goal");
  const note = document.getElementById("note");

  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  // Alvos (metas) por linha (0..1)
  // Você pode ajustar depois.
  const TARGETS = [0.45, 0.45, 0.60, 0.65, 0.45, 0.60, 0.55, 0.55];

  const LABELS = [
    "0 Presença",
    "1 Impulso",
    "2 Fluxo",
    "3 Pausa OK",
    "4 Entonação",
    "5 Foco",
    "6 Harmonia",
    "7 Clareza"
  ];

  function fmtTime(sec){
    sec = Math.max(0, Math.floor(sec));
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  }

  function resizeCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = cv.getBoundingClientRect();
    cv.width = Math.floor(rect.width * dpr);
    cv.height = Math.floor(220 * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  window.addEventListener("resize", resizeCanvas);
  setTimeout(resizeCanvas, 50);

  const tokensObj = LION.store.getTokens();
  function setTokens(n){
    LION.store.setTokens(n);
    pillTokens.textContent = `Tokens: ${n}`;
  }
  setTokens(tokensObj.value);

  // engine
  const engine = new LION.AudioEngine({ sampleHz: 10, silenceThr: 0.02 });

  let startedAt = 0;
  let timerHandle = null;

  function setUIState(state){
    // state: idle, running, paused, stopped
    if(state==="idle"){
      pillStatus.textContent = "Pronto";
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnStop.disabled = true;
      btnExport.disabled = true;
      btnPause.textContent = "Pausar";
    }
    if(state==="running"){
      pillStatus.textContent = "Captando";
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = true;
      btnPause.textContent = "Pausar";
    }
    if(state==="paused"){
      pillStatus.textContent = "Pausado";
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      btnExport.disabled = false; // pode exportar pausado
      btnPause.textContent = "Retomar";
    }
    if(state==="stopped"){
      pillStatus.textContent = "Encerrado";
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnStop.disabled = true;
      btnExport.disabled = false;
      btnPause.textContent = "Pausar";
    }
  }

  function startTimer(){
    startedAt = Date.now();
    if(timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(()=>{
      const sec = (Date.now()-startedAt)/1000;
      pillTime.textContent = fmtTime(sec);
    }, 250);
  }

  function stopTimer(){
    if(timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function draw(){
    const snap = engine.getSnapshot();
    const ts = snap.ts;
    const series = snap.series;

    const w = cv.getBoundingClientRect().width;
    const h = 220;

    ctx.clearRect(0,0,w,h);

    // grid
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    // fundo leve
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillRect(0,0,w,h);

    // linhas horizontais
    ctx.strokeStyle = "rgba(15,43,51,0.08)";
    for(let k=1;k<5;k++){
      const y = (h*k)/5;
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
    }

    // metas (target lines) por série (tracinhos na altura)
    for(let i=0;i<8;i++){
      const y = (1 - TARGETS[i]) * (h-12) + 6;
      ctx.strokeStyle = "rgba(43,122,139,0.20)";
      ctx.setLineDash([6,6]);
      ctx.beginPath();
      ctx.moveTo(0,y);
      ctx.lineTo(w,y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // desenha 8 séries, empilhadas (offset vertical)
    // Em vez de 8 gráficos separados, a gente usa 8 "faixas" no mesmo canvas.
    const bandH = (h-16)/8;
    const leftPad = 6;
    const rightPad = 6;
    const topPad = 8;

    function xOf(idx){
      if(ts.length<=1) return leftPad;
      return leftPad + (idx/(ts.length-1))*(w-leftPad-rightPad);
    }

    for(let i=0;i<8;i++){
      const y0 = topPad + i*bandH;
      const y1 = y0 + bandH;

      // faixa
      ctx.fillStyle = "rgba(43,122,139,0.04)";
      ctx.fillRect(0, y0, w, bandH);

      // label
      ctx.fillStyle = "rgba(15,43,51,0.55)";
      ctx.font = "12px system-ui";
      ctx.fillText(LABELS[i], 8, y0 + 14);

      // meta dentro da faixa
      const yT = y1 - TARGETS[i]*(bandH-18) - 6;
      ctx.strokeStyle = "rgba(43,122,139,0.35)";
      ctx.beginPath();
      ctx.moveTo(0, yT);
      ctx.lineTo(w, yT);
      ctx.stroke();

      // curva
      const arr = series[i] || [];
      ctx.strokeStyle = "rgba(15,43,51,0.78)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(let j=0;j<arr.length;j++){
        const v = Math.max(0, Math.min(1, arr[j]));
        const x = xOf(j);
        const y = y1 - v*(bandH-18) - 6;
        if(j===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.stroke();

      // “zona boa” (retângulo discreto)
      // exemplo: entre 0.55 e 0.85
      const yGoodTop = y1 - 0.85*(bandH-18) - 6;
      const yGoodBot = y1 - 0.55*(bandH-18) - 6;
      ctx.fillStyle = "rgba(43,122,139,0.06)";
      ctx.fillRect(0, yGoodTop, w, (yGoodBot-yGoodTop));
    }
  }

  engine.onSample((s)=>{
    draw();

    // token
    if(s.earned){
      const current = LION.store.getTokens().value;
      setTokens(current + 1);
      // feedback suave
      pillStatus.textContent = "Você ganhou 1 token";
      setTimeout(()=> pillStatus.textContent = engine.paused ? "Pausado" : "Captando", 900);
    }
  });

  async function doStart(){
    try{
      await engine.start();
      setUIState("running");
      startTimer();
    }catch(e){
      alert("Não foi possível iniciar o microfone. Verifique permissões.");
      console.error(e);
    }
  }

  function doPause(){
    if(!engine.running) return;
    if(engine.paused){
      engine.resume();
      setUIState("running");
      return;
    }
    engine.pause();
    setUIState("paused");
  }

  function doStop(){
    if(!engine.running) return;
    engine.stop();
    stopTimer();
    setUIState("stopped");
  }

  function exportReport(){
    // Limite 10
    const list = LION.store.getReports();
    if(list.length >= MAX_REPORTS){
      alert(`Limite atingido (${MAX_REPORTS}). Exclua relatórios para continuar.`);
      location.href = "report.html";
      return;
    }

    // snapshot do canvas
    const dataUrl = cv.toDataURL("image/png");

    // snapshot dos últimos valores (final)
    const snap = engine.getSnapshot();
    const last = snap.series.map(s=> (s.length ? s[s.length-1] : 0));
    const mean = snap.series.map(arr=>{
      if(!arr.length) return 0;
      let sum=0; for(const v of arr) sum+=v;
      return sum/arr.length;
    });

    const id = Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
    const createdAt = Date.now();

    const report = {
      id,
      createdAt,
      goal: (goal.value||"").trim(),
      note: (note.value||"").trim(),
      tokensNow: LION.store.getTokens().value,
      last,
      mean,
      snapPng: dataUrl
    };

    list.unshift(report);
    LION.store.saveReports(list.slice(0, MAX_REPORTS));

    location.href = `report.html?id=${encodeURIComponent(id)}`;
  }

  btnStart.addEventListener("click", doStart);
  btnPause.addEventListener("click", doPause);
  btnStop.addEventListener("click", doStop);
  btnExport.addEventListener("click", exportReport);

  // estado inicial
  setUIState("idle");
  pillTime.textContent = "00:00";
})();