// Efectos de sonido sintetizados con WebAudio (sin assets externos).

export type SfxName = 'click' | 'deal' | 'pass' | 'win' | 'lose' | 'coin'

let ctx: AudioContext | null = null
let muted = false

export function setSfxMuted(value: boolean) {
  muted = value
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('domino-muted', value ? '1' : '0')
  }
}

export function loadSfxMuted(): boolean {
  if (typeof window === 'undefined') return false
  muted = window.localStorage.getItem('domino-muted') === '1'
  return muted
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOptions {
  freq: number
  duration: number
  type?: OscillatorType
  gain?: number
  delay?: number
  slideTo?: number
}

function tone({ freq, duration, type = 'sine', gain = 0.08, delay = 0, slideTo }: ToneOptions) {
  const audio = getCtx()
  if (!audio) return
  const t0 = audio.currentTime + delay
  const osc = audio.createOscillator()
  const vol = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration)
  vol.gain.setValueAtTime(0.0001, t0)
  vol.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  vol.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(vol).connect(audio.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

export function playSfx(name: SfxName) {
  if (muted) return
  switch (name) {
    case 'click': // ficha sobre la mesa
      tone({ freq: 180, duration: 0.09, type: 'triangle', gain: 0.12, slideTo: 90 })
      break
    case 'deal': // reparto
      tone({ freq: 320, duration: 0.06, type: 'triangle', gain: 0.06 })
      tone({ freq: 240, duration: 0.06, type: 'triangle', gain: 0.06, delay: 0.07 })
      break
    case 'pass':
      tone({ freq: 150, duration: 0.18, type: 'sawtooth', gain: 0.045, slideTo: 100 })
      break
    case 'coin':
      tone({ freq: 880, duration: 0.09, type: 'square', gain: 0.05 })
      tone({ freq: 1320, duration: 0.14, type: 'square', gain: 0.05, delay: 0.09 })
      break
    case 'win':
      tone({ freq: 523, duration: 0.14, type: 'triangle', gain: 0.09 })
      tone({ freq: 659, duration: 0.14, type: 'triangle', gain: 0.09, delay: 0.13 })
      tone({ freq: 784, duration: 0.14, type: 'triangle', gain: 0.09, delay: 0.26 })
      tone({ freq: 1046, duration: 0.3, type: 'triangle', gain: 0.1, delay: 0.39 })
      break
    case 'lose':
      tone({ freq: 330, duration: 0.2, type: 'sawtooth', gain: 0.06, slideTo: 250 })
      tone({ freq: 250, duration: 0.35, type: 'sawtooth', gain: 0.06, delay: 0.22, slideTo: 160 })
      break
  }
}
