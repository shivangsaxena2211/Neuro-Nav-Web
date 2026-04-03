/* Futuristic biosignal dashboard — demo-ready, wire to NPG Lite/ESP32 later */

const $ = (id) => document.getElementById(id);

const state = {
  running: true,
  demo: true,
  armed: false,
  mode: "manual", // manual | assist | neuro
  speed: 140,
  thr: 0.55,
  sens: 0.65,
  rx: 0,
  tx: 0,
  ws: null,
  lastCmd: "—",
  lastCmdAt: 0,
  fps: 0,
  buffer: 0,
};

function nowMs() {
  return performance.now();
}

// ---------------------------
// Moving particle background
// ---------------------------

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function makeParticleField(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  const dpr = () => Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  const cfg = {
    baseCountPerMegapixel: 42,
    maxCount: 140,
    minCount: 45,
    maxLinkDist: 140,
    drift: 0.16,
    speed: 0.28,
  };

  let W = 0;
  let H = 0;
  let DPR = dpr();
  let particles = [];
  let last = nowMs();
  let raf = 0;
  let enabled = !prefersReducedMotion();

  function size() {
    const rect = canvas.getBoundingClientRect();
    DPR = dpr();
    W = Math.max(1, Math.floor(rect.width * DPR));
    H = Math.max(1, Math.floor(rect.height * DPR));
    canvas.width = W;
    canvas.height = H;

    const mp = (W * H) / (DPR * DPR) / 1_000_000;
    const target = Math.round(cfg.baseCountPerMegapixel * mp);
    const count = Math.max(cfg.minCount, Math.min(cfg.maxCount, target));
    rebuild(count);
  }

  function rebuild(count) {
    const next = [];
    for (let i = 0; i < count; i++) {
      next.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: (Math.random() * 1.6 + 0.8) * DPR,
        vx: (Math.random() * 2 - 1) * cfg.speed * DPR,
        vy: (Math.random() * 2 - 1) * cfg.speed * DPR,
        hue: Math.random() < 0.6 ? 190 + Math.random() * 40 : 225 + Math.random() * 35, // cyan/indigo
        a: 0.18 + Math.random() * 0.25,
      });
    }
    particles = next;
  }

  function step(dt) {
    // dt in seconds
    const t = nowMs() * 0.001;
    for (const p of particles) {
      const dx = Math.sin(t * 0.8 + p.y * 0.002) * cfg.drift * DPR;
      const dy = Math.cos(t * 0.7 + p.x * 0.002) * cfg.drift * DPR;
      p.x += (p.vx + dx) * dt * 60;
      p.y += (p.vy + dy) * dt * 60;

      if (p.x < -20 * DPR) p.x = W + 20 * DPR;
      if (p.x > W + 20 * DPR) p.x = -20 * DPR;
      if (p.y < -20 * DPR) p.y = H + 20 * DPR;
      if (p.y > H + 20 * DPR) p.y = -20 * DPR;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // subtle vignette
    const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, Math.min(W, H) * 0.1, W * 0.5, H * 0.5, Math.max(W, H) * 0.65);
    vg.addColorStop(0, "rgba(0,0,0,0.10)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // links
    const maxD = cfg.maxLinkDist * DPR;
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > maxD * maxD) continue;
        const d = Math.sqrt(d2);
        const k = 1 - d / maxD;
        ctx.strokeStyle = `rgba(56,189,248,${0.06 * k})`;
        ctx.lineWidth = 1 * DPR;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // particles
    for (const p of particles) {
      ctx.fillStyle = `hsla(${p.hue}, 95%, 70%, ${p.a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      // glow
      ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${p.a * 0.25})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!enabled) return;
    const t = nowMs();
    const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000));
    last = t;
    step(dt);
    draw();
  }

  function setEnabled(on) {
    enabled = on;
    if (!enabled) ctx.clearRect(0, 0, W, H);
  }

  const onResize = () => size();
  window.addEventListener("resize", onResize);

  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const onMotion = () => setEnabled(!prefersReducedMotion());
  mq?.addEventListener?.("change", onMotion);

  size();
  loop();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mq?.removeEventListener?.("change", onMotion);
    },
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function ts() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function log(msg) {
  const el = $("log");
  if (!el) return;
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `<div class="ts">${ts()}</div><div class="msg">${escapeHtml(msg)}</div>`;
  el.prepend(row);
  while (el.childElementCount > 80) el.removeChild(el.lastChild);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setConn(kind, text) {
  const badge = $("connBadge");
  const connText = $("connText");
  if (!badge || !connText) return;
  const map = {
    IDLE: "badge badge-idle",
    OK: "badge badge-ok",
    WARN: "badge badge-warn",
    BAD: "badge badge-bad",
  };
  badge.className = map[kind] || map.IDLE;
  badge.textContent = kind;
  connText.textContent = text;
}

function setArmedUI() {
  const badge = $("armed");
  const btn = $("btnArm");
  if (!badge || !btn) return;
  if (state.armed) {
    badge.className = "badge badge-ok";
    badge.textContent = "ARMED";
    btn.textContent = "Disarm";
  } else {
    badge.className = "badge badge-warn";
    badge.textContent = "SAFE";
    btn.textContent = "Arm";
  }
}

// ---------------------------
// Plotting
// ---------------------------

class RingBuffer {
  constructor(size) {
    this.size = size;
    this.a = new Float32Array(size);
    this.i = 0;
    this.full = false;
  }
  push(v) {
    this.a[this.i] = v;
    this.i = (this.i + 1) % this.size;
    if (this.i === 0) this.full = true;
  }
  length() {
    return this.full ? this.size : this.i;
  }
  toArray() {
    const n = this.length();
    const out = new Float32Array(n);
    if (!this.full) {
      out.set(this.a.subarray(0, n), 0);
      return out;
    }
    const tail = this.a.subarray(this.i);
    const head = this.a.subarray(0, this.i);
    out.set(tail, 0);
    out.set(head, tail.length);
    return out;
  }
  rms() {
    const n = this.length();
    if (!n) return 0;
    let s = 0;
    if (!this.full) {
      for (let k = 0; k < n; k++) s += this.a[k] * this.a[k];
    } else {
      for (let k = 0; k < this.size; k++) s += this.a[k] * this.a[k];
    }
    return Math.sqrt(s / (this.full ? this.size : n));
  }
}

class Chart {
  constructor(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;
    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }
  resize() {
    const rect = this.cv.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(120, Math.floor(rect.height));
    this.cv.width = Math.floor(w * this.dpr);
    this.cv.height = Math.floor(h * this.dpr);
  }
  clear() {
    const { width: W, height: H } = this.cv;
    const g = this.ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(2,6,23,0.50)");
    g.addColorStop(1, "rgba(2,6,23,0.10)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, W, H);
  }
  grid() {
    const { width: W, height: H } = this.cv;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = "rgba(148,163,184,0.10)";
    const stepX = Math.floor(W / 12);
    const stepY = Math.floor(H / 6);
    for (let x = stepX; x < W; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    for (let y = stepY; y < H; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }
  drawTrace(arr) {
    const { width: W, height: H } = this.cv;
    const ctx = this.ctx;
    const n = arr.length;
    if (n < 2) return;

    const mid = H * 0.5;
    const amp = (H * 0.38) / Math.max(1e-6, this.opts.scale);

    ctx.save();

    // glow
    ctx.lineWidth = 5 * this.dpr;
    ctx.strokeStyle = this.opts.glow;
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (W - 1);
      const y = mid - arr[i] * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // main line
    ctx.lineWidth = 2 * this.dpr;
    ctx.strokeStyle = this.opts.stroke;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (W - 1);
      const y = mid - arr[i] * amp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // baseline
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1 * this.dpr;
    ctx.strokeStyle = "rgba(226,232,240,0.10)";
    ctx.beginPath();
    ctx.moveTo(0, mid + 0.5);
    ctx.lineTo(W, mid + 0.5);
    ctx.stroke();

    ctx.restore();
  }
  render(arr) {
    this.clear();
    this.grid();
    this.drawTrace(arr);
  }
}

// ---------------------------
// Demo signal generation
// ---------------------------

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xA11CE);

function noise() {
  return (rand() * 2 - 1) * 0.9;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// simple leaky integrator for EMG envelope
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ---------------------------
// Biosignal "intent" mapping (demo)
// ---------------------------

function inferEegIntent(eegRms, sens) {
  // purely demo: map calm/active to forward/stop
  // higher RMS means more "intent" for movement
  const x = clamp01((eegRms - 0.18) * 2.2);
  const p = smoothstep(Math.max(0.05, 1 - sens), 1, x);
  if (p > 0.78) return "F";
  if (p < 0.18) return "STOP";
  return "NEUTRAL";
}

// ---------------------------
// Transport (WebSocket placeholder)
// ---------------------------

function buildPayload(cmd) {
  return {
    t: Date.now(),
    cmd,
    speed: state.speed,
    mode: state.mode,
    armed: state.armed,
  };
}

function updatePayloadPreview(cmd) {
  const pre = $("payload");
  if (!pre) return;
  pre.textContent = JSON.stringify(buildPayload(cmd), null, 2);
}

function sendCmd(cmd, origin = "ui") {
  if (!state.armed && cmd !== "STOP") {
    log(`Blocked command "${cmd}" (SAFE).`);
    return;
  }

  const payload = buildPayload(cmd);
  updatePayloadPreview(cmd);

  // WS if connected
  if (state.ws && state.ws.readyState === WebSocket.OPEN) {
    try {
      state.ws.send(JSON.stringify(payload));
      state.tx++;
      $("tx").textContent = String(state.tx);
      log(`Tx(${origin}): ${cmd} @${state.speed}`);
    } catch {
      log("WebSocket send failed.");
    }
  } else {
    // no transport -> still update UI/log
    log(`Cmd(${origin}): ${cmd} @${state.speed} (no link)`);
  }

  state.lastCmd = cmd;
  state.lastCmdAt = nowMs();
  $("lastCmd").textContent = cmd;
}

function connectWS() {
  const url = $("wsUrl").value.trim();
  if (!url) return;
  try {
    const ws = new WebSocket(url);
    state.ws = ws;
    setConn("WARN", "Connecting…");
    log(`WebSocket connecting: ${url}`);

    ws.onopen = () => {
      setConn("OK", "WebSocket connected");
      log("WebSocket connected.");
    };
    ws.onclose = () => {
      setConn("IDLE", "WebSocket closed");
      log("WebSocket closed.");
    };
    ws.onerror = () => {
      setConn("BAD", "WebSocket error");
      log("WebSocket error.");
    };
    ws.onmessage = (ev) => {
      state.rx++;
      $("rx").textContent = String(state.rx);
      handleIncoming(ev.data);
    };
  } catch {
    setConn("BAD", "WebSocket failed");
    log("WebSocket failed to initialize.");
  }
}

function disconnectWS() {
  if (state.ws) {
    try {
      state.ws.close();
    } catch {
      // ignore
    }
  }
  state.ws = null;
  setConn("IDLE", "No link");
}

function handleIncoming(data) {
  // expected JSON; accept single sample or arrays
  let msg;
  try {
    msg = typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return;
  }
  // If you stream real samples, map them here:
  // {t, eeg, emg, ecg} OR {eeg:[...], emg:[...], ecg:[...]}
  ingest(msg);
}

// ---------------------------
// Ingestion + metrics
// ---------------------------

const SR = 250; // Hz (demo)
const WINDOW_SEC = 4;
const N = SR * WINDOW_SEC;

const eegBuf = new RingBuffer(N);
const emgBuf = new RingBuffer(N);
const ecgBuf = new RingBuffer(N);

let emgEnv = 0;
let ecgPeaks = 0;
let lastPeakAt = 0;
let bpm = 0;

/** Latest metrics snapshot for NOVA (updated every frame in `updateMetrics`). */
let novaSignalSnapshot = {
  eegRms: 0,
  eegBand: "—",
  eegQuality: "—",
  emgEnv: 0,
  emgGate: false,
  emgThr: 0.55,
  bpm: 0,
  ecgStatus: "WAIT",
  eegCmd: "—",
  mode: "manual",
  armed: false,
  demo: true,
  running: true,
  t: 0,
};

let novaHospitalCache = { t: 0, names: [] };

function novaRefreshSnapshot(p) {
  novaSignalSnapshot = { ...p, t: Date.now() };
}

function ingest(frame) {
  // frame may contain scalar samples or arrays; we normalize into per-sample pushes
  const eeg = frame?.eeg;
  const emg = frame?.emg;
  const ecg = frame?.ecg;

  if (Array.isArray(eeg) || Array.isArray(emg) || Array.isArray(ecg)) {
    const len = Math.max(eeg?.length || 0, emg?.length || 0, ecg?.length || 0);
    for (let i = 0; i < len; i++) {
      if (Array.isArray(eeg) && i < eeg.length) eegBuf.push(Number(eeg[i]) || 0);
      if (Array.isArray(emg) && i < emg.length) emgBuf.push(Number(emg[i]) || 0);
      if (Array.isArray(ecg) && i < ecg.length) ecgBuf.push(Number(ecg[i]) || 0);
    }
  } else {
    if (typeof eeg === "number") eegBuf.push(eeg);
    if (typeof emg === "number") emgBuf.push(emg);
    if (typeof ecg === "number") ecgBuf.push(ecg);
  }
}

function updateMetrics() {
  // EEG
  const eegRms = eegBuf.rms();
  $("mEEGRms").textContent = fmt(eegRms * 100, 1); // "µV" feel
  $("qEEG").textContent = eegRms > 0.55 ? "NOISY" : eegRms > 0.25 ? "OK" : "CLEAN";
  const band = eegRms > 0.38 ? "BETA" : eegRms > 0.25 ? "ALPHA" : "THETA";
  $("mEEGBand").textContent = band;

  // EMG envelope + gate
  const emgArr = emgBuf.toArray();
  const lastEmg = emgArr.length ? emgArr[emgArr.length - 1] : 0;
  const rect = Math.abs(lastEmg);
  emgEnv = lerp(emgEnv, rect, 0.08);
  const gate = emgEnv >= state.thr;
  $("mEMGEnv").textContent = fmt(emgEnv, 2);
  $("mEMGThr").textContent = fmt(state.thr, 2);
  $("mEMGGate").textContent = gate ? "OPEN" : "CLOSED";
  $("qEMG").textContent = gate ? "ACTIVE" : "REST";

  // ECG: naive R-peak-ish detection (demo)
  const ecgArr = ecgBuf.toArray();
  if (ecgArr.length > 3) {
    const a = ecgArr[ecgArr.length - 1];
    const b = ecgArr[ecgArr.length - 2];
    const c = ecgArr[ecgArr.length - 3];
    // local maxima + threshold
    if (b > a && b > c && b > 0.65) {
      const t = nowMs();
      if (t - lastPeakAt > 280) {
        ecgPeaks++;
        if (lastPeakAt) {
          const rr = (t - lastPeakAt) / 1000;
          bpm = Math.max(35, Math.min(200, 60 / rr));
        }
        lastPeakAt = t;
      }
    }
  }
  $("mECGPeaks").textContent = String(ecgPeaks);
  $("mECGBpm").textContent = bpm ? fmt(bpm, 0) : "—";
  $("qECG").textContent = bpm ? `${fmt(bpm, 0)} BPM` : "—";
  $("mECGOk").textContent = bpm ? (bpm > 120 ? "FAST" : bpm < 55 ? "SLOW" : "NOMINAL") : "WAIT";

  // mapping preview
  const eegCmd = inferEegIntent(eegRms, state.sens);
  $("mEEGCmd").textContent = eegCmd;

  novaRefreshSnapshot({
    eegRms,
    eegBand: band,
    eegQuality: eegRms > 0.55 ? "NOISY" : eegRms > 0.25 ? "OK" : "CLEAN",
    emgEnv,
    emgGate: gate,
    emgThr: state.thr,
    bpm,
    ecgStatus: bpm ? (bpm > 120 ? "FAST" : bpm < 55 ? "SLOW" : "NOMINAL") : "WAIT",
    eegCmd,
    mode: state.mode,
    armed: state.armed,
    demo: state.demo,
    running: state.running,
  });

  // buffer + latency
  state.buffer = Math.min(eegBuf.length(), emgBuf.length(), ecgBuf.length());
  $("buf").textContent = `${state.buffer}/${N}`;
  const lat = state.lastCmdAt ? Math.max(0, nowMs() - state.lastCmdAt) : 0;
  $("lat").textContent = state.lastCmdAt ? `${fmt(lat, 0)} ms` : "—";

  // assist/neuro auto-control (demo only)
  if (!state.running) return;
  if (!state.armed) return;
  if (state.mode === "assist") {
    if (gate) {
      // when muscle gate open, allow last manual cmd to continue; default forward
      // keep it gentle: only send periodic keep-alive
      maybeAutoSend("F", 260);
    } else {
      maybeAutoSend("STOP", 260);
    }
  } else if (state.mode === "neuro") {
    // only act when EMG is calm (safety) and EEG intent strong
    const calm = emgEnv < state.thr * 0.6;
    if (calm) maybeAutoSend(eegCmd, 300);
    else maybeAutoSend("STOP", 250);
  }
}

let lastAutoSentAt = 0;
let lastAutoCmd = "—";
function maybeAutoSend(cmd, minIntervalMs) {
  const t = nowMs();
  if (t - lastAutoSentAt < minIntervalMs && cmd === lastAutoCmd) return;
  lastAutoSentAt = t;
  lastAutoCmd = cmd;
  if (cmd === "NEUTRAL") return;
  sendCmd(cmd, "auto");
}

// ---------------------------
// Demo sample loop
// ---------------------------

let t0 = nowMs();
let lastFrame = nowMs();
let fpsAvg = 60;

function tick() {
  requestAnimationFrame(tick);
  const t = nowMs();
  const dt = Math.max(1e-3, (t - lastFrame) / 1000);
  lastFrame = t;
  fpsAvg = fpsAvg * 0.92 + (1 / dt) * 0.08;
  state.fps = fpsAvg;
  $("fps").textContent = fmt(state.fps, 0);

  if (state.running && state.demo) {
    // push enough samples for this frame based on SR
    const elapsed = (t - t0) / 1000;
    const targetSamples = Math.floor(elapsed * SR);
    const have = eegBuf.length();
    const need = Math.max(0, targetSamples - have);
    for (let i = 0; i < need; i++) {
      const n = (have + i) / SR;
      // EEG: alpha (~10Hz) + beta (~18Hz) + slow drift + noise
      const alpha = Math.sin(2 * Math.PI * 10 * n) * 0.18;
      const beta = Math.sin(2 * Math.PI * 18 * n + 0.7) * 0.12;
      const drift = Math.sin(2 * Math.PI * 0.35 * n) * 0.10;
      const eeg = alpha + beta + drift + noise() * 0.05;

      // EMG: bursts + high-freq-ish texture
      const burst = smoothstep(0.05, 0.12, Math.sin(2 * Math.PI * 0.25 * n) * 0.5 + 0.5);
      const hf = Math.sin(2 * Math.PI * 60 * n) * 0.18 + Math.sin(2 * Math.PI * 90 * n) * 0.12;
      const emg = (hf + noise() * 0.35) * (0.15 + burst * 0.85);

      // ECG: stylized P-QRS-T waveform
      const hr = 72 + Math.sin(2 * Math.PI * 0.05 * n) * 4;
      const rr = 60 / hr;
      const phase = (n % rr) / rr; // 0..1
      const p = Math.exp(-Math.pow((phase - 0.18) / 0.04, 2)) * 0.10;
      const q = -Math.exp(-Math.pow((phase - 0.30) / 0.015, 2)) * 0.18;
      const r = Math.exp(-Math.pow((phase - 0.33) / 0.010, 2)) * 0.95;
      const s = -Math.exp(-Math.pow((phase - 0.36) / 0.015, 2)) * 0.25;
      const tt = Math.exp(-Math.pow((phase - 0.60) / 0.09, 2)) * 0.22;
      const ecg = (p + q + r + s + tt) + noise() * 0.02;

      ingest({ eeg, emg, ecg });
    }
  }

  updateMetrics();
  renderAll();
}

// ---------------------------
// Rendering
// ---------------------------

let chartEEG, chartEMG, chartECG;
function initCharts() {
  chartEEG = new Chart($("cvEEG"), {
    stroke: "rgba(34,211,238,0.95)",
    glow: "rgba(34,211,238,0.55)",
    scale: 0.85,
  });
  chartEMG = new Chart($("cvEMG"), {
    stroke: "rgba(52,211,153,0.92)",
    glow: "rgba(52,211,153,0.50)",
    scale: 1.10,
  });
  chartECG = new Chart($("cvECG"), {
    stroke: "rgba(251,113,133,0.92)",
    glow: "rgba(251,113,133,0.48)",
    scale: 1.00,
  });
}

function renderAll() {
  chartEEG.render(eegBuf.toArray());
  chartEMG.render(emgBuf.toArray());
  chartECG.render(ecgBuf.toArray());
}

// ---------------------------
// SOS — map + nearby hospitals (OpenStreetMap / Overpass)
// ---------------------------

const sos = {
  map: null,
  hospitalLayer: null,
  routeLayer: null,
  userMarker: null,
  leafletPromise: null,
  userLat: null,
  userLon: null,
  /** Last good fix for flaky replay on Refresh */
  lastGeo: null,
  detailsCache: new Map(), // key -> { phone, doctor }
};

function loadLeafletIfNeeded() {
  if (window.L) return Promise.resolve();
  if (sos.leafletPromise) return sos.leafletPromise;
  sos.leafletPromise = new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.onload = () => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Leaflet failed to load"));
      document.body.appendChild(s);
    };
    link.onerror = () => reject(new Error("Leaflet CSS failed"));
    document.head.appendChild(link);
  });
  return sos.leafletPromise;
}

function sosSetStatus(text) {
  const el = $("sosStatus");
  if (el) el.textContent = text;
}

function sosOpenMapsLink(lat, lon) {
  const a = $("sosOpenMaps");
  if (!a) return;
  a.href = `https://www.google.com/maps/search/hospital/@${lat},${lon},14z`;
  a.style.display = "inline-flex";
}

function sosHideMapsLink() {
  const a = $("sosOpenMaps");
  if (!a) return;
  a.style.display = "none";
  a.removeAttribute("href");
}

function ensureSosMap() {
  if (sos.map) return;
  const mount = $("sosMap");
  if (!mount || !window.L) return;
  sos.map = L.map("sosMap", { zoomControl: true }).setView([20, 0], 2);
  // Carto basemaps tolerate file:// and missing Referer better than tile.openstreetmap.org
  // ("Access blocked" tiles are common on OSM CDN when not opened over http(s)).
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
    maxZoom: 19,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  }).addTo(sos.map);
  sos.hospitalLayer = L.layerGroup().addTo(sos.map);
  sos.routeLayer = L.layerGroup().addTo(sos.map);
}

function clearHospitalMarkers() {
  if (sos.hospitalLayer) sos.hospitalLayer.clearLayers();
  if (sos.routeLayer) sos.routeLayer.clearLayers();
  sosSetHospitalDetails({ name: "—", phone: "—", doctor: "—", routeText: "—" });
  if (sos.userMarker) {
    sos.map.removeLayer(sos.userMarker);
    sos.userMarker = null;
  }
}

function hospitalIcon() {
  return L.divIcon({
    className: "sos-hosp-marker",
    html: '<div class="sos-hosp-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function geoErrorMessage(err) {
  if (!err) return "Could not get your location.";
  const c = err.code;
  if (c === 1) return "Location permission denied.";
  if (c === 2) return "Location unavailable (device or network).";
  if (c === 3) return "Location request timed out.";
  return err.message || "Could not get your location.";
}

/** Extra help when GPS fails (avoids blaming “file://” when you’re already on localhost). */
function geoFailureTips(err) {
  if (window.isSecureContext === false) {
    return "Tip: open via http://localhost or HTTPS instead of double‑clicking the HTML file.";
  }
  const c = err && err.code;
  if (c === 2) {
    return "On Windows: Settings → Privacy & security → Location → On, and allow location for your browser. Or tap “Approx. from IP” / “Search map” below.";
  }
  if (c === 1) {
    return "Click the lock icon in the address bar and allow location for this site.";
  }
  if (c === 3) {
    return "Try “Approx. from IP” or type a city in Search map.";
  }
  return "Use “Approx. from IP” or “Search map” if GPS keeps failing.";
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/** High-accuracy first, then coarse Wi‑Fi / network fix (often works when GPS-style fails on desktop). */
async function getPositionBestEffort() {
  if (!navigator.geolocation) {
    throw Object.assign(new Error("Geolocation not supported in this browser."), { code: 0 });
  }
  if (window.isSecureContext === false) {
    throw new Error("Geolocation needs a secure context. Open via http://localhost or HTTPS (not file://).");
  }
  try {
    return await getCurrentPositionAsync({
      enableHighAccuracy: true,
      timeout: 14000,
      maximumAge: 0,
    });
  } catch {
    return await getCurrentPositionAsync({
      enableHighAccuracy: false,
      timeout: 22000,
      maximumAge: 120000,
    });
  }
}

async function fetchApproxIpLocation() {
  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 16000);
  const signal = ac.signal;

  const toRow = (lat, lon, labelParts) => {
    const la = typeof lat === "string" ? parseFloat(lat) : Number(lat);
    const lo = typeof lon === "string" ? parseFloat(lon) : Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
    const label = labelParts.filter(Boolean).join(", ") || "IP estimate";
    return { lat: la, lon: lo, label };
  };

  try {
    try {
      const res = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal });
      if (res.ok) {
        const d = await res.json();
        const row = toRow(d.latitude, d.longitude, [d.city, d.region, d.country]);
        if (row) return row;
      }
    } catch {
      // try next service
    }

    try {
      const res = await fetch("https://ipwho.is/", { signal });
      if (res.ok) {
        const d = await res.json();
        if (d.success) {
          const row = toRow(d.latitude, d.longitude, [d.city, d.region, d.country]);
          if (row) return row;
        }
      }
    } catch {
      // continue
    }

    throw new Error("IP location services unreachable. Try “Search map” with your city.");
  } finally {
    clearTimeout(tid);
  }
}

async function geocodeWithPhoton(query) {
  const q = String(query || "").trim();
  if (!q) throw new Error("Type a city or address in the search box.");

  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 16000);
  try {
    const res = await fetch(url.toString(), { signal: ac.signal });
    if (!res.ok) throw new Error(`Place search HTTP ${res.status}`);
    const data = await res.json();
    const f = data.features && data.features[0];
    if (!f || !f.geometry || !f.geometry.coordinates) {
      throw new Error("No matches. Try a larger city or region.");
    }
    const [lon, lat] = f.geometry.coordinates;
    const p = f.properties || {};
    const label = [p.name, p.city, p.state, p.country].filter(Boolean).join(", ") || q;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Invalid coordinates for that place.");
    }
    return { lat, lon, label };
  } finally {
    clearTimeout(tid);
  }
}

function sosUserPopupHtml(kind, detailLabel) {
  const safe = (s) => escapeHtml(String(s || ""));
  if (kind === "gps") return "<b>You are here</b> (GPS)";
  if (kind === "cached") return "<b>You are here</b> <span style=\"opacity:.85\">(last known this session)</span>";
  if (kind === "ip") {
    const sub = detailLabel ? `<br><span style="opacity:.9;font-size:12px">${safe(detailLabel)}</span>` : "";
    return `<b>Approximate area</b> <span style="opacity:.85">(IP)</span>${sub}`;
  }
  if (kind === "search") {
    const sub = detailLabel ? `<br><span style="opacity:.9;font-size:12px">${safe(detailLabel)}</span>` : "";
    return `<b>Location</b> <span style="opacity:.85">(search)</span>${sub}`;
  }
  return "<b>You are here</b>";
}

async function sosPlotHospitalsAt(lat, lon, kind, detailLabel = "") {
  sos.userLat = lat;
  sos.userLon = lon;
  sosOpenMapsLink(lat, lon);

  sos.map.setView([lat, lon], 13);
  sos.userMarker = L.circleMarker([lat, lon], {
    radius: 11,
    color: "#38bdf8",
    weight: 2,
    fillColor: "#22d3ee",
    fillOpacity: 0.35,
  })
    .addTo(sos.map)
    .bindPopup(sosUserPopupHtml(kind, detailLabel));

  sosSetStatus("Loading nearby hospitals…");

  let rows;
  try {
    rows = await fetchHospitalRows(lat, lon);
  } catch (e) {
    const detail = e && e.name === "AbortError" ? "Request timed out." : e.message || "Network error.";
    sosSetStatus(`Hospital lookup failed: ${detail} Try Refresh or Open in Maps.`);
    log(`SOS: hospital lookup failed — ${detail}`);
    return;
  }

  const points = [[lat, lon]];
  let count = 0;

  for (const row of rows) {
    const sub = row.addr ? `<br><span style="opacity:.85;font-size:12px">${escapeHtml(row.addr)}</span>` : "";
    const marker = L.marker([row.lat, row.lon], { icon: hospitalIcon() })
      .bindPopup(`<b>${escapeHtml(row.name)}</b>${sub}`)
      .addTo(sos.hospitalLayer);
    marker.on("click", () => {
      sosSelectHospital(row.lat, row.lon, row.name);
    });
    points.push([row.lat, row.lon]);
    count++;
  }

  if (count > 1) {
    try {
      const b = L.latLngBounds(points);
      sos.map.fitBounds(b.pad(0.12));
    } catch {
      // ignore
    }
  } else if (count === 1) {
    sos.map.setView([points[1][0], points[1][1]], 14);
  }

  sosSetStatus(
    count
      ? `Found ${count} hospital/clinic marker${count === 1 ? "" : "s"} nearby. Tap pins for names.`
      : "No hospitals found in this area via search. Use “Open in Maps” or zoom out.",
  );
  log(`SOS: ${count} hospital(s) plotted.`);
}

function sosSetHospitalDetails({ name, phone, doctor, routeText }) {
  const set = (id, v) => {
    const el = $(id);
    if (el) el.textContent = v || "—";
  };
  set("hospName", name);
  set("hospPhone", phone);
  set("hospDoctor", doctor);
  set("hospRoute", routeText);
}

function sosClearRouteAndDetails() {
  if (sos.routeLayer) sos.routeLayer.clearLayers();
  sosSetHospitalDetails({
    name: "—",
    phone: "—",
    doctor: "—",
    routeText: "—",
  });
}

async function sosDrawRoute(fromLat, fromLon, toLat, toLon) {
  if (!sos.routeLayer) return { routeText: "—", km: null };
  sos.routeLayer.clearLayers();

  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("steps", "false");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 22000);
  try {
    const res = await fetch(url.toString(), { signal: ac.signal });
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data && data.routes && data.routes[0];
    if (!route || !route.geometry) throw new Error("No route found.");

    const km = route.distance ? route.distance / 1000 : null;
    const min = route.duration ? route.duration / 60 : null;

    // Uber-like route: wide soft base + animated dashed "flow" overlay (CSS: .sos-route-base / .sos-route-flow)
    L.geoJSON(route.geometry, {
      style: {
        className: "sos-route-base",
        color: "#fb7185",
        weight: 12,
        opacity: 0.28,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(sos.routeLayer);
    L.geoJSON(route.geometry, {
      style: {
        className: "sos-route-flow",
        color: "#ffe4e6",
        weight: 4,
        opacity: 1,
        lineCap: "round",
        lineJoin: "round",
      },
    }).addTo(sos.routeLayer);

    // endpoints glow
    L.circleMarker([fromLat, fromLon], {
      radius: 6,
      color: "#38bdf8",
      weight: 2,
      fillColor: "#22d3ee",
      fillOpacity: 0.25,
    }).addTo(sos.routeLayer);
    L.circleMarker([toLat, toLon], {
      radius: 7,
      color: "#fb7185",
      weight: 2,
      fillColor: "#fb7185",
      fillOpacity: 0.18,
    }).addTo(sos.routeLayer);

    const routeText =
      km != null && min != null
        ? `Fastest route: ${km.toFixed(1)} km • ${Math.max(1, Math.round(min))} min`
        : "Fastest route ready";

    return { routeText, km };
  } finally {
    clearTimeout(tid);
  }
}

async function fetchHospitalDetailsOverpass(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (sos.detailsCache.has(key)) return sos.detailsCache.get(key);

  // Query nearby hospitals/clinics and pick the closest. Doctor names may not exist in OSM.
  const radius = 250;
  const q = `[out:json][timeout:25];
(
  nwr["amenity"="hospital"](around:${radius},${lat},${lon});
  nwr["amenity"="clinic"](around:${radius},${lat},${lon});
);
out center tags;`;

  const urls = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastErr;

  for (const url of urls) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 26000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: "data=" + encodeURIComponent(q),
        signal: ac.signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const els = data && data.elements ? data.elements : [];
      if (!els.length) continue;

      let best = null;
      let bestD = Infinity;
      for (const el of els) {
        const ll = elementLatLon(el);
        if (!ll) continue;
        const dKm = haversineKm(lat, lon, ll.lat, ll.lon);
        if (dKm < bestD) {
          bestD = dKm;
          best = el;
        }
      }
      if (!best) continue;

      const tags = best.tags || {};
      const phone =
        tags.phone ||
        tags["contact:phone"] ||
        tags["contact:phone:mobile"] ||
        tags["phone:mobile"] ||
        tags["fax"] ||
        tags["contact:fax"] ||
        "";

      const doctor =
        tags.doctor ||
        tags["doctor_name"] ||
        tags["doctor:full_name"] ||
        tags["doctor:principal"] ||
        tags["staff:doctor"] ||
        tags["medical_doctor"] ||
        tags["director"] ||
        tags["medical:director"] ||
        "";

      const detail = {
        phone: phone ? String(phone) : "Not listed",
        doctor: doctor ? String(doctor) : "Not listed",
        sourceDistanceKm: bestD,
      };
      sos.detailsCache.set(key, detail);
      return detail;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(tid);
    }
  }

  throw lastErr || new Error("Hospital details unavailable.");
}

async function sosSelectHospital(toLat, toLon, name) {
  if (!sos.map) return;
  if (!Number.isFinite(toLat) || !Number.isFinite(toLon)) return;

  // Keep UI responsive: show name immediately; fill details as they arrive.
  sosSetHospitalDetails({
    name: name || "Hospital",
    phone: "Loading…",
    doctor: "Loading…",
    routeText: "Computing route…",
  });

  if (!sos.userLat || !sos.userLon) {
    sosSetHospitalDetails({
      name: name || "Hospital",
      phone: "—",
      doctor: "—",
      routeText: "Set your location first (Refresh / IP / Search).",
    });
    return;
  }

  try {
    const [routeResRes, detailsRes] = await Promise.allSettled([
      sosDrawRoute(sos.userLat, sos.userLon, toLat, toLon),
      fetchHospitalDetailsOverpass(toLat, toLon),
    ]);

    const routeRes = routeResRes.status === "fulfilled" ? routeResRes.value : null;
    const details = detailsRes.status === "fulfilled" ? detailsRes.value : null;

    sosSetHospitalDetails({
      name: name || "Hospital",
      phone: details && details.phone ? details.phone : "Not listed",
      doctor: details && details.doctor ? details.doctor : "Not listed",
      routeText: routeRes && routeRes.routeText ? routeRes.routeText : "Route unavailable",
    });

    sosSetStatus("Route + hospital info loaded. Tap another pin to switch.");
    log(`SOS: Selected hospital "${name}" — route + contact details.`);
  } catch (e) {
    sosSetHospitalDetails({
      name: name || "Hospital",
      phone: "Not available",
      doctor: "Not available",
      routeText: e && e.message ? `Route/details error: ${e.message}` : "Route/details error",
    });
    sosSetStatus("Could not load route/contact details for that hospital.");
    log(`SOS: hospital details failed — ${e?.message || e}`);
  }
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** GET-based search; less likely to be blocked than Overpass from the browser. */
async function fetchNearbyHospitalsPhoton(lat, lon) {
  const maxKm = 12;
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", "hospital");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("limit", "80");
  url.searchParams.set("lang", "en");

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), 22000);
  try {
    const res = await fetch(url.toString(), { signal: ac.signal });
    if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
    const data = await res.json();
    const rows = [];
    for (const f of data.features || []) {
      const p = f.properties || {};
      const isHospital = p.osm_key === "amenity" && (p.osm_value === "hospital" || p.osm_value === "clinic");
      if (!isHospital) continue;
      const c = f.geometry && f.geometry.coordinates;
      if (!c || c.length < 2) continue;
      const [flon, flat] = c;
      if (haversineKm(lat, lon, flat, flon) > maxKm) continue;
      const addr = [p.street, p.district, p.city, p.country].filter(Boolean).join(", ");
      rows.push({
        lat: flat,
        lon: flon,
        name: p.name || (p.osm_value === "clinic" ? "Clinic" : "Hospital"),
        addr,
      });
    }
    return rows;
  } finally {
    clearTimeout(tid);
  }
}

async function fetchNearbyHospitalsOverpass(lat, lon) {
  const radius = 10000;
  const q = `[out:json][timeout:25];
(
  nwr["amenity"="hospital"](around:${radius},${lat},${lon});
);
out center;`;

  const urls = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let lastErr;
  for (const url of urls) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), 28000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: "data=" + encodeURIComponent(q),
        signal: ac.signal,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        const snippet = text.slice(0, 200).replace(/\s+/g, " ");
        if (/blocked|access denied|rate limit|too many/i.test(snippet)) {
          lastErr = new Error("Overpass blocked or rate-limited this request.");
        } else {
          lastErr = new Error("Invalid response from hospital service.");
        }
        continue;
      }
      if (data.remark && typeof data.remark === "string") {
        lastErr = new Error(data.remark.trim());
        continue;
      }
      return data.elements || [];
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(tid);
    }
  }
  throw lastErr || new Error("Hospital data service unavailable.");
}

async function fetchHospitalRows(lat, lon) {
  try {
    const photonRows = await fetchNearbyHospitalsPhoton(lat, lon);
    if (photonRows.length) return photonRows;
  } catch {
    // fall through to Overpass
  }
  const elements = await fetchNearbyHospitalsOverpass(lat, lon);
  const rows = [];
  const seen = new Set();
  for (const el of elements) {
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    const ll = elementLatLon(el);
    if (!ll) continue;
    seen.add(id);
    rows.push({
      lat: ll.lat,
      lon: ll.lon,
      name: (el.tags && el.tags.name) || "Hospital",
      addr: [el.tags && el.tags["addr:full"], el.tags && el.tags["addr:street"], el.tags && el.tags["addr:city"]]
        .filter(Boolean)
        .join(", "),
    });
  }
  return rows;
}

function elementLatLon(el) {
  if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

async function sosRefreshHospitals() {
  if (!sos.map) return;

  sosHideMapsLink();
  clearHospitalMarkers();
  sosSetStatus("Locating you…");

  try {
    const pos = await getPositionBestEffort();
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    sos.lastGeo = { lat, lon, t: Date.now() };
    await sosPlotHospitalsAt(lat, lon, "gps", "");
  } catch (e) {
    const msg =
      e && typeof e.code === "number" ? geoErrorMessage(e) : e && e.message ? e.message : geoErrorMessage(e);
    const stale = sos.lastGeo && Date.now() - sos.lastGeo.t < 15 * 60 * 1000;
    if (stale) {
      sosSetStatus(`${msg} Using your last position from this session.`);
      log(`SOS: geolocation failed — ${msg} (using cached fix)`);
      await sosPlotHospitalsAt(sos.lastGeo.lat, sos.lastGeo.lon, "cached", "");
      return;
    }
    const tips = geoFailureTips(e);
    sosSetStatus(`${msg}${tips ? ` — ${tips}` : ""}`);
    log(`SOS: ${msg}`);
    sos.map.setView([20, 0], 2);
  }
}

function openSosModal() {
  const modal = $("sosModal");
  if (!modal) return;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  log("SOS: emergency map opened.");

  loadLeafletIfNeeded()
    .then(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          ensureSosMap();
          if (sos.map) sos.map.invalidateSize();
          sosRefreshHospitals();
        }, 120);
      });
    })
    .catch((e) => {
      sosSetStatus(`Could not load map library: ${e.message}`);
      log(`SOS: ${e.message}`);
    });
}

function closeSosModal() {
  const modal = $("sosModal");
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function bindSOS() {
  const openBtn = $("btnSOS");
  const closeBtn = $("btnSosClose");
  const backdrop = $("sosBackdrop");
  const refreshBtn = $("btnSosRefresh");
  if (!openBtn || !closeBtn || !backdrop) return;

  openBtn.addEventListener("click", () => openSosModal());
  closeBtn.addEventListener("click", () => closeSosModal());
  backdrop.addEventListener("click", () => closeSosModal());
  if (refreshBtn) refreshBtn.addEventListener("click", () => sosRefreshHospitals());

  const ipBtn = $("btnSosIpLoc");
  const searchBtn = $("btnSosSearchPlace");
  const searchInput = $("sosPlaceSearch");

  if (ipBtn) {
    ipBtn.addEventListener("click", async () => {
      if (!sos.map) return;
      sosHideMapsLink();
      clearHospitalMarkers();
      sosSetStatus("Getting rough location from IP (city-level)…");
      try {
        const { lat, lon, label } = await fetchApproxIpLocation();
        sos.lastGeo = { lat, lon, t: Date.now() };
        await sosPlotHospitalsAt(lat, lon, "ip", label);
      } catch (err) {
        sosSetStatus(err.message || "IP location failed. Try Search map.");
        log(`SOS: IP fallback — ${err.message}`);
        sos.map.setView([20, 0], 2);
      }
    });
  }

  async function runSosPlaceSearch() {
    if (!sos.map || !searchInput) return;
    const query = searchInput.value;
    sosHideMapsLink();
    clearHospitalMarkers();
    sosSetStatus("Finding that place…");
    try {
      const { lat, lon, label } = await geocodeWithPhoton(query);
      sos.lastGeo = { lat, lon, t: Date.now() };
      await sosPlotHospitalsAt(lat, lon, "search", label);
    } catch (err) {
      sosSetStatus(err.message || "Search failed.");
      log(`SOS: place search — ${err.message}`);
      sos.map.setView([20, 0], 2);
    }
  }

  if (searchBtn) searchBtn.addEventListener("click", () => runSosPlaceSearch());
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runSosPlaceSearch();
      }
    });
  }

  const clearRouteBtn = $("btnSosClearRoute");
  if (clearRouteBtn) {
    clearRouteBtn.addEventListener("click", () => {
      sosClearRouteAndDetails();
      sosSetStatus("Route cleared. Tap a hospital pin again.");
    });
  }

  window.addEventListener("keydown", (e) => {
    const modal = $("sosModal");
    if (modal && modal.classList.contains("is-open") && e.key === "Escape") {
      e.preventDefault();
      closeSosModal();
    }
  });
}

// ---------------------------
// NOVA — signal-aware assistant (rule-based; not medical advice)
// ---------------------------

function novaAppendMessage(role, text) {
  const box = $("novaMessages");
  if (!box) return;
  const row = document.createElement("div");
  row.className = role === "user" ? "nova-msg nova-msg-user" : "nova-msg nova-msg-nova";
  const meta = document.createElement("div");
  meta.className = "nova-msg-meta";
  meta.textContent = role === "user" ? "You" : "NOVA";
  const body = document.createElement("div");
  body.textContent = text;
  row.appendChild(meta);
  row.appendChild(body);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function novaThinking(on) {
  const send = $("btnNovaSend");
  const inp = $("novaInput");
  if (send) send.disabled = on;
  if (inp) inp.disabled = on;
}

function novaSetOpen(open) {
  const sheet = $("novaSheet");
  const fab = $("btnNovaToggle");
  if (!sheet) return;
  sheet.hidden = !open;
  sheet.setAttribute("aria-hidden", open ? "false" : "true");
  if (fab) fab.setAttribute("aria-expanded", open ? "true" : "false");
}

function novaBuildSignalAnalysis() {
  const s = novaSignalSnapshot;
  const eegRmsDisp = fmt(s.eegRms * 100, 1);
  let ecgLine =
    s.ecgStatus === "WAIT"
      ? "ECG heart-rate estimate is still stabilizing (demo detector)."
      : `ECG trend reads about ${s.bpm} BPM (${s.ecgStatus} for this demo logic only).`;
  let emgLine = s.emgGate
    ? "EMG envelope is above your gate threshold — the dashboard treats this as higher muscle drive / activation."
    : "EMG envelope is below the gate — low activation in this demo.";
  let eegLine = `EEG RMS proxy is ~${eegRmsDisp} (scaled units), band hint ${s.eegBand}, quality ${s.eegQuality}.`;
  if (s.eegQuality === "NOISY") {
    eegLine +=
      " If this were a live headset, check electrodes, contact quality, mains interference, and motion artifact.";
  }
  let cardio = "";
  if (s.ecgStatus === "FAST") {
    cardio =
      "\nIf you have chest pain, severe shortness of breath, fainting, or stroke-like symptoms, use SOS and your local emergency number now.";
  }
  if (s.ecgStatus === "SLOW") {
    cardio =
      "\nIf you feel faint, confused, or have chest pain with a very slow rate on a clinical monitor, seek urgent care — this UI cannot confirm rhythm.";
  }
  return (
    `${eegLine}\n${emgLine}\n${ecgLine}${cardio}\n\n` +
    `Intent mapping (demo only): EEG→${s.eegCmd}. Console: mode=${s.mode}, armed=${s.armed}, stream=${s.running ? "running" : "paused"}, demo=${s.demo}.\n\n` +
    "Reminder: NeuroDrive is a research / demo UI, not a licensed diagnostic device."
  );
}

function novaMedicationReply() {
  return (
    "Medication guidance:\n" +
    "I must not prescribe or recommend specific drugs or doses. That requires your full medical history, allergies, pregnancy status, kidney/liver function, and an up-to-date medication list.\n\n" +
    "What I can suggest safely:\n" +
    "• Take this dashboard snapshot and your symptoms to a clinician or pharmacist.\n" +
    "• Ask about interactions, side effects, deprescribing, and non-drug options.\n" +
    "• Do not start/stop/merge medicines based on a chatbot.\n\n" +
    "If symptoms are severe or sudden, use SOS / emergency services instead of waiting for chat advice."
  );
}

async function novaHospitalsReply() {
  const lat = sos.userLat ?? sos.lastGeo?.lat;
  const lon = sos.userLon ?? sos.lastGeo?.lon;
  if (lat == null || lon == null) {
    return (
      "Hospital finder:\n" +
      "Open SOS, then use Approx. from IP or Search map so we have coordinates. Ask me again for names, or use Open in Maps inside SOS."
    );
  }
  const now = Date.now();
  if (novaHospitalCache.t && now - novaHospitalCache.t < 90000 && novaHospitalCache.names.length) {
    return (
      "From your last area lookup (cached ~90s), nearby hospital/clinic POIs include:\n• " +
      novaHospitalCache.names.join("\n• ") +
      "\n\nOpen SOS to verify on the map and tap a pin for routing."
    );
  }
  try {
    const rows = await fetchHospitalRows(lat, lon);
    const names = rows.slice(0, 8).map((r) => r.name);
    novaHospitalCache = { t: now, names };
    if (!names.length) {
      return "No hospital POIs returned in this radius (OpenStreetMap coverage varies).\nTry SOS → Search map / zoom out / Open in Maps.";
    }
    return (
      "Nearby names from our OSM-backed search (verify before traveling):\n• " +
      names.join("\n• ") +
      "\n\nUse SOS to open the live map, compare routes, and read the Hospital info panel after you tap a pin."
    );
  } catch {
    return "Hospital lookup failed (network). Use SOS and Open in Maps as a fallback.";
  }
}

async function novaReply(userText) {
  const raw = String(userText || "").trim();
  if (!raw) return "Type a question or tap a quick chip.";
  const q = raw.toLowerCase();

  if (
    /\b(911|999|112|ambulanc|heart attack|cardiac arrest|stroke|unconscious|not breathing|can't breathe|cannot breathe|choking)\b/.test(q)
  ) {
    return "Emergency:\nIf you or someone else may be in immediate danger, call your local emergency number now and use SOS if you need directions.\nA chatbot cannot triage emergencies.";
  }

  if (/\b(hospital|clinic|er\b|emergency room|nearby|directions|urgent care)\b/.test(q)) {
    return await novaHospitalsReply();
  }

  if (/\b(drug|pill|medication|medicine|prescription|dose|tablet|insulin|antibioti|opioid|benzo|ssri)\b/.test(q)) {
    return novaMedicationReply();
  }

  if (
    /\b(eeg|emg|ecg|ekg|signal|bpm|heart|muscle|brain|cortex|spasm|seiz|tremor)\b/.test(q) ||
    /\b(analy|interpret|status|levels|telemetry)\b/.test(q)
  ) {
    return novaBuildSignalAnalysis();
  }

  return `${novaBuildSignalAnalysis()}\n\nTip: ask about "hospitals", "medications" (safety only), or "signals".`;
}

function bindNova() {
  const toggle = $("btnNovaToggle");
  const close = $("btnNovaClose");
  const send = $("btnNovaSend");
  const inp = $("novaInput");
  const sheet = $("novaSheet");
  if (!toggle || !sheet) return;

  toggle.addEventListener("click", () => {
    const willOpen = !!sheet.hidden;
    novaSetOpen(willOpen);
    const box = $("novaMessages");
    if (willOpen && box && box.childElementCount === 0) {
      novaAppendMessage(
        "nova",
        "Hello — I'm NOVA. I use this dashboard's EEG / EMG / ECG context to explain trends. I do not diagnose, prescribe, or replace emergency services.\n\nTap a chip or ask a question.",
      );
    }
  });
  if (close) close.addEventListener("click", () => novaSetOpen(false));

  document.querySelectorAll("[data-nova-chip]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const k = btn.getAttribute("data-nova-chip");
      let q = "";
      if (k === "signals") q = "Analyze my EEG, EMG, and ECG.";
      if (k === "hospitals") q = "Nearby hospitals.";
      if (k === "meds") q = "Medication safety.";
      novaAppendMessage("user", q);
      novaThinking(true);
      try {
        let ans;
        if (k === "hospitals") ans = await novaHospitalsReply();
        else if (k === "meds") ans = novaMedicationReply();
        else ans = novaBuildSignalAnalysis();
        novaAppendMessage("nova", ans);
      } finally {
        novaThinking(false);
      }
    });
  });

  async function sendNova() {
    const t = (inp?.value || "").trim();
    if (!t) return;
    if (inp) inp.value = "";
    novaAppendMessage("user", t);
    novaThinking(true);
    try {
      const ans = await novaReply(t);
      novaAppendMessage("nova", ans);
    } finally {
      novaThinking(false);
    }
  }

  if (send) send.addEventListener("click", () => sendNova());
  if (inp) {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sendNova();
      }
    });
  }
}

// ---------------------------
// UI wiring
// ---------------------------

function bindUI() {
  $("btnDemo").addEventListener("click", () => {
    state.demo = true;
    state.running = true;
    t0 = nowMs();
    eegBuf.i = 0;
    emgBuf.i = 0;
    ecgBuf.i = 0;
    eegBuf.full = emgBuf.full = ecgBuf.full = false;
    emgEnv = 0;
    bpm = 0;
    ecgPeaks = 0;
    lastPeakAt = 0;
    log("Demo stream started.");
  });

  $("btnPause").addEventListener("click", () => {
    state.running = !state.running;
    $("btnPause").innerHTML = `<span class="dot dot-slate"></span>${state.running ? "Pause" : "Resume"}`;
    log(state.running ? "Resumed." : "Paused.");
  });

  $("btnSnapshot").addEventListener("click", () => {
    const snap = {
      t: Date.now(),
      eegRms: eegBuf.rms(),
      emgEnv,
      bpm,
      mode: state.mode,
      armed: state.armed,
      lastCmd: state.lastCmd,
    };
    navigator.clipboard?.writeText(JSON.stringify(snap, null, 2)).catch(() => {});
    log("Snapshot copied to clipboard.");
  });

  $("btnClearLog").addEventListener("click", () => {
    $("log").innerHTML = "";
  });

  $("btnArm").addEventListener("click", () => {
    state.armed = !state.armed;
    setArmedUI();
    log(state.armed ? "System ARMED." : "System SAFE.");
    if (!state.armed) sendCmd("STOP", "safety");
  });

  $("mode").addEventListener("change", (e) => {
    state.mode = e.target.value;
    log(`Mode set: ${state.mode}`);
    updatePayloadPreview(state.lastCmd === "—" ? "STOP" : state.lastCmd);
  });

  $("speed").addEventListener("input", (e) => {
    state.speed = Number(e.target.value) || 0;
    $("speedVal").textContent = String(state.speed);
    updatePayloadPreview(state.lastCmd === "—" ? "STOP" : state.lastCmd);
  });

  $("thr").addEventListener("input", (e) => {
    state.thr = Number(e.target.value) || 0;
    $("thrVal").textContent = fmt(state.thr, 2);
  });

  $("sens").addEventListener("input", (e) => {
    state.sens = Number(e.target.value) || 0;
    $("sensVal").textContent = fmt(state.sens, 2);
  });

  $("btnCopy").addEventListener("click", () => {
    const txt = $("payload").textContent || "";
    navigator.clipboard?.writeText(txt).catch(() => {});
    log("Payload copied.");
  });

  document.querySelectorAll("[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.getAttribute("data-cmd");
      if (cmd === "NEUTRAL") return;
      if (cmd === "STOP") return sendCmd("STOP", "pad");
      sendCmd(cmd, "pad");
    });
  });

  // Keyboard controls
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "w") sendCmd("F", "kb");
    if (k === "s") sendCmd("B", "kb");
    if (k === "a") sendCmd("L", "kb");
    if (k === "d") sendCmd("R", "kb");
    if (k === " ") sendCmd("STOP", "kb");
  });

  // Connection buttons (Serial is placeholder on Windows; Web Serial requires HTTPS + supported browser)
  $("btnSerial").addEventListener("click", async () => {
    setConn("WARN", "Serial not implemented");
    log("Serial connect placeholder. Implement Web Serial: navigator.serial.requestPort()");
  });

  $("btnWS").addEventListener("click", () => connectWS());
  $("btnWSDisconnect").addEventListener("click", () => disconnectWS());

  bindSOS();
  bindNova();

  updatePayloadPreview("STOP");
  setArmedUI();
  setConn("IDLE", "No link");
}

// ---------------------------
// Boot
// ---------------------------

function boot() {
  const cv = $("particles");
  if (cv) makeParticleField(cv);
  initCharts();
  bindUI();
  log("Dashboard ready.");
  log("Start with Demo stream, then wire your real data transport.");
  tick();
}

document.addEventListener("DOMContentLoaded", boot);

