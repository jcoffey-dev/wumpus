/**
 * A very small chiptune engine: pulse waves for voices, filtered white noise
 * for percussion, and a look-ahead scheduler so patterns stay in time even
 * when React is busy re-rendering.
 *
 * Shared with the lemonade stand, note for note -- same author, same licence,
 * and a synth is not the part of a game worth writing twice. What is not
 * shared is everything under "sfx" below: a cave needs wings, a fall and a
 * growl, and it needs a Teletype.
 */

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5,
  'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

/** "C#4" -> Hz. A4 = 440. */
export function noteToFreq(note: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(note)
  if (!m) return 0
  const semis = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12
  return 440 * Math.pow(2, (semis - 69) / 12)
}

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'saw' | 'noise'

export interface Track {
  wave: Wave
  gain: number
  /**
   * One entry per step. '.' rest, '=' sustain previous, otherwise a note.
   * Slashes stack notes into a chord: "F4/A4/C5". On a noise track the
   * letter picks the drum: K kick, S snare, C clap, H closed hat, O open hat.
   */
  notes: string[]
  /** Sweeping lowpass, the whole point of a funk bass. */
  filter?: { from: number; to: number; q?: number }
  /** Fraction of the note's length actually sounded; low values are stabs. */
  gate?: number
  /** Cents, for a fatter unison. */
  detune?: number
}

export interface Tune {
  bpm: number
  stepsPerBeat: number
  tracks: Track[]
  /** 0 is straight, ~0.15 is a light funk shuffle. Delays every other step. */
  swing?: number
}

/** Fourier series for a pulse wave of the given duty cycle. */
function pulseWave(ctx: AudioContext, duty: number, harmonics = 24): PeriodicWave {
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let n = 1; n <= harmonics; n++) {
    imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
}

/**
 * The dial-in, as a schedule rather than a number buried in the audio.
 *
 * The boot screen prints what is happening while it happens, so both have to
 * agree about when each stage starts -- and the only way to keep two clocks in
 * step is to have one clock. All values are seconds from the moment of DIAL.
 */
export const DIAL_UP = {
  /** 5551973. The last four are the year, which is the only joke in here. */
  number: [5, 5, 5, 1, 9, 7, 3],
  dialTone: 0.62,
  ringAt: 2.0,
  ring: 1.0,
  answerAt: 3.35,
  answer: 0.95,
  total: 5.5,
} as const

export class Synth {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicBus!: GainNode
  private sfxBus!: GainNode
  private waves: Partial<Record<Wave, PeriodicWave>> = {}
  private noiseBuffer!: AudioBuffer

  private tune: Tune | null = null
  private step = 0
  private nextStepTime = 0
  private timer: number | null = null

  musicOn = true
  sfxOn = true

  /** Must be called from a user gesture the first time. */
  ensure(): AudioContext {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(ctx.destination)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = 0.55
    this.musicBus.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.9
    this.sfxBus.connect(this.master)

    this.waves.pulse12 = pulseWave(ctx, 0.125)
    this.waves.pulse25 = pulseWave(ctx, 0.25)
    this.waves.pulse50 = pulseWave(ctx, 0.5)

    const len = Math.floor(ctx.sampleRate * 1.5)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    this.noiseBuffer = buf

    return ctx
  }

  setMusic(on: boolean) {
    this.musicOn = on
    if (!this.ctx) return
    this.musicBus.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05)
  }

  setSfx(on: boolean) {
    this.sfxOn = on
    if (!this.ctx) return
    this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02)
  }

  // ---------------------------------------------------------------- voices

  private voice(
    dest: AudioNode,
    wave: Wave,
    freq: number,
    at: number,
    dur: number,
    gain: number,
    opts: { filter?: Track['filter']; detune?: number } = {},
  ) {
    const ctx = this.ensure()
    const osc = ctx.createOscillator()
    if (wave === 'triangle') osc.type = 'triangle'
    else if (wave === 'saw') osc.type = 'sawtooth'
    else osc.setPeriodicWave(this.waves[wave] ?? this.waves.pulse50!)
    osc.frequency.setValueAtTime(freq, at)
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, at)

    const env = ctx.createGain()
    const peak = Math.max(0.0001, gain)
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    env.gain.setValueAtTime(peak, at + Math.max(0.02, dur * 0.6))
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)

    let node: AudioNode = osc
    if (opts.filter) {
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.Q.value = opts.filter.q ?? 6
      lp.frequency.setValueAtTime(opts.filter.from, at)
      lp.frequency.exponentialRampToValueAtTime(
        Math.max(60, opts.filter.to),
        at + Math.max(0.05, dur),
      )
      osc.connect(lp)
      node = lp
    }

    node.connect(env).connect(dest)
    osc.start(at)
    osc.stop(at + dur + 0.02)
  }

  /** A small kit: pitched-sine kick, noise-and-tone snare, clap, two hats. */
  private drum(dest: AudioNode, kind: string, at: number, gain: number) {
    const ctx = this.ensure()

    if (kind === 'K') {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(130, at)
      osc.frequency.exponentialRampToValueAtTime(42, at + 0.11)
      const env = ctx.createGain()
      env.gain.setValueAtTime(gain * 1.5, at)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
      osc.connect(env).connect(dest)
      osc.start(at)
      osc.stop(at + 0.26)
      return
    }

    const noise = ctx.createBufferSource()
    noise.buffer = this.noiseBuffer
    const filter = ctx.createBiquadFilter()
    const env = ctx.createGain()
    let dur = 0.05

    if (kind === 'S' || kind === 'C') {
      filter.type = 'bandpass'
      filter.frequency.value = kind === 'S' ? 1900 : 1300
      filter.Q.value = kind === 'S' ? 0.9 : 2.4
      dur = kind === 'S' ? 0.16 : 0.1
      if (kind === 'S') {
        // A little body under the crack.
        const tone = ctx.createOscillator()
        tone.type = 'triangle'
        tone.frequency.setValueAtTime(210, at)
        tone.frequency.exponentialRampToValueAtTime(150, at + 0.09)
        const tenv = ctx.createGain()
        tenv.gain.setValueAtTime(gain * 0.6, at)
        tenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
        tone.connect(tenv).connect(dest)
        tone.start(at)
        tone.stop(at + 0.12)
      }
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 7200
      dur = kind === 'O' ? 0.22 : 0.035
    }

    env.gain.setValueAtTime(gain, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    noise.connect(filter).connect(env).connect(dest)
    noise.start(at)
    noise.stop(at + dur + 0.02)
  }

  // ------------------------------------------------------------- sequencer

  playTune(tune: Tune, restart = true) {
    this.ensure()
    if (this.tune === tune && this.timer !== null && !restart) return
    this.stopTune()
    this.tune = tune
    this.step = 0
    this.nextStepTime = this.ctx!.currentTime + 0.08
    this.timer = window.setInterval(() => this.schedule(), 25)
  }

  stopTune() {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.tune = null
  }

  get playing() {
    return this.timer !== null
  }

  private schedule() {
    const ctx = this.ctx
    const tune = this.tune
    if (!ctx || !tune) return
    const stepDur = 60 / tune.bpm / tune.stepsPerBeat
    const length = Math.max(...tune.tracks.map((t) => t.notes.length))
    const swing = tune.swing ?? 0

    while (this.nextStepTime < ctx.currentTime + 0.2) {
      // A shuffle pushes every other step late without moving the downbeats.
      const at = this.nextStepTime + (this.step % 2 === 1 ? swing * stepDur : 0)

      for (const track of tune.tracks) {
        const note = track.notes[this.step % track.notes.length]
        if (!note || note === '.' || note === '=') continue

        // A note runs until the next step that is not a sustain marker.
        let held = 1
        for (let i = 1; i < length; i++) {
          if (track.notes[(this.step + i) % track.notes.length] === '=') held++
          else break
        }
        const dur = held * stepDur * (track.gate ?? 0.95)

        if (track.wave === 'noise') {
          this.drum(this.musicBus, note, at, track.gain)
          continue
        }

        for (const part of note.split('/')) {
          const f = noteToFreq(part)
          if (!f) continue
          this.voice(this.musicBus, track.wave, f, at, dur, track.gain, {
            filter: track.filter,
            detune: track.detune,
          })
        }
      }
      this.nextStepTime += stepDur
      this.step = (this.step + 1) % length
    }
  }

  // ------------------------------------------------------------------ sfx

  private seq(notes: [string, number][], wave: Wave = 'pulse25', gain = 0.22) {
    const ctx = this.ensure()
    let t = ctx.currentTime + 0.01
    for (const [note, dur] of notes) {
      if (note !== '.') this.voice(this.sfxBus, wave, noteToFreq(note), t, dur, gain)
      t += dur
    }
  }

  blip() {
    this.seq([['E5', 0.05]], 'pulse12', 0.15)
  }

  select() {
    this.seq([['C5', 0.05], ['G5', 0.09]], 'pulse25', 0.18)
  }

  /** A room that will not take you: the listing just said NOT POSSIBLE. */
  reject() {
    this.seq([['A3', 0.09], ['E3', 0.16]], 'saw', 0.2)
  }

  /** Footsteps down a tunnel. Two dull knocks, the second lower. */
  walk() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    for (const [i, f] of [190, 150].entries()) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const t = at + i * 0.13
      osc.frequency.setValueAtTime(f, t)
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.1)
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.16, t)
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
      osc.connect(env).connect(this.sfxBus)
      osc.start(t)
      osc.stop(t + 0.15)
    }
  }

  /**
   * The arrow. A short noise burst swept downward through a bandpass, which
   * is close enough to something crooked going past your ear in the dark.
   */
  arrow() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 4
    band.frequency.setValueAtTime(2600, at)
    band.frequency.exponentialRampToValueAtTime(420, at + 0.42)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(0.3, at + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.45)
    src.connect(band).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 0.5)
  }

  /** Wings. Filtered noise pulsed at wingbeat rate, rising as they carry you. */
  bats() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.loop = true
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 1.6
    band.frequency.setValueAtTime(900, at)
    band.frequency.exponentialRampToValueAtTime(2600, at + 0.9)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    // Twelve wingbeats a second, getting louder as they lift you.
    for (let i = 0; i < 11; i++) {
      const t = at + i * 0.082
      env.gain.exponentialRampToValueAtTime(0.05 + i * 0.018, t + 0.03)
      env.gain.exponentialRampToValueAtTime(0.012, t + 0.075)
    }
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.0)
    src.connect(band).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 1.05)
  }

  /** A pit. One long fall, no bottom, and then nothing. */
  pit() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(660, at)
    osc.frequency.exponentialRampToValueAtTime(34, at + 1.5)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(0.24, at + 0.06)
    env.gain.setValueAtTime(0.24, at + 1.0)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
    osc.connect(env).connect(this.sfxBus)
    osc.start(at)
    osc.stop(at + 1.7)
  }

  /** The wumpus, up close. A growl is a sawtooth an octave too low, wobbling. */
  wumpus() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.01
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(78, at)
    osc.frequency.exponentialRampToValueAtTime(46, at + 1.1)

    // The wobble is what makes it an animal rather than a chord.
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 17
    const depth = ctx.createGain()
    depth.gain.value = 11
    lfo.connect(depth).connect(osc.frequency)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 5
    lp.frequency.setValueAtTime(1500, at)
    lp.frequency.exponentialRampToValueAtTime(280, at + 1.1)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(0.3, at + 0.09)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 1.2)

    osc.connect(lp).connect(env).connect(this.sfxBus)
    osc.start(at)
    lfo.start(at)
    osc.stop(at + 1.3)
    lfo.stop(at + 1.3)
  }

  /** The kill. */
  fanfare() {
    this.seq(
      [['C5', 0.11], ['E5', 0.11], ['G5', 0.11], ['C6', 0.11], ['G5', 0.11], ['C6', 0.4]],
      'pulse25',
      0.2,
    )
  }

  sad() {
    this.seq([['G4', 0.12], ['F#4', 0.12], ['F4', 0.12], ['E4', 0.4]], 'triangle', 0.22)
  }

  /** The Teletype's key-click. */
  beep() {
    this.seq([['A5', 0.06]], 'pulse50', 0.14)
  }

  /**
   * The print head.
   *
   * An ASR-33 printed ten characters a second and you could hear every one of
   * them: a solenoid thump with a little bandpassed clatter on top. Called
   * once per character while a line is being typed out, so the transcript
   * sounds like it is being printed rather than appearing.
   */
  print() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.001

    const thump = ctx.createOscillator()
    thump.type = 'square'
    thump.frequency.setValueAtTime(320 + Math.random() * 90, at)
    const tenv = ctx.createGain()
    tenv.gain.setValueAtTime(0.05, at)
    tenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.02)
    thump.connect(tenv).connect(this.sfxBus)
    thump.start(at)
    thump.stop(at + 0.03)

    const clack = ctx.createBufferSource()
    clack.buffer = this.noiseBuffer
    clack.playbackRate.value = 0.8 + Math.random() * 0.5
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 2600
    band.Q.value = 1.2
    const cenv = ctx.createGain()
    cenv.gain.setValueAtTime(0.06, at)
    cenv.gain.exponentialRampToValueAtTime(0.0001, at + 0.018)
    clack.connect(band).connect(cenv).connect(this.sfxBus)
    clack.start(at)
    clack.stop(at + 0.03)
  }

  /** Carriage return and line feed: the head slams back, the platen turns. */
  carriage() {
    const ctx = this.ensure()
    const at = ctx.currentTime + 0.005
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    src.playbackRate.value = 0.55
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.setValueAtTime(1500, at)
    band.frequency.exponentialRampToValueAtTime(600, at + 0.13)
    band.Q.value = 0.8
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.11, at)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.15)
    src.connect(band).connect(env).connect(this.sfxBus)
    src.start(at)
    src.stop(at + 0.17)
  }

  /**
   * Dialling in, properly.
   *
   * The sound everybody means by "modem" is a V.32/V.34 handshake from the
   * 1990s -- the ascending probe tones and the long grinding echo-cancel
   * training. None of that existed in 1973 and none of it could have: this
   * game was played on a Model 33 at 110 baud through an acoustic coupler,
   * two rubber cups you pushed a telephone handset into. What that sounded
   * like is Bell 103, and Bell 103 is a much quieter animal.
   *
   * So this is the real sequence, in order, at the real frequencies:
   *
   *   1. Dial tone. North American precise tone plan: 350 Hz + 440 Hz.
   *   2. Dialling. Touch-Tone, which existed from 1963 -- each digit is one
   *      row tone and one column tone from the DTMF grid, together.
   *   3. Ringback. 440 Hz + 480 Hz, the same pair the far end hears as ring.
   *   4. The answer tone. The far modem puts up its mark frequency, 2225 Hz,
   *      and holds it while the near end decides it has found a friend.
   *   5. Data, both ways at once, which is the part people forget. Bell 103
   *      is full duplex on two separate channels: the originating end keys
   *      1070 Hz for a space and 1270 Hz for a mark, the answering end 2025
   *      and 2225. Both are chattering simultaneously and the beating
   *      between them is most of the texture.
   *
   * Everything runs through a 300-3400 Hz telephone band, because that is all
   * a phone line passes, with a peak around 900 Hz and a good deal of hiss for
   * the two rubber cups and the room they are sitting in.
   */
  dialUp(): () => void {
    const ctx = this.ensure()
    const t0 = ctx.currentTime + 0.03
    const stop: { stop: (when?: number) => void }[] = []

    // --- the telephone line itself ------------------------------------
    const line = ctx.createGain()
    line.gain.value = 1
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 300
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3400
    // The handset in the cups: a resonance, not a clean channel.
    const cup = ctx.createBiquadFilter()
    cup.type = 'peaking'
    cup.frequency.value = 900
    cup.Q.value = 1.1
    cup.gain.value = 5
    line.connect(hp).connect(lp).connect(cup).connect(this.sfxBus)

    /** A pure tone on the line for a fixed window. */
    const tone = (freq: number, from: number, to: number, gain: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, from)
      env.gain.exponentialRampToValueAtTime(gain, from + 0.012)
      env.gain.setValueAtTime(gain, to - 0.012)
      env.gain.exponentialRampToValueAtTime(0.0001, to)
      osc.connect(env).connect(line)
      osc.start(from)
      osc.stop(to + 0.02)
      stop.push(osc)
    }

    // --- 1. dial tone --------------------------------------------------
    const DIAL_END = t0 + DIAL_UP.dialTone
    tone(350, t0, DIAL_END, 0.075)
    tone(440, t0, DIAL_END, 0.075)

    // --- 2. Touch-Tone dialling ----------------------------------------
    const ROW = [941, 697, 697, 697, 770, 770, 770, 852, 852, 852]
    const COL = [1336, 1209, 1336, 1477, 1209, 1336, 1477, 1209, 1336, 1477]
    let at = DIAL_END + 0.12
    for (const digit of DIAL_UP.number) {
      const end = at + 0.09
      tone(ROW[digit]!, at, end, 0.085)
      tone(COL[digit]!, at, end, 0.085)
      at = end + 0.055
    }

    // --- 3. ringback ---------------------------------------------------
    const RING_START = t0 + DIAL_UP.ringAt
    const RING_END = RING_START + DIAL_UP.ring
    tone(440, RING_START, RING_END, 0.07)
    tone(480, RING_START, RING_END, 0.07)

    // --- 4. the far end answers ----------------------------------------
    const ANSWER_START = t0 + DIAL_UP.answerAt
    const ANSWER_END = ANSWER_START + DIAL_UP.answer
    tone(2225, ANSWER_START, ANSWER_END, 0.055)

    // --- 5. both ends talking at once ----------------------------------
    /*
     * One oscillator per direction, keyed bit by bit. 110 baud is 9.09 ms a
     * bit, and the bits are random because what is actually going down the
     * line at this point is a login banner nobody has typed yet -- scrambled
     * to the ear either way.
     */
    const DATA_START = ANSWER_END - 0.1
    const DATA_END = t0 + DIAL_UP.total
    const BIT = 1 / 110

    const channel = (mark: number, space: number, gain: number) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(mark, DATA_START)
      for (let t = DATA_START; t < DATA_END; t += BIT) {
        osc.frequency.setValueAtTime(Math.random() < 0.5 ? mark : space, t)
      }
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, DATA_START)
      env.gain.exponentialRampToValueAtTime(gain, DATA_START + 0.05)
      env.gain.setValueAtTime(gain, DATA_END - 0.08)
      env.gain.exponentialRampToValueAtTime(0.0001, DATA_END)
      osc.connect(env).connect(line)
      osc.start(DATA_START)
      osc.stop(DATA_END + 0.02)
      stop.push(osc)
    }

    channel(1270, 1070, 0.05) // originating end: the coupler on this desk
    channel(2225, 2025, 0.042) // answering end: the machine at the other

    // --- line noise, under all of it -----------------------------------
    const hiss = ctx.createBufferSource()
    hiss.buffer = this.noiseBuffer
    hiss.loop = true
    const hissGain = ctx.createGain()
    hissGain.gain.setValueAtTime(0.012, t0)
    // The line gets noisier once it is carrying something.
    hissGain.gain.setValueAtTime(0.012, DATA_START)
    hissGain.gain.linearRampToValueAtTime(0.03, DATA_START + 0.2)
    hissGain.gain.linearRampToValueAtTime(0.0001, DATA_END)
    hiss.connect(hissGain).connect(line)
    hiss.start(t0)
    hiss.stop(DATA_END + 0.05)
    stop.push(hiss)

    return () => {
      for (const node of stop) {
        try {
          node.stop()
        } catch {
          // Already stopped; nothing to do.
        }
      }
    }
  }
}

export const synth = new Synth()
