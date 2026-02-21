(function(){
  // Motor simples: RMS + picos + pausas proxy + 6 bandas por FFT (total = 8 linhas)
  // Render: 8 séries normalizadas (0..1) com decaimento lento e metas (target lines)

  const BAND_EDGES = [ 80, 160, 320, 640, 1280, 2560 ]; // Hz (aprox)
  const MAX_SEC = 5 * 60; // 5 minutos buffer

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }

  function nowMs(){ return Date.now(); }

  class RingBuffer {
    constructor(maxLen){
      this.maxLen = maxLen;
      this.arr = new Array(maxLen);
      this.i = 0;
      this.len = 0;
    }
    push(v){
      this.arr[this.i] = v;
      this.i = (this.i + 1) % this.maxLen;
      this.len = Math.min(this.len + 1, this.maxLen);
    }
    toArray(){
      // retorna do mais antigo ao mais novo
      const out = [];
      for(let k=0; k<this.len; k++){
        const idx = (this.i - this.len + k + this.maxLen) % this.maxLen;
        out.push(this.arr[idx]);
      }
      return out;
    }
  }

  class AudioEngine {
    constructor({sampleHz=10, silenceThr=0.02}={}){
      this.sampleHz = sampleHz;
      this.silenceThr = silenceThr;

      this.ctx = null;
      this.stream = null;
      this.source = null;
      this.analyser = null;

      this.time0 = 0;
      this.running = false;
      this.paused = false;

      // buffer: guardamos pontos por sampleHz, por 5 min
      this.maxPoints = Math.max(60, Math.floor(MAX_SEC * this.sampleHz));
      this.series = Array.from({length:8}, ()=> new RingBuffer(this.maxPoints));
      this.ts = new RingBuffer(this.maxPoints);

      // métricas para token
      this.goodStreakSec = 0;
      this.tokensEarnedInSession = 0;

      // decaimento (queda lenta): EMA
      this.ema = new Array(8).fill(0);
      this.alphaRise = 0.35; // sobe relativamente rápido
      this.alphaFall = 0.08; // cai devagar

      this._tickHandle = null;
      this._onSample = null;
    }

    onSample(fn){ this._onSample = fn; }

    async start(){
      if(this.running) return;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.5;

      this.source.connect(this.analyser);

      this.running = true;
      this.paused = false;
      this.time0 = nowMs();

      this._loop();
    }

    pause(){
      if(!this.running) return;
      this.paused = true;
    }

    resume(){
      if(!this.running) return;
      this.paused = false;
    }

    stop(){
      this.running = false;
      this.paused = false;
      if(this._tickHandle) clearTimeout(this._tickHandle);
      try{
        if(this.stream){
          this.stream.getTracks().forEach(t=>t.stop());
        }
      }catch{}
      try{
        if(this.ctx) this.ctx.close();
      }catch{}
    }

    _loop(){
      const intervalMs = Math.max(50, Math.floor(1000/this.sampleHz));
      const tick = ()=>{
        if(!this.running) return;
        if(!this.paused){
          const sample = this._sample();
          if(this._onSample) this._onSample(sample);
        }
        this._tickHandle = setTimeout(tick, intervalMs);
      };
      tick();
    }

    _sample(){
      const analyser = this.analyser;
      const sr = this.ctx.sampleRate;

      const timeData = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(timeData);

      // RMS
      let sum = 0;
      for(let i=0;i<timeData.length;i++){
        const x = timeData[i];
        sum += x*x;
      }
      const rms = Math.sqrt(sum / timeData.length); // 0..~1

      // Pausa (proxy): rms abaixo de um limiar
      const pause = (rms < this.silenceThr) ? 1 : 0;

      // FFT magnitudes
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);

      // energia total (proxy)
      let total = 0;
      for(let i=0;i<freqData.length;i++) total += freqData[i];
      const totalNorm = total / (freqData.length * 255); // 0..1

      // bandas (6)
      const bands = new Array(6).fill(0);
      const counts = new Array(6).fill(0);

      for(let i=0;i<freqData.length;i++){
        const hz = (i * sr) / (2 * freqData.length);
        const mag = freqData[i] / 255; // 0..1
        let b = -1;
        if(hz < BAND_EDGES[0]) b = 0;
        else if(hz < BAND_EDGES[1]) b = 1;
        else if(hz < BAND_EDGES[2]) b = 2;
        else if(hz < BAND_EDGES[3]) b = 3;
        else if(hz < BAND_EDGES[4]) b = 4;
        else if(hz < BAND_EDGES[5]) b = 5;
        else b = 5;
        bands[b] += mag;
        counts[b] += 1;
      }
      for(let b=0;b<6;b++){
        bands[b] = counts[b] ? (bands[b]/counts[b]) : 0;
      }

      // 8 linhas finais (normalizadas)
      // 0 presença (rms com queda lenta)
      // 1 impulso (pico relativo: totalNorm - rms)
      // 2 fluxo (estabilidade: 1 - |rms - emaRms|)
      // 3 pausa ok (1 - pausa em excesso) -> proxy
      // 4 entonação (variação leve: totalNorm)
      // 5 foco (menos ruído alto: 1 - banda alta)
      // 6 harmonia (equilíbrio bandas média vs alta)
      // 7 clareza (proxy: bandas 2-4 somadas)
      const eR = this.ema[0];

      const presença = rms;
      const impulso = clamp01(totalNorm - rms + 0.2);
      const fluxo = clamp01(1 - Math.abs(rms - eR) * 6);
      const pausaOk = clamp01(1 - pause*0.8); // se pausou, cai; se falou, fica
      const enton = clamp01(totalNorm);
      const foco = clamp01(1 - (bands[5]*0.9));
      const harmonia = clamp01(1 - Math.abs((bands[2]+bands[3]) - (bands[4]+bands[5]))*0.9);
      const clareza = clamp01((bands[2] + bands[3] + bands[4]) / 3);

      const raw = [presença, impulso, fluxo, pausaOk, enton, foco, harmonia, clareza];

      // EMA com queda lenta (se desceu, cai devagar)
      for(let i=0;i<8;i++){
        const prev = this.ema[i];
        const x = raw[i];
        const a = (x >= prev) ? this.alphaRise : this.alphaFall;
        this.ema[i] = prev + a*(x - prev);
      }

      const t = (nowMs() - this.time0)/1000;
      this.ts.push(t);
      for(let i=0;i<8;i++){
        this.series[i].push(this.ema[i]);
      }

      // token rule: "zona boa" = presença>=0.25, fluxo>=0.55, foco>=0.55, pausaOk>=0.55
      const good = (this.ema[0] >= 0.25 && this.ema[2] >= 0.55 && this.ema[5] >= 0.55 && this.ema[3] >= 0.55);
      if(good) this.goodStreakSec += (1/this.sampleHz);
      else this.goodStreakSec = 0;

      let earned = false;
      if(this.goodStreakSec >= 12){ // 12s contínuos gera 1 token (demo)
        this.goodStreakSec = 0;
        this.tokensEarnedInSession += 1;
        earned = true;
      }

      return {
        t,
        rms,
        pause,
        totalNorm,
        bands,
        values: this.ema.slice(),
        earned
      };
    }

    getSnapshot(){
      // Retorna arrays para desenhar ou exportar relatório
      return {
        ts: this.ts.toArray(),
        series: this.series.map(s=>s.toArray())
      };
    }
  }

  window.LION = window.LION || {};
  window.LION.AudioEngine = AudioEngine;
})();