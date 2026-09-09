import { ROOM_COUNT, areConnected, isRoom, tunnelsFrom } from './cave'
import {
  ARROWS_PER_CAVE,
  BATS_TEXT,
  BAT_COUNT,
  DEATH_TEXT,
  NO_TUNNEL_TEXT,
  MAX_ARROW_PATH,
  MAX_CARRIED_ARROWS,
  PIT_COUNT,
  SENSE_TEXT,
  STARTING_ARROWS,
  WIN_TEXT,
  WUMPUS_WAKES,
} from './constants'
import { chance, type Rng } from './rng'
import type { Cave, Command, Hazard, Line, Outcome } from './types'

/**
 * The whole game lives in this file and none of it knows what a screen is.
 * `step` takes a cave and a command and hands back the cave that follows,
 * plus the lines the machine would have printed. Both skins render those
 * lines; neither one decides anything.
 */

// -------------------------------------------------------------- laying out

/**
 * Deal the hazards.
 *
 * Yob's listing allowed the hunter to start in the same room as a bat or a
 * pit, and several later ports quietly stopped doing that because starting a
 * game by falling down a hole is not a game. It is not a rule so much as an
 * oversight, so it is fixed here: every hazard and the hunter get their own
 * room. The wumpus may still be one tunnel away on the first turn -- that
 * part is the game.
 */
export function layCave(depth: number, arrows: number, rng: Rng): Cave {
  const rooms = shuffle(
    Array.from({ length: ROOM_COUNT }, (_, i) => i + 1),
    rng,
  )
  let n = 0
  const wumpus = rooms[n++]!
  const pits = rooms.slice(n, (n += PIT_COUNT))
  const bats = rooms.slice(n, (n += BAT_COUNT))
  const you = rooms[n]!

  const cave: Cave = {
    depth,
    wumpus,
    pits,
    bats,
    you,
    start: you,
    arrows,
    visited: [you],
    sensed: {},
    outcome: null,
  }

  /*
   * Record what the first room says before handing it over.
   *
   * Every other room gets this from `enter`, and leaving the first one out is
   * an easy thing not to notice: the transcript is right either way, because
   * `describe` recomputes the senses rather than reading them back. What goes
   * wrong is the map, which reads `sensed` -- so a hunter who starts next to a
   * pit would be told about it in words and see nothing marked, which makes
   * the remaster a harder game than the original rather than the same one.
   */
  return { ...cave, sensed: { [you]: sense(cave) } }
}

/** Fisher-Yates, off the seeded stream so a cave replays exactly. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const pick = <T,>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)]!

// ------------------------------------------------------------------ senses

/** What the hunter can smell, feel and hear from where they are standing. */
export function sense(cave: Cave, room = cave.you): Hazard[] {
  const near = tunnelsFrom(room)
  const out: Hazard[] = []
  // Printed in this order every time, so the transcript reads the same way.
  if (near.includes(cave.wumpus)) out.push('wumpus')
  if (near.some((r) => cave.pits.includes(r))) out.push('pit')
  if (near.some((r) => cave.bats.includes(r))) out.push('bats')
  return out
}

/** The lines a room prints on arrival: what it senses, then where it leads. */
export function describe(cave: Cave): Line[] {
  const lines: Line[] = sense(cave).map((h) => ({ kind: 'sense', text: SENSE_TEXT[h] }))
  lines.push({ kind: 'system', text: `YOU ARE IN ROOM ${cave.you}` })
  lines.push({ kind: 'system', text: `TUNNELS LEAD TO ${tunnelsFrom(cave.you).join(' ')}` })
  return lines
}

/** Record what this room told us, so the map can show it later. */
function remember(cave: Cave): Cave {
  const here = sense(cave)
  return { ...cave, sensed: { ...cave.sensed, [cave.you]: here } }
}

// ------------------------------------------------------------------ moving

/**
 * Walk into a room and find out what is in it.
 *
 * Bats are the awkward part and the reason this recurses: a bat drops you in
 * a room chosen at random, and that room can hold the wumpus, a pit, or
 * another bat. Yob's listing loops; so does this, with a stop after a handful
 * of throws. Two bats in twenty rooms cannot actually bounce you forever, but
 * an unbounded loop in a game nobody can inspect is worth not writing.
 */
function enter(cave: Cave, room: number, lines: Line[], rng: Rng, throws = 0): Cave {
  const moved: Cave = {
    ...cave,
    you: room,
    visited: cave.visited.includes(room) ? cave.visited : [...cave.visited, room],
  }

  if (room === moved.wumpus) {
    // Walking in on a sleeping wumpus wakes it, and it is faster than you.
    lines.push({ kind: 'death', text: DEATH_TEXT.eaten! })
    return { ...moved, outcome: 'eaten' }
  }

  if (moved.pits.includes(room)) {
    lines.push({ kind: 'death', text: DEATH_TEXT['fell-in-a-pit']! })
    return { ...moved, outcome: 'fell-in-a-pit' }
  }

  if (moved.bats.includes(room) && throws < 5) {
    lines.push({ kind: 'bats', text: BATS_TEXT })
    // Anywhere but where you already are -- being dropped back is not a snatch.
    const elsewhere = Array.from({ length: ROOM_COUNT }, (_, i) => i + 1).filter((r) => r !== room)
    return enter(moved, pick(elsewhere, rng), lines, rng, throws + 1)
  }

  return remember(moved)
}

// ----------------------------------------------------------------- shooting

/**
 * Fly a crooked arrow.
 *
 * The hunter names up to five rooms. If the next named room is not reachable
 * from the one the arrow is in, the arrow does not stop and it does not fail
 * -- it blunders on into a random tunnel, which is how a crooked arrow ends
 * up in the room behind you. That rule is the reason this game is frightening
 * to play well: a long shot is a good way to shoot yourself.
 */
function flyArrow(cave: Cave, path: readonly number[], lines: Line[], rng: Rng): Cave {
  let at = cave.you
  const flown: number[] = []

  for (const named of path.slice(0, MAX_ARROW_PATH)) {
    const next = areConnected(at, named) ? named : pick(tunnelsFrom(at), rng)
    flown.push(next)
    at = next

    if (at === cave.wumpus) {
      lines.push({ kind: 'win', text: WIN_TEXT })
      lines.push({ kind: 'system', text: 'THERE IS ANOTHER ONE FURTHER IN. THERE ALWAYS IS.' })
      return { ...cave, arrows: cave.arrows - 1, outcome: 'shot-the-wumpus' }
    }
    if (at === cave.you) {
      lines.push({ kind: 'death', text: DEATH_TEXT['shot-yourself']! })
      return { ...cave, arrows: cave.arrows - 1, outcome: 'shot-yourself' }
    }
  }

  lines.push({ kind: 'shot', text: `MISSED. THE ARROW WENT ${flown.join(' - ')}` })
  return { ...cave, arrows: cave.arrows - 1 }
}

/**
 * A shot that misses wakes the wumpus, and a woken wumpus takes one of four
 * doors: the three tunnels out, or the floor it is already lying on. If it
 * picks the room the hunter is standing in, the hunt is over.
 */
function stirWumpus(cave: Cave, lines: Line[], rng: Rng): Cave {
  if (!chance(rng, WUMPUS_WAKES)) return cave

  const options = [...tunnelsFrom(cave.wumpus), cave.wumpus]
  const to = pick(options, rng)
  const moved = { ...cave, wumpus: to }

  if (to === cave.you) {
    lines.push({ kind: 'death', text: DEATH_TEXT.eaten! })
    return { ...moved, outcome: 'eaten' }
  }
  // It moved, and the only way to know is that the room smells different now.
  return remember(moved)
}

// -------------------------------------------------------------------- step

export interface StepResult {
  cave: Cave
  lines: Line[]
}

/**
 * One turn. Everything above, in the order the 1973 game does it.
 *
 * A command that does not make sense does not cost a turn and does not end
 * the game -- it is refused with the same words the listing used, because a
 * player who mistypes a room number has not made a decision worth punishing.
 */
export function step(cave: Cave, command: Command, rng: Rng): StepResult {
  const lines: Line[] = []
  if (cave.outcome) return { cave, lines }

  if (command.type === 'move') {
    if (!isRoom(command.to) || !areConnected(cave.you, command.to)) {
      lines.push({ kind: 'system', text: NO_TUNNEL_TEXT })
      return { cave, lines }
    }
    return { cave: enter(cave, command.to, lines, rng), lines }
  }

  const path = command.path.filter(isRoom).slice(0, MAX_ARROW_PATH)
  if (path.length === 0) {
    lines.push({ kind: 'system', text: NO_TUNNEL_TEXT })
    return { cave, lines }
  }

  let next = flyArrow(cave, path, lines, rng)
  if (next.outcome) return { cave: next, lines }

  next = stirWumpus(next, lines, rng)
  if (next.outcome) return { cave: next, lines }

  if (next.arrows <= 0) {
    lines.push({ kind: 'death', text: DEATH_TEXT['out-of-arrows']! })
    return { cave: { ...next, outcome: 'out-of-arrows' }, lines }
  }

  return { cave: next, lines }
}

// ------------------------------------------------------------- expeditions

/** What a hunter carries into the next cave after bagging one. */
export const arrowsAfterWin = (left: number): number =>
  Math.min(MAX_CARRIED_ARROWS, left + ARROWS_PER_CAVE)

export const startingArrows = () => STARTING_ARROWS

export const outcomeText = (o: Outcome): string =>
  o === 'shot-the-wumpus' ? WIN_TEXT : (DEATH_TEXT[o] ?? '')

export const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1

/**
 * A hunt is worth ranking on what it caught first, then on the two things
 * that separate a careful hunter from a lucky one: arrows they did not need
 * to fire, and rooms they did not need to walk.
 */
export function compareHunts(
  a: { bagged: number; arrows: number; roomsWalked: number },
  b: { bagged: number; arrows: number; roomsWalked: number },
): number {
  if (a.bagged !== b.bagged) return b.bagged - a.bagged
  if (a.arrows !== b.arrows) return b.arrows - a.arrows
  return a.roomsWalked - b.roomsWalked
}
