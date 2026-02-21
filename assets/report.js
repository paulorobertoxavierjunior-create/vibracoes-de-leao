// assets/report.js
(function(){
  function getParam(name){
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }
  function fmt(ts){
    return new Date(ts).toLocaleString();
  }

  const id = getParam("id");
  const list = LV.loadReports();

  const single = document.getElementById("single");
  const listBox = document.getElementById("list");
  const items = document.getElementById("items");

  function drawOverlay(canvas, series, goal){
    const cv = canvas;
    const ctx = cv.getContext("2d");

    // escala p/ canvas real
    const W = cv.clientWidth || 900;
    const H = Math.round(W*0.46);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.floor(W*dpr);
    cv.height = Math.floor(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);

    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,W,H);

    // meta
    const yGoal = H - (goal/100)*H;
    ctx.save();
    ctx.setLineDash([6,6]);
    ctx.strokeStyle="#2a6f88";
    ctx.globalAlpha=0.85;
    ctx.beginPath();
    ctx.moveTo(0,yGoal);
    ctx.lineTo(W,yGoal);
    ctx.stroke();
    ctx.restore();

    const laneH = H / 8;
    for(let i=0;i<8;i++){
      const top = i*laneH;
      const mid = top + laneH/2;

      ctx.strokeStyle="#00000012";
      ctx.beginPath();
      ctx.moveTo(0,mid);
      ctx.lineTo(W,mid);
      ctx.stroke();

      const s = series[i] || [];
      const n = s.length;
      if(n<2) continue;

      ctx.strokeStyle="#111";
      ctx.lineWidth=1.6;
      ctx.beginPath();
      for(let k=0;k<n;k++){
        const x = (k/(n-1))*(W-1);
        const v = s[k];
        const y = top + (1 - v) * (laneH-18) + 18;
        if(k===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
      }
      ctx.stroke();

      ctx.fillStyle="#2b4d5b";
      ctx.font="12px system-ui";
      const names = ["RMS","20–60","60–120","120–250","250–500","500–1k","1–2k","2–4k"];
      ctx.fillText(`${i}) ${names[i]}`, 10, top+14);
    }
  }

  if(id){
    const rep = list.find(r=>r.id===id);
    if(!rep){
      alert("Relatório não encontrado.");
      location.href="report.html";
      return;
    }

    single.style.display="block";
    listBox.style.display="none";

    document.getElementById("meta").textContent =
      `ID: ${rep.id} • ${fmt(rep.at)} • Pessoa: ${rep.who} • Modo: ${rep.mode}`;

    const txt = document.getElementById("txt");
    txt.value = rep.text;

    const cv2 = document.getElementById("cv2");
    drawOverlay(cv2, rep.series, rep.goal);

    document.getElementById("btnCopy").addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(txt.value);
        alert("Copiado.");
      }catch{
        txt.select(); document.execCommand("copy");
        alert("Copiado (compatível).");
      }
    });

    document.getElementById("btnDel").addEventListener("click", ()=>{
      if(!confirm("Excluir este relatório?")) return;
      const out = LV.loadReports().filter(x=>x.id!==rep.id);
      LV.saveReports(out);
      location.href="report.html";
    });

  }else{
    // lista
    document.getElementById("btnDelAll").addEventListener("click", ()=>{
      if(!confirm("Excluir TODOS os relatórios?")) return;
      LV.saveReports([]);
      location.reload();
    });

    if(!list.length){
      items.innerHTML = `<p class="muted">Nenhum relatório salvo ainda.</p>`;
      return;
    }

    items.innerHTML = list.map(r=>{
      return `
        <div class="card soft" style="margin-top:10px">
          <div class="row" style="justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:900">${r.who} • ${r.mode}</div>
              <div class="muted" style="font-size:12px">${fmt(r.at)} • meta ${r.goal}</div>
            </div>
            <div class="row">
              <a class="btn" href="report.html?id=${encodeURIComponent(r.id)}">Abrir</a>
              <button class="btn danger" data-del="${r.id}">Excluir</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    items.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const rid = btn.getAttribute("data-del");
        if(!confirm("Excluir este relatório?")) return;
        const out = LV.loadReports().filter(x=>x.id!==rid);
        LV.saveReports(out);
        location.reload();
      });
    });
  }
})();