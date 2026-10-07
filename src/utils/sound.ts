// Web Audio API sound synthesizer (no external audio files required, optional & toggleable)

class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = false; // Optional by default per specification Section 33

  constructor() {
    const saved = localStorage.getItem('kahoot_sound_enabled');
    if (saved === 'true') {
      this.enabled = true;
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('kahoot_sound_enabled', String(this.enabled));
    if (this.enabled) {
      this.playTick();
    }
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', delaySec = 0, gainVal = 0.12) {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delaySec);

    gain.gain.setValueAtTime(gainVal, ctx.currentTime + delaySec);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delaySec + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delaySec);
    osc.stop(ctx.currentTime + delaySec + durationSec);
  }

  // Soru başlangıç sesi
  public playQuestionStart() {
    this.playTone(440, 0.12, 'triangle', 0);
    this.playTone(554.37, 0.12, 'triangle', 0.1);
    this.playTone(659.25, 0.25, 'triangle', 0.2);
  }

  // Son 5 saniye uyarısı
  public playTick() {
    this.playTone(880, 0.07, 'sine', 0, 0.08);
  }

  // Süre bitiş sesi
  public playTimeUp() {
    this.playTone(300, 0.25, 'sawtooth', 0, 0.12);
    this.playTone(220, 0.4, 'sawtooth', 0.2, 0.12);
  }

  // Doğru cevap sesi
  public playCorrect() {
    this.playTone(523.25, 0.12, 'sine', 0, 0.15);
    this.playTone(659.25, 0.12, 'sine', 0.1, 0.15);
    this.playTone(783.99, 0.3, 'sine', 0.2, 0.15);
  }

  // Yanlış cevap sesi
  public playWrong() {
    this.playTone(240, 0.2, 'sawtooth', 0, 0.12);
    this.playTone(180, 0.35, 'sawtooth', 0.18, 0.12);
  }

  // Kazanan sesi
  public playWinner() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'triangle', idx * 0.14, 0.16);
    });
  }
}

export const soundManager = new SoundManager();
