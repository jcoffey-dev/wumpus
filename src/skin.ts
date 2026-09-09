import { createContext, useContext } from 'react'

/**
 * Two skins over one game. "teletype" is 1973 as it actually was -- a
 * printing terminal, no screen, no colour and no sound but the print head.
 * "modern" is the same cave with the lamp on. The rules never differ between
 * them, and neither does a single word the machine prints.
 *
 * Worth saying why this is a Teletype rather than a CRT, since the lemonade
 * stand's period skin is an Atari television. Wumpus is six years older than
 * that machine. It was written for a timesharing system and played on paper,
 * which is why the game asks you to remember things: there is no screen to
 * look back at, only what you have already torn off.
 */
export type Skin = 'teletype' | 'modern'

export const SKIN_KEY = 'wumpus.skin.v1'

export function readSkin(): Skin {
  try {
    return window.localStorage.getItem(SKIN_KEY) === 'teletype' ? 'teletype' : 'modern'
  } catch {
    return 'modern'
  }
}

export function writeSkin(s: Skin): void {
  try {
    window.localStorage.setItem(SKIN_KEY, s)
  } catch {
    // A skin that does not stick is a small loss; carry on.
  }
}

export interface SkinApi {
  skin: Skin
  setSkin: (s: Skin) => void
  toggle: () => void
}

export const SkinContext = createContext<SkinApi>({
  skin: 'modern',
  setSkin: () => {},
  toggle: () => {},
})

export const useSkin = () => useContext(SkinContext)
