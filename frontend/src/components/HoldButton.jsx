import { useCallback, useEffect, useRef, useState } from 'react'

const HOLD_DURATION_MS = 3000
const TICK_MS = 30

/**
 * HoldButton — the single most important control in the app.
 *
 * The user must hold for ~3 seconds to activate, which prevents accidental
 * triggering (e.g. a phone in a pocket). Design goals:
 *  - Instant, obvious visual + haptic feedback on press.
 *  - Clear progress so the user knows how long to keep holding.
 *  - Releasing early cancels cleanly.
 *  - Works with touch, mouse, and keyboard (accessibility).
 *  - Large one-handed target, high contrast.
 */
export default function HoldButton({ onActivate, disabled = false }) {
  const [progress, setProgress] = useState(0) // 0..1
  const [holding, setHolding] = useState(false)
  const startRef = useRef(0)
  const rafRef = useRef(null)
  const activatedRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (rafRef.current) {
      clearInterval(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const cancelHold = useCallback(() => {
    clearTimer()
    setHolding(false)
    setProgress(0)
    activatedRef.current = false
  }, [clearTimer])

  const startHold = useCallback(() => {
    if (disabled || holding) return
    activatedRef.current = false
    setHolding(true)
    startRef.current = Date.now()

    // Short haptic pulse to confirm the press registered.
    if (navigator.vibrate) navigator.vibrate(20)

    clearTimer()
    rafRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const p = Math.min(elapsed / HOLD_DURATION_MS, 1)
      setProgress(p)
      if (p >= 1 && !activatedRef.current) {
        activatedRef.current = true
        clearTimer()
        setHolding(false)
        setProgress(0)
        if (navigator.vibrate) navigator.vibrate([80, 40, 80])
        onActivate?.()
      }
    }, TICK_MS)
  }, [disabled, holding, clearTimer, onActivate])

  // Keyboard accessibility: hold Space/Enter to activate.
  const onKeyDown = useCallback(
    (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault()
        startHold()
      }
    },
    [startHold],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const pct = Math.round(progress * 100)
  const secondsLeft = Math.ceil((HOLD_DURATION_MS * (1 - progress)) / 1000)

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label="Hold for three seconds to send an emergency alert"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        startHold()
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onKeyDown={onKeyDown}
      onKeyUp={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'no-select relative flex aspect-square w-full max-w-[20rem] select-none',
        'items-center justify-center rounded-full',
        'text-center font-extrabold uppercase tracking-wide',
        'shadow-2xl transition-transform duration-100 active:scale-[0.98]',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-white/70',
        disabled
          ? 'bg-zinc-600 text-zinc-300'
          : 'bg-danger text-white ring-1 ring-white/10',
      ].join(' ')}
    >
      {/* Circular progress ring drawn while holding. */}
      {holding && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 30ms linear' }}
          />
        </svg>
      )}

      <span className="px-6 leading-tight">
        {holding ? (
          <>
            <span className="block text-5xl tabular-nums">{secondsLeft}</span>
            <span className="mt-2 block text-base font-semibold normal-case tracking-normal">
              Keep holding… {pct}%
            </span>
          </>
        ) : (
          <>
            <span className="block text-4xl">Hold for Help</span>
            <span className="mt-3 block text-base font-semibold normal-case tracking-normal opacity-90">
              Press &amp; hold 3 seconds
            </span>
          </>
        )}
      </span>
    </button>
  )
}
