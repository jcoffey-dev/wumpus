import { describe, expect, it } from 'vitest'
import { EDGES, LAYOUT, ROOM_COUNT, TUNNELS, areConnected, tunnelsFrom } from './cave'

/**
 * The adjacency table is typed out by hand, which means it can be typed out
 * wrong. A wrong table would not crash and would not look wrong on screen --
 * it would just quietly stop being a dodecahedron, and the game would still
 * play. So it gets proved rather than trusted.
 */
describe('the cave is a dodecahedron', () => {
  it('has twenty rooms', () => {
    expect(TUNNELS).toHaveLength(ROOM_COUNT)
  })

  it('gives every room exactly three tunnels', () => {
    for (let room = 1; room <= ROOM_COUNT; room++) {
      expect(tunnelsFrom(room)).toHaveLength(3)
    }
  })

  it('never leads a room to itself or twice to the same place', () => {
    for (let room = 1; room <= ROOM_COUNT; room++) {
      const to = tunnelsFrom(room)
      expect(to).not.toContain(room)
      expect(new Set(to).size).toBe(3)
    }
  })

  /** A tunnel you can walk down but not back up is not a tunnel. */
  it('is symmetric', () => {
    for (let a = 1; a <= ROOM_COUNT; a++) {
      for (const b of tunnelsFrom(a)) {
        expect(areConnected(b, a)).toBe(true)
      }
    }
  })

  it('has thirty tunnels, counted once each', () => {
    expect(EDGES).toHaveLength(30)
    const seen = new Set(EDGES.map(([a, b]) => `${a}-${b}`))
    expect(seen.size).toBe(30)
  })

  /**
   * Connected, and no shortcuts. A dodecahedron has a diameter of five: from
   * any room, the furthest room is exactly five tunnels away. This catches
   * the kind of typo that leaves the graph 3-regular and symmetric but wired
   * to the wrong vertex -- which the tests above would all pass.
   */
  it('is connected with a diameter of five', () => {
    const distances = (from: number) => {
      const dist = new Map<number, number>([[from, 0]])
      const queue = [from]
      while (queue.length) {
        const at = queue.shift()!
        for (const next of tunnelsFrom(at)) {
          if (dist.has(next)) continue
          dist.set(next, dist.get(at)! + 1)
          queue.push(next)
        }
      }
      return dist
    }

    for (let room = 1; room <= ROOM_COUNT; room++) {
      const dist = distances(room)
      expect(dist.size).toBe(ROOM_COUNT)
      expect(Math.max(...dist.values())).toBe(5)
    }
  })

  /**
   * Every vertex of a dodecahedron lies on three pentagonal faces, so every
   * room sits on three five-room loops. Nothing in the game reads this; it is
   * here because it is the property that makes the shape a dodecahedron
   * rather than merely a 3-regular graph of diameter five.
   */
  it('puts every room on a five-room loop', () => {
    const fives = (start: number) => {
      let found = 0
      const walk = (at: number, path: number[]) => {
        if (path.length === 5) {
          if (areConnected(at, start)) found++
          return
        }
        for (const next of tunnelsFrom(at)) {
          if (path.includes(next)) continue
          walk(next, [...path, next])
        }
      }
      walk(start, [start])
      // Each pentagon is walked twice, once in each direction.
      return found / 2
    }

    for (let room = 1; room <= ROOM_COUNT; room++) {
      expect(fives(room)).toBe(3)
    }
  })
})

describe('the map it is drawn on', () => {
  it('places every room', () => {
    for (let room = 1; room <= ROOM_COUNT; room++) {
      expect(LAYOUT[room]).toBeDefined()
    }
  })

  it('never puts two rooms in the same place', () => {
    const seen = new Set(Object.values(LAYOUT).map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`))
    expect(seen.size).toBe(ROOM_COUNT)
  })

  /**
   * The whole point of a Schlegel diagram: it is planar, so no two tunnels
   * cross. A layout that crosses is still a layout -- it draws, it scales, it
   * looks broadly cave-shaped -- and it is much harder to read than it looks
   * in a screenshot, so the property is asserted rather than eyeballed.
   *
   * Tunnels that share a room meet at it and are skipped; anything else that
   * touches is a crossing.
   */
  it('draws no tunnel across another', () => {
    const point = (room: number) => LAYOUT[room]!

    const orientation = (
      [ax, ay]: readonly [number, number],
      [bx, by]: readonly [number, number],
      [cx, cy]: readonly [number, number],
    ) => {
      const v = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
      return Math.abs(v) < 1e-9 ? 0 : Math.sign(v)
    }

    for (const [a, b] of EDGES) {
      for (const [c, d] of EDGES) {
        if (a === c && b === d) continue
        // Sharing an endpoint is a junction, not a crossing.
        if (a === c || a === d || b === c || b === d) continue

        const [p1, p2, p3, p4] = [point(a), point(b), point(c), point(d)]
        const crosses =
          orientation(p1, p2, p3) !== orientation(p1, p2, p4) &&
          orientation(p3, p4, p1) !== orientation(p3, p4, p2)
        expect(crosses, `tunnel ${a}-${b} crosses ${c}-${d}`).toBe(false)
      }
    }
  })
})
