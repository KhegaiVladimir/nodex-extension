# Nodex — список задач для Cursor
# Выдавай по одной задаче. Следующую — только после того как предыдущая работает.

---

## ФАЗА 1 — Фундамент (shared/)
*Эти файлы не зависят ни от Chrome API ни от React. Начинаем здесь.*

### Задача 1
> Создай `shared/constants/gestures.js` и `shared/constants/commands.js`.
> `gestures.js` экспортирует объект GESTURES с ключами:
> HEAD_LEFT, HEAD_RIGHT, HEAD_UP, HEAD_DOWN, TILT_LEFT, TILT_RIGHT, EYES_CLOSED, MOUTH_OPEN, NONE.
> `commands.js` экспортирует объект COMMANDS с ключами:
> PLAY, PAUSE, PLAY_PAUSE, VOL_UP, VOL_DOWN, MUTE, REWIND, SKIP, NEXT, PREV, NONE.
> Оба объекта через Object.freeze(). Значения = строки совпадающие с ключами.

### Задача 2
> Создай `shared/constants/messages.js`.
> Экспортирует объект MSG через Object.freeze() со всеми типами сообщений
> между content script, side panel и service worker.
> Типы: METRICS_UPDATE, GESTURE_FIRED, COMMAND_EXECUTED, ENGINE_STATUS,
> CALIBRATION_PROGRESS, START_ENGINE, STOP_ENGINE, SAVE_CALIBRATION,
> UPDATE_SETTINGS, REQUEST_STATUS, CONTENT_TO_SIDEPANEL, SIDEPANEL_TO_CONTENT.

### Задача 3
> Создай `shared/constants/defaults.js`.
> Импортирует GESTURES и COMMANDS из соседних файлов.
> Экспортирует:
> - DEFAULT_GESTURE_MAP: маппинг жест→команда (HEAD_LEFT→REWIND, HEAD_RIGHT→SKIP,
>   HEAD_UP→VOL_UP, HEAD_DOWN→VOL_DOWN, TILT_LEFT→PREV, TILT_RIGHT→NEXT,
>   EYES_CLOSED→PAUSE, MOUTH_OPEN→MUTE)
> - DEFAULT_COOLDOWNS: мс per-gesture (HEAD_UP/DOWN = 300, TILT = 800, EYES = 1200, остальные 600)
> - DEFAULT_THRESHOLDS: yaw=18, pitch=12, roll=15, earClose=0.18, mouthOpen=0.55, hysteresis=4
> - EYE_CLOSE_MIN_MS = 350
> - SENSITIVITY_PRESETS: объект с low/medium/high пресетами порогов

### Задача 4
> Создай `shared/utils/cooldown.js`.
> Класс Cooldown с конструктором(intervalMs).
> Методы: canFire() → boolean, fire() → boolean, reset(), setInterval(ms).
> fire() возвращает true только если кулдаун прошёл, и сам регистрирует срабатывание.
> Валидация intervalMs в конструкторе — выбрасывай TypeError если не число или < 0.

### Задача 5
> Создай `shared/utils/gestureLogic.js`.
> Чистые функции без состояния и без импортов Chrome API.
> Функции: computeYaw(lm), computePitch(lm), computeRoll(lm), computeEAR(lm), computeMouthRatio(lm).
> lm — массив 468 объектов {x, y, z} от MediaPipe Face Mesh.
> Добавь JSDoc с описанием какие индексы лендмарок используются и почему.
> Защита от деления на ноль (faceWidth < 0.001 → return 0).
> computeYaw инвертирует знак (компенсация зеркала камеры).

### Задача 6
> Создай `shared/storage.js`.
> Обёртка над chrome.storage.local — все методы async/await, никаких колбэков.
> Экспортируй: loadCalibration(), saveCalibration(data), loadSettings(defaults),
> saveSettings(patch), loadGestureMap(defaults), saveGestureMap(map).
> Константы ключей в объекте KEYS внутри файла (не экспортировать).
> saveCalibration валидирует что data — объект, иначе TypeError.
> saveSettings делает partial merge с текущими настройками.

---

## ФАЗА 2 — Content Script движки

### Задача 7
> Создай `content/YouTubeController.js`.
> Класс YouTubeController.
> Метод _getVideo() ищет video элемент у которого readyState >= 2, duration > 0,
> и который НЕ находится внутри элемента с классом .ad-showing.
> Метод execute(command) принимает строку из COMMANDS, возвращает boolean.
> Метод setVolumeStep(percent) устанавливает шаг громкости (по умолчанию 5%).
> Для NEXT и PREV используй document.querySelector('.ytp-next-button/.ytp-prev-button').click()
> как fallback — но только для этих двух команд.
> Не кэшируй ссылку на video — вызывай _getVideo() каждый раз.

### Задача 8
> Создай `content/GestureEngine.js`.
> Класс GestureEngine с конструктором({ thresholds, cooldowns, gestureMap, baseline, onCommand, onMetrics }).
> Метод processFrame(landmarks) — вызывается каждый кадр.
> Внутри: вычитает baseline из метрик, применяет гистерезис для каждого жеста,
> отдельная логика для глаз (EYE_CLOSE_MIN_MS защита от моргания),
> HEAD_UP/HEAD_DOWN эмитят повторно при удержании, остальные — только на переднем фронте.
> Метод updateSettings({ thresholds, gestureMap, baseline, cooldowns }) — обновляет без пересоздания.
> Метод destroy() — очищает состояние.
> Импортирует из shared/ — не дублирует логику.

### Задача 9
> Создай `content/FaceEngine.js`.
> Класс FaceEngine с конструктором(videoEl, onFrame).
> Валидация аргументов в конструкторе (TypeError если неверный тип).
> Метод init() — загружает MediaPipe скрипты через _loadScript(chrome.runtime.getURL(...)),
> создаёт FaceMesh с locateFile указывающим на assets/mediapipe/.
> Метод start() — создаёт Camera, начинает обработку кадров.
> Метод stop() — останавливает без уничтожения.
> Метод destroy() — полная очистка, останавливает камеру и закрывает FaceMesh.
> _loadScript(url) — возвращает Promise, таймаут 10 секунд, не дублирует загрузку.
> Флаг _destroyed — проверяется в onResults чтобы не обрабатывать кадры после destroy.

### Задача 10
> Создай `content/HUD.js`.
> Класс HUD.
> Метод mount() → Promise<HTMLVideoElement>: создаёт host div с Shadow DOM,
> инжектирует в document.body, запрашивает камеру через getUserMedia,
> возвращает video элемент для FaceEngine.
> Все элементы внутри Shadow DOM — стили YouTube не должны ломать HUD.
> Метод show() / hide() — показывает/скрывает видео и метрики.
> Метод showCommand(command) — toast уведомление 1.5 сек, человекочитаемые подписи на русском.
> Метод updateMetrics(metrics) — обновляет yaw/pitch/EAR индикаторы.
> Метод unmount() — останавливает все треки камеры, удаляет элементы из DOM.
> _requestCamera() — обрабатывает NotAllowedError и NotFoundError с понятными сообщениями.

### Задача 11
> Создай `content/index.js`.
> Класс NodexContentScript — оркестратор.
> В начале файла: проверка window.__nodexLoaded, установка флага.
> Метод init(): загружает данные из storage параллельно (Promise.all),
> создаёт HUD → FaceEngine → GestureEngine в правильном порядке,
> подписывается на chrome.runtime.onMessage,
> авто-старт если engine_active === true в storage.
> Метод start() / stop() — управление движком + запись в storage.
> _handleCommand(cmd, gesture, metrics) — выполняет команду в YouTubeController,
> обновляет HUD, шлёт сообщение в side panel.
> _handleMetrics(metrics) — обновляет HUD, шлёт в side panel каждый 3-й кадр (не каждый).
> _handleMessage(message) — switch по MSG типам.
> window.addEventListener('beforeunload') — вызывает destroy().

---

## ФАЗА 3 — Service Worker

### Задача 12
> Создай `background/service-worker.js`.
> Три обработчика:
> 1. chrome.action.onClicked → chrome.sidePanel.open({ tabId })
> 2. chrome.webNavigation.onHistoryStateUpdated → уведомляет content script о SPA-навигации YouTube
> 3. chrome.runtime.onMessage → relay между content script и side panel:
>    CONTENT_TO_SIDEPANEL: форвардит в runtime.sendMessage (side panel), ошибкиглотает
>    SIDEPANEL_TO_CONTENT: форвардит в tabs.sendMessage по tabId
>    REQUEST_STATUS: запрашивает статус у активного content script
> Никакого состояния в переменных модуля — service worker эфемерен.

---

## ФАЗА 4 — Side Panel (React)

### Задача 13
> Создай `sidepanel/index.html`.
> Минимальный HTML: подключает main.jsx через <script type="module">,
> шрифты (DM Mono + Syne через Google Fonts или локально),
> тёмная тема через CSS переменные в :root,
> meta viewport, title "Nodex".

### Задача 14
> Создай `sidepanel/main.jsx`.
> Точка входа React: createRoot + render App.
> Глобальные стили: тёмный фон #0a0a0a, цвет текста #f5f3ee, акцент #c8f55a.

### Задача 15
> Создай `sidepanel/App.jsx`.
> Три экрана переключаемых через useState (не Router):
> 'main' — статус движка (running/stopped), кнопка старт/стоп, текущий жест.
> 'calibration' — захват нейтральной позы (3 секунды усреднения),
>   сохранение baseline через saveCalibration() из shared/storage.js,
>   отправка SAVE_CALIBRATION в content script через service worker.
> 'settings' — маппинг жест→команда (select для каждого жеста),
>   выбор пресета чувствительности (low/medium/high),
>   сохранение через saveGestureMap() и saveSettings().
> Все сообщения в content script через:
>   chrome.tabs.query({active:true, currentWindow:true}) → tabId →
>   chrome.runtime.sendMessage({type: MSG.SIDEPANEL_TO_CONTENT, tabId, ...})
> Подписка на chrome.runtime.onMessage для получения метрик и статуса.
> Дизайн: тёмный, акцент #c8f55a, шрифт DM Mono для метрик, Syne для заголовков.

---

## ФАЗА 5 — Сборка

### Задача 16
> Создай `vite.config.js` для сборки Chrome Extension.
> Два entry points:
> - sidepanel/main.jsx → обычный React bundle в dist/sidepanel/
> - content/index.js → IIFE формат, один файл без chunks, в dist/content/index.js
> Service worker не через Vite — копируется as-is через rollupOptions.
> Скопируй manifest.json, assets/ и sidepanel/index.html в dist/.
> Используй vite-plugin-web-extension или ручной rollupOptions.
> Исключи @mediapipe/* из бандла (external) — они загружаются через getURL.

### Задача 17 — финальная
> Создай `package.json` с командами:
> "dev": "vite build --watch"
> "build": "vite build"
> "zip": "cd dist && zip -r ../nodex.zip ."
> Зависимости: react, react-dom, vite, @vitejs/plugin-react.
> devDependencies: только то что нужно для сборки.
> Никаких лишних зависимостей — MediaPipe берём локально из assets/.

---

## Порядок тестирования после сборки

1. `npm run build` — должно создать `dist/` без ошибок
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → выбери `dist/`
3. Открой `youtube.com/watch?v=...`
4. Кликни иконку расширения → должен открыться side panel
5. Нажми Start в side panel → должен появиться HUD с видео камеры
6. Покивай головой → должен появиться toast "⏸ Пауза" или "▶ Играть"
7. Если MediaPipe не грузится — проверь DevTools → вкладка расширения → ошибки CSP

## Частые проблемы и решения

**"FaceMesh is not defined"**
→ Файлы не в assets/mediapipe/ или не добавлены в web_accessible_resources

**Toast появляется но YouTube не реагирует**
→ _getVideo() возвращает null — YouTube показывает рекламу или видео не загружено

**Side panel не получает метрики**
→ Service worker выгрузился — это нормально для MV3, сообщения придут при следующей активности

**Двойной запуск content script**
→ window.__nodexLoaded проверка должна быть первой строкой в index.js
