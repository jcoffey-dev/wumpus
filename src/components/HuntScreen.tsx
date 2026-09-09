import { useEffect, useMemo, useState } from 'react'
import { MAX_ARROW_PATH } from '../game/constants'
import { areConnected, tunnelsFrom } from '../game/cave'
import type { Cave, Command, Line } from '../game/types'
import { useSkin } from '../skin'
import { CaveMap } from './CaveMap'
import { Btn } from './Frame'
import { Teletype } from './Teletype'

/**
 * The screen where the game is played, and the only one either skin shows
 * differently in any way that matters.
 *
 * 1973 gets the transcript and a prompt. The remaster gets the map, the same
 * transcript underneath it, and buttons for the rooms you can reach -- which
 * is a convenience over typing a number, not information. The three tunnels
 * out of a room are printed in both skins, because the listing printed them.
 */
export function HuntScreen({
  cave,
  transcript,
  hunterName,
  busy,
  onCommand,
  onBlip,
  onReject,
}: {
  cave: Cave
  transcript: Line[]
  hunterName: string
  /** True while the teletype is still printing; a prompt mid-line is a lie. */
  busy: boolean
  onCommand: (c: Command) => void
  onBlip: () => void
  onReject: () => void
}) {
  const { skin } = useSkin()
  const [mode, setMode] = useState<'move' | 'shoot'>('move')
  const [path, setPath] = useState<number[]>([])
  const exits = tunnelsFrom(cave.you)

  // A new room is a fresh decision; never carry a half-typed shot into it.
  useEffect(() => {
    setMode('move')
    setPath([])
  }, [cave.you, cave.depth])

  /** Where the arrow is now, so the next room can be offered from there. */
  const arrowAt = path.length ? path[path.length - 1]! : cave.you
  const arrowExits = tunnelsFrom(arrowAt)

  const canFire = path.length > 0
  const canExtend = path.length < MAX_ARROW_PATH

  const shoot = () => {
    if (!canFire) return onReject()
    onCommand({ type: 'shoot', path })
    setPath([])
    setMode('move')
  }

  const move = (to: number) => {
    if (!areConnected(cave.you, to)) return onReject()
    onCommand({ type: 'move', to })
  }

  // Typing a room number works in both skins; it is how the game was played.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy) return
      if (e.key === 'Escape') {
        setPath([])
        setMode('move')
        return
      }
      if (e.key === 'Enter' && mode === 'shoot') {
        shoot()
        return
      }
      const n = Number(e.key)
      if (!Number.isInteger(n)) return
      // Room numbers run to 20, so a digit alone is ambiguous; the buttons
      // and the number field are the honest ways in. This is a shortcut for
      // the common case only: a single-digit room you can actually reach.
      const target = mode === 'move' ? exits : arrowExits
      const hit = target.find((r) => r === n)
      if (hit === undefined) return
      if (mode === 'move') move(hit)
      else setPath((p) => (p.length < MAX_ARROW_PATH ? [...p, hit] : p))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const senses = useMemo(
    () => transcript.filter((l) => l.kind === 'sense').slice(-3),
    [transcript],
  )

  return (
    <div className="stack hunt">
      {skin === 'modern' && (
        <div className="map-wrap">
          <CaveMap cave={cave} aim={path} />
        </div>
      )}

      <Teletype lines={transcript} />

      {!busy && !cave.outcome && (
        <div className="prompt">
          {mode === 'move' ? (
            <>
              <div className="prompt-q">WALK, OR SHOOT?</div>
              <div className="prompt-row">
                <Btn
                  kind="primary"
                  onClick={() => {
                    onBlip()
                    setMode('shoot')
                  }}
                  title="Fire a crooked arrow"
                >
                  SHOOT
                </Btn>
                <span className="prompt-sep">WHICH TUNNEL?</span>
                {exits.map((r) => (
                  <Btn key={r} onClick={() => move(r)} title={`Walk into room ${r}`}>
                    {r}
                  </Btn>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="prompt-q">
                AIM IT THROUGH HOW MANY ROOMS, UP TO {MAX_ARROW_PATH}?{' '}
                {path.length ? path.join(' - ') : '--'}
              </div>
              <div className="prompt-row">
                {canExtend ? (
                  arrowExits.map((r) => (
                    <Btn
                      key={r}
                      onClick={() => {
                        onBlip()
                        setPath((p) => [...p, r])
                      }}
                      title={`Send the arrow on to room ${r}`}
                    >
                      {r}
                    </Btn>
                  ))
                ) : (
                  <span className="prompt-sep">THE ARROW WILL GO NO FURTHER</span>
                )}
                <Btn kind="primary" onClick={shoot} disabled={!canFire} title="Loose the arrow">
                  FIRE
                </Btn>
                <Btn
                  kind="ghost"
                  onClick={() => {
                    onBlip()
                    setPath([])
                    setMode('move')
                  }}
                >
                  BACK
                </Btn>
              </div>
              {/* The rule that makes long shots frightening, said out loud. */}
              <div className="prompt-note">
                NAME A ROOM THE ARROW CANNOT REACH AND IT PICKS ITS OWN TUNNEL.
              </div>
            </>
          )}
        </div>
      )}

      <div className="statusbar">
        <span>{hunterName}</span>
        <span>CAVE {cave.depth}</span>
        <span>ARROWS {cave.arrows}</span>
        <span className="senses">{senses.map((s) => s.text).join('  ') || ' '}</span>
      </div>
    </div>
  )
}
