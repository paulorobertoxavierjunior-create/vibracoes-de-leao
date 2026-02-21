(function(){
  const id = new URL(location.href).searchParams.get("id");
  const single = document.getElementById("single");
  const list = document.getElementById("list");

  const reports = LION.store.getReports();

  function fmt(ts){
    return new Date(ts).toLocaleString();
  }

  function buildText(r){
    const labels = [
      "Presença","Impulso","Fluxo","Pausa OK","Entonação","Foco","Harmonia","Clareza"
    ];
    const last = r.last || [];
    const mean = r.mean || [];

    const linesLast = labels.map((n,i)=>`- ${n}: ${(last[i]??0).toFixed(3)}`).join("\n");
    const linesMean = labels.map((n,i)=>`- ${n}: ${(mean[i]??0).toFixed(3)}`).join("\n");

    return `LION VIBES — RELATÓRIO (DEMO)
Data/hora: ${fmt(r.createdAt)}
ID: ${r.id}

Objetivo:
${r.goal || "(não informado)"}

Observação:
${r.note || "(não informado)"}

Tokens (no momento):
${r.tokensNow ?? 0}

Resumo (última leitura):
${linesLast}

Média (janela salva):
${linesMean}

Nota:
- Isso é um espelho de treino por voz/ritmo.
- Não é instrumento clínico e não faz diagnóstico.
`;
  }

  function saveAll(arr){
    LION.store.saveReports(arr);
  }

  if(id){
    const r = reports.find(x=>x.id===id);
    if(!r){
      alert("Relatório não encontrado.");
      location.href = "report.html";
      return;
    }

    single.style.display = "block";
    list.style.display = "none";

    document.getElementById("meta").textContent = `Criado em ${fmt(r.createdAt)} • ID ${r.id}`;
    const img = document.getElementById("imgSnap");
    img.src = r.snapPng;

    document.getElementById("k1").textContent =
      `Objetivo:\n${r.goal || "(não informado)"}`;

    document.getElementById("k2").textContent =
      `Tokens no momento:\n${r.tokensNow ?? 0}`;

    const txt = document.getElementById("txt");
    txt.value = buildText(r);

    document.getElementById("btnCopy").addEventListener("click", async ()=>{
      try{
        await navigator.clipboard.writeText(txt.value);
        alert("Copiado.");
      }catch{
        txt.select();
        document.execCommand("copy");
        alert("Copiado (modo compatível).");
      }
    });

    document.getElementById("btnDelete").addEventListener("click", ()=>{
      if(confirm("Excluir este relatório do dispositivo?")){
        const out = reports.filter(x=>x.id!==id);
        saveAll(out);
        location.href = "report.html";
      }
    });

  } else {
    const items = document.getElementById("items");
    const btnDeleteAll = document.getElementById("btnDeleteAll");

    btnDeleteAll.addEventListener("click", ()=>{
      if(confirm("Excluir TODOS os relatórios do dispositivo?")){
        saveAll([]);
        location.reload();
      }
    });

    if(!reports.length){
      items.innerHTML = `<p class="muted">Nenhum relatório salvo ainda.</p>`;
      return;
    }

    items.innerHTML = reports.map(r=>{
      return `
        <div class="card soft" style="margin-top:10px">
          <div class="row" style="justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
            <div>
              <div style="font-weight:1000">Relatório</div>
              <div class="muted tiny">${fmt(r.createdAt)} • ID ${r.id}</div>
              <div class="tiny muted" style="margin-top:6px">${(r.goal||"").slice(0,70)}</div>
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
        if(confirm("Excluir este relatório?")){
          const out = reports.filter(x=>x.id!==rid);
          saveAll(out);
          location.reload();
        }
      });
    });
  }
})();