export type Hazard = 'wumpus' | 'pit' | 'bats'

/** What is where. Never handed to a screen that has not earned it. */
export interface Cave {
  /** Which cave of the expedition this is, counting from 1. */
  depth: number
  wumpus: number
  pits: readonly number[]
  bats: readonly number[]
  /** Where the hunter is standing. */
  you: number
  /** Where the hunter started, so a transcript can say so. */
  start: number
  arrows: number
  /** Rooms the hunter has stood in, in order, including the one they are in. */
  visited: readonly number[]
  /** Rooms the hunter has been warned about, whether or not they went. */
  sensed: Readonly<Record<number, readonly Hazard[]>>
  outcome: Outcome | null
}

export type Outcome =
  | 'shot-the-wumpus'
  | 'eaten'
  | 'fell-in-a-pit'
  | 'shot-yourself'
  | 'out-of-arrows'

/** True when the hunt ended in a way the hunter walks away from. */
export const isWin = (o: Outcome | null): boolean => o === 'shot-the-wumpus'

export interface Hunter {
  id: number
  name: string
  /** Wumpodes bagged. The score, before any tie-break. */
  bagged: number
  /** Arrows carried into the next cave; a win keeps what is left of them. */
  arrows: number
  /** Rooms entered across the whole expedition, for the tie-break. */
  roomsWalked: number
  dead: boolean
  /** How the expedition ended, for the standings. */
  died: Outcome | null
  diedAtDepth: number | null
}

/**
 * One line of the transcript. The teletype prints these and the map reads
 * them for its log, so both skins say exactly the same things.
 */
export interface Line {
  kind: 'system' | 'sense' | 'move' | 'shot' | 'death' | 'win' | 'prompt' | 'bats'
  text: string
}

export type Phase =
  | 'boot'
  | 'title'
  | 'instructions'
  | 'setup'
  | 'hunting'
  | 'resolve'
  | 'report'
  | 'gameover'
  | 'scores'

/** A move or a shot, before the cave has had its say. */
export type Command =
  | { type: 'move'; to: number }
  | { type: 'shoot'; path: readonly number[] }
