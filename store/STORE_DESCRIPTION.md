# Nodex — Chrome Web Store Listing Copy

---

## Short Description (129 chars)

Control YouTube hands-free. Nod, tilt, or blink to navigate and play videos. 100% private, local AI. Perfect for accessibility.

---

## Full Description

**Nodex — Hands-Free YouTube for Everyone**

Take full control of YouTube without touching your mouse or keyboard. Nodex is a hands-free accessibility extension that uses head gestures and blinks to navigate, play, pause, seek, and browse — built with accessibility and privacy at its core.

Nodex runs powerful AI locally on your device. No subscriptions. No cloud. No compromises.

---

### 🎯 How It Works

Nodex uses MediaPipe Face Mesh technology right inside your browser. It tracks facial landmarks in real-time to detect nods, tilts, and blinks. Because all processing happens locally using WebAssembly, **your camera feed never leaves your computer**. Nothing is recorded, uploaded, or analyzed in the cloud.

---

### 🎮 Two Seamless Modes

- **Player Mode:** Control the video you are watching. Nod up/down to adjust volume, turn left/right to skip backward/forward, and blink to play or pause.
- **Browse Mode:** Navigate the YouTube homepage grid hands-free. Use head turns to move the focus ring across videos, and blink to open your selected content.

---

### ✨ Key Features

- **Zero Network AI:** 100% offline functionality after installation. True privacy.
- **Personalized Calibration:** A quick, guided setup tunes the gesture engine to your anatomy and lighting conditions.
- **Live HUD Metrics:** See your real-time head pose and gesture triggers in the sleek side panel.
- **Custom Sensitivity:** Adjustable presets (Low / Medium / High) ensure comfortable use for any range of motion.
- **Smart Auto-Pause:** Leave the camera frame? Nodex automatically pauses your video until you return.
- **Gesture Mapping:** Assign any gesture to any action — fully configurable for your needs.

---

### 🔒 Privacy & Permissions

We take your data seriously. Nodex requires camera access strictly to read spatial coordinates — no images or video are ever stored or transmitted.

- `camera` — To detect head gestures and blinks locally.
- `storage` — To save your calibration profiles on your machine.
- `scripting` & `sidePanel` — To display the hands-free control interface on YouTube.

We collect absolutely zero telemetry, analytics, or browsing history.

---

## wasm-unsafe-eval — Justification (for CWS reviewers)

Nodex uses MediaPipe Face Mesh (a Google open-source library) to detect head gestures and blink patterns entirely on the user's device. MediaPipe compiles and executes a WebAssembly binary at runtime, which requires the `wasm-unsafe-eval` CSP directive — this is a hard requirement of the MediaPipe runtime and cannot be avoided without forking the library.

**No video, image, or biometric data ever leaves the browser.** The camera feed is processed in-memory by the WASM module; only numeric landmark coordinates (468 floating-point values per frame) are passed to the extension's gesture engine. The WASM binary itself is bundled locally in the extension package (`assets/mediapipe/`) — no external CDN or network requests are made at any point.

This is the same pattern used by Google's own MediaPipe web demos and is the minimum surface required to run on-device ML inference in a Chrome extension.


Вот ТЗ для Figma/Canva:                                                           
                                                                                 
  ---                                                                               
  Promotional Tile — ТЗ (440×280 px)                                                
                                                                                    
  Фон                                                                               
  Тёмный градиент: #0F0F0F → #1A1A2E (слева направо)                                
                                                                                    
  Левая половина (~220px) — текст:                                                  
  NODEX                     ← шрифт Inter Bold, 32px, белый                         
  ──────────────────                                                                
  Control YouTube           ← Inter Regular, 16px, #AAAAAA                          
  with your head                                          
  ──────────────────                                                                
  🔒 100% local AI          ← Inter Regular, 13px, #666666  
  No camera data sent                                                               
                                                                                    
  Правая половина — иконка:
  Иконка расширения (твой логотип Nodex) по центру, размер ~80×80px, можно с лёгким 
  свечением box-shadow: 0 0 40px rgba(99, 102, 241, 0.4)                            
                                                                                    
  Акцентная линия:                                                                  
  Тонкая вертикальная черта #6366F1 (indigo) между левой и правой половиной —
  разделитель                                                                       
                                                            
  Итоговый вид:                                                                     
  ┌──────────────────────────────────────────┐              
  │                          │               │                                      
  │  NODEX                   │    [icon]     │              
  │  Control YouTube         │               │
  │  with your head          │               │                                      
  │                          │               │
  │  🔒 100% local AI        │               │                                      
  └──────────────────────────────────────────┘              
                                                                                    
  ---
  Шрифты в Figma: Inter (есть бесплатно в Google Fonts)                             
                                                                                    
  Цвета:
                                                                                    
  ┌──────────────┬─────────┐                                
  │   Элемент    │   HEX   │                                                        
  ├──────────────┼─────────┤                                
  │ Фон левый    │ #0F0F0F │
  ├──────────────┼─────────┤
  │ Фон правый   │ #1A1A2E │
  ├──────────────┼─────────┤                                                        
  │ Заголовок    │ #FFFFFF │
  ├──────────────┼─────────┤                                                        
  │ Подзаголовок │ #AAAAAA │                                
  ├──────────────┼─────────┤
  │ Мелкий текст │ #666666 │
  ├──────────────┼─────────┤                                                        
  │ Акцент       │ #6366F1 │
  └──────────────┴─────────┘                                                        
                                                            
  Canva: создай документ 440×280 px, вставь градиентный фон, текст слева, иконку    
  справа — 15 минут.