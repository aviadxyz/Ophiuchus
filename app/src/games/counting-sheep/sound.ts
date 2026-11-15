/**
 * Web Audio API synthesizer for gentle cartoon space sheep sounds.
 * Synthesizes a soothing, soft "baa-a-a" bleat using oscillators and formant filtering.
 */

class SheepSoundSynthesizer {
  private ctx: AudioContext | null = null
  private isMuted = false

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx = window.AudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
    return this.ctx
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted
    return this.isMuted
  }

  /**
   * Plays a soft cartoon space sheep bleat ("baa-a-a").
   */
  public playBleat(): void {
    if (this.isMuted) return
    const ctx = this.getContext()
    if (!ctx) return

    const now = ctx.currentTime
    const duration = 0.55

    // Main carrier oscillator (nasal saw wave)
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(245, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + duration)

    // Formant vocal filter for "baa" vowel sound
    const formant = ctx.createBiquadFilter()
    formant.type = 'bandpass'
    formant.frequency.setValueAtTime(920, now)
    formant.Q.setValueAtTime(3.2, now)

    // Tremolo LFO for the "a-a-a" stutter flutter
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.setValueAtTime(7.2, now)

    const lfoGain = ctx.createGain()
    lfoGain.gain.setValueAtTime(0.3, now)

    // Modulate tremolo depth
    const tremoloAmp = ctx.createGain()
    tremoloAmp.gain.setValueAtTime(0.7, now)

    // Master volume envelope for gentle restful sound
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.001, now)
    masterGain.gain.linearRampToValueAtTime(0.12, now + 0.06)
    masterGain.gain.setValueAtTime(0.12, now + 0.32)
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    // Secondary sub-oscillator for warmth
    const subOsc = ctx.createOscillator()
    subOsc.type = 'triangle'
    subOsc.frequency.setValueAtTime(122.5, now)
    const subGain = ctx.createGain()
    subGain.gain.setValueAtTime(0.06, now)

    // Audio routing
    lfo.connect(lfoGain.gain)
    osc.connect(formant)
    formant.connect(tremoloAmp)
    subOsc.connect(subGain)
    subGain.connect(tremoloAmp)

    tremoloAmp.connect(masterGain)
    masterGain.connect(ctx.destination)

    // Trigger start & stops
    osc.start(now)
    subOsc.start(now)
    lfo.start(now)

    osc.stop(now + duration)
    subOsc.stop(now + duration)
    lfo.stop(now + duration)
  }

  public pause(): void {
    if (this.ctx && this.ctx.state === 'running') {
      void this.ctx.suspend()
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close()
      this.ctx = null
    }
  }
}

export const sheepAudio = new SheepSoundSynthesizer()
