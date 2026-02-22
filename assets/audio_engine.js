// assets/audio_engine.js
export function createAudioEngine() {
  let ctx = null, src = null, analyser = null;
  let freq = null, time = null;

  const state = {
    running: false,
    last: Array(8).fill(0),
    decay: 0.92,     // queda lenta (quanto mais perto de 1, mais lento)
    gain: 2.2,       // “sensibilidade”
  };

  async function start() {
    if (state.running) return;

    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;

    src.connect(analyser);

    freq = new Uint8Array(analyser.frequencyBinCount);
    time = new Uint8Array(analyser.fftSize);

    state.running = true;
  }

  function stop() {
    state.running = false;
    if (ctx) ctx.close();
    ctx = null; src = null; analyser = null;
  }

  function read() {
    if (!state.running || !analyser) return state.last;

    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);

    // RMS (0..1)
    let sum = 0;
    for (let i=0;i<time.length;i++){
      const v = (time[i]-128)/128;
      sum += v*v;
    }
    const rms = Math.sqrt(sum/time.length); // 0..~1

    // Bandas simples por faixas de bins (não “clínico”, só treino)
    // divide 7 bandas + 1 RMS = 8 total
    const bands = [rms];

    const N = freq.length;
    const ranges = [
      [0.00, 0.05],
      [0.05, 0.10],
      [0.10, 0.16],
      [0.16, 0.24],
      [0.24, 0.35],
      [0.35, 0.50],
      [0.50, 0.70],
    ];

    for (const [a,b] of ranges){
      const i0 = Math.floor(a*N), i1 = Math.max(i0+1, Math.floor(b*N));
      let s=0;
      for (let i=i0;i<i1;i++) s += freq[i];
      const avg = s/(i1-i0)/255; // 0..1
      bands.push(avg);
    }

    // normaliza + aplica gain + decay
    for (let k=0;k<8;k++){
      let v = bands[k] * state.gain;
      if (v > 1) v = 1;
      // decay lento: se subir, sobe rápido; se cair, cai devagar
      const prev = state.last[k];
      state.last[k] = (v > prev) ? v : (prev*state.decay + v*(1-state.decay));
    }

    return state.last;
  }

  return { state, start, stop, read };
} 