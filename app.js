'use strict';

/* =====================================================================
   Stride — 1 minute to 20, one small step at a time.
   The app decides everything. You show up and do it.
   ===================================================================== */

const MOVES = [
  { id: 'march',    name: 'March in place',      type: 'time', base: 45, grow: 0.90 },
  { id: 'jog',      name: 'Jog in place',        type: 'time', base: 20, grow: 1.00 },
  { id: 'squat',    name: 'Squats',              type: 'reps', base: 5,  grow: 0.13 },
  { id: 'wallpush', name: 'Wall push-ups',       type: 'reps', base: 5,  grow: 0.12 },
  { id: 'push',     name: 'Push-ups (knees ok)', type: 'reps', base: 3,  grow: 0.10 },
  { id: 'plank',    name: 'Plank',               type: 'time', base: 15, grow: 0.18 },
  { id: 'bridge',   name: 'Glute bridges',       type: 'reps', base: 8,  grow: 0.14 },
  { id: 'step',     name: 'Step-ups',            type: 'reps', base: 5,  grow: 0.13 },
];
const DAYS = 90;
const START_SEC = 60;
const END_SEC = 1200;

/* ---------------- state ---------------- */
const pathHash = (location.pathname.replace(/[^a-zA-Z0-9]/g, '').slice(-24)) || 'local';
const LS_KEY = 'stride.' + pathHash + '.v3';
const LS_OLD = 'stride.' + pathHash + '.v2';
const IDB_NAME = 'stride.' + pathHash + '.upload';

let state = {
  startDate: null,
  history: [],
  settings: {
    reminder: '',
    music: { mode: 'builtin', link: '', hasFile: false },
    camera: false,
    slots: ['march', 'squat', 'wallpush', 'plank']
  }
};

function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (e) {}
  if (!raw) { try { raw = localStorage.getItem(LS_OLD); } catch (e) {} }
  if (raw) {
    try {
      const s = JSON.parse(raw);
      state = {
        ...state, ...s,
        settings: { ...state.settings, ...(s.settings || {}), music: { ...state.settings.music, ...((s.settings && s.settings.music) || {}) } }
      };
    } catch (e) {}
  }
  if (!Array.isArray(state.settings.slots) || !state.settings.slots.length) {
    state.settings.slots = ['march', 'squat', 'wallpush', 'plank'];
  }
  saveState();
}
function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

function localDayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + (offset || 0));
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function daysSinceStart() {
  if (!state.startDate) return 0;
  const s = new Date(state.startDate + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((t - s) / 86400000));
}
function todayDone() { return state.history.includes(localDayKey()); }

function compute() {
  const keys = new Set(state.history);
  const ds = daysSinceStart();
  let comp = 0, missed = 0;
  for (let i = 1; i <= ds; i++) {
    if (keys.has(localDayKey(-i))) comp++; else missed++;
  }
  if (todayDone()) comp++;
  return {
    comp, missed,
    marker: Math.max(0, Math.min(DAYS, comp - missed)),
    day: ds + 1,
    done: comp >= DAYS
  };
}

/* ---------------- the ramp ---------------- */
function totalSeconds(day) {
  const d = Math.min(Math.max(day, 1), DAYS);
  return Math.round(START_SEC + (d - 1) * ((END_SEC - START_SEC) / (DAYS - 1)));
}
function moveCount(day) { return Math.min(4, 1 + Math.floor((Math.max(day, 1) - 1) / 25)); }
function moveTarget(move, day) {
  const d = Math.max(day, 1) - 1;
  const raw = move.base + move.grow * d;
  return move.type === 'time' ? Math.round(raw) : Math.max(1, Math.round(raw));
}
function sessionFor(day) {
  const moves = state.settings.slots
    .slice(0, moveCount(day))
    .map(id => MOVES.find(m => m.id === id))
    .filter(Boolean)
    .map(m => ({ id: m.id, name: m.name, type: m.type, target: moveTarget(m, day) }));
  return { total: totalSeconds(day), moves };
}

function fmt(sec) { sec = Math.max(0, Math.ceil(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
function targetText(m) { return m.type === 'time' ? fmt(m.target) : m.target + ' reps'; }

/* ---------------- journey illustration ---------------- */
const W = 400, H = 300;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 2.1);
function bez(p0, p1, p2, t) {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
}
const P0 = { x: 40, y: 258 }, P1 = { x: 196, y: 232 }, P2 = { x: 344, y: 108 };

function journeySVG(marker) {
  const p = clamp01(marker / DAYS);
  const ep = easeOut(p);
  const sunY = lerp(248, 86, ep);
  const sunR = lerp(13, 27, ep);
  const sunOp = lerp(0.75, 1, ep);
  const f = bez(P0, P1, P2, p);
  const ahead = bez(P0, P1, P2, Math.min(1, (marker + 1) / DAYS));
  const behind = bez(P0, P1, P2, Math.max(0, (marker - 1) / DAYS));
  const step = (Math.floor(marker) % 2) ? 1 : -1;

  let ticks = '';
  for (let i = 1; i < 10; i++) {
    const q = bez(P0, P1, P2, i / 10);
    ticks += `<circle cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" r="2.4" fill="#4b539a" opacity="0.22"/>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#c5caf1"/>
      <stop offset="58%" stop-color="#dcdcf5"/>
      <stop offset="100%" stop-color="#f6ddc6"/>
    </linearGradient>
    <radialGradient id="sunGlow">
      <stop offset="0" stop-color="#ffd9a0" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#ffc178" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hillBack" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9aa2e2"/><stop offset="1" stop-color="#828cd0"/>
    </linearGradient>
    <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7c86cd"/><stop offset="1" stop-color="#6d77c4"/>
    </linearGradient>
    <linearGradient id="hillFront" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5f6ab8"/><stop offset="1" stop-color="#4f59a8"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${P2.x}" cy="${sunY.toFixed(1)}" r="${(sunR * 3.6).toFixed(1)}" fill="url(#sunGlow)" opacity="${sunOp}"/>
  <circle cx="${P2.x}" cy="${sunY.toFixed(1)}" r="${sunR.toFixed(1)}" fill="#ffeac4" opacity="${sunOp}"/>
  <path d="M0 ${H} L0 214 Q 96 168 196 206 T ${W} 176 L${W} ${H} Z" fill="url(#hillBack)" opacity="0.55"/>
  <path d="M0 ${H} L0 246 Q 112 210 214 240 T ${W} 222 L${W} ${H} Z" fill="url(#hillMid)" opacity="0.72"/>
  <path d="M${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="8" stroke-linecap="round"/>
  <path d="M${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}" fill="none" stroke="#6d76c4" stroke-opacity="0.30" stroke-width="2" stroke-dasharray="5 7" stroke-linecap="round"/>
  ${ticks}
  <circle cx="${behind.x.toFixed(1)}" cy="${behind.y.toFixed(1)}" r="4.6" fill="none" stroke="#ef6b7d" stroke-width="2.2" stroke-opacity="0.9"/>
  <circle cx="${ahead.x.toFixed(1)}" cy="${ahead.y.toFixed(1)}" r="4.6" fill="none" stroke="#35b785" stroke-width="2.2"/>
  <path d="M0 ${H} L0 272 Q 130 254 240 274 T ${W} 262 L${W} ${H} Z" fill="url(#hillFront)"/>
  <g transform="translate(${f.x.toFixed(1)} ${f.y.toFixed(1)})">
    <ellipse cx="0" cy="12" rx="8" ry="2.6" fill="#3b4384" opacity="0.28"/>
    <line x1="0" y1="-3" x2="0" y2="9" stroke="#2f3563" stroke-width="3" stroke-linecap="round"/>
    <line x1="0" y1="1" x2="${-3.4 * step}" y2="9.5" stroke="#2f3563" stroke-width="2.3" stroke-linecap="round"/>
    <line x1="0" y1="1" x2="${3.4 * -step}" y2="9.5" stroke="#2f3563" stroke-width="2.3" stroke-linecap="round"/>
    <circle cx="0" cy="-8.5" r="4.8" fill="#2f3563"/>
  </g>
</svg>`;
}

/* ---------------- music ---------------- */
const BUILTIN_SRC = 'ambient.mp3';
const audio = new Audio();
audio.preload = 'auto';
audio.addEventListener('error', () => {
  const m = state.settings.music;
  if (m.mode === 'file') {
    setMusicState('badfile');
    if (session) { audio.src = BUILTIN_SRC; audio.loop = true; audio.play().catch(() => {}); fade(audio, 0.55, 600); }
  } else if (m.mode === 'link') {
    setMusicState('badlink');
  }
});

let ytPlayer = null, ytReady = false, ytId = null, ytApiLoaded = false;

function fade(el, to, ms) {
  if (!el) return;
  const from = el.volume || 0, steps = Math.max(4, Math.round(ms / 60));
  let i = 0;
  if (window.__fade) clearInterval(window.__fade);
  window.__fade = setInterval(() => {
    i++;
    try { el.volume = clamp01(lerp(from, to, i / steps)); } catch (e) {}
    if (i >= steps) clearInterval(window.__fade);
  }, ms / steps);
}
function fadeYT(to) { if (ytPlayer && ytReady) { try { ytPlayer.setVolume(Math.round(to * 100)); } catch (e) {} } }

function musicPlay() {
  if (window.__pause) { clearTimeout(window.__pause); window.__pause = null; }
  const mode = state.settings.music.mode;
  if (mode === 'builtin') {
    if (audio.src !== BUILTIN_SRC) { audio.src = BUILTIN_SRC; audio.loop = true; }
    audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
    fade(audio, 0.55, 500);
  } else if (mode === 'file' && audio.src && audio.src !== BUILTIN_SRC) {
    audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
    fade(audio, 1, 500);
  } else if (mode === 'link' && ytPlayer && ytReady) {
    if (audio.src) { audio.pause(); audio.src = ''; }
    try { ytPlayer.unMute(); ytPlayer.setVolume(100); ytPlayer.playVideo(); } catch (e) {}
    setMusicState('playing');
  } else if (mode === 'link' && audio.src) {
    audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
    fade(audio, 1, 500);
  }
}
function musicPause() {
  if (audio.src) {
    fade(audio, 0, 700);
    window.__pause = setTimeout(() => { audio.pause(); window.__pause = null; }, 750);
  }
  if (ytPlayer && ytReady) {
    // mute as well as pause: mute guarantees silence even if pause is ignored
    try { ytPlayer.mute(); } catch (e) {}
    try { ytPlayer.pauseVideo(); } catch (e) {}
  }
}

function ensureYtDiv() {
  if (!document.getElementById('yt-embed')) {
    const div = document.createElement('div');
    div.id = 'yt-embed';
    document.body.appendChild(div);
  }
}
function makePlayer() {
  if (!ytId || !(window.YT && YT.Player) || document.getElementById('yt-embed-inner')) return;
  const host = document.getElementById('yt-embed');
  if (!host) return;
  const inner = document.createElement('div');
  inner.id = 'yt-embed-inner';
  host.appendChild(inner);
  ytPlayer = new YT.Player(inner, {
    videoId: ytId,
    width: '100%',
    height: '100%',
    playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, modestbranding: 1 },
    events: {
      onReady: () => {
        ytReady = true;
        if (window.__ytCb) { window.__ytCb(); window.__ytCb = null; }
      },
      onStateChange: (ev) => {
        // once YouTube is genuinely playing, stop the fallback track
        if (window.YT && ev.data === window.YT.PlayerState.PLAYING && audio.src) {
          audio.pause();
          audio.src = '';
        }
      },
      onError: () => setMusicState('badlink')
    }
  });
}
function loadYT(id, cb) {
  ytId = id;
  if (!ytApiLoaded) {
    ytApiLoaded = true;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => setMusicState('badlink');
    document.head.appendChild(tag);
  }
  window.__ytCb = cb;
  makePlayer();
}
window.onYouTubeIframeAPIReady = makePlayer;

function ytIdFromUrl(u) {
  const m = u.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const isDirectAudio = (u) => /\.(mp3|m4a|aac|ogg|opus|wav)(\?.*)?$/i.test(u);
const isSpotify = (u) => /spotify\.com|open\.spotify/.test(u);

/* ---------------- uploaded file ---------------- */
function openDB() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(IDB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('files');
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function saveFile(blob) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, 'upload');
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function loadFile() {
  const db = await openDB();
  return new Promise((res) => {
    const rq = db.transaction('files', 'readonly').objectStore('files').get('upload');
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => res(null);
  });
}

function setMusicState(s) {
  document.body.dataset.music = s;
  window.__musicState = s;
  const el = $('music-note');
  if (!el) return;
  const m = state.settings.music;
  const msg = {
    off: m.mode === 'none' ? 'Music is off.' : null,
    blocked: 'Your browser blocked the sound — tap Start once more.',
    nofile: 'No file loaded yet — using the built-in track. Choose one in Settings.',
    fallback: 'Playing the built-in track. Add your own in Settings.',
    nolink: 'No link saved yet — add one in Settings.',
    noaudio: 'That file could not be read — using the built-in track instead.',
    badfile: 'That audio file would not play (unsupported format). Try an .mp3 or .m4a.',
    badlink: 'That link would not play. Check it, or use a direct audio URL.'
  }[s];
  if (msg) { el.textContent = msg; el.classList.remove('hidden'); }
  else el.classList.add('hidden');
}

/* =====================================================================
   Motion detection.
   The old version compared frames 16ms apart, which is why it flickered.
   This one samples every 120ms, counts pixels that actually changed,
   and holds "moving" for a while after the last real movement.
   ===================================================================== */
const Motion = {
  video: null, canvas: null, ctx: null, stream: null, raf: null,
  prevLum: null, moving: false, running: false, failed: false, errorName: '',
  lastSample: 0, lastMotionAt: 0, activeMs: 0, lastRatio: 0, hits: 0,
  onState: () => {},

  SAMPLE_MS: 120,      // compare across 120ms — 16ms shows almost no change
  HOLD_MS: 2600,       // stay "moving" this long after the last real movement
  PIXEL_DELTA: 26,     // luminance change for a pixel to count
  FLOOR: 0.02,         // never treat less than 2% of the frame as movement
  CEILING: 0.45,       // allow the bar to rise above a noisy room
  NEED_HITS: 2,        // consecutive samples above the bar = real movement
  CW: 64, CH: 48,
  BW: 32, BH: 24,      // block-averaged grid: averaging kills per-pixel grain

  // calibration: watch a few seconds, learn what "still" looks like on THIS
  // camera in THIS light, then set the bar well above that noise floor
  CAL_MS: 2600,
  calRatios: [],
  calibrating: true,
  threshold: 0.02,

  async start() {
    this.errorName = '';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.failed = true; this.errorName = 'Unsupported'; return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }
      });
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.setAttribute('playsinline', '');
      this.video.muted = true;
      await this.video.play().catch(() => {});
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.CW; this.canvas.height = this.CH;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.prevLum = null;
      this.activeMs = 0;
      this.lastMotionAt = 0;
      this.lastSample = 0;
      this.hits = 0;
      this.lastRatio = 0;
      this.calRatios = [];
      this.calibrating = true;
      this.threshold = this.FLOOR;
      this.failed = false;
      this.running = true;
      this.raf = requestAnimationFrame((t) => this.loop(t));
      return true;
    } catch (e) {
      this.failed = true;
      this.errorName = (e && e.name) || 'Error';
      return false;
    }
  },

  loop(now) {
    if (!this.running) return;
    if (now - this.lastSample >= this.SAMPLE_MS) {
      this.lastSample = now;
      this.sample(now);
    }
    const moving = this.lastMotionAt > 0 && (now - this.lastMotionAt) < this.HOLD_MS;
    if (moving !== this.moving) { this.moving = moving; this.onState(moving); }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  },

  sample(now) {
    const { CW, CH, BW, BH, ctx, video } = this;
    if (!ctx || !video || video.readyState < 2) return;
    ctx.drawImage(video, 0, 0, CW, CH);
    const d = ctx.getImageData(0, 0, CW, CH).data;

    // average 2x2 blocks: per-pixel grain is independent, real movement is not,
    // so averaging cuts the noise roughly in half and leaves motion intact
    const lum = new Float32Array(BW * BH);
    for (let y = 0; y < BH; y++) {
      for (let x = 0; x < BW; x++) {
        const i = ((y * 2) * CW + x * 2) * 4;
        const i2 = i + CW * 4;
        lum[y * BW + x] = (
          (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) +
          (d[i + 4] * 0.299 + d[i + 5] * 0.587 + d[i + 6] * 0.114) +
          (d[i2] * 0.299 + d[i2 + 1] * 0.587 + d[i2 + 2] * 0.114) +
          (d[i2 + 4] * 0.299 + d[i2 + 5] * 0.587 + d[i2 + 6] * 0.114)
        ) / 4;
      }
    }

    if (this.prevLum) {
      let changed = 0;
      for (let i = 0; i < lum.length; i++) {
        if (Math.abs(lum[i] - this.prevLum[i]) > this.PIXEL_DELTA) changed++;
      }
      const ratio = changed / lum.length;
      this.lastRatio = ratio;

      if (this.calibrating) {
        this.calRatios.push(ratio);
        if (this.calRatios.length >= Math.round(this.CAL_MS / this.SAMPLE_MS)) {
          const sorted = this.calRatios.slice().sort((a, b) => a - b);
          const base = sorted[Math.floor(sorted.length * 0.3)] || 0;
          this.threshold = Math.min(this.CEILING, Math.max(this.FLOOR, base * 4));
          this.calibrating = false;
        }
        this.prevLum = lum;
        return;
      }

      if (ratio > this.threshold) {
        this.hits++;
        if (this.hits >= this.NEED_HITS) this.lastMotionAt = now;
      } else {
        this.hits = 0;
      }
    }
    this.prevLum = lum;
  },

  stop() {
    this.running = false;
    this.moving = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.video = null;
  }
};

/* =====================================================================
   Session loop — one timestamped animation frame drives the clock.
   No setInterval, so it cannot drift or double up.
   With motion mode on, time only counts while you are actually moving.
   ===================================================================== */
let session = null;
let starting = false;

function sessionElapsed(now) {
  if (!session) return;
  let dt = now - session.lastTick;
  session.lastTick = now;
  if (dt < 0) dt = 0;
  if (dt > 300) dt = 300;                 // returning from background shouldn't jump

  const gated = session.useMotion && !Motion.failed;
  const active = gated ? Motion.moving : true;
  session.active = active;
  if (active || !gated) session.leftMs -= dt;
  if (active) session.movedMs = (session.movedMs || 0) + dt;

  const left = Math.max(0, session.leftMs / 1000);
  $('timer-display').textContent = fmt(left);
  document.body.dataset.sessionLeft = Math.round(left);

  if (gated) {
    // live signal, so the camera's reading is visible rather than a mystery
    const meter = $('motion-meter');
    if (meter) {
      const bar = Math.min(1, (Motion.lastRatio || 0) / ((Motion.threshold || 0.02) * 1.4));
      meter.style.width = (bar * 100).toFixed(0) + '%';
      meter.classList.toggle('hot', Motion.moving);
    }
    if (Motion.calibrating) {
      $('motion-text').textContent = 'Reading the room…';
      $('running-note').textContent = 'Stand still for a moment while the camera learns what still looks like.';
    } else {
      $('motion-text').textContent = Motion.moving ? 'Moving' : 'Still';
      $('running-note').textContent = Motion.moving
        ? 'Moving — the clock is running.'
        : 'Paused — start moving and the clock runs again.';
    }
  }

  if (session.leftMs <= 0) { completeSession(); return; }
  session.raf = requestAnimationFrame(sessionElapsed);
}

async function beginSession() {
  if (starting || session) return;
  starting = true;
  const btn = $('btn-start');
  btn.disabled = true;

  try {
    const c = compute();
    if (!state.startDate) { state.startDate = localDayKey(); saveState(); }
    const s = sessionFor(c.day);
    session = {
      leftMs: s.total * 1000,
      sub: s.moves.length === 1 ? 'one move · repeat until the timer ends'
        : s.moves.length + ' moves · cycle through the list',
      moves: s.moves,
      useMotion: !!state.settings.camera,
      lastTick: performance.now(),
      gated: null
    };

    startMusicNow();
    renderToday();
    session.raf = requestAnimationFrame(sessionElapsed);

    if (session.useMotion) {
      const ok = await Motion.start();
      if (!session) { Motion.stop(); return; }
      if (ok) {
        $('motion-row').classList.remove('hidden');
        Motion.onState = (moving) => {
          $('motion-dot').classList.toggle('moving', moving);
          if (moving) musicPlay(); else musicPause();
        };
        $('running-note').textContent = 'Move and the clock runs. Pause and it waits for you.';
      } else {
        session.useMotion = false;
        $('motion-row').classList.add('hidden');
        const why = {
          NotAllowedError: 'Camera permission was denied, so the music cannot follow your movement. Allow the camera for this site in your browser settings, then start again.',
          NotFoundError: 'No camera found on this device.',
          NotReadableError: 'The camera is being used by another app.',
          Unsupported: 'This browser cannot use the camera.',
          Error: 'The camera could not be started.'
        }[Motion.errorName] || 'The camera could not be started.';
        $('running-note').textContent = why + ' The clock runs on time for now.';
      }
    }
  } finally {
    starting = false;
    btn.disabled = false;
  }
}

function completeSession() {
  if (!session) return;
  if (session.raf) cancelAnimationFrame(session.raf);
  session = null;
  musicPause();
  Motion.stop();
  if (!todayDone()) { state.history.push(localDayKey()); saveState(); }
  $('motion-row').classList.add('hidden');
  $('yt-wrap').classList.add('hidden');
  renderToday();
  renderJourney();
}

/* ---------------- music start (must be inside the tap) ---------------- */
function startMusicNow() {
  const m = state.settings.music;
  if (!m || m.mode === 'none') { setMusicState('off'); return; }

  if (m.mode === 'builtin') {
    if (audio.src !== BUILTIN_SRC) audio.src = BUILTIN_SRC;
    audio.loop = true;
    audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
    fade(audio, 0.55, 600);
    return;
  }

  if (m.mode === 'file') {
    audio.loop = false;
    if (audio.src && audio.src !== BUILTIN_SRC) {
      audio.currentTime = 0;
      audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
      fade(audio, 1, 400);
    } else if (m.hasFile) {
      loadFile().then((blob) => {
        if (!blob) { setMusicState('noaudio'); return; }
        audio.src = URL.createObjectURL(blob);
        audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
        fade(audio, 1, 400);
      });
    } else {
      setMusicState('nofile');
      audio.src = BUILTIN_SRC;
      audio.loop = true;
      audio.play().then(() => setMusicState('fallback')).catch(() => {});
      fade(audio, 0.55, 600);
    }
    return;
  }

  if (m.mode === 'link') {
    audio.loop = false;
    const link = m.link;
    const yt = ytIdFromUrl(link);
    if (yt) {
      $('yt-wrap').classList.remove('hidden');
      ensureYtDiv();
      pendingPlay = true;
      loadYT(yt, () => {
        if (!session) return;
        try { ytPlayer.unMute(); ytPlayer.setVolume(100); ytPlayer.playVideo(); } catch (e) {}
        setMusicState('playing');
        pendingPlay = false;
      });
      // if the player is slow to load, the built-in covers the gap
      setTimeout(() => {
        if (session && !ytReady) {
          audio.src = BUILTIN_SRC; audio.loop = true;
          audio.play().catch(() => {});
          fade(audio, 0.4, 600);
          setMusicState('fallback');
        }
      }, 2500);
    } else if (link) {
      if (audio.src !== link) audio.src = link;
      audio.play().then(() => setMusicState('playing')).catch(() => setMusicState('blocked'));
      fade(audio, 1, 400);
    } else {
      setMusicState('nolink');
    }
  }
}
let pendingPlay = false;

/* ---------------- render ---------------- */
function renderToday() {
  const c = compute();
  $('day-pill').textContent = 'Day ' + c.day;

  const idle = $('today-idle'), running = $('today-running'), complete = $('today-complete');
  if (c.done) {
    idle.classList.add('hidden'); running.classList.add('hidden'); complete.classList.remove('hidden');
    return;
  }
  complete.classList.add('hidden');

  if (session) {
    idle.classList.add('hidden'); running.classList.remove('hidden');
    $('running-sub').textContent = session.sub;
    $('running-list').innerHTML = session.moves.map(m =>
      `<li><span class="name">${m.name}</span><span class="t">${targetText(m)}</span></li>`).join('');
    return;
  }

  idle.classList.remove('hidden'); running.classList.add('hidden');

  const s = sessionFor(c.day);
  $('session-time').textContent = fmt(s.total);
  $('session-sub').textContent = s.moves.length === 1
    ? 'one move · repeat until the timer ends'
    : s.moves.length + ' moves · cycle through the list';
  $('move-list').innerHTML = s.moves.map((m, i) =>
    `<li><span class="name">${m.name}</span><span class="t">${targetText(m)}</span><button class="swap" data-slot="${i}">swap</button></li>`).join('');
  $('move-list').querySelectorAll('.swap').forEach(b =>
    b.addEventListener('click', () => swapSlot(Number(b.dataset.slot))));

  $('today-note').textContent = c.day === 1
    ? 'One minute. That is the whole job today.'
    : (c.day <= 14 ? 'Small on purpose. You are building the habit, not the workout.'
      : 'Tap Done when the timer ends.');
  setMusicState(window.__musicState === 'playing' ? 'playing' : 'off');
}

function swapSlot(slot) {
  const slots = state.settings.slots;
  const used = new Set(slots);
  const idx = MOVES.findIndex(m => m.id === slots[slot]);
  for (let k = 1; k <= MOVES.length; k++) {
    const cand = MOVES[(idx + k) % MOVES.length];
    if (!used.has(cand.id)) { slots[slot] = cand.id; break; }
  }
  saveState();
  renderToday();
}

function renderJourney() {
  const c = compute();
  $('scene').innerHTML = journeySVG(c.done ? DAYS : c.marker);
  $('step-line').textContent = 'Step ' + c.marker + ' of ' + DAYS;
  const up = Math.min(DAYS, c.marker + 1);
  const down = Math.max(0, c.marker - 1);
  $('forecast').innerHTML = `Finish today → <span class="up">Step ${up}</span> &nbsp;·&nbsp; Skip → <span class="down">Step ${down}</span>`;
  $('stat-done').textContent = c.comp;
  $('stat-missed').textContent = c.missed;
  $('stat-day').textContent = c.day;
}

/* ---------------- settings ---------------- */
function describeLink(u) {
  if (ytIdFromUrl(u)) return 'YouTube — you may need to tap play inside the video once it appears.';
  if (isDirectAudio(u)) return 'Direct audio — starts and stops with your motion.';
  if (isSpotify(u)) return 'Spotify embeds cannot be controlled by an app. Upload a file or use YouTube instead.';
  return 'Will try to play as audio.';
}
function renderSettings() {
  const m = state.settings.music;
  document.querySelectorAll('.seg').forEach(b => b.classList.toggle('active', b.dataset.mode === m.mode));
  $('file-row').classList.toggle('hidden', m.mode !== 'file');
  $('link-row').classList.toggle('hidden', m.mode !== 'link');
  $('link-input').value = m.link || '';
  $('camera-toggle').checked = !!state.settings.camera;
  $('reminder-time').value = state.settings.reminder || '';
  $('file-status').textContent = m.hasFile
    ? 'Your file is loaded.'
    : 'Choose any audio file — .mp3 and .m4a are the most reliable. Files from Apple Music are locked and cannot be used.';
  $('link-status').textContent = m.link ? describeLink(m.link) : 'A YouTube link or a direct audio URL (.mp3, .m4a, .ogg).';
  $('music-status').textContent = {
    builtin: 'A soft 64-second pad, looping. Works offline, no setup.',
    none: 'No music.',
    file: 'Your own track.',
    link: 'Streamed from the link you saved.'
  }[m.mode] || '';
  // warn early if the stored link is not a supported URL
  const warn = $('link-warn');
  if (warn) {
    if (m.mode === 'link' && m.link && !ytIdFromUrl(m.link) && !isDirectAudio(m.link) && !isSpotify(m.link)) {
      warn.textContent = 'That does not look like a YouTube or audio file link.';
      warn.classList.remove('hidden');
    } else warn.classList.add('hidden');
  }
}

function exportBackup() {
  const payload = JSON.stringify({ v: 3, startDate: state.startDate, history: state.history, settings: state.settings });
  const code = btoa(unescape(encodeURIComponent(payload)));
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code)
      .then(() => { $('backup-status').textContent = 'Backup code copied.'; })
      .catch(() => { $('backup-status').textContent = 'Copy this: ' + code.slice(0, 100) + '…'; });
  } else { $('backup-status').textContent = 'Copy this: ' + code; }
}
function importBackup() {
  const code = prompt('Paste your backup code:');
  if (!code) return;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (d.history) state.history = d.history;
    if (d.startDate) state.startDate = d.startDate;
    if (d.settings) state.settings = { ...state.settings, ...d.settings };
    saveState();
    renderToday(); renderJourney(); renderSettings();
    $('backup-status').textContent = 'Progress restored.';
  } catch (e) { $('backup-status').textContent = 'That code did not work.'; }
}

/* ---------------- nav ---------------- */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
  if (name === 'journey') renderJourney();
  if (name === 'today') renderToday();
}

/* ---------------- init ---------------- */
function init() {
  loadState();

  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.screen)));

  $('btn-start').addEventListener('click', () => beginSession());
  $('btn-done').addEventListener('click', completeSession);

  document.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => {
    state.settings.music.mode = b.dataset.mode;
    saveState(); renderSettings();
  }));

  $('file-input').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      audio.loop = false;
      audio.src = URL.createObjectURL(f);
      state.settings.music.mode = 'file';
      state.settings.music.hasFile = true;
      saveState(); renderSettings();
      $('file-status').textContent = 'Loaded: ' + f.name + ' (' + Math.round(f.size / 1048576 * 10) / 10 + ' MB).';
      // verify it can actually be decoded
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = audio.src;
      probe.addEventListener('loadedmetadata', () => {
        $('file-status').textContent = 'Loaded: ' + f.name + ' — ' + fmt(probe.duration) + '.';
      });
      probe.addEventListener('error', () => {
        $('file-status').textContent = 'This file would not play (' + f.name + '). Try converting it to .mp3 or .m4a.';
      });
      saveFile(f).then(() => {
        state.settings.music.hasFile = true; saveState();
      }).catch(() => {
        state.settings.music.hasFile = false; saveState();
        $('file-status').textContent = 'Loaded: ' + f.name + ' — but it was too large to save for next time.';
      });
    } catch (err) {
      $('file-status').textContent = 'That file could not be read.';
    }
  });

  $('btn-link-save').addEventListener('click', () => {
    const v = $('link-input').value.trim();
    if (!v) return;
    state.settings.music.link = v;
    saveState(); renderSettings();
  });

  $('camera-toggle').addEventListener('change', (e) => { state.settings.camera = e.target.checked; saveState(); });
  $('reminder-time').addEventListener('change', (e) => { state.settings.reminder = e.target.value; saveState(); });

  $('btn-reminder-enable').addEventListener('click', async () => {
    if (!('Notification' in window)) { $('reminder-status').textContent = 'Notifications are not supported here.'; return; }
    const perm = await Notification.requestPermission();
    $('reminder-status').textContent = perm === 'granted'
      ? 'On. Daily nudge at ' + (state.settings.reminder || 'your set time') + '.'
      : 'Notifications were blocked — you can still open the app daily.';
  });

  $('btn-export').addEventListener('click', exportBackup);
  $('btn-import').addEventListener('click', importBackup);
  $('btn-erase').addEventListener('click', () => {
    if (!confirm('Erase all progress and start fresh?')) return;
    state.history = []; state.startDate = null; saveState();
    renderToday(); renderJourney(); renderSettings();
  });

  loadFile().then((blob) => { if (blob && state.settings.music.hasFile) audio.src = URL.createObjectURL(blob); });

  let last = localDayKey();
  setInterval(() => {
    const today = localDayKey();
    if (today !== last) { last = today; renderToday(); renderJourney(); }
    if (state.settings.reminder && 'Notification' in window && Notification.permission === 'granted') {
      const now = new Date();
      if (pad(now.getHours()) + ':' + pad(now.getMinutes()) === state.settings.reminder && !todayDone()) {
        try { new Notification('Stride', { body: 'Today affects tomorrow. One minute is enough.' }); } catch (e) {}
      }
    }
  }, 15000);

  renderToday();
  renderJourney();
  renderSettings();
}

document.addEventListener('DOMContentLoaded', init);