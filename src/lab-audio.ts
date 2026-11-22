/**
 * lab-audio.ts — Synthesised Web Audio Effects for Launch Lab
 *
 * Owns the main scene's AudioContext, gesture-unlocked resume lifecycle,
 * cannon boom, barrel-modification clang, looping rocket engine rumble,
 * burnout whine, and no-liftoff sad trombone.
 */

export class LabAudio {
  private audioCtx: AudioContext | null = null;
  private engineNodes: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private readonly canPlay: () => boolean;
  private readonly onUnlockError?: () => void;

  constructor(canPlay: () => boolean, onUnlockError?: () => void) {
    this.canPlay = canPlay;
    this.onUnlockError = onUnlockError;
  }

  get isRunning(): boolean {
    return this.audioCtx?.state === 'running';
  }

  private ensureContext(): AudioContext {
    if (!this.audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext!;
      this.audioCtx = new Ctor();
    }
    return this.audioCtx;
  }

  /** Unlock on the user's gesture before async flight recording can lose browser activation. */
  async unlock(): Promise<boolean> {
    if (!this.canPlay()) return false;
    try {
      const ctx = this.ensureContext();
      await ctx.resume();
      if (!this.canPlay()) return false;
      if (ctx.state !== 'running') throw new Error('Audio is suspended');
      return true;
    } catch {
      this.onUnlockError?.();
      return false;
    }
  }

  playCannonBoom(): void {
    if (!this.canPlay()) return;
    try {
      const ctx = this.ensureContext();
      const duration = 0.3;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * duration), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sr * 0.05));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      /* silent fail */
    }
  }

  playClangSound(): void {
    if (!this.canPlay()) return;
    try {
      const ctx = this.ensureContext();
      const duration = 0.09;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * duration), sr);
      const data = buf.getChannelData(0);
      const freq = 1200 + Math.random() * 500;
      for (let i = 0; i < data.length; i++) {
        const tm = i / sr;
        data[i] =
          (Math.sin(tm * freq * Math.PI * 2) * 0.5 + (Math.random() * 2 - 1) * 0.25) *
          Math.exp(-i / (sr * 0.02));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 800;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      /* silent fail */
    }
  }

  startEngineLoop(): void {
    if (!this.canPlay()) return;
    try {
      const ctx = this.ensureContext();
      this.stopEngineLoop();

      const sr = ctx.sampleRate;
      const loopDur = 0.5;
      const buf = ctx.createBuffer(1, Math.floor(sr * loopDur), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const noise = Math.random() * 2 - 1;
        const rumble = Math.sin(t * 60 * Math.PI * 2) * 0.3;
        data[i] = (noise * 0.4 + rumble) * 0.5;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 850;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();

      this.engineNodes = { source: src, gain };
    } catch {
      /* silent fail */
    }
  }

  stopEngineLoop(): void {
    if (this.engineNodes && this.audioCtx) {
      try {
        this.engineNodes.gain.gain.setValueAtTime(this.engineNodes.gain.gain.value, this.audioCtx.currentTime);
        this.engineNodes.gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.3);
        const src = this.engineNodes.source;
        setTimeout(() => {
          try {
            src.stop();
          } catch {
            /* already stopped */
          }
        }, 400);
      } catch {
        /* silent fail */
      }
      this.engineNodes = null;
    }
  }

  syncEngine(active: boolean, output: number): void {
    const shouldPlay = active && this.canPlay();
    if (shouldPlay && !this.engineNodes) this.startEngineLoop();
    else if (!shouldPlay) this.stopEngineLoop();
    if (shouldPlay && this.engineNodes && this.audioCtx) {
      this.engineNodes.gain.gain.setTargetAtTime(0.12 * output, this.audioCtx.currentTime, 0.04);
    }
  }

  playBurnoutSound(): void {
    if (!this.canPlay()) return;
    try {
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const duration = 0.4;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, Math.floor(sr * duration), sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        const freq = 200 * Math.exp(-t * 3);
        data[i] = Math.sin(t * freq * Math.PI * 2) * 0.3 * Math.exp(-t / 0.15);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      /* silent fail */
    }
  }

  playSadTrombone(): void {
    if (!this.canPlay()) return;
    try {
      const ctx = this.ensureContext();
      const notes = [392, 370, 349, 294];
      const durations = [0.25, 0.25, 0.25, 0.6];
      let startOffset = 0;

      for (let n = 0; n < notes.length; n++) {
        const freq = notes[n];
        const dur = durations[n];
        const offset = startOffset;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + dur * 0.95);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + offset);
        osc.stop(ctx.currentTime + offset + dur);
        startOffset += dur;
      }
    } catch {
      /* silent fail */
    }
  }
}
