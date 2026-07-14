/* Lullbrook — Web Audio engine.
   Buffers are looped with AudioBufferSourceNode (sample-accurate), and every
   decoded file gets its tail crossfaded into its head so the loop point is
   inaudible even for sources that weren't cut cleanly. */

const FADE_TOGGLE = 0.35;   // seconds, on/off ramp per sound
const LOOP_XFADE = 1.2;     // seconds blended across the loop seam

class LullbrookAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.masterVolume = 0.8;
    this.playing = true;          // master intent (play vs paused)
    this.channels = new Map();    // id -> {gain, source, buffer, volume, state}
    this.buffers = new Map();     // id -> AudioBuffer (decoded + seam-fixed)
    this.pending = new Map();     // id -> Promise<AudioBuffer>
  }

  ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.playing ? this.masterVolume : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /* Crossfade the last LOOP_XFADE seconds into the first, then trim the tail.
     Equal-power curves keep perceived loudness constant across the seam. */
  makeSeamless(buffer) {
    const ctx = this.ensureContext();
    const fade = Math.min(LOOP_XFADE, buffer.duration / 4);
    const f = Math.floor(fade * buffer.sampleRate);
    const newLen = buffer.length - f;
    if (f < 64 || newLen < buffer.sampleRate) return buffer;
    const out = ctx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = out.getChannelData(ch);
      dst.set(src.subarray(0, newLen));
      for (let i = 0; i < f; i++) {
        const t = i / f;
        const inGain = Math.sin(t * Math.PI / 2);
        const outGain = Math.cos(t * Math.PI / 2);
        dst[i] = src[i] * inGain + src[newLen + i] * outGain;
      }
    }
    return out;
  }

  async load(sound) {
    if (this.buffers.has(sound.id)) return this.buffers.get(sound.id);
    if (this.pending.has(sound.id)) return this.pending.get(sound.id);
    const p = (async () => {
      const res = await fetch(sound.file);
      if (!res.ok) throw new Error(`fetch ${sound.file}: ${res.status}`);
      const raw = await res.arrayBuffer();
      const decoded = await this.ensureContext().decodeAudioData(raw);
      const buf = this.makeSeamless(decoded);
      this.buffers.set(sound.id, buf);
      this.pending.delete(sound.id);
      return buf;
    })();
    this.pending.set(sound.id, p);
    return p;
  }

  channel(id) {
    let c = this.channels.get(id);
    if (!c) {
      const ctx = this.ensureContext();
      c = { gain: ctx.createGain(), source: null, volume: 0.5, state: 'off' };
      c.gain.gain.value = 0;
      c.gain.connect(this.master);
      this.channels.set(id, c);
    }
    return c;
  }

  async start(sound, volume) {
    const ctx = this.ensureContext();
    const c = this.channel(sound.id);
    if (volume != null) c.volume = volume;
    c.state = 'loading';
    const buf = await this.load(sound);
    if (c.state !== 'loading') return; // toggled off while decoding
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(c.gain);
    // start at a random phase so re-layered sounds never align the same way
    src.start(0, Math.random() * buf.duration);
    c.source = src;
    c.state = 'on';
    const g = c.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(c.volume, ctx.currentTime + FADE_TOGGLE);
  }

  stop(id) {
    const c = this.channels.get(id);
    if (!c) return;
    c.state = 'off';
    if (!c.source) return;
    const ctx = this.ctx;
    const src = c.source;
    c.source = null;
    const g = c.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(0, ctx.currentTime + FADE_TOGGLE);
    setTimeout(() => { try { src.stop(); } catch {} }, FADE_TOGGLE * 1000 + 80);
  }

  setVolume(id, v) {
    const c = this.channel(id);
    c.volume = v;
    if (c.state === 'on' && this.ctx) {
      const g = c.gain.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }
  }

  setMaster(v, ramp = 0.08) {
    this.masterVolume = v;
    if (this.master && this.playing) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setTargetAtTime(v, this.ctx.currentTime, ramp);
    }
  }

  /* Master pause keeps sources alive but fades the master bus, then suspends
     the context so the mix resumes exactly where it left off. */
  async pause(fadeSec = 0.4) {
    if (!this.ctx || !this.playing) { this.playing = false; return; }
    this.playing = false;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0, this.ctx.currentTime + fadeSec);
    await new Promise(r => setTimeout(r, fadeSec * 1000 + 60));
    if (!this.playing && this.ctx.state === 'running') await this.ctx.suspend();
  }

  async resume() {
    this.playing = true;
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(this.masterVolume, this.ctx.currentTime + 0.4);
  }

  /* Long fade used by the sleep timer. */
  fadeOutAndPause(seconds) {
    if (!this.ctx || !this.playing) return;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setValueAtTime(g.value, this.ctx.currentTime);
    g.linearRampToValueAtTime(0.0001, this.ctx.currentTime + seconds);
    setTimeout(() => { if (this.playing) this.pause(0.1); }, seconds * 1000);
  }

  cancelFade() {
    if (!this.ctx) return;
    const g = this.master.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.setTargetAtTime(this.playing ? this.masterVolume : 0, this.ctx.currentTime, 0.1);
  }
}

export const engine = new LullbrookAudio();
