import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SKIN_KEY, SkinContext, readSkin, writeSkin, type Skin, type SkinApi } from './skin'

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>(readSkin)

  const setSkin = useCallback((s: Skin) => {
    setSkinState(s)
    writeSkin(s)
  }, [])

  // The attribute lives on <html> so the page background can follow the skin.
  useEffect(() => {
    document.documentElement.dataset.skin = skin
  }, [skin])

  // Keep sibling tabs in the same browser in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SKIN_KEY || e.key === null) setSkinState(readSkin())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<SkinApi>(
    () => ({ skin, setSkin, toggle: () => setSkin(skin === 'teletype' ? 'modern' : 'teletype') }),
    [skin, setSkin],
  )

  return <SkinContext value={value}>{children}</SkinContext>
}
