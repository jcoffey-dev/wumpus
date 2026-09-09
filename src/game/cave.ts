/**
 * The cave is a dodecahedron and always has been.
 *
 * Yob's note on the game says it plainly: he was tired of grid games, so he
 * hung the rooms on the vertices of a dodecahedron. Twenty rooms, three
 * tunnels from each, thirty tunnels in all. That is not a parameter and it is
 * not generated -- it is the shape of the game, and it is the same shape in
 * every cave you will ever walk into here.
 *
 * What changes between caves is only where the hazards sit. That is worth
 * being clear about, because it is the whole reason the game is playable at
 * all: you are not learning a maze, you are learning to read three sentences
 * about a room you cannot see.
 */

/** Rooms are numbered 1..20, the way they are printed. */
export const ROOM_COUNT = 20

/**
 * The adjacency Yob used, in the order the rooms print.
 *
 * Written out rather than derived. A dodecahedron can be generated, but the
 * generated one comes out with an arbitrary numbering, and this numbering is
 * the one every listing of this game has used since 1973 -- so room 1 has
 * always led to 2, 5 and 8, and a transcript from a magazine still makes
 * sense against it. `cave.test.ts` proves it is a real dodecahedron rather
 * than trusting that it was typed correctly.
 */
export const TUNNELS: readonly (readonly number[])[] = Object.freeze([
  Object.freeze([2, 5, 8]), //   1
  Object.freeze([1, 3, 10]), //  2
  Object.freeze([2, 4, 12]), //  3
  Object.freeze([3, 5, 14]), //  4
  Object.freeze([1, 4, 6]), //   5
  Object.freeze([5, 7, 15]), //  6
  Object.freeze([6, 8, 17]), //  7
  Object.freeze([1, 7, 9]), //   8
  Object.freeze([8, 10, 18]), // 9
  Object.freeze([2, 9, 11]), //  10
  Object.freeze([10, 12, 19]), //11
  Object.freeze([3, 11, 13]), // 12
  Object.freeze([12, 14, 20]), //13
  Object.freeze([4, 13, 15]), // 14
  Object.freeze([6, 14, 16]), // 15
  Object.freeze([15, 17, 20]), //16
  Object.freeze([7, 16, 18]), // 17
  Object.freeze([9, 17, 19]), // 18
  Object.freeze([11, 18, 20]), //19
  Object.freeze([13, 16, 19]), //20
])

/** The three tunnels out of a room, in printing order. */
export function tunnelsFrom(room: number): readonly number[] {
  return TUNNELS[room - 1] ?? []
}

export function areConnected(a: number, b: number): boolean {
  return tunnelsFrom(a).includes(b)
}

export const isRoom = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= ROOM_COUNT

/**
 * Where each room sits when the cave is drawn flat.
 *
 * A dodecahedron cannot be drawn on paper without lying about something, so
 * this is the Schlegel diagram: one face pushed out to become the rim and the
 * other eleven nested inside it. Done right, every tunnel is a straight line
 * and no two of them cross -- which is the property `cave.test.ts` checks,
 * because it is the one that makes the map readable and the one that is easy
 * to break by moving a room.
 *
 * The rings are 5 / 10 / 5, and the middle one is the part that is easy to
 * get wrong. Rooms 6 to 15 are not two pentagons at different depths; they
 * are a single ten-room ring that alternates between the rooms wired inward
 * to the middle pentagon (8, 10, 12, 14, 6) and the rooms wired outward to
 * the rim (9, 11, 13, 15, 7). Drawing them as two rings is what puts crossed
 * tunnels on the map.
 *
 * Unit coordinates about an origin at (0, 0); the map scales them.
 */
export const LAYOUT: Readonly<Record<number, readonly [number, number]>> = Object.freeze(
  buildLayout(),
)

function buildLayout(): Record<number, [number, number]> {
  /**
   * Each ring in the order its rooms are wired together, so that the nth
   * entry of one ring lines up radially with the room it is joined to. Room 1
   * leads out to 8, and 8 leads out to 9 and back to 7, so 1 / 8 / 18 all sit
   * on rays a fixed angle apart.
   */
  const rings: [number[], number][] = [
    [[1, 2, 3, 4, 5], 0.3],
    [[8, 9, 10, 11, 12, 13, 14, 15, 6, 7], 0.66],
    [[18, 19, 20, 16, 17], 1.0],
  ]

  const out: Record<number, [number, number]> = {}
  for (const [rooms, radius] of rings) {
    const step = 360 / rooms.length
    rooms.forEach((room, i) => {
      // -90 puts the first room of each ring at the top rather than the right.
      // The rim starts one half-step round, because 18 hangs off 9 rather
      // than off 8.
      const offset = rooms.length === 5 && radius === 1 ? 36 : 0
      const rad = ((-90 + offset + step * i) * Math.PI) / 180
      out[room] = [Math.cos(rad) * radius, Math.sin(rad) * radius]
    })
  }
  return out
}

/** Every tunnel once, as a pair, so the map does not draw each of them twice. */
export const EDGES: readonly (readonly [number, number])[] = Object.freeze(
  TUNNELS.flatMap((to, i) =>
    to.filter((b) => i + 1 < b).map((b) => Object.freeze([i + 1, b]) as readonly [number, number]),
  ),
)
