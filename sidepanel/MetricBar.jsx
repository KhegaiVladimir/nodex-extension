import React, { useRef, useState, useEffect } from 'react'

/**
 * EMA smoothing factor for the visual layer only.
 * Kept low (0.14) so the bar glides instead of jumping,
 * without introducing perceptible lag at 30 FPS.
 * GestureEngine thresholds are unaffected — only display is smoothed.
 */
const DISPLAY_ALPHA = 0.14

const ACCENT        = '#64FFDA'
const ACCENT_DIM    = 'rgba(100, 255, 218, 0.22)'
const ACCENT_GLOW   = 'rgba(100, 255, 218, 0.50)'
const TRACK_BG      = '#161616'
const TRACK_BORDER  = '#242424'
const TICK_IDLE     = '#303030'
const TICK_ACTIVE   = 'rgba(100, 255, 218, 0.50)'

/**
 * A single animated metric row.
 *
 * type='centered'  — bar grows from the midpoint left or right (Yaw, Pitch, Roll).
 * type='fill'      — bar fills left-to-right from 0 (EAR, Mouth).
 *
 * triggerBelow=true  → gesture fires when value DROPS below threshold (EAR).
 * triggerBelow=false → gesture fires when |value| EXCEEDS threshold (default).
 */
export default function MetricBar({
  label,
  value,
  max,
  threshold,
  type = 'fill',
  unit = '',
  triggerBelow = false,
}) {
  const emaRef      = useRef(null)   // null = not yet seeded
  const [smoothed, setSmoothed] = useState(0)

  useEffect(() => {
    if (value == null) return
    // Seed EMA with the first real value instead of blending from 0.
    // Without this, metrics that start as undefined (e.g. EAR when no face
    // is detected) would blend up from 0 and briefly cross the threshold,
    // causing a visual false-positive "triggered" state on the first frame.
    if (emaRef.current === null) {
      emaRef.current = value
      setSmoothed(value)
      return
    }
    emaRef.current = DISPLAY_ALPHA * value + (1 - DISPLAY_ALPHA) * emaRef.current
    setSmoothed(emaRef.current)
  }, [value])

  const absSmoothed = Math.abs(smoothed)
  const triggered = triggerBelow
    ? smoothed < threshold
    : absSmoothed >= threshold

  // Normalised fill fraction [0, 1]
  const fraction    = Math.min(absSmoothed / max, 1)
  const threshFrac  = Math.min(threshold / max, 1)

  const fillColor = triggered ? ACCENT : ACCENT_DIM
  const tickColor = triggered ? TICK_ACTIVE : TICK_IDLE
  const glow      = triggered ? { boxShadow: `0 0 7px ${ACCENT_GLOW}` } : {}

  // The track wrapper is slightly taller than the bar so threshold ticks
  // can protrude above and below without being clipped.
  const WRAP_H = '10px'
  const BAR_H  = '5px'

  const trackStyle = {
    flex: 1,
    height: WRAP_H,
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  }

  const railStyle = {
    position: 'absolute',
    left: 0, right: 0,
    height: BAR_H,
    background: TRACK_BG,
    borderRadius: '3px',
    border: `1px solid ${TRACK_BORDER}`,
    overflow: 'visible',
  }

  const fillBase = {
    position: 'absolute',
    top: 0, bottom: 0,
    borderRadius: '3px',
    transition: 'width 0.05s linear, background-color 0.12s ease',
  }

  // Tick mark: extends the full height of the wrapper (3px above + below rail)
  const tickStyle = (leftPct) => ({
    position: 'absolute',
    top: 0, bottom: 0,
    left: `${leftPct * 100}%`,
    width: '1px',
    background: tickColor,
    transition: 'background 0.12s ease',
    // Render ticks on top of the fill
    zIndex: 2,
    pointerEvents: 'none',
  })

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '3px 0',
    }}>

      {/* ── Label ── */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: triggered ? ACCENT : 'var(--muted)',
        width: '36px',
        flexShrink: 0,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        transition: 'color 0.12s ease',
        userSelect: 'none',
      }}>
        {label}
      </span>

      {/* ── Track ── */}
      <div style={trackStyle}>
        <div style={railStyle}>

          {type === 'centered' ? (
            <>
              {/* Fill grows from center outward toward whichever side is active */}
              <div style={{
                ...fillBase,
                ...(smoothed >= 0
                  ? { left: '50%',  width: `${fraction * 50}%`, borderRadius: '0 3px 3px 0' }
                  : { right: '50%', width: `${fraction * 50}%`, borderRadius: '3px 0 0 3px' }
                ),
                background: fillColor,
                ...glow,
              }} />

              {/* Center divider */}
              <div style={{
                position: 'absolute',
                top: '-2px', bottom: '-2px',
                left: 'calc(50% - 0.5px)',
                width: '1px',
                background: '#2e2e2e',
                zIndex: 1,
              }} />

              {/* Left threshold tick */}
              <div style={tickStyle(0.5 - threshFrac * 0.5)} />
              {/* Right threshold tick */}
              <div style={tickStyle(0.5 + threshFrac * 0.5)} />
            </>
          ) : (
            <>
              {/* Fill from left edge */}
              <div style={{
                ...fillBase,
                left: 0,
                width: `${fraction * 100}%`,
                background: fillColor,
                ...glow,
              }} />

              {/* Threshold tick */}
              <div style={tickStyle(threshFrac)} />
            </>
          )}

        </div>
      </div>

      {/* ── Value ── */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: triggered ? ACCENT : '#444',
        width: '36px',
        textAlign: 'right',
        flexShrink: 0,
        letterSpacing: '0.02em',
        transition: 'color 0.12s ease',
        userSelect: 'none',
      }}>
        {typeof value === 'number'
          ? (type === 'centered'
              ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}${unit}`
              : `${value.toFixed(2)}${unit}`)
          : '—'}
      </span>

    </div>
  )
}
