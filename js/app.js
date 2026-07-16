import { CATEGORIES, SOUNDS, SOUND_MAP, DEFAULT_PRESETS } from './data.js';
import { icon } from './icons.js';
import { engine } from './audio.js';

const $ = sel => document.querySelector(sel);
/* ---------------- analytics ---------------- */
function track(name, params = {}) {
  try { window.gtag?.('event', name, params); } catch {}
}
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const state = {
  mix: new Map(),          // id -> volume, the active layers
  master: store.get('lullbrook.master', 0.8),
  playing: false,
  category: 'all',
  timerEnd: null,
  timerTick: null,
  fadeArmed: false,
};
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------- rendering ---------------- */

function renderSidebar() {
  const counts = { all: SOUNDS.length };
  for (const s of SOUNDS) counts[s.cat] = (counts[s.cat] || 0) + 1;
  const items = [{ id: 'all', name: 'All Sounds', icon: 'ui-all' }, ...CATEGORIES];
  $('#cats').innerHTML = items.map(c => `
    <button class="cat${c.id === state.category ? ' is-current' : ''}" data-cat="${c.id}" aria-pressed="${c.id === state.category}" aria-label="${c.name}">
      ${icon(c.icon, 'icon cat-icon')}<span>${c.name}</span><em>${counts[c.id] || 0}</em>
    </button>`).join('');
}

function renderGrid() {
  $('#grid').innerHTML = SOUNDS.map(s => `
    <div class="card" data-id="${s.id}" data-cat="${s.cat}">
      <button class="card-toggle" aria-pressed="false" aria-label="${s.name}">
        ${icon(s.icon, 'icon card-icon')}
        <span class="card-name">${s.name}</span>
      </button>
      <input class="card-vol" type="range" min="0" max="1" step="0.01" value="0.5"
             aria-label="${s.name} volume" tabindex="-1">
    </div>`).join('');
}

function applyFilter() {
  document.querySelectorAll('.card').forEach(el => {
    el.hidden = state.category !== 'all' && el.dataset.cat !== state.category;
  });
  document.querySelectorAll('.cat').forEach(el => {
    const cur = el.dataset.cat === state.category;
    el.classList.toggle('is-current', cur);
    el.setAttribute('aria-pressed', cur);
  });
  $('#catTitle').textContent = state.category === 'all'
    ? 'All Sounds'
    : CATEGORIES.find(c => c.id === state.category).name;
}

function cardEl(id) { return document.querySelector(`.card[data-id="${id}"]`); }

function syncCard(id) {
  const el = cardEl(id);
  if (!el) return;
  const on = state.mix.has(id);
  el.classList.toggle('is-on', on);
  el.querySelector('.card-toggle').setAttribute('aria-pressed', on);
  const vol = el.querySelector('.card-vol');
  vol.tabIndex = on ? 0 : -1;
  if (on) vol.value = state.mix.get(id);
}

function syncBottomBar() {
  const n = state.mix.size;
  $('#playBtn').innerHTML = icon(state.playing && n ? 'ui-pause' : 'ui-play', 'icon');
  $('#playBtn').setAttribute('aria-label', state.playing && n ? 'Pause' : 'Play');
  const label = $('#npLabel');
  if (!n) label.textContent = 'Quiet · tap a sound to begin';
  else label.textContent = `${n} layer${n > 1 ? 's' : ''}${state.playing ? '' : ' · paused'}`;
  $('#clearBtn').disabled = !n;
  document.title = n && state.playing ? `Lullbrook · ${n} layer${n > 1 ? 's' : ''}` : 'Lullbrook · ambient sound library';
  drawViz();
}

/* ---------------- mixer actions ---------------- */

function persistMix() {
  store.set('lullbrook.mix', Object.fromEntries(state.mix));
}

function toggleSound(id) {
  const sound = SOUND_MAP.get(id);
  if (!sound) return;
  if (state.mix.has(id)) {
    state.mix.delete(id);
    engine.stop(id);
    cardEl(id)?.classList.remove('is-loading');
  } else {track('sound_play', { sound_id: id, sound_name: sound.name, mix_size: state.mix.size + 1 });
    const vol = store.get('lullbrook.vol', {})[id] ?? 0.5;
    state.mix.set(id, vol);
    if (!state.playing) setPlaying(true);
    const el = cardEl(id);
    el?.classList.add('is-loading');
    engine.start(sound, vol)
      .then(() => el?.classList.remove('is-loading'))
      .catch(err => {
        console.error('Failed to start sound', id, err);
        el?.classList.remove('is-loading');
        state.mix.delete(id);
        syncCard(id); syncBottomBar();
      });
  }
  persistMix();
  syncCard(id);
  syncBottomBar();
}

function setSoundVolume(id, v) {
  if (!state.mix.has(id)) return;
  state.mix.set(id, v);
  engine.setVolume(id, v);
  const vols = store.get('lullbrook.vol', {}); vols[id] = v; store.set('lullbrook.vol', vols);
  persistMix();
  drawViz();
}

function setPlaying(on) {
  state.playing = on;
  if (on) {
    engine.resume();
    // (re)start any layers that aren't running yet (e.g. restored session)
    for (const [id, vol] of state.mix) {
      const c = engine.channels.get(id);
      if (!c || c.state === 'off') {
        cardEl(id)?.classList.add('is-loading');
        engine.start(SOUND_MAP.get(id), vol)
          .then(() => cardEl(id)?.classList.remove('is-loading'))
          .catch(() => cardEl(id)?.classList.remove('is-loading'));
      }
    }
  } else {
    engine.pause();
  }
  syncBottomBar();
}

function clearAll() {
  for (const id of [...state.mix.keys()]) {
    engine.stop(id);
    state.mix.delete(id);
    syncCard(id);
  }
  persistMix();
  syncBottomBar();
}

function applyMix(mix) {
  track('preset_apply', { mix_size: Object.keys(mix).length });
  clearAll();
  for (const [id, vol] of Object.entries(mix)) {
    if (!SOUND_MAP.has(id)) continue;
    state.mix.set(id, vol);
    engine.start(SOUND_MAP.get(id), vol).catch(() => {});
    syncCard(id);
  }
  if (!state.playing) setPlaying(true);
  persistMix();
  syncBottomBar();
}

/* ---------------- sleep timer ---------------- */

const TIMER_FADE = 45; // seconds of gentle fade before stopping

function setTimer(minutes) {
  clearInterval(state.timerTick);
  state.timerTick = null;
  state.timerEnd = null;
  state.fadeArmed = false;
  engine.cancelFade();
  $('#timerBtn').classList.toggle('is-active', !!minutes);
  if (!minutes) { $('#timerLabel').textContent = ''; return; }
    track('timer_set', { minutes });  
  state.timerEnd = Date.now() + minutes * 60000;
  const tick = () => {
    const left = Math.max(0, state.timerEnd - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
    $('#timerLabel').textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (!state.fadeArmed && left <= TIMER_FADE * 1000 && state.playing) {
      state.fadeArmed = true;
      engine.fadeOutAndPause(left / 1000);
    }
    
    if (left <= 0) {
      clearInterval(state.timerTick);
      state.timerTick = null; state.timerEnd = null; state.fadeArmed = false;
      state.playing = false;
      $('#timerLabel').textContent = '';
      $('#timerBtn').classList.remove('is-active');
      syncBottomBar();
    }
  };
  tick();
  state.timerTick = setInterval(tick, 1000);
}

/* ---------------- presets ---------------- */

function userPresets() { return store.get('lullbrook.presets', []); }

function renderPresets() {
  const mine = userPresets();
  const row = (p, del) => `
    <div class="preset-row">
      <button class="preset-apply" data-mix='${JSON.stringify(p.mix).replace(/'/g, '&#39;')}'>
        <strong>${p.name}</strong><span>${Object.keys(p.mix).length} sounds</span>
      </button>
      ${del ? `<button class="preset-del" data-name="${p.name}" aria-label="Delete ${p.name}">${icon('ui-clear', 'icon sm')}</button>` : ''}
    </div>`;
  $('#presetList').innerHTML =
    DEFAULT_PRESETS.map(p => row(p, false)).join('') +
    (mine.length ? `<div class="preset-sep">Yours</div>` + mine.map(p => row(p, true)).join('') : '');
  $('#presetSave').disabled = !state.mix.size;
}

function savePreset(name) {
  if (!name || !state.mix.size) return;
  const mine = userPresets().filter(p => p.name !== name);
  mine.push({ name, mix: Object.fromEntries(state.mix) });
    track('preset_save', { mix_size: state.mix.size }); 
  store.set('lullbrook.presets', mine);
  renderPresets();
}

/* ---------------- popovers ---------------- */

function closePopovers() {
  document.querySelectorAll('.popover').forEach(p => { p.hidden = true; });
  document.querySelectorAll('[data-popover]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

function togglePopover(btn) {
  const pop = $('#' + btn.dataset.popover);
  const show = pop.hidden;
  closePopovers();
  if (show) {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (btn.dataset.popover === 'presetPop') renderPresets();
  }
}

/* ---------------- viz: dusk waves ---------------- */

const viz = $('#viz');
const vctx = viz.getContext('2d');
let vizRaf = null, vizT = 0;

function vizLayers() {
  return [...state.mix.entries()].map(([id, vol], i) => ({ id, vol, i }));
}

function drawViz() {
  const layers = vizLayers();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = viz.clientWidth, h = viz.clientHeight;
  if (viz.width !== w * dpr) { viz.width = w * dpr; viz.height = h * dpr; }
  vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vctx.clearRect(0, 0, w, h);
  const mid = h / 2;
  if (!layers.length) {
    vctx.strokeStyle = 'rgba(232, 196, 160, 0.18)';
    vctx.lineWidth = 1;
    vctx.beginPath(); vctx.moveTo(0, mid); vctx.lineTo(w, mid); vctx.stroke();
  } else {
    const active = state.playing ? 1 : 0.35;
    layers.forEach(({ vol, i }) => {
      const amp = Math.max(1.5, vol * engine.masterVolume * (h * 0.42) * active);
      const freq = 1.6 + (i % 5) * 0.7;
      const phase = vizT * (0.5 + (i % 3) * 0.25) + i * 1.7;
      const hue = 18 + (i * 23) % 46;             // ember ambers through dusty rose
      vctx.strokeStyle = `hsla(${hue}, 52%, 68%, 0.55)`;
      vctx.lineWidth = 1.4;
      vctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const y = mid + Math.sin((x / w) * Math.PI * 2 * freq + phase) * amp
                      * Math.sin((x / w) * Math.PI); // taper the ends
        x === 0 ? vctx.moveTo(x, y) : vctx.lineTo(x, y);
      }
      vctx.stroke();
    });
  }
  const animate = layers.length && state.playing && !reducedMotion.matches;
  if (animate && !vizRaf) {
    const loop = () => {
      vizT += 0.02;
      vizRaf = null;
      drawViz();
    };
    vizRaf = requestAnimationFrame(loop);
  }
  if (!animate && vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = null; }
}

/* ---------------- events ---------------- */

function bindEvents() {
  $('#cats').addEventListener('click', e => {
    const btn = e.target.closest('.cat');
    if (!btn) return;
    state.category = btn.dataset.cat;
    applyFilter();
  });

  $('#grid').addEventListener('click', e => {
    const toggle = e.target.closest('.card-toggle');
    if (toggle) {
      toggleSound(toggle.closest('.card').dataset.id);
      // after a pointer tap, release focus so Space means play/pause;
      // keyboard activation (detail 0) keeps focus for further tabbing
      if (e.detail > 0) toggle.blur();
    }
  });
  $('#grid').addEventListener('input', e => {
    if (e.target.classList.contains('card-vol')) {
      setSoundVolume(e.target.closest('.card').dataset.id, parseFloat(e.target.value));
    }
  });

  $('#playBtn').addEventListener('click', () => {
    if (!state.mix.size) return;
    setPlaying(!state.playing);
  });
  $('#masterVol').addEventListener('input', e => {
    state.master = parseFloat(e.target.value);
    engine.setMaster(state.master);
    store.set('lullbrook.master', state.master);
    drawViz();
  });
  $('#clearBtn').addEventListener('click', clearAll);

  document.querySelectorAll('[data-popover]').forEach(btn =>
    btn.addEventListener('click', () => togglePopover(btn)));
  document.addEventListener('click', e => {
    if (!e.target.closest('.popover') && !e.target.closest('[data-popover]')) closePopovers();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePopovers();
    if (e.code === 'Space' && !e.target.matches('input, button, textarea, select, [contenteditable]')) {
      e.preventDefault();
      if (state.mix.size) setPlaying(!state.playing);
    }
  });

  $('#timerPop').addEventListener('click', e => {
    const b = e.target.closest('[data-minutes]');
    if (!b) return;
    setTimer(parseInt(b.dataset.minutes, 10) || 0);
    closePopovers();
  });

  $('#presetList').addEventListener('click', e => {
    const apply = e.target.closest('.preset-apply');
    if (apply) { applyMix(JSON.parse(apply.dataset.mix)); closePopovers(); return; }
    const del = e.target.closest('.preset-del');
    if (del) {
      store.set('lullbrook.presets', userPresets().filter(p => p.name !== del.dataset.name));
      renderPresets();
    }
  });
  $('#presetForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#presetName');
    savePreset(input.value.trim());
    input.value = '';
  });

  reducedMotion.addEventListener?.('change', drawViz);
  window.addEventListener('resize', drawViz);
}

/* ---------------- boot ---------------- */

function restore() {
  const saved = store.get('lullbrook.mix', null);
  if (saved && typeof saved === 'object') {
    for (const [id, vol] of Object.entries(saved)) {
      if (SOUND_MAP.has(id)) { state.mix.set(id, vol); syncCard(id); }
    }
  }
  $('#masterVol').value = state.master;
  engine.masterVolume = state.master;
  engine.playing = false; // wait for a user gesture before making sound
}

renderSidebar();
renderGrid();
applyFilter();
bindEvents();
restore();
syncBottomBar();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
