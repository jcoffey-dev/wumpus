import { useEffect, useRef, useState } from 'react'
import { DIAL_UP, synth } from '../audio/synth'
import { MAX_HUNTERS, MAX_NAME, STARTING_ARROWS } from '../game/constants'
import { ROOM_COUNT } from '../game/cave'
import { compareHunts, outcomeText } from '../game/engine'
import type { Score } from '../game/highscores'
import type { Cave, Hunter } from '../game/types'
import { isWin } from '../game/types'
import { CaveMap } from './CaveMap'
import { Btn, Line } from './Frame'

/**
 * Everything that is not the hunt itself. These are small enough that keeping
 * them in one file makes the shape of the game easier to see than eight files
 * would, and none of them holds a rule.
 */

// ------------------------------------------------------------------- boot

/**
 * Dialling in.
 *
 * The lemonade stand loads from cassette because that is how an Atari got its
 * programs. This game is six years older than that machine and did not live on
 * a machine you owned at all -- it lived on a timesharing service you
 * telephoned. So the boot is a real Bell 103 call, and pushing the handset
 * into the coupler is the gesture that unlocks the audio.
 *
 * The stages are printed as they happen, from the same schedule the audio is
 * built on, so what is on the paper is what is on the line. See DIAL_UP.
 */
const STAGES: [number, string][] = [
  [0, 'DIAL TONE'],
  [DIAL_UP.dialTone, 'DIALLING 555-1973'],
  [DIAL_UP.ringAt, 'RINGING'],
  [DIAL_UP.answerAt, 'ANSWER TONE 2225 HZ'],
  [DIAL_UP.answerAt + DIAL_UP.answer, 'CARRIER -- 110 BAUD, FULL DUPLEX'],
]

export function BootScreen({ onLoaded }: { onLoaded: () => void }) {
  const [dialling, setDialling] = useState(false)
  const [stage, setStage] = useState(-1)
  const stop = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!dialling) return
    stop.current = synth.dialUp()

    const timers = STAGES.map(([at], i) =>
      window.setTimeout(() => setStage(i), at * 1000),
    )
    const done = window.setTimeout(() => {
      stop.current?.()
      onLoaded()
    }, DIAL_UP.total * 1000)

    return () => {
      for (const t of timers) window.clearTimeout(t)
      window.clearTimeout(done)
      stop.current?.()
    }
  }, [dialling, onLoaded])

  /** Nobody should have to sit through a handshake twice. */
  const skip = () => {
    stop.current?.()
    onLoaded()
  }

  return (
    <div className="stack boot">
      <Line className="accent">PEOPLE&apos;S COMPUTER COMPANY</Line>
      <Line> </Line>
      {dialling ? (
        <>
          {STAGES.slice(0, stage + 1).map(([, label]) => (
            <Line key={label}>{label}</Line>
          ))}
          <Line> </Line>
          <Btn kind="ghost" onClick={skip} title="Skip the handshake">
            SKIP
          </Btn>
        </>
      ) : (
        <>
          <Line>TELEPHONE THE MACHINE TO BEGIN.</Line>
          <Line> </Line>
          <Btn
            kind="primary"
            onClick={() => setDialling(true)}
            title="Dial in. This is also what lets the browser make a sound."
          >
            DIAL
          </Btn>
          <Line> </Line>
          <Line className="dim">SOUND STARTS HERE, AS BROWSERS INSIST.</Line>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ title

export function TitleScreen({
  onStart,
  onInstructions,
  onScores,
}: {
  onStart: () => void
  onInstructions: () => void
  onScores: () => void
}) {
  return (
    <div className="stack title">
      <pre className="banner" aria-label="Hunt the Wumpus">{`
 HUNT THE WUMPUS
`}</pre>
      <Line className="dim">TWENTY ROOMS. THREE TUNNELS EACH. ONE OF IT.</Line>
      <Line> </Line>
      <div className="prompt-row">
        <Btn kind="primary" onClick={onStart}>
          HUNT
        </Btn>
        <Btn onClick={onInstructions}>INSTRUCTIONS</Btn>
        <Btn onClick={onScores}>BOARD</Btn>
      </div>
    </div>
  )
}

// ----------------------------------------------------------- instructions

/**
 * The rules, on request, the way the machine offered them in 1973 -- but in
 * our words rather than Yob's. See NOTICE.md: the rules themselves are ideas
 * and free to use, the sentences he wrote to explain them are not.
 */
export function InstructionsScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="stack rules">
      <Line className="accent">THE CAVE</Line>
      <Line>
        {ROOM_COUNT} ROOMS, EACH WITH EXACTLY THREE TUNNELS OUT OF IT. THE SHAPE NEVER CHANGES.
        WHAT IS IN IT DOES.
      </Line>
      <Line> </Line>
      <Line className="accent">WHAT IS DOWN THERE WITH YOU</Line>
      <Line>ONE WUMPUS. IT SLEEPS. IT IS TOO HEAVY TO FALL DOWN A PIT AND TOO HEAVY FOR THE
        BATS TO LIFT, SO NOTHING DOWN HERE TROUBLES IT BUT YOU.</Line>
      <Line>TWO PITS. WALK INTO ONE AND YOU KEEP GOING.</Line>
      <Line>TWO ROOSTS OF BATS. THEY WILL NOT HURT YOU. THEY WILL PICK YOU UP AND PUT YOU DOWN
        SOMEWHERE ELSE, AND THEY DO NOT CARE WHAT IS ALREADY THERE.</Line>
      <Line> </Line>
      <Line className="accent">WHAT THE CAVE TELLS YOU</Line>
      <Line>STANDING ONE TUNNEL AWAY FROM ANY OF THEM, YOU WILL KNOW SOMETHING IS CLOSE. YOU
        WILL NEVER BE TOLD WHICH ROOM. THREE TUNNELS AND ONE WARNING IS THE WHOLE PUZZLE.</Line>
      <Line> </Line>
      <Line className="accent">YOUR TURN</Line>
      <Line>WALK, OR SHOOT. YOU CARRY {STARTING_ARROWS} ARROWS AND THEY ARE CROOKED: EACH ONE
        CAN BE AIMED THROUGH AS MANY AS FIVE ROOMS IN A ROW.</Line>
      <Line>NAME A ROOM THE ARROW CANNOT REACH FROM WHERE IT IS AND IT WILL NOT STOP. IT WILL
        TAKE A TUNNEL OF ITS OWN CHOOSING, AND ONE OF THOSE LEADS BACK TO YOU.</Line>
      <Line>A SHOT THAT MISSES USUALLY WAKES THE WUMPUS. A WOKEN WUMPUS MOVES ONE ROOM, OR
        STAYS WHERE IT IS. IF IT ARRIVES WHERE YOU ARE, THAT IS THE END OF IT.</Line>
      <Line> </Line>
      <Line className="accent">AFTERWARDS</Line>
      <Line>KILL IT AND YOU GO DEEPER, KEEPING WHAT IS LEFT IN THE QUIVER. DIE AND YOU ARE
        FINISHED. STOP WHENEVER YOU LIKE -- THAT IS WHAT CLIMB OUT IS FOR.</Line>
      <Line> </Line>
      <Btn kind="primary" onClick={onDone}>
        GOT IT
      </Btn>
    </div>
  )
}

// ------------------------------------------------------------------ setup

export function SetupScreen({
  onStart,
  onBlip,
}: {
  onStart: (names: string[]) => void
  onBlip: () => void
}) {
  const [names, setNames] = useState<string[]>([''])

  const set = (i: number, v: string) =>
    setNames((n) => n.map((old, j) => (j === i ? v.slice(0, MAX_NAME) : old)))

  return (
    <div className="stack setup">
      <Line className="accent">WHO IS GOING IN?</Line>
      <Line className="dim">EACH HUNTER GETS THEIR OWN CAVE. YOU TAKE IT IN TURNS.</Line>
      <Line> </Line>
      {names.map((name, i) => (
        <div className="field" key={i}>
          <label htmlFor={`hunter-${i}`}>HUNTER {i + 1}</label>
          <input
            id={`hunter-${i}`}
            className="field-input"
            value={name}
            maxLength={MAX_NAME}
            placeholder={`HUNTER ${i + 1}`}
            onChange={(e) => set(i, e.target.value)}
          />
        </div>
      ))}
      <Line> </Line>
      <div className="prompt-row">
        {names.length < MAX_HUNTERS && (
          <Btn
            onClick={() => {
              onBlip()
              setNames((n) => [...n, ''])
            }}
          >
            ONE MORE
          </Btn>
        )}
        <Btn kind="primary" onClick={() => onStart(names)}>
          GO IN
        </Btn>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------- report

/**
 * The end of one hunt. This is the only screen other than the standings
 * allowed to show where things actually were -- the hunt is over, so knowing
 * costs nothing, and not showing it would waste the one moment the map is
 * genuinely interesting.
 */
export function ReportScreen({
  cave,
  hunter,
  moreToCome,
  onNext,
  onClimbOut,
}: {
  cave: Cave
  hunter: Hunter
  /** True when somebody is still alive to take another turn. */
  moreToCome: boolean
  onNext: () => void
  onClimbOut: () => void
}) {
  const won = isWin(cave.outcome)
  return (
    <div className="stack report">
      <Line className={won ? 'accent' : 'warn'}>{cave.outcome ? outcomeText(cave.outcome) : ''}</Line>
      <Line> </Line>
      <div className="map-wrap map-reveal">
        <CaveMap cave={cave} reveal />
      </div>
      <Line> </Line>
      <Line>
        {hunter.name} — {hunter.bagged} BAGGED, {hunter.arrows} ARROW
        {hunter.arrows === 1 ? '' : 'S'} LEFT, {hunter.roomsWalked} ROOMS WALKED
      </Line>
      <Line className="dim">
        THE WUMPUS WAS IN {cave.wumpus}. PITS: {cave.pits.join(' AND ')}. BATS:{' '}
        {cave.bats.join(' AND ')}.
      </Line>
      <Line> </Line>
      <div className="prompt-row">
        <Btn kind="primary" onClick={onNext}>
          {moreToCome ? 'NEXT HUNTER' : won ? 'GO DEEPER' : 'THAT IS THAT'}
        </Btn>
        <Btn onClick={onClimbOut} title="End the expedition and post the board">
          CLIMB OUT
        </Btn>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- standings

export function GameOverScreen({
  hunters,
  climbedOut,
  onRestart,
  onScores,
}: {
  hunters: Hunter[]
  climbedOut: boolean
  onRestart: () => void
  onScores: () => void
}) {
  const ranked = [...hunters].sort(compareHunts)
  return (
    <div className="stack over">
      <Line className="accent">{climbedOut ? 'YOU CLIMBED OUT.' : 'THE CAVE KEPT EVERYBODY.'}</Line>
      <Line> </Line>
      {ranked.map((h, i) => (
        <Line key={h.id}>
          {String(i + 1).padStart(2)}. {h.name.padEnd(MAX_NAME)} {String(h.bagged).padStart(2)}{' '}
          BAGGED {String(h.arrows).padStart(2)} ARROWS {String(h.roomsWalked).padStart(3)} ROOMS
          {h.died ? `  ${outcomeText(h.died)}` : '  WALKED OUT'}
        </Line>
      ))}
      <Line> </Line>
      <div className="prompt-row">
        <Btn kind="primary" onClick={onRestart}>
          AGAIN
        </Btn>
        <Btn onClick={onScores}>BOARD</Btn>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- board

export type BoardState = 'loading' | 'ready' | 'error'

export function HighScoreScreen({
  scores,
  state,
  highlight,
  onBack,
  onRetry,
}: {
  scores: Score[]
  state: BoardState
  highlight: string[]
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <div className="stack board">
      <Line className="accent">THE BOARD</Line>
      <Line className="dim">RANKED ON WUMPODES, THEN ARROWS LEFT, THEN ROOMS WALKED.</Line>
      <Line> </Line>
      {state === 'loading' && <Line>ASKING THE MACHINE...</Line>}
      {state === 'error' && (
        <>
          {/* The game is entirely playable without the board, and says so
              rather than pretending the run did not happen. */}
          <Line className="warn">THE BOARD IS NOT ANSWERING. YOUR HUNT STILL COUNTED.</Line>
          <Line> </Line>
          <Btn onClick={onRetry}>TRY AGAIN</Btn>
        </>
      )}
      {state === 'ready' && scores.length === 0 && <Line>NOBODY HAS COME BACK OUT YET.</Line>}
      {state === 'ready' &&
        scores.map((s, i) => (
          <Line key={s.id} className={highlight.includes(s.id) ? 'accent' : ''}>
            {String(i + 1).padStart(2)}. {s.name.padEnd(MAX_NAME)} {String(s.bagged).padStart(2)}{' '}
            {String(s.arrows).padStart(2)} {String(s.roomsWalked).padStart(3)}
            {s.died ? '' : '  *'}
          </Line>
        ))}
      <Line> </Line>
      <Btn kind="primary" onClick={onBack}>
        BACK
      </Btn>
    </div>
  )
}
