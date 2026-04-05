import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MSG } from '../shared/constants/messages.js'
import { GESTURES } from '../shared/constants/gestures.js'
import { COMMANDS } from '../shared/constants/commands.js'
import {
  DEFAULT_GESTURE_MAP,
  DEFAULT_THRESHOLDS,
  SENSITIVITY_PRESETS,
} from '../shared/constants/defaults.js'
import {
  saveCalibration,
  saveGestureMap,
  saveSettings,
  loadGestureMap,
  loadSettings,
} from '../shared/storage.js'

/* ── helpers ── */

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/watch*' })
  if (tabs.length > 0) return tabs[0].id

  const [tab] = await chrome.tabs.query({ active: true })
  return tab?.id ?? null
}

async function sendToContent(payload) {
  const tabId = await getActiveTabId()
  if (tabId == null) return
  // Must NOT spread payload: inner `type` (START_ENGINE, etc.) would overwrite
  // SIDEPANEL_TO_CONTENT and the SW would never forward to the tab.
  chrome.runtime.sendMessage({
    type: MSG.SIDEPANEL_TO_CONTENT,
    tabId,
    inner: payload,
  }).catch(() => {})
}

const GESTURE_LABELS = {
  [GESTURES.HEAD_LEFT]:   '← Голова влево',
  [GESTURES.HEAD_RIGHT]:  '→ Голова вправо',
  [GESTURES.HEAD_UP]:     '↑ Голова вверх',
  [GESTURES.HEAD_DOWN]:   '↓ Голова вниз',
  [GESTURES.TILT_LEFT]:   '↰ Наклон влево',
  [GESTURES.TILT_RIGHT]:  '↱ Наклон вправо',
  [GESTURES.EYES_CLOSED]: '👁 Глаза закрыты',
  [GESTURES.MOUTH_OPEN]:  '👄 Рот открыт',
}

const COMMAND_LABELS = {
  [COMMANDS.PLAY]:       '▶ Играть',
  [COMMANDS.PAUSE]:      '⏸ Пауза',
  [COMMANDS.PLAY_PAUSE]: '⏯ Плей/Пауза',
  [COMMANDS.VOL_UP]:     '🔊 Громче',
  [COMMANDS.VOL_DOWN]:   '🔉 Тише',
  [COMMANDS.MUTE]:       '🔇 Без звука',
  [COMMANDS.REWIND]:     '⏪ Назад',
  [COMMANDS.SKIP]:       '⏩ Вперёд',
  [COMMANDS.NEXT]:       '⏭ Следующее',
  [COMMANDS.PREV]:       '⏮ Предыдущее',
  [COMMANDS.NONE]:       '— Нет',
}

const CALIBRATION_DURATION_MS = 3000
const CALIBRATION_FPS = 15

/* ── styles ── */

const S = {
  app: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '100vh',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--accent)',
    margin: 0,
  },
  subheading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '8px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px',
  },
  btn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: 500,
    padding: '10px 0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#0a0a0a',
  },
  btnSecondary: {
    background: 'var(--border)',
    color: 'var(--text)',
  },
  nav: {
    display: 'flex',
    gap: '6px',
  },
  navBtn: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '8px 0',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    background: 'var(--accent)',
    color: '#0a0a0a',
    borderColor: 'var(--accent)',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: '1px solid var(--border)',
  },
  metricLabel: { color: 'var(--muted)', fontSize: '12px' },
  metricValue: { color: 'var(--accent)', fontWeight: 500 },
  select: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 6px',
    width: '100%',
  },
  status: (running) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: running ? '#4ade80' : '#ef4444',
    marginRight: '8px',
  }),
  progressBar: {
    width: '100%',
    height: '6px',
    background: 'var(--border)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressFill: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.2s',
  }),
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
  },
  gestureLabel: { fontSize: '12px', flex: '1 1 auto', whiteSpace: 'nowrap' },
  gestureSelect: { flex: '0 0 130px' },
}

/* ── App ── */

export default function App() {
  const [screen, setScreen] = useState('main')
  const [running, setRunning] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [lastCommand, setLastCommand] = useState(null)

  useEffect(() => {
    const listener = (message) => {
      switch (message.type) {
        case MSG.ENGINE_STATUS:
          setRunning(message.running)
          break
        case MSG.METRICS_UPDATE:
          setMetrics(message.metrics)
          break
        case MSG.COMMAND_EXECUTED:
          setLastCommand({ command: message.command, gesture: message.gesture })
          break
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    sendToContent({ type: MSG.REQUEST_STATUS })

    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  return (
    <div style={S.app}>
      <h1 style={S.heading}>Nodex</h1>

      <div style={S.nav}>
        {['main', 'calibration', 'settings'].map((s) => (
          <button
            key={s}
            style={{
              ...S.navBtn,
              ...(screen === s ? S.navBtnActive : {}),
            }}
            onClick={() => setScreen(s)}
          >
            {{ main: 'Главная', calibration: 'Калибровка', settings: 'Настройки' }[s]}
          </button>
        ))}
      </div>

      {screen === 'main' && (
        <MainScreen
          running={running}
          metrics={metrics}
          lastCommand={lastCommand}
        />
      )}
      {screen === 'calibration' && <CalibrationScreen />}
      {screen === 'settings' && <SettingsScreen />}
    </div>
  )
}

/* ── Main Screen ── */

function MainScreen({ running, metrics, lastCommand }) {
  const handleToggle = () => {
    sendToContent({ type: running ? MSG.STOP_ENGINE : MSG.START_ENGINE })
  }

  return (
    <>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <span style={S.status(running)} />
          <span style={{ fontWeight: 500 }}>
            {running ? 'Движок работает' : 'Движок остановлен'}
          </span>
        </div>

        <button
          style={{ ...S.btn, ...(running ? S.btnSecondary : S.btnPrimary) }}
          onClick={handleToggle}
        >
          {running ? 'Остановить' : 'Запустить'}
        </button>
      </div>

      {lastCommand && (
        <div style={S.card}>
          <div style={S.subheading}>Последняя команда</div>
          <div style={{ fontSize: '16px', color: 'var(--accent)' }}>
            {COMMAND_LABELS[lastCommand.command] ?? lastCommand.command}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {GESTURE_LABELS[lastCommand.gesture] ?? lastCommand.gesture}
          </div>
        </div>
      )}

      {metrics && (
        <div style={S.card}>
          <div style={S.subheading}>Метрики</div>
          {[
            ['Yaw', metrics.yaw],
            ['Pitch', metrics.pitch],
            ['Roll', metrics.roll],
            ['EAR', metrics.ear],
            ['Mouth', metrics.mouth],
          ].map(([label, val]) => (
            <div key={label} style={S.metricRow}>
              <span style={S.metricLabel}>{label}</span>
              <span style={S.metricValue}>
                {typeof val === 'number' ? val.toFixed(2) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ── Calibration Screen ── */

function CalibrationScreen() {
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const framesRef = useRef([])

  const handleStart = useCallback(() => {
    setPhase('capturing')
    setProgress(0)
    setError(null)
    framesRef.current = []

    const started = Date.now()
    const expectedFrames = Math.round((CALIBRATION_DURATION_MS / 1000) * CALIBRATION_FPS)

    const listener = (message) => {
      if (message.type !== MSG.METRICS_UPDATE || !message.metrics) return

      framesRef.current.push(message.metrics)
      const elapsed = Date.now() - started
      setProgress(Math.min(100, (elapsed / CALIBRATION_DURATION_MS) * 100))

      if (elapsed >= CALIBRATION_DURATION_MS) {
        chrome.runtime.onMessage.removeListener(listener)
        finalize()
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener)
      if (framesRef.current.length > 0) finalize()
      else {
        setPhase('idle')
        setError('Не получены метрики. Убедитесь, что движок запущен.')
      }
    }, CALIBRATION_DURATION_MS + 1000)
  }, [])

  const finalize = useCallback(async () => {
    const frames = framesRef.current
    if (frames.length === 0) {
      setError('Нет кадров для калибровки.')
      setPhase('idle')
      return
    }

    const baseline = {
      yaw:   frames.reduce((s, f) => s + (f.yaw ?? 0), 0) / frames.length,
      pitch: frames.reduce((s, f) => s + (f.pitch ?? 0), 0) / frames.length,
      roll:  frames.reduce((s, f) => s + (f.roll ?? 0), 0) / frames.length,
    }

    try {
      await saveCalibration(baseline)
      await sendToContent({ type: MSG.SAVE_CALIBRATION, baseline })
      setPhase('done')
    } catch (err) {
      setError(`Ошибка сохранения: ${err.message}`)
      setPhase('idle')
    }
  }, [])

  return (
    <div style={S.card}>
      <div style={S.subheading}>Калибровка нейтральной позы</div>

      {phase === 'idle' && (
        <>
          <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px' }}>
            Смотрите прямо в камеру и нажмите кнопку. Сохраняйте нейтральное
            положение головы 3 секунды.
          </p>
          {error && (
            <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</p>
          )}
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={handleStart}
          >
            Начать калибровку
          </button>
        </>
      )}

      {phase === 'capturing' && (
        <>
          <p style={{ color: 'var(--accent)', fontSize: '12px' }}>
            Захват... Не двигайте головой.
          </p>
          <div style={S.progressBar}>
            <div style={S.progressFill(progress)} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '6px', textAlign: 'right' }}>
            {Math.round(progress)}%
          </p>
        </>
      )}

      {phase === 'done' && (
        <>
          <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '12px' }}>
            Калибровка сохранена!
          </p>
          <button
            style={{ ...S.btn, ...S.btnSecondary }}
            onClick={() => { setPhase('idle'); setProgress(0) }}
          >
            Повторить
          </button>
        </>
      )}
    </div>
  )
}

/* ── Settings Screen ── */

function SettingsScreen() {
  const [gestureMap, setGestureMap] = useState({ ...DEFAULT_GESTURE_MAP })
  const [preset, setPreset] = useState('medium')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const map = await loadGestureMap(DEFAULT_GESTURE_MAP)
      setGestureMap(map)
      const settings = await loadSettings({ thresholds: DEFAULT_THRESHOLDS })
      const th = settings.thresholds ?? DEFAULT_THRESHOLDS
      for (const [key, val] of Object.entries(SENSITIVITY_PRESETS)) {
        if (val.yaw === th.yaw && val.pitch === th.pitch) {
          setPreset(key)
          break
        }
      }
    })()
  }, [])

  const handleGestureChange = (gesture, command) => {
    setGestureMap((prev) => ({ ...prev, [gesture]: command }))
    setSaved(false)
  }

  const handlePresetChange = (e) => {
    setPreset(e.target.value)
    setSaved(false)
  }

  const handleSave = async () => {
    const thresholds = SENSITIVITY_PRESETS[preset] ?? DEFAULT_THRESHOLDS
    await saveGestureMap(gestureMap)
    await saveSettings({ thresholds })
    await sendToContent({
      type: MSG.UPDATE_SETTINGS,
      settings: { thresholds, gestureMap },
    })
    setSaved(true)
  }

  const mappableGestures = Object.values(GESTURES).filter((g) => g !== GESTURES.NONE)
  const commandOptions = Object.values(COMMANDS)

  return (
    <>
      <div style={S.card}>
        <div style={S.subheading}>Маппинг жестов</div>
        {mappableGestures.map((g) => (
          <div key={g} style={S.gestureRow}>
            <span style={S.gestureLabel}>{GESTURE_LABELS[g] ?? g}</span>
            <div style={S.gestureSelect}>
              <select
                style={S.select}
                value={gestureMap[g] ?? COMMANDS.NONE}
                onChange={(e) => handleGestureChange(g, e.target.value)}
              >
                {commandOptions.map((c) => (
                  <option key={c} value={c}>{COMMAND_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.subheading}>Чувствительность</div>
        <select
          style={S.select}
          value={preset}
          onChange={handlePresetChange}
        >
          <option value="low">Низкая — большие движения</option>
          <option value="medium">Средняя (по умолчанию)</option>
          <option value="high">Высокая — малые движения</option>
        </select>
      </div>

      <button
        style={{ ...S.btn, ...S.btnPrimary, opacity: saved ? 0.6 : 1 }}
        onClick={handleSave}
      >
        {saved ? 'Сохранено ✓' : 'Сохранить настройки'}
      </button>
    </>
  )
}
