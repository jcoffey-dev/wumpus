import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSkin } from '../skin'

/**
 * The thing the game is happening inside.
 *
 * Both skins get a frame, and the frames are not the same object: 1973 is a
 * Teletype, so it is a sheet of fanfold paper coming out of a machine, with
 * the sprocket holes down both edges and a platen at the top. The remaster is
 * a cave, so it is a lit chamber with rock around it. Everything inside is
 * laid out identically -- only the box changes.
 */
export function Frame({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const { skin } = useSkin()
  return (
    <div className="cabinet">
      <div className="bezel">
        {skin === 'teletype' && <div className="platen" aria-hidden />}
        <div className="screen">
          <div className="screen-inner">{children}</div>
          {skin === 'teletype' ? (
            <>
              <div className="sprockets sprockets-left" aria-hidden />
              <div className="sprockets sprockets-right" aria-hidden />
              <div className="paper-grain" aria-hidden />
            </>
          ) : (
            <>
              <div className="lamp" aria-hidden />
              <div className="vignette" aria-hidden />
            </>
          )}
        </div>
      </div>
      {footer}
    </div>
  )
}

/**
 * A sheet of paper does not scroll and a cave mouth does not either. If the
 * page comes out taller than the frame, shrink it rather than clipping it.
 * Lifted from the lemonade stand, where the argument was about televisions.
 */
export function Fit({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const measure = () => {
      const el = box.current
      const page = el?.firstElementChild as HTMLElement | null
      if (!el || !page) return
      // offsetHeight is the laid-out size and ignores the transform, so
      // measuring here cannot feed back into itself.
      const h = page.offsetHeight
      const avail = el.clientHeight
      setScale(h > 0 && avail > 0 ? Math.min(1, avail / h) : 1)
    }

    measure()
    const ro = new ResizeObserver(measure)
    if (box.current) ro.observe(box.current)
    if (box.current?.firstElementChild) ro.observe(box.current.firstElementChild)
    return () => ro.disconnect()
  })

  return (
    <div className="screen-body" ref={box} style={{ '--fit': scale } as React.CSSProperties}>
      {children}
    </div>
  )
}

export function Line({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <div className={`line ${className}`}>{children ?? ' '}</div>
}

export function Btn({
  children,
  onClick,
  kind = 'normal',
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  kind?: 'normal' | 'primary' | 'ghost'
  disabled?: boolean
  title?: string
}) {
  return (
    <button className={`btn btn-${kind}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}
