import { EDGES, LAYOUT, ROOM_COUNT, tunnelsFrom } from '../game/cave'
import type { Cave, Hazard } from '../game/types'

/**
 * The remaster: the cave, drawn.
 *
 * Every mark here is generated from `LAYOUT` and `EDGES` -- there is no
 * artwork file in this repository and there is not going to be one. Cel
 * shading in practice means flat fills, one heavy outline, and a highlight
 * that is a second flat fill rather than a gradient, which is a style that
 * happens to suit a thing made entirely of `<circle>` and `<path>`.
 *
 * The hard rule is that this component may not show the player anything the
 * teletype has not already printed. It takes `reveal` for the two screens
 * that are allowed to lift that -- the death and the standings -- and
 * everywhere else the wumpus, the pits and the bats are simply not in the
 * output. A map that quietly knows more than the transcript would make the
 * remaster an easier game than the original, and they are meant to be the
 * same game.
 */

const R = 210 // Unit radius; the viewBox is a little larger to hold labels.
const ROOM_R = 15

type Known = { hazards: Hazard[]; visited: boolean; adjacent: boolean }

export function CaveMap({
  cave,
  reveal = false,
  aim = [],
}: {
  cave: Cave
  /** Show where everything actually was. Only the end of a hunt earns this. */
  reveal?: boolean
  /** Rooms in the arrow path being typed, so a shot can be seen before it flies. */
  aim?: readonly number[]
}) {
  const at = (room: number): [number, number] => {
    const [x, y] = LAYOUT[room] ?? [0, 0]
    return [x * R, y * R]
  }

  const near = tunnelsFrom(cave.you)
  const known = new Map<number, Known>()
  for (let room = 1; room <= ROOM_COUNT; room++) {
    known.set(room, {
      hazards: cave.sensed[room] ? [...cave.sensed[room]] : [],
      visited: cave.visited.includes(room),
      adjacent: near.includes(room),
    })
  }

  /**
   * What a room is worth worrying about, from what has been printed only.
   *
   * A room the hunter has stood in is safe and is drawn so. A room next to a
   * warning is suspect, and the map says which warning -- never which room
   * the hazard is actually in, because nothing has told the hunter that.
   */
  const suspicion = (room: number): Hazard[] => {
    if (known.get(room)!.visited) return []
    const out = new Set<Hazard>()
    for (const from of cave.visited) {
      if (!tunnelsFrom(from).includes(room)) continue
      for (const h of cave.sensed[from] ?? []) out.add(h)
    }
    return [...out]
  }

  const aimPath = aim.length ? [cave.you, ...aim] : []

  return (
    <svg
      className="cave-map"
      viewBox={`${-R - 34} ${-R - 34} ${(R + 34) * 2} ${(R + 34) * 2}`}
      role="img"
      aria-label={`Cave map. You are in room ${cave.you}.`}
    >
      <defs>
        {/* The lamp. A radial fill is the one gradient the style allows,
            because it is light rather than shading. */}
        <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd97a" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#ffb347" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Tunnels first, so the rooms sit on top of them. */}
      <g className="tunnels">
        {EDGES.map(([a, b]) => {
          const [ax, ay] = at(a)
          const [bx, by] = at(b)
          const walked = cave.visited.includes(a) && cave.visited.includes(b)
          const lit = a === cave.you || b === cave.you
          return (
            <line
              key={`${a}-${b}`}
              x1={ax}
              y1={ay}
              x2={bx}
              y2={by}
              className={`tunnel${lit ? ' tunnel-lit' : walked ? ' tunnel-walked' : ''}`}
            />
          )
        })}
      </g>

      {/* The arrow being aimed, drawn over the tunnels it is going down. */}
      {aimPath.length > 1 && (
        <polyline
          className="aim"
          points={aimPath.map((r) => at(r).join(',')).join(' ')}
          fill="none"
        />
      )}

      <circle cx={at(cave.you)[0]} cy={at(cave.you)[1]} r={96} fill="url(#lamp)" />

      <g className="rooms">
        {Array.from({ length: ROOM_COUNT }, (_, i) => i + 1).map((room) => {
          const k = known.get(room)!
          const worry = suspicion(room)
          const here = room === cave.you
          const shown = reveal
            ? [
                ...(cave.wumpus === room ? (['wumpus'] as Hazard[]) : []),
                ...(cave.pits.includes(room) ? (['pit'] as Hazard[]) : []),
                ...(cave.bats.includes(room) ? (['bats'] as Hazard[]) : []),
              ]
            : []
          const [x, y] = at(room)

          const cls = [
            'room',
            here && 'room-here',
            k.visited && !here && 'room-visited',
            k.adjacent && !here && 'room-open',
            !reveal && worry.length > 0 && 'room-suspect',
            reveal && shown.length > 0 && 'room-revealed',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <g key={room} className={cls} transform={`translate(${x} ${y})`}>
              <circle className="room-disc" r={ROOM_R} />
              <text className="room-label" y={4}>
                {room}
              </text>

              {/* Warnings sit above the room as marks, never as the answer. */}
              {!reveal && worry.length > 0 && (
                <g className="marks" transform={`translate(0 ${-ROOM_R - 9})`}>
                  {worry.map((h, i) => (
                    <Mark key={h} hazard={h} x={(i - (worry.length - 1) / 2) * 15} />
                  ))}
                </g>
              )}

              {reveal &&
                shown.map((h, i) => (
                  <g key={h} transform={`translate(${(i - (shown.length - 1) / 2) * 18} ${-ROOM_R - 12})`}>
                    <Truth hazard={h} />
                  </g>
                ))}

              {here && <Hunter />}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/** A suspicion: the shape of a warning, not the thing itself. */
function Mark({ hazard, x }: { hazard: Hazard; x: number }) {
  if (hazard === 'wumpus') {
    // A nose. It is the smell that has been reported, so it is a nostril.
    return (
      <g transform={`translate(${x} 0)`} className="mark mark-wumpus">
        <path d="M-5 3 Q0 -6 5 3 Q0 6 -5 3 Z" />
      </g>
    )
  }
  if (hazard === 'pit') {
    // A draft. Three lines leaning the way the air is going.
    return (
      <g transform={`translate(${x} 0)`} className="mark mark-pit">
        <path d="M-6 -3 H4 M-6 0 H6 M-6 3 H3" />
      </g>
    )
  }
  return (
    <g transform={`translate(${x} 0)`} className="mark mark-bats">
      <path d="M-6 2 Q-3 -4 0 1 Q3 -4 6 2" />
    </g>
  )
}

/** What was actually in the room, once the hunt is over and it can be told. */
function Truth({ hazard }: { hazard: Hazard }) {
  if (hazard === 'wumpus') {
    return (
      <g className="truth truth-wumpus">
        <path d="M-9 6 Q-11 -6 0 -8 Q11 -6 9 6 Z" />
        <circle cx={-3.5} cy={-2} r={1.7} className="eye" />
        <circle cx={3.5} cy={-2} r={1.7} className="eye" />
        <path d="M-4 3 L-2 6 L0 3 L2 6 L4 3" className="teeth" />
      </g>
    )
  }
  if (hazard === 'pit') {
    return (
      <g className="truth truth-pit">
        <ellipse rx={9} ry={5} />
        <ellipse rx={5} ry={2.6} className="deeper" />
      </g>
    )
  }
  return (
    <g className="truth truth-bats">
      <path d="M-10 3 Q-6 -5 -2 1 Q0 -3 2 1 Q6 -5 10 3 Q5 0 0 4 Q-5 0 -10 3 Z" />
    </g>
  )
}

/**
 * The hunter.
 *
 * Drawn as a ring around the room rather than a figure standing on it. A
 * figure covered the room number, and the number is what the whole game is
 * played in -- "TUNNELS LEAD TO 13 16 19" is useless if you cannot see which
 * one you are standing in.
 */
function Hunter() {
  return (
    <g className="hunter">
      <circle r={ROOM_R + 7} className="hunter-ring" />
      <circle r={ROOM_R + 11} className="hunter-ring hunter-ring-outer" />
    </g>
  )
}
