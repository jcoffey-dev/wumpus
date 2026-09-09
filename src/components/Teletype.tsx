import { useEffect, useRef, useState } from 'react'
import { synth } from '../audio/synth'
import type { Line } from '../game/types'

/**
 * The 1973 skin: everything the machine has said, printed.
 *
 * A Teletype prints at ten characters a second and cannot take any of it
 * back, so this types rather than appears, and nothing already printed ever
 * changes. That is not decoration -- it is the reason the game feels the way
 * it does. Reading "I SMELL A WUMPUS" arrive one letter at a time is a
 * different experience from finding it already on screen, and the whole game
 * is three sentences arriving in the dark.
 *
 * The print head is played per character. At ten a second that is a lot of
 * one-shot oscillators, which is why `synth.print()` is as small as it is.
 */
const CPS = 42 // Faster than a real ASR-33. A real one is 10, and it is a lot.

export function Teletype({ lines, onIdle }: { lines: Line[]; onIdle?: () => void }) {
  const [printed, setPrinted] = useState<string[]>([])
  const [partial, setPartial] = useState('')
  const done = useRef(0)
  const paper = useRef<HTMLDivElement>(null)

  // A new expedition throws the old transcript away rather than scrolling it.
  useEffect(() => {
    if (lines.length < done.current) {
      done.current = 0
      setPrinted([])
      setPartial('')
    }
  }, [lines.length])

  useEffect(() => {
    if (done.current >= lines.length) {
      onIdle?.()
      return
    }
    const text = lines[done.current]!.text
    let at = 0
    setPartial('')

    const timer = window.setInterval(() => {
      at += 1
      setPartial(text.slice(0, at))
      if (synth.sfxOn) synth.print()
      if (at >= text.length) {
        window.clearInterval(timer)
        synth.carriage()
        done.current += 1
        setPartial('')
        setPrinted((p) => [...p, text])
      }
    }, 1000 / CPS)

    return () => window.clearInterval(timer)
    // `printed` is the trigger: finishing one line starts the next.
  }, [lines, printed.length, onIdle])

  // The paper feeds up; you always read at the bottom.
  useEffect(() => {
    paper.current?.scrollTo({ top: paper.current.scrollHeight })
  }, [printed.length, partial])

  return (
    <div className="paper" ref={paper}>
      {printed.map((text, i) => (
        <div className="printed" key={i}>
          {text}
        </div>
      ))}
      {partial && (
        <div className="printed">
          {partial}
          <span className="head" aria-hidden />
        </div>
      )}
    </div>
  )
}
