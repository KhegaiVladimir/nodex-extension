# Nodex — Roadmap to Production

> Текущая оценка: **Хакатон 8.5/10 · Chrome Web Store 7/10**
> Цель: довести до уровня публичного релиза на CWS.

---

## Приоритеты

| Метка | Смысл |
|---|---|
| 🔴 BLOCKER | Без этого нельзя сабмититься в CWS |
| 🟠 HIGH | Портит опыт пользователя, нужно до релиза |
| 🟡 MED | Важно, но не блокирует |
| 🟢 LOW | Полировка / nice-to-have |

---

## 1. Chrome Web Store — обязательные требования

### 🔴 Privacy Policy URL
`PRIVACY.md` написан и корректен, но CWS требует **публично доступный URL**.

- [x] Задеплоить `PRIVACY.md` на GitHub Pages или отдельную страницу  
  (`https://khegaivladimir.github.io/nodex/privacy` или аналог)
- [x] Указать этот URL в поле **Privacy practices** в CWS Developer Dashboard
- [x] Добавить ссылку в `README.md` и в описание магазина

### 🔴 Store Listing — материалы
CWS требует строго определённый набор ассетов:

- [ ] **5 скриншотов** (1280×800 или 640×400):
  1. Browse Mode — фокус-ринг на грид главной страницы YouTube
  2. Player Mode — HUD overlay во время воспроизведения
  3. Панель настроек с MetricBar (Live Metrics)
  4. Калибровочный визард (Step 3 — blink test)
  5. Gesture mapping — таблица жестов
- [ ] **Promotional tile** 440×280 (показывается в поиске CWS)
- [ ] **Marquee image** 1400×560 (опционально, но даёт visibility)
- [ ] Описание на английском, краткое (132 символа) + развёрнутое

---

## 2. Критические UX-баги (до релиза)

### ✅ TOGGLE_MODE — переключение режимов жестом (v1.1.2)
Новая команда `COMMANDS.TOGGLE_MODE` переключает Player ↔ Browse mode из любого жеста без касания UI.

- [x] `TOGGLE_MODE` добавлен в `shared/constants/commands.js`
- [x] `handleCommand()` перехватывает до `controller.execute()` — вызывает `_setMode(!browseMode)`, устанавливает `_manualModeOverride = true`, показывает HUD-баннер "Browse Mode" / "Player Mode"
- [x] Доступен в Settings → Gesture mapping для обоих режимов (Player и Browse)
- [x] По умолчанию не назначен ни на один жест — пользователь сам выбирает

### ✅ Browse Mode HEAD_UP / HEAD_DOWN — работает корректно
`VOL_UP` / `VOL_DOWN` в Browse Mode переиспользованы как вертикальная навигация по рядам. HEAD_UP → верхний ряд, HEAD_DOWN → нижний ряд. Баг был в оценке, не в коде.

### ✅ Browse Mode onboarding — реализован (v1.1.0)
При первой активации Browse Mode показывается HUD-подсказка "Browse Mode · Nod left/right to navigate · Tilt to go back" (исчезает через 5 сек). Флаг сохраняется в `chrome.storage.local` (`nodex_browse_hint_shown`).

### ✅ Холодный старт WASM — индикация добавлена (v1.1.0)
Кнопка Start теперь показывает amber-статус "Loading model…" во время загрузки WASM (~2–3 сек). Переходит в зелёный только после первого фрейма с данными (или через 5 сек по таймауту).

### ✅ Первый запуск без калибровки — онбординг реализован (v1.1.1)
Пользователь устанавливает расширение и сразу жмёт Start — моргание детектируется через fallback thresholds, работает нестабильно.

- [x] Добавить счётчик запусков (`nodex_start_count`) в storage; при первом запуске показывать мини-онбординг: `FirstLaunchHint` — карточка "Set up blink detection first" с CTA "Calibrate now — 30 sec" и ссылкой "Start without calibrating"
- [ ] Рассмотреть "Quick calibration" — нейтральная поза + один моргок, без полного визарда
- [x] При `blinkCalibNeeded === true` и первом запуске — автоматически навигировать в CalibrationScreen через 800 мс (вместо просто алерта); подавляется если пользователь нажал Skip или у него уже есть калибровочные данные
- [x] Исправлены 3 edge-case бага в логике первого запуска (v1.1.1): авто-навигация не зацикливается при ручном переходе на таб Calibrate; двойной промпт (blink alert + hint одновременно) устранён; `firstLaunchHintDismissed` и `autoNavFiredRef` вынесены в App и переживают размонтирование MainScreen

---

## 3. Технический долг

### ✅ Тесты — 230 тестов, все зелёные (v1.1.0)
Vitest настроен, покрытие исчерпывающее:

- **`tests/cooldown.test.js`** — 25 тестов: constructor validation (NaN, Infinity, отрицательные), canFire/fire zero- и positive-interval с fake timers, reset, setInterval boundaries.
- **`tests/gestureLogic.test.js`** — 61 тест: null/degenerate inputs, identity/zero cases, known geometric outputs, sign convention, proportionality, scale invariance, 3D z-axis distances, asymmetric eyes, nose past cheek edge, 90° roll, ratio > 1 mouth.
- **`tests/GestureEngine.test.js`** — 153 теста: `_shouldDeactivate` hysteresis math, `_detect` strict threshold boundaries (exact-at-threshold = NONE), dwell streaks + pre-warm, `_processBlinkFrame` 3-zone state machine (exact boundaries, two-blink sequences, CLOSED↔DEAD oscillation, dead-zone decay cycles), auto-EAR EMA, `setNeutralPose`, `adjustBlinkThreshold` clamping (0.012 / 0.5), `setBlinkCalibration` signalType rejection, live `updateSettings` gestureMap change, `_headPoseNotNeutralForEyes` buffer lifecycle, `destroy()` idempotency.

```bash
npm test   # 230 passed, 0 failed
```

### ✅ CI/CD — GitHub Actions настроены (v1.1.0)
- **`.github/workflows/ci.yml`** — срабатывает на `push` и `pull_request`: `npm ci` → `npm run build` → проверяет `dist/manifest.json`.
- **`.github/workflows/release.yml`** — срабатывает на тег `v*`: `npm run prod` → прикрепляет `nodex.zip` к GitHub Release.

### ✅ CHANGELOG.md создан (v1.1.0)
Формат Keep a Changelog. Записи для v1.0.0 и v1.1.0.

### ✅ Manifest version обновлена до 1.1.0

### ✅ Очистка storage при удалении расширения (v1.1.2)
`onUninstalled` не существует в MV3 — data нельзя почистить автоматически.

- [x] `chrome.runtime.setUninstallURL()` добавлен в service-worker.js
- [x] Кнопка "Clear all Nodex data" добавлена в Settings → Data (double-tap confirmation → `chrome.storage.local.clear()` + reload)
- [x] Known limitation: Chrome сам очищает данные при удалении профиля / очистке данных сайта

### ✅ refineLandmarks — Settings toggle добавлен (v1.1.2)
`mediapipe-bridge.js`: `refineLandmarks` теперь runtime-настройка.

- [x] Toggle "High-precision landmarks" добавлен в Settings → Smart features
- [x] Bridge читает `nodex_refine_landmarks` из storage перед созданием FaceMesh — изолированный мир и EAR-калибровки не меняются (signalType: 'ear' совместим)
- [x] Примечание "Applies after reloading the YouTube tab" — FaceMesh создаётся один раз на загрузку страницы
- [ ] Протестировать стабильность с `refineLandmarks: true` на разных камерах

---

## 4. Полировка и производительность

### ✅ MetricBar — персональный EAR-порог
`MainScreen` загружает `earCalibration.threshold` из storage и передаёт в MetricBar. Tick-линия обновляется в реальном времени после ре-калибровки.

### ✅ Живые метрики (MetricBar) — реализованы (v1.1.0)
Анимированные progress bars для Yaw, Pitch, Roll, EAR, Mouth Ratio с EMA-сглаживанием (α=0.14).

### 🟢 Browse Controller — периодический скан
`PERIODIC_SCAN_MS`: 5000 → 15000 ✅. MutationObserver с debounce покрывает динамические обновления.

- [ ] Рассмотреть полное отключение периодического скана и переход только на MutationObserver

### 🟢 Head-down fix — убедиться что нет регрессии по false positives
После изменения `pThDown = pTh - 2` и decay `-1` (апрель 2026):

- [ ] Потестировать что HEAD_DOWN не срабатывает случайно при небольших наклонах головы
- [ ] Если есть регрессия — вернуть decay к `-2` и только оставить pre-warm

---

## 5. Хакатон — чеклист демо

Технически проект готов к демо. Эти пункты нужны за 1 час до выступления:

- [ ] Пройти полную калибровку (neutral pose + blink) на камере, с которой будешь выступать
- [ ] Запустить движок заранее чтобы WASM прогрелся — не запускать первый раз перед судьями
- [ ] Проверить что `blinkCalibNeeded` алерт НЕ показывается (калибровка актуальна, TTL 7 дней)
- [ ] Открыть Side Panel вручную до начала демо
- [ ] Заготовить слайд/диаграмму: "camera → local WASM → gestures → YouTube" со стрелкой "0 bytes to network"
- [ ] Порядок демо: 10 сек Browse (фокус-ринг на гриде) → 10 сек Player (volume + seek) → показать MetricBar в Side Panel
- [ ] Запасной план: если моргание не детектируется на сцене (другое освещение) — сделать мут через MOUTH_OPEN

---

## Итоговый чеклист по блокерам CWS

```
[x] Privacy Policy URL задеплоен и указан в Dashboard
[ ] 5 скриншотов загружены
[ ] Promotional tile 440×280 готов
[ ] wasm-unsafe-eval обоснование написано
[ ] Store description (132 chars + full) написан
[x] Browse Mode onboarding реализован (v1.1.0)
[x] Cold start loading indicator добавлен (v1.1.0)
[x] manifest version обновлена до 1.1.0
[x] CHANGELOG.md создан
[x] CI/CD настроен (GitHub Actions)
[x] 230 тестов, все зелёные
[x] First-launch calibration onboarding + edge-case fixes (v1.1.1)
```

Осталось 4 пункта до CWS сабмита: скриншоты, promo tile, wasm-unsafe-eval обоснование, store description.

---

*Создан: апрель 2026. Последнее обновление: апрель 2026 (v1.1.1 + first-launch onboarding + edge-case fixes).*
