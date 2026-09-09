import { describe, expect, it } from 'vitest'
import { ROOM_COUNT, tunnelsFrom } from './cave'
import { BAT_COUNT, NO_TUNNEL_TEXT, PIT_COUNT, SENSE_TEXT, STARTING_ARROWS } from './constants'
import { arrowsAfterWin, compareHunts, describe as describeRoom, layCave, sense, step } from './engine'
import { makeRng } from './rng'
import type { Cave } from './types'

/**
 * The engine is the game, so this is where the rules are held to account.
 *
 * Most of these build a cave by hand rather than dealing one, because a rule
 * about what happens when you walk into a pit is not a rule about where pits
 * end up. The dealt caves are tested separately, once, for the things dealing
 * has to guarantee.
 */

const caveWith = (over: Partial<Cave> = {}): Cave => ({
  depth: 1,
  wumpus: 20,
  pits: [18, 19],
  bats: [16, 17],
  you: 1,
  start: 1,
  arrows: STARTING_ARROWS,
  visited: [1],
  sensed: {},
  outcome: null,
  ...over,
})

/** A stream that hands back exactly the numbers a test wants, then zeros. */
const scripted = (...values: number[]) => {
  let i = 0
  return () => values[i++] ?? 0
}

describe('dealing a cave', () => {
  it('gives everything its own room, including the hunter', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const cave = layCave(1, STARTING_ARROWS, makeRng(seed))
      const occupied = [cave.wumpus, ...cave.pits, ...cave.bats, cave.you]
      expect(new Set(occupied).size).toBe(occupied.length)
      expect(cave.pits).toHaveLength(PIT_COUNT)
      expect(cave.bats).toHaveLength(BAT_COUNT)
    }
  })

  it('lays the same cave twice from the same seed', () => {
    const a = layCave(3, 4, makeRng(12345))
    const b = layCave(3, 4, makeRng(12345))
    expect(b).toEqual(a)
  })

  /**
   * The first room is the one it is easy to forget, because `describe`
   * recomputes the senses rather than reading them back -- so the transcript
   * is right whether or not they were ever stored, and only the map notices.
   */
  it('records what the first room senses, not just what it prints', () => {
    let found = 0
    for (let seed = 1; seed <= 200; seed++) {
      const cave = layCave(1, STARTING_ARROWS, makeRng(seed))
      expect(cave.sensed[cave.you]).toEqual(sense(cave))
      if ((cave.sensed[cave.you] ?? []).length > 0) found++
    }
    // A start next to a hazard is common enough that the case is real.
    expect(found).toBeGreaterThan(20)
  })

  it('starts the hunter somewhere they can be told about', () => {
    const cave = layCave(1, STARTING_ARROWS, makeRng(7))
    const lines = describeRoom(cave)
    expect(lines.some((l) => l.text === `YOU ARE IN ROOM ${cave.you}`)).toBe(true)
    expect(lines.some((l) => l.text.startsWith('TUNNELS LEAD TO'))).toBe(true)
  })
})

describe('what a room tells you', () => {
  it('reports a hazard one tunnel away and never says which room', () => {
    // Room 1 leads to 2, 5 and 8. Put the wumpus in 5.
    const cave = caveWith({ you: 1, wumpus: 5, pits: [18, 19], bats: [16, 17] })
    expect(sense(cave)).toEqual(['wumpus'])
    const printed = describeRoom(cave).map((l) => l.text)
    expect(printed).toContain(SENSE_TEXT.wumpus)
    expect(printed.join(' ')).not.toContain('ROOM 5')
  })

  it('says nothing about a hazard two tunnels away', () => {
    // 12 is two from 1 (1-2-12), so it must be silent from room 1.
    expect(tunnelsFrom(1)).not.toContain(12)
    expect(sense(caveWith({ you: 1, wumpus: 12 }))).toEqual([])
  })

  it('reports all three at once, in the order the listing printed them', () => {
    const cave = caveWith({ you: 1, wumpus: 2, pits: [5, 19], bats: [8, 17] })
    expect(sense(cave)).toEqual(['wumpus', 'pit', 'bats'])
  })
})

describe('moving', () => {
  it('refuses a room with no tunnel to it, and does not cost a turn', () => {
    const cave = caveWith({ you: 1 })
    const { cave: after, lines } = step(cave, { type: 'move', to: 12 }, makeRng(1))
    expect(after).toBe(cave)
    expect(lines.map((l) => l.text)).toEqual([NO_TUNNEL_TEXT])
  })

  it('eats you when you walk in on the wumpus', () => {
    const { cave } = step(caveWith({ you: 1, wumpus: 2 }), { type: 'move', to: 2 }, makeRng(1))
    expect(cave.outcome).toBe('eaten')
  })

  it('drops you down a pit', () => {
    const { cave } = step(caveWith({ you: 1, pits: [2, 19] }), { type: 'move', to: 2 }, makeRng(1))
    expect(cave.outcome).toBe('fell-in-a-pit')
  })

  /**
   * The bat rule is the one worth testing hardest: it is the only thing in
   * the game that moves you somewhere you did not choose, and the room it
   * picks can hold anything.
   */
  it('lets a bat carry you somewhere else entirely', () => {
    const cave = caveWith({ you: 1, bats: [2, 17], wumpus: 20, pits: [18, 19] })
    const { cave: after, lines } = step(cave, { type: 'move', to: 2 }, makeRng(99))
    expect(lines.some((l) => l.kind === 'bats')).toBe(true)
    expect(after.you).not.toBe(2)
    expect(after.outcome).toBeNull()
  })

  it('lets a bat drop you on something that kills you', () => {
    // The first roll picks the destination out of the nineteen other rooms;
    // 0 lands on room 1, where the pit is.
    const cave = caveWith({ you: 5, bats: [6, 17], pits: [1, 19], wumpus: 20 })
    const { cave: after } = step(cave, { type: 'move', to: 6 }, scripted(0))
    expect(after.outcome).toBe('fell-in-a-pit')
  })

  it('never drops you back in the room the bat took you from', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const cave = caveWith({ you: 1, bats: [2, 17], wumpus: 20, pits: [18, 19] })
      const { cave: after } = step(cave, { type: 'move', to: 2 }, makeRng(seed))
      if (after.outcome) continue
      expect(after.you).not.toBe(2)
    }
  })

  it('remembers every room it has stood in', () => {
    let cave = caveWith({ you: 1, wumpus: 20, pits: [18, 19], bats: [16, 17] })
    cave = step(cave, { type: 'move', to: 2 }, makeRng(1)).cave
    cave = step(cave, { type: 'move', to: 3 }, makeRng(1)).cave
    expect(cave.visited).toEqual([1, 2, 3])
  })
})

describe('shooting', () => {
  it('kills the wumpus when the arrow reaches it', () => {
    const cave = caveWith({ you: 1, wumpus: 2 })
    const { cave: after, lines } = step(cave, { type: 'shoot', path: [2] }, makeRng(1))
    expect(after.outcome).toBe('shot-the-wumpus')
    expect(lines.some((l) => l.kind === 'win')).toBe(true)
  })

  it('spends an arrow whether it hits or misses', () => {
    const hit = step(caveWith({ you: 1, wumpus: 2 }), { type: 'shoot', path: [2] }, makeRng(1))
    const miss = step(caveWith({ you: 1, wumpus: 20 }), { type: 'shoot', path: [2] }, makeRng(1))
    expect(hit.cave.arrows).toBe(STARTING_ARROWS - 1)
    expect(miss.cave.arrows).toBe(STARTING_ARROWS - 1)
  })

  /**
   * The rule the whole game turns on. Room 1 leads to 2, 5 and 8; room 2
   * leads to 1, 3 and 10. Naming 2 and then 8 asks the arrow to make a jump
   * it cannot -- so it takes a tunnel of its own, and the scripted stream
   * makes that tunnel the one back to room 1.
   */
  it('sends a crooked arrow down a random tunnel when it cannot reach the room named', () => {
    expect(tunnelsFrom(2)).not.toContain(8)
    expect(tunnelsFrom(2)[0]).toBe(1)
    const cave = caveWith({ you: 1, wumpus: 20 })
    // First roll picks tunnel 0 out of room 2, which is room 1: the hunter.
    const { cave: after } = step(cave, { type: 'shoot', path: [2, 8] }, scripted(0))
    expect(after.outcome).toBe('shot-yourself')
  })

  it('will not fly further than five rooms', () => {
    const cave = caveWith({ you: 1, wumpus: 20 })
    const { lines } = step(
      cave,
      { type: 'shoot', path: [2, 3, 4, 5, 6, 7, 8] },
      // Every roll picks the first tunnel, so nothing is left to chance.
      scripted(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
    )
    const flight = lines.find((l) => l.kind === 'shot')!.text
    expect(flight.split(' - ')).toHaveLength(5)
  })

  it('wakes the wumpus onto you when the roll says so', () => {
    // Wumpus in 2, hunter in 1. The shot at 5 is a legal tunnel, so it costs
    // no roll: the first roll is the wake (0.1 is under the 0.75 threshold)
    // and the second picks from [1, 3, 10, 2] -- index 0 being room 1, which
    // is where the hunter is standing.
    const cave = caveWith({ you: 1, wumpus: 2 })
    const { cave: after } = step(cave, { type: 'shoot', path: [5] }, scripted(0.1, 0))
    expect(after.outcome).toBe('eaten')
  })

  it('leaves the wumpus asleep when the roll says so', () => {
    const cave = caveWith({ you: 1, wumpus: 2 })
    // A miss (path goes to 5), then 0.99 -- above the 0.75 wake threshold.
    const { cave: after } = step(cave, { type: 'shoot', path: [5] }, scripted(0.9, 0.99))
    expect(after.wumpus).toBe(2)
    expect(after.outcome).toBeNull()
  })

  it('ends the hunt when the last arrow misses', () => {
    const cave = caveWith({ you: 1, wumpus: 20, arrows: 1 })
    const { cave: after } = step(cave, { type: 'shoot', path: [5] }, scripted(0.9, 0.99))
    expect(after.outcome).toBe('out-of-arrows')
  })

  it('refuses a shot with nowhere to go, and does not cost an arrow', () => {
    const cave = caveWith({ you: 1 })
    const { cave: after } = step(cave, { type: 'shoot', path: [] }, makeRng(1))
    expect(after.arrows).toBe(STARTING_ARROWS)
    expect(after).toBe(cave)
  })
})

describe('a hunt that has already ended', () => {
  it('ignores everything after it', () => {
    const dead = caveWith({ outcome: 'eaten' })
    expect(step(dead, { type: 'move', to: 2 }, makeRng(1)).cave).toBe(dead)
    expect(step(dead, { type: 'shoot', path: [2] }, makeRng(1)).cave).toBe(dead)
  })
})

describe('the expedition around it', () => {
  it('gives back one arrow for a kill, and never more than you started with', () => {
    expect(arrowsAfterWin(2)).toBe(3)
    expect(arrowsAfterWin(STARTING_ARROWS)).toBe(STARTING_ARROWS)
  })

  it('ranks on wumpodes first, then arrows left, then rooms walked', () => {
    const a = { bagged: 3, arrows: 1, roomsWalked: 40 }
    const b = { bagged: 2, arrows: 5, roomsWalked: 4 }
    const c = { bagged: 3, arrows: 4, roomsWalked: 90 }
    const d = { bagged: 3, arrows: 4, roomsWalked: 12 }
    expect([a, b, c, d].sort(compareHunts)).toEqual([d, c, a, b])
  })
})

/**
 * The remaster must not be an easier game than the transcript.
 *
 * `CaveMap` decides what to draw from `cave.sensed` and `cave.visited`, so
 * the guarantee it needs is that neither of those ever names a room the
 * hunter has not been told about. That is asserted here rather than in the
 * component, because it is a property of the engine and it would still have
 * to hold if the map were thrown away tomorrow.
 */
describe('what the map is allowed to know', () => {
  it('only ever records senses for rooms the hunter has stood in', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rng = makeRng(seed)
      let cave = layCave(1, STARTING_ARROWS, rng)
      for (let turn = 0; turn < 12 && !cave.outcome; turn++) {
        const exits = tunnelsFrom(cave.you)
        cave = step(cave, { type: 'move', to: exits[turn % 3]! }, rng).cave
      }
      for (const room of Object.keys(cave.sensed).map(Number)) {
        expect(cave.visited).toContain(room)
      }
    }
  })

  it('never records a sense that the room would not have printed', () => {
    const rng = makeRng(4242)
    let cave = layCave(1, STARTING_ARROWS, rng)
    for (let turn = 0; turn < 10 && !cave.outcome; turn++) {
      const exits = tunnelsFrom(cave.you)
      cave = step(cave, { type: 'move', to: exits[turn % 3]! }, rng).cave
    }
    for (const [room, hazards] of Object.entries(cave.sensed)) {
      // Recompute from scratch: what the room says now is what was stored.
      expect(sense(cave, Number(room))).toEqual(hazards)
    }
  })
})

describe('the whole thing, run a few hundred times', () => {
  /**
   * A hunter who walks at random and never shoots should die most of the
   * time and should never hang, never leave the cave, and never end up in a
   * room that does not exist. This is the cheap version of the lemonade
   * stand's "run a few hundred seasons" check: it is not tuning anything,
   * it is looking for a state the rules cannot produce.
   */
  it('never leaves the cave or hangs', () => {
    let deaths = 0
    for (let seed = 1; seed <= 500; seed++) {
      const rng = makeRng(seed)
      let cave = layCave(1, STARTING_ARROWS, rng)
      let turns = 0
      while (!cave.outcome && turns < 200) {
        const exits = tunnelsFrom(cave.you)
        cave = step(cave, { type: 'move', to: exits[Math.floor(rng() * 3)]! }, rng).cave
        expect(cave.you).toBeGreaterThanOrEqual(1)
        expect(cave.you).toBeLessThanOrEqual(ROOM_COUNT)
        turns++
      }
      if (cave.outcome) deaths++
    }
    // Walking blind into a cave with four lethal rooms out of twenty is not
    // survivable for long; if this ever drops, something has stopped biting.
    expect(deaths).toBeGreaterThan(480)
  })
})
