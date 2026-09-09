import type { Track, Tune } from './synth'

/**
 * The remaster's band, and it is deliberately not the lemonade stand's.
 *
 * That one is a funk band on a hot street in daylight. This is underground:
 * D phrygian, no shuffle at all, everything on the grid and slightly too
 * slow. The engine is identical -- same voices, same kit, same scheduler --
 * and every difference is in what is written for it.
 *
 * Three ideas, and nothing else, because the player is listening for a draft:
 *
 *   - a sub bass that sits on the root and refuses to move, so the harmony
 *     never resolves anywhere;
 *   - a resonant filter sweep on a detuned saw, which is the sound of a
 *     space being bigger than you thought;
 *   - toms instead of a backbeat. A snare on two and four would make this
 *     music to walk to, and nothing down here walks in time.
 *
 * Sixteenths, sixteen to a bar.
 */

const bar = (...steps: string[]) => steps

const kick = (notes: string[]): Track => ({ wave: 'noise', gain: 0.46, notes })
const hats = (notes: string[]): Track => ({ wave: 'noise', gain: 0.09, notes })

/** Hunting. Two bars, almost empty, meant to be forgotten while you think. */
export const DREAD_HUNT: Tune = {
  bpm: 76,
  stepsPerBeat: 4,
  tracks: [
    // The drone. One note, held, and it is the room rather than the tune.
    {
      wave: 'saw',
      gain: 0.13,
      gate: 1,
      detune: 7,
      filter: { from: 260, to: 150, q: 3 },
      notes: [
        ...bar('D1', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '='),
        ...bar('D1', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '='),
        ...bar('D1', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '='),
        ...bar('A#0', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '=', '='),
      ],
    },
    // The sweep. Phrygian second, which is the interval that sounds wrong.
    {
      wave: 'saw',
      gain: 0.07,
      gate: 0.9,
      filter: { from: 3400, to: 320, q: 11 },
      notes: [
        ...bar('.', '.', '.', '.', '.', '.', '.', '.', 'D3/A3', '=', '=', '=', '=', '=', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', '.', '.', 'D#3/A3', '=', '=', '=', '=', '=', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'D3/G3', '=', '=', '.'),
      ],
    },
    // A thin bell, six steps apart, so it never lines up with the bar.
    {
      wave: 'pulse12',
      gain: 0.05,
      gate: 0.5,
      notes: [
        ...bar('D5', '.', '.', '.', '.', '.', 'A4', '.', '.', '.', '.', '.', 'F4', '.', '.', '.'),
      ],
    },
    kick([
      ...bar('K', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'K', '.', '.', '.'),
      ...bar('K', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.'),
    ]),
    hats([
      ...bar('.', '.', '.', '.', '.', '.', '.', '.', 'O', '.', '.', '.', '.', '.', '.', '.'),
      ...bar('.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', 'H', '.'),
    ]),
  ],
}

/** Title. The same cave with something moving in it. */
export const DREAD_TITLE: Tune = {
  bpm: 84,
  stepsPerBeat: 4,
  tracks: [
    {
      wave: 'saw',
      gain: 0.2,
      gate: 0.62,
      detune: 6,
      filter: { from: 1500, to: 190, q: 8 },
      notes: [
        ...bar('D1', '.', '.', 'D1', '.', '.', 'D2', '.', '.', '.', 'A#1', '.', '.', 'D1', '.', '.'),
        ...bar('D1', '.', '.', 'D1', '.', '.', 'D2', '.', 'F1', '.', '.', 'G1', '.', '.', '.', '.'),
        ...bar('C1', '.', '.', 'C1', '.', '.', 'C2', '.', '.', '.', 'G1', '.', '.', 'C1', '.', '.'),
        ...bar('A#0', '.', '.', 'A#0', '.', '.', 'A#1', '.', 'C1', '.', '.', 'D1', '.', '.', 'D1', '.'),
      ],
    },
    // Stabs in the gaps. Minor seconds, held just long enough to be unpleasant.
    {
      wave: 'pulse25',
      gain: 0.075,
      gate: 0.34,
      filter: { from: 2800, to: 700, q: 10 },
      notes: [
        ...bar('.', '.', 'D4/F4/A4', '.', '.', 'D4/F4/A4', '.', '.', '.', '.', '.', '.', 'D#4/F4/A4', '.', '.', '.'),
        ...bar('.', '.', 'D4/F4/A4', '.', '.', '.', '.', 'D4/G4/A#4', '.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', 'C4/E4/G4', '.', '.', 'C4/E4/G4', '.', '.', '.', '.', '.', '.', 'C4/F4/G4', '.', '.', '.'),
        ...bar('.', '.', 'A#3/D4/F4', '.', '.', '.', 'A#3/D4/F4', '.', '.', 'C4/D4/F4', '.', '.', '.', '.', '.', '.'),
      ],
    },
    // The lead only ever plays four notes, and always the same four.
    {
      wave: 'pulse12',
      gain: 0.08,
      gate: 0.8,
      notes: [
        ...bar('.', '.', '.', '.', '.', '.', '.', '.', 'A4', '.', 'A#4', '.', 'A4', '=', '.', '.'),
        ...bar('.', '.', '.', '.', 'F4', '.', 'D4', '=', '=', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.', 'G4', '.', 'A4', '.', 'G4', '=', '.', '.'),
        ...bar('F4', '.', 'D#4', '.', 'D4', '=', '=', '=', '.', '.', '.', '.', '.', '.', '.', '.'),
      ],
    },
    kick([
      ...bar('K', '.', '.', '.', '.', '.', 'K', '.', '.', '.', '.', '.', 'K', '.', '.', '.'),
      ...bar('K', '.', '.', '.', '.', '.', 'K', '.', '.', '.', 'K', '.', '.', '.', '.', '.'),
    ]),
    // Toms, not a backbeat. Bandpassed noise reads as a floor tom well enough.
    { wave: 'noise', gain: 0.2, notes: [
      ...bar('.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.', 'S', '.', 'S', '.'),
      ...bar('.', '.', '.', '.', 'S', '.', '.', '.', '.', '.', '.', '.', 'S', '.', '.', '.'),
    ] },
    hats([
      ...bar('.', '.', 'H', '.', '.', '.', 'H', '.', '.', '.', 'H', '.', '.', '.', 'O', '.'),
    ]),
  ],
}

/** The standings. It stops stalking and just tolls. */
export const DREAD_END: Tune = {
  bpm: 70,
  stepsPerBeat: 4,
  tracks: [
    {
      wave: 'saw',
      gain: 0.17,
      gate: 1,
      detune: 5,
      filter: { from: 900, to: 180, q: 4 },
      notes: [
        ...bar('D1', '=', '=', '=', '=', '=', '=', '=', 'A#0', '=', '=', '=', '=', '=', '=', '='),
        ...bar('C1', '=', '=', '=', '=', '=', '=', '=', 'D1', '=', '=', '=', '=', '=', '=', '='),
      ],
    },
    {
      wave: 'pulse25',
      gain: 0.1,
      gate: 0.85,
      notes: [
        ...bar('D4', '=', '=', '=', '=', '=', '.', '.', 'F4', '=', '=', '=', '=', '=', '.', '.'),
        ...bar('E4', '=', '=', '=', '=', '=', '.', '.', 'D4', '=', '=', '=', '=', '=', '=', '='),
      ],
    },
    kick([...bar('K', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.', '.')]),
  ],
}
