import type { Tune } from './synth'

/**
 * The old-school music, and a word about what it is honestly claiming.
 *
 * Hunt the Wumpus was silent. It ran on a timesharing system through a
 * Teletype, and a Teletype's only instrument is its own print head -- which
 * this game does play, in `synth.print()`. So a chiptune here is not a
 * restoration of anything.
 *
 * What it is instead: the music the game would have got when it followed
 * everybody home. The listing spread through People's Computer Company and
 * Creative Computing and was typed into every machine of the next decade, and
 * a 1981 home-computer port of a cave game sounded roughly like this -- two
 * pulse voices, a triangle bass, filtered noise for a kit, and a minor key
 * because the room next door has something in it.
 *
 * Written in eighths, eight to a bar, in D natural minor.
 */

const bar = (...notes: string[]) => notes

/** Title. A stalking figure that keeps arriving back where it started. */
export const TITLE_TUNE: Tune = {
  bpm: 116,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse25',
      gain: 0.15,
      notes: [
        ...bar('D4', '.', 'F4', '.', 'A4', '.', 'F4', '.'),
        ...bar('E4', '.', 'G4', '.', 'A#4', '=', '=', '.'),
        ...bar('C4', '.', 'E4', '.', 'G4', '.', 'E4', '.'),
        ...bar('D4', '=', '=', '.', 'A3', '.', 'D4', '.'),
        ...bar('F4', '.', 'A4', '.', 'D5', '.', 'A4', '.'),
        ...bar('G4', '.', 'A#4', '.', 'E5', '=', '=', '.'),
        ...bar('F5', '.', 'E5', '.', 'D5', '.', 'C5', '.'),
        ...bar('D5', '=', '=', '=', '=', '.', '.', '.'),
      ],
    },
    {
      wave: 'pulse12',
      gain: 0.06,
      notes: [
        ...bar('.', '.', 'A5', '.', '.', '.', 'D5', '.'),
        ...bar('.', '.', 'A#5', '.', '.', '.', 'G5', '.'),
        ...bar('.', '.', 'G5', '.', '.', '.', 'C5', '.'),
        ...bar('.', '.', 'A5', '.', '.', '.', 'F5', '.'),
        ...bar('.', '.', 'D6', '.', '.', '.', 'A5', '.'),
        ...bar('.', '.', 'E6', '.', '.', '.', 'A#5', '.'),
        ...bar('A5', '.', 'G5', '.', 'F5', '.', 'E5', '.'),
        ...bar('D5', '=', '=', '.', '.', '.', '.', '.'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.3,
      notes: [
        ...bar('D2', '.', 'D3', '.', 'A2', '.', 'D3', '.'),
        ...bar('E2', '.', 'E3', '.', 'B2', '.', 'E3', '.'),
        ...bar('C2', '.', 'C3', '.', 'G2', '.', 'C3', '.'),
        ...bar('D2', '.', 'D3', '.', 'A2', '.', 'A2', '.'),
        ...bar('D2', '.', 'D3', '.', 'A2', '.', 'D3', '.'),
        ...bar('E2', '.', 'E3', '.', 'B2', '.', 'E3', '.'),
        ...bar('F2', '.', 'F3', '.', 'C3', '.', 'F3', '.'),
        ...bar('D2', '=', '=', '=', 'A2', '.', 'D2', '.'),
      ],
    },
    {
      wave: 'noise',
      gain: 0.14,
      notes: [
        ...bar('K', '.', 'H', '.', 'S', '.', 'H', '.'),
        ...bar('K', '.', 'H', '.', 'S', '.', 'K', 'H'),
      ],
    },
  ],
}

/**
 * Walking music. Almost nothing: a bass on the beat and a hat every other
 * bar, so the room has a pulse without arguing with the print head. The
 * hunting screen is where somebody is actually thinking.
 */
export const HUNT_TUNE: Tune = {
  bpm: 92,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'triangle',
      gain: 0.26,
      notes: [
        ...bar('D2', '.', '.', '.', 'A2', '.', '.', '.'),
        ...bar('D2', '.', '.', '.', 'F2', '.', '.', '.'),
        ...bar('C2', '.', '.', '.', 'G2', '.', '.', '.'),
        ...bar('D2', '.', '.', '.', 'A2', '.', 'D2', '.'),
      ],
    },
    {
      wave: 'pulse12',
      gain: 0.05,
      notes: [
        ...bar('.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', 'A4', '.', '.', '.', 'F4', '.'),
        ...bar('.', '.', '.', '.', '.', '.', '.', '.'),
        ...bar('.', '.', 'E4', '.', '.', '.', 'D4', '.'),
      ],
    },
    {
      wave: 'noise',
      gain: 0.07,
      notes: [
        ...bar('.', '.', 'H', '.', '.', '.', 'H', '.'),
        ...bar('.', '.', 'H', '.', '.', '.', 'H', 'H'),
      ],
    },
  ],
}

/** Plays once behind the standings, whoever is left to read them. */
export const END_TUNE: Tune = {
  bpm: 84,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse25',
      gain: 0.15,
      notes: [
        ...bar('A4', '.', 'D5', '=', 'F5', '.', 'A5', '='),
        ...bar('G5', '.', 'F5', '=', 'D5', '=', '=', '.'),
        ...bar('C5', '.', 'E5', '=', 'G5', '.', 'C6', '='),
        ...bar('A5', '.', 'F5', '=', 'D5', '=', '=', '.'),
      ],
    },
    {
      wave: 'triangle',
      gain: 0.28,
      notes: [
        ...bar('D2', '.', '.', '.', 'D3', '.', '.', '.'),
        ...bar('G2', '.', '.', '.', 'D3', '.', '.', '.'),
        ...bar('C2', '.', '.', '.', 'C3', '.', '.', '.'),
        ...bar('D2', '.', '.', '.', 'A2', '.', 'D2', '.'),
      ],
    },
  ],
}
