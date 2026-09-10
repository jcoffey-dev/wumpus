/**
 * One board, shared by everybody, held by the scores service rather than the
 * browser. Nothing about it is trusted on the way in: the server decides what
 * is plausible, and the client re-checks the shape of whatever comes back
 * before putting it on screen.
 *
 * The service is shared with the other games on the site rather than being one
 * of ours -- see https://github.com/jcoffey-dev/games-scores. That is why
 * every call names the game. Nothing else about it leaks in here: the rows
 * come back in this game's own field names, so this file would be identical if
 * the board were ours alone.
 */

/** Which board on the shared service is ours. */
export const GAME = 'wumpus'

const BASE = (import.meta.env.VITE_SCORES_API ?? '/api').replace(/\/+$/, '')
const TIMEOUT_MS = 8000

export const MAX_SCORES = 50

export interface Score {
  id: string
  name: string
  /** Wumpodes bagged. The rank, before any tie-break. */
  bagged: number
  /** Arrows still in the quiver when the expedition ended. */
  arrows: number
  roomsWalked: number
  /** How it ended, or null for a hunter who climbed out on their own legs. */
  died: string | null
  at: number
}

export type NewScore = Omit<Score, 'id' | 'at'>

function isScore(v: unknown): v is Score {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    Number.isFinite(s.bagged) &&
    Number.isFinite(s.arrows) &&
    Number.isFinite(s.roomsWalked) &&
    (s.died === null || typeof s.died === 'string') &&
    Number.isFinite(s.at)
  )
}

const parseBoard = (body: unknown): Score[] => {
  const rows = (body as { scores?: unknown })?.scores
  if (!Array.isArray(rows)) return []
  return rows
    .filter(isScore)
    .map((s) => ({ ...s, name: s.name.slice(0, 12) }))
    .slice(0, MAX_SCORES)
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const why = (body as { error?: string })?.error
    throw new Error(why ?? `scores service returned ${res.status}`)
  }
  return body
}

export async function fetchScores(): Promise<Score[]> {
  return parseBoard(await call(`/scores?game=${GAME}`))
}

/** Posts every hunter in the party at once and returns the new board. */
export async function submitScores(
  entries: NewScore[],
): Promise<{ ids: string[]; scores: Score[] }> {
  const body = await call('/scores', {
    method: 'POST',
    body: JSON.stringify({ game: GAME, entries }),
  })
  const ids = (body as { ids?: unknown })?.ids
  return {
    ids: Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : [],
    scores: parseBoard(body),
  }
}
