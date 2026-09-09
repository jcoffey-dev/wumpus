import { STARTING_ARROWS } from './constants'
import { arrowsAfterWin } from './engine'
import type { Cave, Hunter, Line, Phase } from './types'
import { isWin } from './types'

/**
 * The phase machine, and the only place a turn changes hands.
 *
 * A turn is one cave, not one move. A hunter walks their cave until it kills
 * them or they kill it, and only then does the teletype go quiet and the next
 * hunter sit down. Splitting turns move-by-move would be fairer in some
 * abstract sense and unplayable in practice: this is a game about what you
 * have worked out, and taking turns to walk into the same darkness would mean
 * four people watching one person think.
 */
export interface GameState {
  phase: Phase
  seed: number
  hunters: Hunter[]
  /** Index into `hunters`; the dead are skipped, never removed. */
  turn: number
  cave: Cave | null
  /** Everything the machine has printed for the cave now being walked. */
  transcript: Line[]
  /** Set once somebody calls the expedition off, so the standings say so. */
  climbedOut: boolean
  /** Where the board was opened from, so BACK has somewhere to go. */
  scoresReturn: Phase
}

export const initialState = (seed: number, phase: Phase = 'boot'): GameState => ({
  phase,
  seed,
  hunters: [],
  turn: 0,
  cave: null,
  transcript: [],
  climbedOut: false,
  scoresReturn: 'title',
})

export type Action =
  | { type: 'BOOTED' }
  | { type: 'SHOW_INSTRUCTIONS' }
  | { type: 'SHOW_SETUP' }
  | { type: 'START'; names: string[] }
  | { type: 'ENTER_CAVE'; cave: Cave; lines: Line[] }
  | { type: 'PRINT'; lines: Line[] }
  | { type: 'ADVANCE'; cave: Cave; lines: Line[] }
  | { type: 'SHOW_REPORT' }
  | { type: 'NEXT_TURN' }
  | { type: 'CLIMB_OUT' }
  | { type: 'SHOW_SCORES' }
  | { type: 'CLOSE_SCORES' }
  | { type: 'RESTART'; seed: number }

export const livingHunters = (s: GameState) => s.hunters.filter((h) => !h.dead)

/** Whose turn it is, or undefined once everybody is out of the cave. */
export const currentHunter = (s: GameState): Hunter | undefined => s.hunters[s.turn]

/** How deep the hunter about to play is going: one more than they have bagged. */
export const depthFor = (h: Hunter): number => h.bagged + 1

/**
 * The next living hunter after `from`, wrapping once. Returns -1 when there
 * is nobody left, which is what ends the expedition.
 */
export function nextLiving(hunters: Hunter[], from: number): number {
  for (let i = 1; i <= hunters.length; i++) {
    const at = (from + i) % hunters.length
    if (!hunters[at]!.dead) return at
  }
  return -1
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'BOOTED':
      return { ...state, phase: 'title' }

    case 'SHOW_INSTRUCTIONS':
      return { ...state, phase: 'instructions' }

    case 'SHOW_SETUP':
      return { ...state, phase: 'setup' }

    case 'START':
      return {
        ...state,
        phase: 'hunting',
        hunters: action.names.map((name, i) => ({
          id: i,
          name: name.trim().toUpperCase() || `HUNTER ${i + 1}`,
          bagged: 0,
          arrows: STARTING_ARROWS,
          roomsWalked: 0,
          dead: false,
          died: null,
          diedAtDepth: null,
        })),
        turn: 0,
        cave: null,
        transcript: [],
      }

    case 'ENTER_CAVE':
      return {
        ...state,
        phase: 'hunting',
        cave: action.cave,
        transcript: action.lines,
      }

    case 'PRINT':
      return { ...state, transcript: [...state.transcript, ...action.lines] }

    /**
     * One turn's worth of consequences. The hunter's running totals are kept
     * on the hunter rather than recomputed from the cave, because a cave is
     * thrown away at the end of a hunt and the expedition is not.
     */
    case 'ADVANCE': {
      const before = state.cave
      const cave = action.cave
      const walked = before && cave.you !== before.you ? 1 : 0

      const hunters = state.hunters.map((h) =>
        h.id !== currentHunter(state)?.id
          ? h
          : {
              ...h,
              roomsWalked: h.roomsWalked + walked,
              arrows: cave.arrows,
            },
      )

      return {
        ...state,
        cave,
        hunters,
        transcript: [...state.transcript, ...action.lines],
        phase: cave.outcome ? 'resolve' : 'hunting',
      }
    }

    /** The hunt has ended; settle it against the hunter and show the report. */
    case 'SHOW_REPORT': {
      const cave = state.cave
      const who = currentHunter(state)
      if (!cave?.outcome || !who) return { ...state, phase: 'report' }

      const won = isWin(cave.outcome)
      const hunters = state.hunters.map((h) =>
        h.id !== who.id
          ? h
          : {
              ...h,
              bagged: won ? h.bagged + 1 : h.bagged,
              arrows: won ? arrowsAfterWin(cave.arrows) : cave.arrows,
              dead: !won,
              died: won ? null : cave.outcome,
              diedAtDepth: won ? null : cave.depth,
            },
      )
      return { ...state, phase: 'report', hunters }
    }

    case 'NEXT_TURN': {
      const at = nextLiving(state.hunters, state.turn)
      if (at === -1) return { ...state, phase: 'gameover', cave: null }
      return { ...state, phase: 'hunting', turn: at, cave: null, transcript: [] }
    }

    case 'CLIMB_OUT':
      return { ...state, phase: 'gameover', climbedOut: true, cave: null }

    case 'SHOW_SCORES':
      return state.phase === 'scores'
        ? state
        : { ...state, phase: 'scores', scoresReturn: state.phase }

    case 'CLOSE_SCORES':
      return { ...state, phase: state.scoresReturn }

    case 'RESTART':
      // The tape only loads once a session; a new expedition starts at the title.
      return initialState(action.seed, 'title')

    default:
      return state
  }
}
