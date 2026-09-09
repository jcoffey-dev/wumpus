import { useCallback, useEffect, useRef, useState, useReducer } from 'react'
import { DREAD_END, DREAD_HUNT, DREAD_TITLE } from './audio/dread'
import { END_TUNE, HUNT_TUNE, TITLE_TUNE } from './audio/tunes'
import { synth } from './audio/synth'
import { NO_TUNNEL_TEXT } from './game/constants'
import { describe, layCave, randomSeed, step } from './game/engine'
import { makeRng, type Rng } from './game/rng'
import { fetchScores, submitScores, type Score } from './game/highscores'
import {
  currentHunter,
  depthFor,
  initialState,
  livingHunters,
  reducer,
} from './game/reducer'
import type { Command, Line } from './game/types'
import { useSkin } from './skin'
import { Btn, Fit, Frame } from './components/Frame'
import { HuntScreen } from './components/HuntScreen'
import {
  BootScreen,
  GameOverScreen,
  HighScoreScreen,
  InstructionsScreen,
  ReportScreen,
  SetupScreen,
  TitleScreen,
  type BoardState,
} from './components/screens'
import './App.css'

/**
 * AGPL section 13: anyone playing this over a network is entitled to the
 * source of the version they are playing, so the offer sits on every screen.
 */
const SOURCE_URL = 'https://github.com/Coffey-Labs/wumpus'

export default function App() {
  const [seed] = useState(randomSeed)
  const [state, dispatch] = useReducer(reducer, seed, initialState)
  const rng = useRef<Rng>(makeRng(seed))
  const [music, setMusic] = useState(true)
  const [sfx, setSfx] = useState(true)
  const started = useRef(false)
  const { skin, toggle: toggleSkin } = useSkin()
  const [scores, setScores] = useState<Score[]>([])
  const [boardState, setBoardState] = useState<BoardState>('loading')
  const [freshScores, setFreshScores] = useState<string[]>([])
  /** True while the teletype is mid-line, so no prompt appears over it. */
  const [printing, setPrinting] = useState(false)

  const who = currentHunter(state)

  // ------------------------------------------------------------ audio glue

  const wake = useCallback(() => {
    if (started.current) return
    started.current = true
    synth.ensure()
    synth.setMusic(music)
    synth.setSfx(sfx)
  }, [music, sfx])

  // 1973 gets the chiptune it never had; the remaster gets the other band.
  useEffect(() => {
    if (!started.current) return
    const front =
      state.phase === 'title' || state.phase === 'instructions' || state.phase === 'setup'
    const set =
      skin === 'modern'
        ? { title: DREAD_TITLE, hunt: DREAD_HUNT, end: DREAD_END }
        : { title: TITLE_TUNE, hunt: HUNT_TUNE, end: END_TUNE }
    const tune = state.phase === 'gameover' ? set.end : front ? set.title : set.hunt
    synth.playTune(tune, false)
  }, [state.phase, skin])

  useEffect(() => {
    synth.setMusic(music)
  }, [music])
  useEffect(() => {
    synth.setSfx(sfx)
  }, [sfx])

  const loadBoard = useCallback(async () => {
    setBoardState('loading')
    try {
      setScores(await fetchScores())
      setBoardState('ready')
    } catch {
      setBoardState('error')
    }
  }, [])

  const blip = useCallback(() => synth.blip(), [])

  // ---------------------------------------------------------------- turns

  /**
   * Lay a cave for whoever is up and print the first room.
   *
   * A cave is dealt off the same seeded stream as everything else, which is
   * what makes a whole expedition -- four hunters, a dozen caves -- replayable
   * from one number in the footer.
   */
  const enterCave = useCallback((depth: number, arrows: number) => {
    const cave = layCave(depth, arrows, rng.current)
    const lines: Line[] = [
      { kind: 'system', text: `HUNT THE WUMPUS -- CAVE ${depth}` },
      ...describe(cave),
    ]
    dispatch({ type: 'ENTER_CAVE', cave, lines })
  }, [])

  // Whenever it is somebody's turn and there is no cave, deal them one.
  useEffect(() => {
    if (state.phase !== 'hunting' || state.cave || !who) return
    enterCave(depthFor(who), who.arrows)
  }, [state.phase, state.cave, who, enterCave])

  const command = (c: Command) => {
    if (!state.cave) return
    const { cave, lines } = step(state.cave, c, rng.current)

    // The sound belongs to what happened, so it is chosen from the lines the
    // engine produced rather than guessed at from the command.
    if (c.type === 'shoot') synth.arrow()
    else if (lines.some((l) => l.kind === 'system' && l.text === NO_TUNNEL_TEXT)) synth.reject()
    else synth.walk()

    if (lines.some((l) => l.kind === 'bats')) synth.bats()
    if (cave.outcome === 'fell-in-a-pit') synth.pit()
    if (cave.outcome === 'eaten') synth.wumpus()
    if (cave.outcome === 'shot-the-wumpus') synth.fanfare()
    if (cave.outcome === 'shot-yourself' || cave.outcome === 'out-of-arrows') synth.sad()

    // A room that refused the move prints its refusal and nothing else.
    const next = cave.outcome
      ? { cave, lines }
      : { cave, lines: c.type === 'move' && cave.you !== state.cave.you ? [...lines, ...describe(cave)] : lines }

    dispatch({ type: 'ADVANCE', cave: next.cave, lines: next.lines })
  }

  // The report waits for the teletype to finish saying how it ended.
  useEffect(() => {
    if (state.phase !== 'resolve' || printing) return
    const t = window.setTimeout(() => dispatch({ type: 'SHOW_REPORT' }), 500)
    return () => window.clearTimeout(t)
  }, [state.phase, printing])

  const start = (names: string[]) => {
    wake()
    synth.select()
    dispatch({ type: 'START', names })
  }

  const nextTurn = () => {
    synth.select()
    dispatch({ type: 'NEXT_TURN' })
  }

  /**
   * Close the books. The standings show straight away; posting to the board
   * happens behind them, so a slow or missing line out never holds up the end
   * of an expedition.
   */
  const post = useCallback(
    (hunters: typeof state.hunters) => {
      setBoardState('loading')
      submitScores(
        hunters.map((h) => ({
          name: h.name,
          bagged: h.bagged,
          arrows: h.arrows,
          roomsWalked: h.roomsWalked,
          died: h.died,
        })),
      )
        .then(({ ids, scores: table }) => {
          setScores(table)
          setFreshScores(ids)
          setBoardState('ready')
        })
        .catch(() => setBoardState('error'))
    },
    [],
  )

  const climbOut = () => {
    synth.fanfare()
    dispatch({ type: 'CLIMB_OUT' })
    post(state.hunters)
  }

  // An expedition that ends because everybody died posts itself.
  const posted = useRef(false)
  useEffect(() => {
    if (state.phase !== 'gameover' || posted.current) return
    posted.current = true
    if (!state.climbedOut) post(state.hunters)
  }, [state.phase, state.climbedOut, state.hunters, post])

  const restart = () => {
    const s = randomSeed()
    rng.current = makeRng(s)
    posted.current = false
    setFreshScores([])
    dispatch({ type: 'RESTART', seed: s })
  }

  const showScores = () => {
    wake()
    synth.select()
    dispatch({ type: 'SHOW_SCORES' })
    if (boardState !== 'ready') void loadBoard()
  }

  // --------------------------------------------------------------- render

  const moreToCome = livingHunters(state).some((h) => h.id !== who?.id)

  return (
    <div className="app" onPointerDown={wake} onKeyDown={wake}>
      <Frame
        footer={
          <div className="controls">
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                setMusic((m) => !m)
              }}
              title="Background music"
            >
              MUSIC {music ? 'ON' : 'OFF'}
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                setSfx((s) => !s)
              }}
              title="Sound effects"
            >
              SOUND {sfx ? 'ON' : 'OFF'}
            </Btn>
            <Btn
              kind="ghost"
              onClick={() => {
                wake()
                synth.select()
                toggleSkin()
              }}
              title={skin === 'teletype' ? 'Switch to the remaster' : 'Switch to the 1973 Teletype'}
            >
              {skin === 'teletype' ? 'REMASTER' : '1973'}
            </Btn>
            <Btn kind="ghost" onClick={restart} title="Abandon this expedition">
              NEW HUNT
            </Btn>
            <a
              className="btn btn-ghost"
              href={SOURCE_URL}
              target="_blank"
              rel="noreferrer noopener"
              title="Free software, AGPL-3.0-or-later"
            >
              SOURCE
            </a>
            <span className="seed">SEED {state.seed}</span>
          </div>
        }
      >
        {state.phase === 'boot' && <BootScreen onLoaded={() => dispatch({ type: 'BOOTED' })} />}

        <Fit>
          {state.phase === 'title' && (
            <TitleGate
              onStart={() => {
                wake()
                synth.select()
                dispatch({ type: 'SHOW_SETUP' })
              }}
              onInstructions={() => {
                wake()
                synth.select()
                dispatch({ type: 'SHOW_INSTRUCTIONS' })
              }}
              onScores={showScores}
            />
          )}

          {state.phase === 'instructions' && (
            <InstructionsScreen onDone={() => dispatch({ type: 'SHOW_SETUP' })} />
          )}

          {state.phase === 'setup' && <SetupScreen onStart={start} onBlip={blip} />}

          {(state.phase === 'hunting' || state.phase === 'resolve') && state.cave && who && (
            <HuntScreen
              key={`${who.id}-${state.cave.depth}`}
              cave={state.cave}
              transcript={state.transcript}
              hunterName={who.name}
              busy={printing}
              onCommand={command}
              onBlip={blip}
              onReject={() => synth.reject()}
            />
          )}

          {state.phase === 'report' && state.cave && who && (
            <ReportScreen
              cave={state.cave}
              hunter={who}
              moreToCome={moreToCome}
              onNext={nextTurn}
              onClimbOut={climbOut}
            />
          )}

          {state.phase === 'gameover' && (
            <GameOverScreen
              hunters={state.hunters}
              climbedOut={state.climbedOut}
              onRestart={restart}
              onScores={showScores}
            />
          )}

          {state.phase === 'scores' && (
            <HighScoreScreen
              scores={scores}
              state={boardState}
              highlight={freshScores}
              onBack={() => {
                synth.select()
                dispatch({ type: 'CLOSE_SCORES' })
              }}
              onRetry={() => {
                synth.select()
                void loadBoard()
              }}
            />
          )}
        </Fit>
      </Frame>
      {/* Kept out of the tree above so a re-render of the game cannot reset it. */}
      <PrintingWatcher lines={state.transcript} onChange={setPrinting} />
    </div>
  )
}

/**
 * Whether the machine is still typing.
 *
 * The prompt must not appear while a line is half printed -- the whole point
 * of the teletype is that you read the room before you answer it. This
 * watches the transcript rather than the printer so both skins agree, and so
 * the remaster's map does not become a way to skip the reading.
 *
 * It times the characters that have just *arrived*, not the whole transcript.
 * Timing the whole thing is the obvious way to write this and it is wrong in
 * a way that takes a few turns to notice: `Teletype` only prints lines it has
 * not printed yet, so the wait kept growing while the actual printing stayed
 * the same length, and by the fourth room the prompt was gone for five
 * seconds after a print that took one.
 */
function PrintingWatcher({
  lines,
  onChange,
}: {
  lines: Line[]
  onChange: (busy: boolean) => void
}) {
  const chars = lines.reduce((n, l) => n + l.text.length, 0)
  const printed = useRef(0)

  useEffect(() => {
    // A new cave throws the transcript away; nothing is owed from the old one.
    if (chars < printed.current) printed.current = 0

    const fresh = chars - printed.current
    printed.current = chars
    if (fresh <= 0) {
      onChange(false)
      return
    }

    onChange(true)
    // 42 characters a second, plus a beat to read the last line.
    const t = window.setTimeout(() => onChange(false), (fresh / 42) * 1000 + 120)
    return () => window.clearTimeout(t)
  }, [chars, onChange])
  return null
}

/** Enter or Space starts the hunt, the way a terminal would take it. */
function TitleGate(props: {
  onStart: () => void
  onInstructions: () => void
  onScores: () => void
}) {
  const { onStart } = props
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onStart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStart])
  return <TitleScreen {...props} />
}
