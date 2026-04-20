var di=Object.defineProperty;var _i=(Y,T,h)=>T in Y?di(Y,T,{enumerable:!0,configurable:!0,writable:!0,value:h}):Y[T]=h;var Pt=(Y,T,h)=>_i(Y,typeof T!="symbol"?T+"":T,h);(function(){"use strict";const Y=Object.freeze({HEALTH_CHECK:"NODEX_HEALTH_CHECK",HEALTH_CHECK_RESULT:"NODEX_HEALTH_CHECK_RESULT",RECOVERING:"NODEX_BRIDGE_RECOVERING",RECOVERED:"NODEX_BRIDGE_RECOVERED",NO_FACE:"NODEX_NO_FACE"}),T=Object.freeze({METRICS_UPDATE:"METRICS_UPDATE",GESTURE_FIRED:"GESTURE_FIRED",COMMAND_EXECUTED:"COMMAND_EXECUTED",ENGINE_STATUS:"ENGINE_STATUS",CALIBRATION_PROGRESS:"CALIBRATION_PROGRESS",START_ENGINE:"START_ENGINE",STOP_ENGINE:"STOP_ENGINE",CALIBRATION_START:"CALIBRATION_START",CALIBRATION_CANCEL:"CALIBRATION_CANCEL",SAVE_CALIBRATION:"SAVE_CALIBRATION",UPDATE_SETTINGS:"UPDATE_SETTINGS",REQUEST_STATUS:"REQUEST_STATUS",CONTENT_TO_SIDEPANEL:"CONTENT_TO_SIDEPANEL",SIDEPANEL_TO_CONTENT:"SIDEPANEL_TO_CONTENT",TOGGLE_BROWSE_MODE:"TOGGLE_BROWSE_MODE",BROWSE_MODE_CHANGED:"BROWSE_MODE_CHANGED",TUTORIAL_START:"TUTORIAL_START",TUTORIAL_END:"TUTORIAL_END",METRICS_FRAME:"METRICS_FRAME",CALIBRATION_COMPLETE:"CALIBRATION_COMPLETE",BLINK_DETECTED:"BLINK_DETECTED",BLINK_THRESHOLD_ADJUST:"BLINK_THRESHOLD_ADJUST",WIZARD_START:"WIZARD_START",WIZARD_ENTER_TEST:"WIZARD_ENTER_TEST",WIZARD_CANCEL:"WIZARD_CANCEL",BLINK_THRESHOLD_UPDATED:"BLINK_THRESHOLD_UPDATED",SET_AUTO_PAUSE:"SET_AUTO_PAUSE",START_BLINK_CALIBRATION:"START_BLINK_CALIBRATION",BLINK_CALIB_PHASE_A_STARTED:"BLINK_CALIB_PHASE_A_STARTED",BLINK_CALIB_PHASE_B_STARTED:"BLINK_CALIB_PHASE_B_STARTED",BLINK_CALIB_SUCCESS:"BLINK_CALIB_SUCCESS",BLINK_CALIB_FAILED:"BLINK_CALIB_FAILED",BLINK_CALIB_NEEDED:"BLINK_CALIB_NEEDED"}),h=Object.freeze({PLAY:"PLAY",PAUSE:"PAUSE",PLAY_PAUSE:"PLAY_PAUSE",VOL_UP:"VOL_UP",VOL_DOWN:"VOL_DOWN",NEXT:"NEXT",PREV:"PREV",REWIND:"REWIND",MUTE:"MUTE",SKIP:"SKIP",BACK:"BACK",TOGGLE_MODE:"TOGGLE_MODE",NONE:"NONE"}),_=Object.freeze({HEAD_LEFT:"HEAD_LEFT",HEAD_RIGHT:"HEAD_RIGHT",HEAD_UP:"HEAD_UP",HEAD_DOWN:"HEAD_DOWN",EYES_CLOSED:"EYES_CLOSED",EYES_HOLD:"EYES_HOLD",MOUTH_OPEN:"MOUTH_OPEN",TILT_LEFT:"TILT_LEFT",TILT_RIGHT:"TILT_RIGHT",NONE:"NONE"}),bt={[_.HEAD_LEFT]:h.REWIND,[_.HEAD_RIGHT]:h.SKIP,[_.HEAD_UP]:h.VOL_UP,[_.HEAD_DOWN]:h.VOL_DOWN,[_.TILT_LEFT]:h.PREV,[_.TILT_RIGHT]:h.NEXT,[_.EYES_CLOSED]:h.PLAY_PAUSE,[_.EYES_HOLD]:h.NONE,[_.MOUTH_OPEN]:h.MUTE},Bt={[_.HEAD_LEFT]:h.REWIND,[_.HEAD_RIGHT]:h.SKIP,[_.HEAD_UP]:h.VOL_UP,[_.HEAD_DOWN]:h.VOL_DOWN,[_.EYES_CLOSED]:h.PLAY_PAUSE,[_.EYES_HOLD]:h.NONE,[_.TILT_LEFT]:h.BACK,[_.TILT_RIGHT]:h.NONE,[_.MOUTH_OPEN]:h.NONE},Ft=bt,_t={[_.HEAD_UP]:200,[_.HEAD_DOWN]:350,[_.HEAD_LEFT]:350,[_.HEAD_RIGHT]:350,[_.TILT_LEFT]:800,[_.TILT_RIGHT]:800,[_.EYES_CLOSED]:900,[_.EYES_HOLD]:1500,[_.MOUTH_OPEN]:600},ut={yaw:22,pitch:9,roll:15,earClose:.22,mouthOpen:.55,hysteresis:4,hysteresisYaw:7,hysteresisPitch:7},nt=!1,$={CALIBRATION:"nodex_calibration",SETTINGS:"nodex_settings",GESTURE_MAP:"nodex_gesture_map",PLAYER_GESTURE_MAP:"nodex_player_gesture_map",BROWSE_GESTURE_MAP:"nodex_browse_gesture_map"};async function J(r){return(await chrome.storage.local.get(r))[r]??null}async function ot(r,t){await chrome.storage.local.set({[r]:t})}async function mt(){return J($.CALIBRATION)}async function rt(r){if(r===null||typeof r!="object"||Array.isArray(r))throw new TypeError("calibration data must be a plain object");await ot($.CALIBRATION,r)}async function Ht(r={}){const t=await J($.SETTINGS);return t&&t.onboarding_complete&&(t.onboarding_complete=!0),{...r,...t??{}}}let yt=Promise.resolve();async function Q(r){const t=yt.then(async()=>{const i={...await J($.SETTINGS)??{},...r};return await ot($.SETTINGS,i),i});return yt=t.catch(()=>{}),t}async function Ut(r={}){const t=await J($.PLAYER_GESTURE_MAP);if(t)return{...r,...t};const e=await J($.GESTURE_MAP);return{...r,...e??{}}}async function Gt(r){await ot($.PLAYER_GESTURE_MAP,r)}async function Yt(r={}){const t=await J($.BROWSE_GESTURE_MAP);return{...r,...t??{}}}async function Wt(r){await ot($.BROWSE_GESTURE_MAP,r)}const Vt=1400,Et=200,A=Object.freeze({play:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/></svg>',pause:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></svg>',playpause:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,3 14,12 3,21" fill="currentColor" stroke="none"/><rect x="16" y="4" width="3" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="20.5" y="4" width="3" height="16" rx="1" fill="currentColor" stroke="none"/></svg>',volUp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><path d="M17 9a4 4 0 0 1 0 6"/><path d="M19.5 6.5a8 8 0 0 1 0 11"/></svg>',volDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>',mute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><line x1="17" y1="9" x2="23" y2="15"/><line x1="23" y1="9" x2="17" y2="15"/></svg>',rewind:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,19 2,12 13,5" fill="currentColor" stroke="none"/><polygon points="22,19 11,12 22,5" fill="currentColor" stroke="none"/></svg>',skip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="2,5 13,12 2,19" fill="currentColor" stroke="none"/><polygon points="11,5 22,12 11,19" fill="currentColor" stroke="none"/></svg>',next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,5 16,12 3,19" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>',prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="21,5 8,12 21,19" fill="currentColor" stroke="none"/><line x1="5" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="2"/></svg>',back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/></svg>',browse:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',player:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,9 10,15 15,12" fill="currentColor" stroke="none"/></svg>',warning:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5"/></svg>',check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',arrowLeft:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',arrowRight:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 15 12 9 6"/></svg>',arrowUp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15 12 9l-6 6"/></svg>',arrowDown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',select:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'}),Kt=Object.freeze({[h.PLAY]:{icon:A.play,label:"Play"},[h.PAUSE]:{icon:A.pause,label:"Pause"},[h.PLAY_PAUSE]:{icon:A.playpause,label:"Play / Pause"},[h.VOL_UP]:{icon:A.volUp,label:"Volume Up"},[h.VOL_DOWN]:{icon:A.volDown,label:"Volume Down"},[h.MUTE]:{icon:A.mute,label:"Mute"},[h.REWIND]:{icon:A.rewind,label:"Rewind"},[h.SKIP]:{icon:A.skip,label:"Skip"},[h.NEXT]:{icon:A.next,label:"Next"},[h.PREV]:{icon:A.prev,label:"Previous"},[h.BACK]:{icon:A.back,label:"Back"},BROWSE_ON:{icon:A.browse,label:"Browse Mode"},BROWSE_OFF:{icon:A.player,label:"Player Mode"},NO_VIDEOS:{icon:A.warning,label:"No videos found",warning:!0},CALIBRATED:{icon:A.check,label:"Calibration saved"}}),$t=Object.freeze({[h.REWIND]:{icon:A.arrowLeft,label:"Left"},[h.SKIP]:{icon:A.arrowRight,label:"Right"},[h.VOL_UP]:{icon:A.arrowUp,label:"Up"},[h.VOL_DOWN]:{icon:A.arrowDown,label:"Down"},[h.PLAY_PAUSE]:{icon:A.select,label:"Select"},[h.BACK]:{icon:A.back,label:"Back"}}),qt=`
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  }

  /* ── Toast ─────────────────────────────────────────────── */
  .toast {
    position: fixed;
    top: 68px;
    left: 50%;
    transform: translateX(-50%) scale(0.88);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px 10px 12px;
    background: rgba(8, 8, 12, 0.72);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.06) inset;
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    transition: opacity ${Et}ms ease, transform ${Et}ms ease;
  }

  .toast.visible {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  .toast.warning {
    background: rgba(30, 8, 8, 0.82);
    border-color: rgba(255, 80, 80, 0.25);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,80,80,0.12) inset;
  }

  .toast.browse-hint {
    background: rgba(6, 18, 14, 0.82);
    border-color: rgba(100, 255, 218, 0.20);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(100,255,218,0.08) inset;
  }

  .toast-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #ffffff;
  }

  .toast.warning .toast-icon {
    color: #ff6b6b;
    background: rgba(255, 80, 80, 0.12);
  }

  .toast.browse-hint .toast-icon {
    color: #64FFDA;
    background: rgba(100, 255, 218, 0.12);
  }

  .toast-icon svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  /* Text wrapper — stacks label + optional subtitle vertically */
  .toast-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .toast-label {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: 0.01em;
  }

  .toast-subtitle {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.45);
    letter-spacing: 0.01em;
    display: none;
  }

  /* Subtitle only visible on browse-hint toasts */
  .toast.browse-hint .toast-subtitle {
    display: block;
    color: rgba(100, 255, 218, 0.60);
  }

  /* ── Metrics ────────────────────────────────────────────── */
  .panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .metrics {
    display: flex;
    gap: 1px;
    background: rgba(255,255,255,0.06);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 5px 10px;
    background: rgba(8, 8, 12, 0.65);
    min-width: 42px;
    gap: 1px;
  }

  .metric:first-child { border-radius: 11px 0 0 11px; }
  .metric:last-child  { border-radius: 0 11px 11px 0; }

  /* EAR status dot: shows closed/open eye state in real time */
  .ear-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #64FFDA;
    transition: background 0.1s;
    flex-shrink: 0;
  }
  .ear-dot.closed {
    background: #ff6b6b;
  }

  .metric-label {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
  }

  .metric-value {
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', 'Courier New', monospace;
    color: #64FFDA;
    letter-spacing: -0.02em;
  }

  /* ── Mode badge ──────────────────────────────────────────── */
  .mode-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 6px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.08);
    transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    background: rgba(8, 8, 12, 0.65);
    color: rgba(255,255,255,0.5);
  }

  .mode-badge.browse {
    background: rgba(100, 255, 218, 0.12);
    color: #64FFDA;
    border-color: rgba(100, 255, 218, 0.3);
  }

  .mode-badge svg {
    width: 10px;
    height: 10px;
    display: block;
    flex-shrink: 0;
  }

  .hidden { display: none !important; }
`;class zt{constructor(){this._host=null,this._shadow=null,this._toast=null,this._toastIcon=null,this._toastLabel=null,this._toastSubtitle=null,this._modeBadge=null,this._modeBadgeSvg=null,this._modeBadgeLabel=null,this._panel=null,this._toastTimer=null,this._metricYaw=null,this._metricPitch=null,this._metricRoll=null,this._metricEar=null,this._earDot=null}mount(){this._host=document.createElement("div"),this._host.id="nodex-hud",this._shadow=this._host.attachShadow({mode:"closed"});const t=document.createElement("style");t.textContent=qt,this._shadow.appendChild(t),this._buildToast(),this._buildPanel(),document.body.appendChild(this._host)}show(){this._panel&&this._panel.classList.remove("hidden")}hide(){this._panel&&this._panel.classList.add("hidden")}showCommand(t,e=!1){if(!this._toast)return;const i=(e?$t[t]:null)??Kt[t];i&&(this._toastIcon.innerHTML=i.icon,this._toastLabel.textContent=i.label,this._toastSubtitle.textContent="",i.warning?this._toast.classList.add("warning"):this._toast.classList.remove("warning"),this._toast.classList.remove("browse-hint"),this._toast.classList.add("visible"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible")},Vt))}showWarning(t){this._toast&&(this._toastIcon.innerHTML=A.warning,this._toastLabel.textContent=t,this._toastSubtitle.textContent="",this._toast.classList.remove("browse-hint"),this._toast.classList.add("visible","warning"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible","warning")},5e3))}setModeIndicator(t){this._modeBadge&&(this._modeBadgeSvg.innerHTML=t?A.browse:A.player,this._modeBadgeLabel.textContent=t?"Browse":"Player",t?this._modeBadge.classList.add("browse"):this._modeBadge.classList.remove("browse"))}updateMetrics(t){this._metricYaw&&(this._metricYaw.textContent=typeof t.yaw=="number"?t.yaw.toFixed(1):"—",this._metricPitch.textContent=typeof t.pitch=="number"?t.pitch.toFixed(1):"—",this._metricRoll.textContent=typeof t.roll=="number"?t.roll.toFixed(1):"—",this._metricEar.textContent=typeof t.ear=="number"?t.ear.toFixed(2):"—",this._earDot&&typeof t.ear=="number"&&(t.ear<.15?this._earDot.classList.add("closed"):this._earDot.classList.remove("closed")))}showBrowseHint(){this._toast&&(this._toastIcon.innerHTML=A.browse,this._toastLabel.textContent="Browse Mode",this._toastSubtitle.textContent="Nod left/right to navigate · Tilt to go back",this._toast.classList.remove("warning"),this._toast.classList.add("visible","browse-hint"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible","browse-hint")},5e3))}unmount(){var t,e;clearTimeout(this._toastTimer),(e=(t=this._host)==null?void 0:t.parentNode)==null||e.removeChild(this._host),this._host=this._shadow=this._toast=this._toastIcon=this._toastLabel=this._toastSubtitle=this._modeBadge=this._modeBadgeSvg=this._modeBadgeLabel=this._panel=this._metricYaw=this._metricPitch=this._metricRoll=this._metricEar=this._earDot=null}_buildToast(){this._toast=document.createElement("div"),this._toast.className="toast",this._toastIcon=document.createElement("div"),this._toastIcon.className="toast-icon";const t=document.createElement("div");t.className="toast-text",this._toastLabel=document.createElement("span"),this._toastLabel.className="toast-label",this._toastSubtitle=document.createElement("span"),this._toastSubtitle.className="toast-subtitle",t.appendChild(this._toastLabel),t.appendChild(this._toastSubtitle),this._toast.appendChild(this._toastIcon),this._toast.appendChild(t),this._shadow.appendChild(this._toast)}_buildPanel(){this._panel=document.createElement("div"),this._panel.className="panel",this._modeBadge=document.createElement("div"),this._modeBadge.className="mode-badge",this._modeBadgeSvg=document.createElement("span"),this._modeBadgeSvg.innerHTML=A.player,this._modeBadgeLabel=document.createElement("span"),this._modeBadgeLabel.textContent="Player",this._modeBadge.appendChild(this._modeBadgeSvg),this._modeBadge.appendChild(this._modeBadgeLabel);const t=document.createElement("div");t.className="metrics";const e=[{key:"yaw",label:"YAW"},{key:"pitch",label:"PITCH"},{key:"roll",label:"ROLL"},{key:"ear",label:"EAR"}];for(const{key:i,label:s}of e){const o=document.createElement("div");o.className="metric";const a=document.createElement("span");a.className="metric-label",a.textContent=s;const l=document.createElement("span");if(l.className="metric-value",l.textContent="—",i==="yaw"&&(this._metricYaw=l),i==="pitch"&&(this._metricPitch=l),i==="roll"&&(this._metricRoll=l),i==="ear"){this._metricEar=l,this._earDot=document.createElement("div"),this._earDot.className="ear-dot",o.appendChild(a),o.appendChild(l),o.appendChild(this._earDot),t.appendChild(o);continue}o.appendChild(a),o.appendChild(l),t.appendChild(o)}this._panel.appendChild(this._modeBadge),this._panel.appendChild(t),this._shadow.appendChild(this._panel)}}class jt{constructor(t){if(typeof t!="number"||!Number.isFinite(t)||t<0)throw new TypeError("intervalMs must be a non-negative finite number");this._interval=t,this._lastFired=0}canFire(){return Date.now()-this._lastFired>=this._interval}fire(){return this.canFire()?(this._lastFired=Date.now(),!0):!1}reset(){this._lastFired=0}setInterval(t){if(typeof t!="number"||!Number.isFinite(t)||t<0)throw new TypeError("ms must be a non-negative finite number");this._interval=t}}const wt=1,xt=234,Tt=454,Xt=10,Zt=152,Jt=159,Qt=145,te=133,ee=33,ie=158,se=153,ne=386,oe=374,re=362,ae=263,le=385,ce=380,he=13,de=14,_e=78,ue=308,X=.001;function q(r,t){return Math.sqrt((r.x-t.x)**2+(r.y-t.y)**2+(r.z-t.z)**2)}function fe(r){if(!(r!=null&&r.length))return 0;const t=r[wt],e=r[xt],i=r[Tt];if(!t||!e||!i)return 0;const s=(e.x+i.x)/2,o=Math.abs(i.x-e.x)/2;return o<X?0:-((t.x-s)/o)*45}function pe(r){if(!(r!=null&&r.length))return 0;const t=r[wt],e=r[Xt],i=r[Zt];if(!t||!e||!i)return 0;const s=(e.y+i.y)/2,o=Math.abs(i.y-e.y)/2;return o<X?0:(s-t.y)/o*40}function ge(r){if(!(r!=null&&r.length))return 0;const t=r[xt],e=r[Tt];if(!t||!e)return 0;const i=e.x-t.x,s=e.y-t.y;return Math.abs(i)<X&&Math.abs(s)<X?0:-Math.atan2(s,i)*(180/Math.PI)}function be(r){if(!(r!=null&&r.length))return null;const t=r[Jt],e=r[Qt],i=r[ie],s=r[se],o=r[te],a=r[ee],l=r[ne],u=r[oe],g=r[le],p=r[ce],b=r[re],x=r[ae];if(!t||!e||!i||!s||!o||!a||!l||!u||!g||!p||!b||!x)return null;const R=q(o,a),C=q(b,x);if(R<X||C<X)return null;const m=(q(t,e)+q(i,s))/2,d=(q(l,u)+q(g,p))/2;return(m/R+d/C)/2}function me(r){return null}function ye(r){if(!(r!=null&&r.length))return 0;const t=r[he],e=r[de],i=r[_e],s=r[ue];if(!t||!e||!i||!s)return 0;const o=q(i,s);return o<X?0:q(t,e)/o}const Ee=4,we=3,xe=2,at=6,Te=20,Se=16,Ce=14,ve=12,ke=12,Ie=35,Ae=42,St=.04,Re=12,Ne=.15,Le=.19,Me=.03,Oe=.038,De=.046,Pe=.008,Be=4,Fe=10080*60*1e3;class He{constructor({thresholds:t=ut,cooldowns:e=_t,gestureMap:i=Ft,baseline:s=null,onCommand:o=null,onMetrics:a=null,onPanelNotify:l=null}={}){this._thresholds={...t},this._gestureMap={...i},this._baseline=s,this._onCommand=o,this._onMetrics=a,this._onPanelNotify=l,this._yawBaseline=0,this._pitchBaseline=0,this._rollBaseline=0,this._applyPoseBaselinesFrom(s),this._blinkCalibration=null,this._blinkFallbackWarned=!1,this._metricsStreamingTo=null,this._wizardCaptureOnly=!1,this._emitBlinkEvents=!1,this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0,this._headHistYaw=new Float32Array(at),this._headHistPitch=new Float32Array(at),this._headHistIdx=0,this._headHistFull=!1,this._earEmaOpen=0,this._earEmaFrames=0,this._dynamicEarThreshold=null,this._dynamicEarExit=null,this._dwellYawLeft=0,this._dwellYawRight=0,this._dwellPitchUp=0,this._dwellPitchDown=0,this._active=_.NONE,this._blocked=!1,this._destroyed=!1,this._cooldowns={};for(const u of Object.values(_))u!==_.NONE&&(this._cooldowns[u]=new jt(e[u]??600));typeof window<"u"&&(window.__nodexGestureEngine=this)}async loadEarCalibrationFromStorage(){var t,e;if(!this._destroyed)try{const{earCalibration:i}=await chrome.storage.local.get("earCalibration"),s=i&&typeof i.calibratedAt=="number"&&Date.now()-i.calibratedAt<Fe,o=i==null?void 0:i.signalType;if(s&&(nt&&o==="iris"||!nt&&(o==="ear"||o==null))){const l=Math.min(i.threshold+.03,(i.earOpen??.5)*.8);i.exitThreshold>i.threshold+.05?this._blinkCalibration={...i,exitThreshold:l}:this._blinkCalibration=i}else this._blinkCalibration=null,(t=this._onPanelNotify)==null||t.call(this,{type:T.BLINK_CALIB_NEEDED})}catch{this._blinkCalibration=null,(e=this._onPanelNotify)==null||e.call(this,{type:T.BLINK_CALIB_NEEDED})}}startCalibrationWizard(t){this._destroyed||(this._metricsStreamingTo="sidepanel",this._wizardCaptureOnly=!0,this._emitBlinkEvents=!1)}enterWizardTestPhase(){this._destroyed||(this._wizardCaptureOnly=!1,this._emitBlinkEvents=!0)}stopCalibrationWizard(){this._destroyed||(this._metricsStreamingTo=null,this._wizardCaptureOnly=!1,this._emitBlinkEvents=!1)}setNeutralPose(t){const e=t.yawBaseline,i=t.pitchBaseline,s=t.rollBaseline??0;typeof e=="number"&&Number.isFinite(e)&&(this._yawBaseline=e),typeof i=="number"&&Number.isFinite(i)&&(this._pitchBaseline=i),typeof s=="number"&&Number.isFinite(s)&&(this._rollBaseline=s),this._baseline={...this._baseline??{},yaw:this._yawBaseline,pitch:this._pitchBaseline,roll:this._rollBaseline}}setBlinkCalibration(t){!t||typeof t!="object"||t.signalType!=="ear"&&t.signalType!=null||(this._blinkCalibration=t)}adjustBlinkThreshold(t){var o;if(this._destroyed||!((o=this._blinkCalibration)!=null&&o.range))return;const e=this._blinkCalibration;let i=e.threshold+t;i=Math.max(.012,Math.min(.5,i));const s=Math.min(i+.03,e.earOpen*.8);this._blinkCalibration={...e,threshold:i,exitThreshold:s},chrome.storage.local.set({earCalibration:this._blinkCalibration})}applyBlinkThresholdUpdate(t){if(this._destroyed||!this._blinkCalibration)return;const e=t.threshold,i=t.exitThreshold;typeof e!="number"||!Number.isFinite(e)||typeof i!="number"||!Number.isFinite(i)||(this._blinkCalibration={...this._blinkCalibration,threshold:e,exitThreshold:i})}processFrame(t){var m,d;if(this._destroyed||!(t!=null&&t.length))return;const e=this._thresholds,i=fe(t),s=pe(t),o=ge(t),a=me(),l=a!==null?a:be(t),u=ye(t),g=i-this._yawBaseline,p=s-this._pitchBaseline,b=o-this._rollBaseline,x={yaw:g,pitch:p,roll:b,ear:l??void 0,mouth:u};if((m=this._onMetrics)==null||m.call(this,x),this._metricsStreamingTo==="sidepanel"&&l!=null&&Number.isFinite(l)&&((d=this._onPanelNotify)==null||d.call(this,{type:T.METRICS_FRAME,yaw:i,pitch:s,ear:l})),this._pushHeadPoseHistory(Math.abs(g),Math.abs(p)),this._blocked){this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0,this._resetHeadPoseDwell(),this._active=_.NONE;return}if(this._wizardCaptureOnly)return;this._updateHeadPoseDwellStreaks(g,p,e);const R=Math.abs(g)>ve||Math.abs(p)>Ce||Math.abs(b)>ke,C=this._headPoseNotNeutralForEyes();if(l!=null&&Number.isFinite(l)?R||C?(this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0):this._processBlinkFrame(l,x,a!==null):(this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0),this._active!==_.NONE&&this._active!==_.EYES_CLOSED&&this._shouldDeactivate(this._active,g,p,b,u,e)&&(this._active=_.NONE,this._resetHeadPoseDwell()),this._active===_.NONE){const v=this._detect(g,p,b,u,e,Ee,we);v!==_.NONE&&(this._active=v,this._fire(v,x))}(this._active===_.HEAD_UP||this._active===_.HEAD_DOWN||this._active===_.HEAD_LEFT||this._active===_.HEAD_RIGHT)&&this._fire(this._active,x)}_processBlinkFrame(t,e,i){const s=this._blinkCalibration,o=s!=null&&typeof s.threshold=="number"&&Number.isFinite(s.threshold)&&typeof s.exitThreshold=="number"&&Number.isFinite(s.exitThreshold);!o&&!this._blinkFallbackWarned&&(this._blinkFallbackWarned=!0,console.warn("[Nodex] No blink calibration — using auto-calibration fallback. Calibrate via side panel for best results.")),!o&&!i&&this._closedStreak===0&&t>.09&&(this._earEmaFrames===0?this._earEmaOpen=t:this._earEmaOpen=St*t+(1-St)*this._earEmaOpen,this._earEmaFrames++,this._earEmaFrames>=Re&&this._earEmaOpen>=.12&&(this._dynamicEarThreshold=Math.max(.08,this._earEmaOpen*.6),this._dynamicEarExit=Math.max(.11,this._earEmaOpen*.8)));const a=o?s.threshold:i?Oe:this._dynamicEarThreshold??Ne,l=o?s.exitThreshold:i?De:this._dynamicEarExit??Le;o&&typeof s.noiseFloor=="number"&&Number.isFinite(s.noiseFloor)&&s.noiseFloor;const u=15,g=Ie;t<a?(this._closedStreak++,this._deadZoneFrames=0,this._closedStreak===Ae&&!this._longHoldFired&&(this._longHoldFired=!0,this._fire(_.EYES_HOLD,e))):t>l?(!this._longHoldFired&&this._closedStreak>=u&&this._closedStreak<=g&&this._fire(_.EYES_CLOSED,e),this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0):this._closedStreak<u&&(this._deadZoneFrames++,this._deadZoneFrames>=Be&&(this._closedStreak=Math.floor(this._closedStreak/2),this._deadZoneFrames=0))}updateSettings({thresholds:t,gestureMap:e,baseline:i,cooldowns:s,blocked:o}={}){if(t&&(this._thresholds={...t}),e&&(this._gestureMap={...e}),i!==void 0&&(this._baseline=i,this._applyPoseBaselinesFrom(i)),o!==void 0&&(this._blocked=o),s)for(const[a,l]of Object.entries(s))this._cooldowns[a]&&this._cooldowns[a].setInterval(l)}destroy(){typeof window<"u"&&window.__nodexGestureEngine===this&&(window.__nodexGestureEngine=null),this._destroyed=!0,this._active=_.NONE,this._closedStreak=0,this._longHoldFired=!1,this._deadZoneFrames=0,this.stopCalibrationWizard(),this._yawBaseline=0,this._pitchBaseline=0,this._rollBaseline=0,this._headHistIdx=0,this._headHistFull=!1,this._earEmaOpen=0,this._earEmaFrames=0,this._dynamicEarThreshold=null,this._dynamicEarExit=null,this._resetHeadPoseDwell(),this._onCommand=null,this._onMetrics=null,this._onPanelNotify=null;for(const t of Object.values(this._cooldowns))t.reset()}_pushHeadPoseHistory(t,e){this._headHistYaw[this._headHistIdx]=t,this._headHistPitch[this._headHistIdx]=e,this._headHistIdx=(this._headHistIdx+1)%at,!this._headHistFull&&this._headHistIdx===0&&(this._headHistFull=!0)}_headPoseNotNeutralForEyes(){const t=this._headHistFull?at:this._headHistIdx;for(let e=0;e<t;e++)if(this._headHistYaw[e]>Te||this._headHistPitch[e]>Se)return!0;return!1}_resetHeadPoseDwell(){this._dwellYawLeft=0,this._dwellYawRight=0,this._dwellPitchUp=0,this._dwellPitchDown=0}_updateHeadPoseDwellStreaks(t,e,i){const s=i.yaw??22,o=i.pitch??18,a=o-4;t>s?this._dwellYawRight++:this._dwellYawRight=0,t<-s?this._dwellYawLeft++:this._dwellYawLeft=0,e>o?this._dwellPitchUp++:this._dwellPitchUp=0,e<-a?this._dwellPitchDown++:this._dwellPitchDown=Math.max(0,this._dwellPitchDown-1)}_applyPoseBaselinesFrom(t){const e=t==null?void 0:t.yaw,i=t==null?void 0:t.pitch,s=t==null?void 0:t.roll;this._yawBaseline=typeof e=="number"&&Number.isFinite(e)?e:0,this._pitchBaseline=typeof i=="number"&&Number.isFinite(i)?i:0,this._rollBaseline=typeof s=="number"&&Number.isFinite(s)?s:0}_fire(t,e){var o,a;if(this._destroyed||(t===_.EYES_CLOSED&&this._emitBlinkEvents&&((o=this._onPanelNotify)==null||o.call(this,{type:T.BLINK_DETECTED})),this._emitBlinkEvents))return;t!==_.EYES_CLOSED&&t!==_.MOUTH_OPEN&&(this._headHistFull=!1,this._headHistIdx=0,this._headHistYaw.fill(0),this._headHistPitch.fill(0));const i=this._cooldowns[t];if(!i||!i.fire())return;const s=this._gestureMap[t]??h.NONE;s!==h.NONE&&((a=this._onCommand)==null||a.call(this,s,t,e))}_detect(t,e,i,s,o,a,l){const u=o.yaw??22,g=o.pitch??18,p=Math.abs(t),b=Math.abs(e);return b+4>=p&&e>g&&this._dwellPitchUp>=l?_.HEAD_UP:b+14>=p&&e<-g&&this._dwellPitchDown>=xe?_.HEAD_DOWN:t<-u&&this._dwellYawLeft>=a?_.HEAD_LEFT:t>u&&this._dwellYawRight>=a?_.HEAD_RIGHT:i<-o.roll?_.TILT_LEFT:i>o.roll?_.TILT_RIGHT:s>o.mouthOpen?_.MOUTH_OPEN:_.NONE}_shouldDeactivate(t,e,i,s,o,a){const l=a.yaw??22,u=a.pitch??18,g=a.roll??15,p=a.hysteresisYaw??7,b=a.hysteresisPitch??7,x=a.hysteresis??4;switch(t){case _.HEAD_LEFT:return e>=-(l-p);case _.HEAD_RIGHT:return e<=l-p;case _.HEAD_UP:return i<=u-b;case _.HEAD_DOWN:return i>=-(u-b);case _.TILT_LEFT:return s>=-(g-x);case _.TILT_RIGHT:return s<=g-x;case _.MOUTH_OPEN:return o<=a.mouthOpen*.8;default:return!0}}}function ft(r,t){var e;if(!r)return null;try{if(r.nodeType===1&&r.matches(t))return r}catch{return null}try{const i=(e=r.querySelector)==null?void 0:e.call(r,t);if(i)return i}catch{return null}if(r.shadowRoot){const i=ft(r.shadowRoot,t);if(i)return i}for(const i of r.children||[]){const s=ft(i,t);if(s)return s}return null}const Ue={[h.PLAY]:{key:"k",code:"KeyK",keyCode:75},[h.PAUSE]:{key:"k",code:"KeyK",keyCode:75},[h.PLAY_PAUSE]:{key:"k",code:"KeyK",keyCode:75},[h.VOL_UP]:{key:"ArrowUp",code:"ArrowUp",keyCode:38},[h.VOL_DOWN]:{key:"ArrowDown",code:"ArrowDown",keyCode:40},[h.MUTE]:{key:"m",code:"KeyM",keyCode:77},[h.REWIND]:{key:"j",code:"KeyJ",keyCode:74},[h.SKIP]:{key:"l",code:"KeyL",keyCode:76},[h.NEXT]:{key:"N",code:"KeyN",keyCode:78,shiftKey:!0}},Ge=new Set([h.VOL_UP,h.VOL_DOWN,h.MUTE]);function Ye(){return document.querySelector("#movie_player.ad-showing")!==null||document.querySelector(".ytp-ad-player-overlay")!==null}class We{execute(t){if(Ye()&&!Ge.has(t))return!1;if(t===h.PREV){const i=document.querySelector("#movie_player")??document.body,s=ft(i,".ytp-prev-button");if(s&&!s.disabled&&s.getAttribute("aria-disabled")!=="true")try{return s.click(),!0}catch(a){console.error("[Nodex] Prev button click failed:",a)}return this._sendKey({key:"P",code:"KeyP",keyCode:80,shiftKey:!0}),window.history.back(),!0}if(t===h.PLAY||t===h.PAUSE){const i=document.querySelector("video");if(i)return t===h.PLAY?i.play().catch(()=>{}):i.pause(),!0}const e=Ue[t];return e?this._sendKey(e):!1}_sendKey({key:t,code:e,keyCode:i,shiftKey:s=!1}){try{const o=document.querySelector("#movie_player")??document.body,a={key:t,code:e,keyCode:i,which:i,shiftKey:s,bubbles:!0,cancelable:!0,composed:!0};return o.dispatchEvent(new KeyboardEvent("keydown",a)),o.dispatchEvent(new KeyboardEvent("keyup",a)),!0}catch(o){return console.error("[Nodex] Keyboard dispatch failed:",o),!1}}}const Ve=["yt-lockup-view-model a.yt-lockup-view-model__content-image",'yt-lockup-view-model a[href*="/watch?v="]','yt-lockup-view-model a[href^="/shorts/"]',"ytd-rich-item-renderer a#thumbnail","ytd-video-renderer a#thumbnail","ytd-compact-video-renderer a#thumbnail","ytd-grid-video-renderer a#thumbnail","ytd-reel-item-renderer a#thumbnail","ytd-rich-grid-media a#thumbnail","ytd-rich-section-renderer a#thumbnail"],Ke='a[href*="/watch?v="], a[href^="/shorts/"], a[href*="youtube.com/shorts/"]',Ct=8,$e=1500,qe=800,ze=400,je=15e3,Xe=700,Ze=2500,Je=["ytd-rich-grid-renderer","ytd-section-list-renderer","ytd-watch-next-secondary-results-renderer"],Qe=["ytd-ad-slot-renderer","ytd-display-ad-renderer","ytd-promoted-sparkles-web-renderer","ytd-movie-renderer","ytd-in-feed-ad-layout-renderer","ytd-promoted-video-renderer","ytd-statement-banner-renderer","ytd-brand-video-shelf-renderer"].join(","),vt=Ve.join(","),kt=20,It=20;function lt(r){if(!r||typeof r!="string")return null;let t=r.match(/[?&]v=([^&]+)/);return t||(t=r.match(/\/shorts\/([^/?&#]+)/),t)?t[1]:null}function At(r,t){if(!r||!t)return!1;if(r===t)return!0;const e=lt(r),i=lt(t);return!!(e&&i&&e===i)}function ti(){for(const r of Je){const t=document.querySelector(r);if(t)return t}return document.querySelector("ytd-app")??document.body}function z(r){var s,o,a;if(!(r!=null&&r.closest)||r.closest(Qe))return!1;const t=(s=r.closest)==null?void 0:s.call(r,"ytd-rich-item-renderer");if((o=t==null?void 0:t.hasAttribute)!=null&&o.call(t,"is-empty")||t&&!((a=r.closest)!=null&&a.call(r,"yt-lockup-view-model"))&&t.querySelector(".yt-badge-shape--commerce"))return!1;const e=r.getBoundingClientRect();if(e.width<=0||e.height<=0)return!1;const i=window.innerHeight;return!(e.bottom<-2*i||e.top>i+2*i)}function Rt(){return[...document.querySelectorAll(vt)].filter(z)}function ct(r,t,e){return e?Math.hypot(r,3*t):Math.hypot(3*r,t)}function ei(r){if(!r)return null;const t=r.width??0,e=r.height??0,i=r.left+(t>0?t/2:0),s=r.top+(e>0?e/2:0),o=Rt();let a=null,l=1/0;for(const u of o){const g=u.getBoundingClientRect();if(g.width<=0||g.height<=0)continue;const p=g.left+g.width/2,b=g.top+g.height/2,x=Math.hypot(p-i,b-s);x<l&&(l=x,a=u)}return a}function tt(r,t,e=null){if(!r)return null;const i=r.width??0,s=r.height??0,o=r.left+(i>0?i/2:0),a=r.top+(s>0?s/2:0),l=Rt();let u=null,g=1/0;for(const p of l){if(e&&p===e)continue;const b=p.getBoundingClientRect();if(b.width<=0||b.height<=0)continue;const x=b.left+b.width/2,R=b.top+b.height/2,C=x-o,m=R-a;let d=1/0;if(t==="right"){if(C<=kt)continue;d=ct(C,m,!0)}else if(t==="left"){if(C>=-kt)continue;d=ct(C,m,!0)}else if(t==="up"){if(m>=-It)continue;d=ct(C,m,!1)}else if(t==="down"){if(m<=It)continue;d=ct(C,m,!1)}else continue;d<g&&(g=d,u=p)}return u}function ii(r,t){const e=a=>{const l=t.get(a);return l?l.width*l.height:0},i=new Map;for(const a of r){const l=lt(a.href);if(!l)continue;const u=i.get(l);(!u||e(a)>e(u))&&i.set(l,a)}const s=[],o=new Set;for(const a of r){const l=lt(a.href);l&&i.get(l)!==a||o.has(a)||(o.add(a),s.push(a))}return s}function Nt(r,t){var i;let e=1/0;for(const s of r){const o=(i=t.get(s))==null?void 0:i.top;typeof o=="number"&&o<e&&(e=o)}return e===1/0?0:e}function Lt(r,t){var i;let e=1/0;for(const s of r){const o=(i=t.get(s))==null?void 0:i.left;typeof o=="number"&&o<e&&(e=o)}return e===1/0?0:e}function si(r,t,e){const i=Nt(r,e),s=Nt(t,e);return Math.abs(i-s)>=Ct?i-s:Lt(r,e)-Lt(t,e)}function pt(r){const t=r[0];return t!=null&&t.closest?!!t.closest("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer"):!1}function ni(r,t,e){var R,C;if(r.length===0)return[];const i=new Map,s=[];for(const m of r){const d=(R=m.closest)==null?void 0:R.call(m,"ytd-reel-shelf-renderer, ytd-rich-shelf-renderer");d?(i.has(d)||i.set(d,[]),i.get(d).push(m)):s.push(m)}const o=80;let a=100;if(s.length>0){const m=s.map(d=>{var v;return((v=t.get(d))==null?void 0:v.height)??0}).filter(d=>d>20).sort((d,v)=>d-v);if(m.length>=3){const d=m[Math.floor(m.length/2)];a=Math.max(60,d*.5)}else a=o}const l=[...s].sort((m,d)=>{const v=t.get(m)??{top:0,left:0},E=t.get(d)??{top:0,left:0},n=v.top-E.top;return Math.abs(n)<1?v.left-E.left:n}),u=[];let g=[],p=-1/0;for(const m of l){const d=((C=t.get(m))==null?void 0:C.top)??0;g.length===0||d-p<a?(g.push(m),g.length===1&&(p=d)):(u.push(g),g=[m],p=d)}g.length>0&&u.push(g);for(const m of u)m.sort((d,v)=>{var E,n;return(((E=t.get(d))==null?void 0:E.left)??0)-(((n=t.get(v))==null?void 0:n.left)??0)});const b=[];for(const m of i.values())m.sort((d,v)=>{var E,n;return(((E=t.get(d))==null?void 0:E.left)??0)-(((n=t.get(v))==null?void 0:n.left)??0)}),b.push(m);const x=[...u,...b];return x.sort((m,d)=>si(m,d,t)),x}const dt=class dt{constructor(){this._ac=new AbortController,this._destroyed=!1,this._focusIndex=-1,this._focusedElement=null,this._focusRing=null,this._currentItems=[],this._rows=[],this._retryTimer=null,this._observer=null,this._scrollRaf=null,this._scrollTrackTimer=null,this._periodicTimer=null,this._lastScanTime=0,this._lastCommandAt=0,this._focusedHref=null,this._itemListSignature=null,this._mutationDebounce=null,this._onScroll=this._handleScroll.bind(this),this._lastVerticalCmdAt=0,this._lastVerticalDirection=0,this._onBrowseResize=null,this._onBrowsePageShow=null,this._onYtNavigateFinish=null,this._lastFocusRect=null,this._stickyColumnX=null,this._stickyColumnAt=0,this._scaledEl=null,this._scaledElSource=null,typeof window<"u"&&(window.__nodexBrowseController=this)}activate(){if(this._destroyed)return 0;this.deactivate(),this._ensureFocusRing(),this._scanItems(),this._focusFirstVisible(),this._observer=new MutationObserver(()=>{this._destroyed||(clearTimeout(this._mutationDebounce),this._mutationDebounce=setTimeout(()=>{this._mutationDebounce=null,!this._destroyed&&this._scanItems()},qe))});const t=ti();return this._observer.observe(t,{subtree:!0,childList:!0}),window.addEventListener("scroll",this._onScroll,{passive:!0,signal:this._ac.signal}),this._onBrowseResize=()=>{this._ensureFocusRing(),this._focusIndex>=0&&this._highlightItem(this._focusIndex)},window.addEventListener("resize",this._onBrowseResize,{passive:!0,signal:this._ac.signal}),this._onBrowsePageShow=e=>{this._destroyed||(e.persisted&&(this._focusRing=null),this._ensureFocusRing(),this._scanItems(),this._focusIndex>=0?this._highlightItem(this._focusIndex):this._currentItems.length>0&&this._focusFirstVisible())},window.addEventListener("pageshow",this._onBrowsePageShow,{signal:this._ac.signal}),this._onYtNavigateFinish=()=>{this._destroyed||(this._focusRing&&(this._focusRing.remove(),this._focusRing=null),this._ensureFocusRing(),this._scanItems(),this._currentItems.length>0&&this._focusIndex<0?this._focusFirstVisible():this._focusIndex>=0&&this._highlightItem(this._focusIndex))},document.addEventListener("yt-navigate-finish",this._onYtNavigateFinish,{signal:this._ac.signal}),this._periodicTimer=setInterval(()=>{this._destroyed||performance.now()-this._lastCommandAt<1500||(this._ensureFocusRing(),this._scanItems(),this._focusIndex<0&&this._currentItems.length>0?this._focusFirstVisible():this._focusIndex>=0&&this._highlightItem(this._focusIndex))},je),this._currentItems.length===0&&this._scheduleRetry(),this._currentItems.length}refreshIfActive(){this._destroyed||(this._ensureFocusRing(),this._scanItems(),this._focusIndex<0&&this._currentItems.length>0?this._focusFirstVisible():this._focusIndex>=0&&this._highlightItem(this._focusIndex))}deactivate(){this._destroyed||this._teardownBrowseSession({permanent:!1})}destroy(){this._destroyed||(typeof window<"u"&&window.__nodexBrowseController===this&&(window.__nodexBrowseController=null),this._destroyed=!0,this._teardownBrowseSession({permanent:!0}))}_teardownBrowseSession({permanent:t}){var e;clearTimeout(this._mutationDebounce),this._mutationDebounce=null,clearTimeout(this._retryTimer),this._retryTimer=null,clearTimeout(this._scrollTrackTimer),this._scrollTrackTimer=null,clearInterval(this._periodicTimer),this._periodicTimer=null,cancelAnimationFrame(this._scrollRaf),this._scrollRaf=null,(e=this._observer)==null||e.disconnect(),this._observer=null,this._ac.abort(),t||(this._ac=new AbortController),this._onBrowseResize=null,this._onBrowsePageShow=null,this._onYtNavigateFinish=null,this._focusRing&&(this._focusRing.remove(),this._focusRing=null),this._scaledElSource=null,this._applyCardScale(null),this._focusIndex=-1,this._focusedElement=null,this._currentItems=[],this._rows=[],this._lastCommandAt=0,this._focusedHref=null,this._itemListSignature=null,this._lastVerticalCmdAt=0,this._lastVerticalDirection=0,this._lastFocusRect=null,this._resetStickyColumn()}_applyCardScale(t){if(t===this._scaledElSource)return;this._scaledElSource=t;const e=t?t.closest(dt.CARD_CONTAINER_SEL)??t:null;e!==this._scaledEl&&(this._scaledEl&&(this._scaledEl.style.transform="",this._scaledEl.style.transition="",this._scaledEl.style.zIndex="",this._scaledEl.style.position="",this._scaledEl=null),e&&(e.style.position="relative",e.style.zIndex="1",e.style.transition="transform 0.2s ease-out",e.style.transform="scale(1.05)",this._scaledEl=e))}_pulseEdge(){const t=this._focusRing;!t||t.style.display==="none"||(t.style.transition="border-color 0.08s ease-out, box-shadow 0.08s ease-out",t.style.borderColor="#ff4444",t.style.boxShadow="0 0 0 4px rgba(255, 68, 68, 0.35)",setTimeout(()=>{!this._focusRing||this._destroyed||(t.style.borderColor="#64FFDA",t.style.boxShadow="0 0 0 4px rgba(100, 255, 218, 0.2)",setTimeout(()=>{!this._focusRing||this._destroyed||(t.style.transition="top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out")},180))},120))}_resetStickyColumn(){this._stickyColumnX=null,this._stickyColumnAt=0}execute(t){if(this._destroyed||document.querySelector(".ad-showing"))return!1;if(t===h.SKIP||t===h.REWIND||t===h.VOL_UP||t===h.VOL_DOWN){const i=performance.now();if(i-this._lastCommandAt<Xe)return!1;this._lastCommandAt=i}if(!this._ensureItems())return!1;switch(t){case h.SKIP:return this._moveFocus(1);case h.REWIND:return this._moveFocus(-1);case h.VOL_UP:return this._moveFocusVertical(-1);case h.VOL_DOWN:return this._moveFocusVertical(1);case h.PLAY_PAUSE:return this._selectCurrent();default:return!1}}_ensureItems(){const t=this._currentItems[this._focusIndex];if(t!=null&&t.isConnected){const e=t.getBoundingClientRect(),i=window.innerHeight;return(e.bottom<0||e.top>i)&&(this._scanItems(),this._currentItems.length>0&&this._focusFirstVisible()),this._currentItems.length>0}return this._scanItems(),this._currentItems.length===0?!1:((this._focusIndex<0||this._focusIndex>=this._currentItems.length)&&this._focusFirstVisible(),this._currentItems.length>0)}_ensureFocusRing(){if(this._focusRing){const t=this._focusRing;(!t.isConnected||t.ownerDocument!==document||document.body!=null&&!document.body.contains(t))&&(this._focusRing=null)}this._createFocusRing()}_createFocusRing(){if(this._focusRing){const i=this._focusRing;if(i.isConnected&&i.ownerDocument===document&&(document.body==null||document.body.contains(i)))return;this._focusRing=null}const t=document.createElement("div");t.id="nodex-focus-ring",t.setAttribute("data-nodex","focus-ring"),Object.assign(t.style,{position:"fixed",pointerEvents:"none",zIndex:"2147483647",border:"3px solid #64FFDA",borderRadius:"12px",boxShadow:"0 0 0 4px rgba(100, 255, 218, 0.2)",transition:"top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out",display:"none"}),(document.body||document.documentElement).appendChild(t),this._focusRing=t}_focusFirstVisible(){if(this._currentItems.length===0)return;this._resetStickyColumn();const t=window.innerHeight,e=Ct;let i=-1,s=null;const o=(a,l)=>{const u=a.top-l.top;return Math.abs(u)>=e?a.top<l.top:a.left<l.left};for(let a=0;a<this._currentItems.length;a++){const l=this._currentItems[a];if(!l.isConnected)continue;const u=l.getBoundingClientRect();u.bottom<=0||u.top>=t||u.height<=0||(s===null||o(u,s))&&(i=a,s=u)}if(i>=0){this._setFocus(i);return}this._setFocus(0)}_scheduleRetry(){clearTimeout(this._retryTimer);let t=0;const e=()=>{if(!this._destroyed){if(t++,this._scanItems(),this._currentItems.length>0){this._focusFirstVisible();return}t<10&&(this._retryTimer=setTimeout(e,600))}};this._retryTimer=setTimeout(e,500)}_scanItems(){var a,l,u,g;if(this._destroyed)return;this._lastScanTime=Date.now();let t=this._queryVisibleItems(vt).filter(p=>z(p));if(t.length===0&&(t=this._queryVisibleItems(Ke).filter(p=>{var x;if(!z(p)||p.closest("ytd-playlist-renderer, #masthead")||(x=p.href)!=null&&x.includes("&list="))return!1;const b=p.getBoundingClientRect();return b.width>=150&&b.height>=100})),t.length===0){this._rows=[],this._currentItems=[],this._focusIndex=-1,this._focusedElement=null,this._focusedHref=null,this._itemListSignature=null,this._resetStickyColumn(),this._focusRing&&(this._focusRing.style.display="none");return}const e=((a=this._scaledEl)==null?void 0:a.style.transform)??"";this._scaledEl&&(this._scaledEl.style.transform="");const i=new Map;for(const p of t)i.set(p,p.getBoundingClientRect());this._scaledEl&&(this._scaledEl.style.transform=e),t=ii(t,i),this._rows=ni(t,i),t=this._rows.flat();const s={count:t.length,firstHref:((l=t[0])==null?void 0:l.href)??"",lastHref:((u=t[t.length-1])==null?void 0:u.href)??""};if(this._itemListSignature=s,this._currentItems=t,this._focusedHref){const p=t.findIndex(b=>At(this._focusedHref,b.href));if(p>=0){this._setFocus(p),this._ensureFocusInViewport();return}}const o=this._focusedElement;if(o&&o.isConnected){const p=t.indexOf(o);if(p>=0){this._setFocus(p),this._ensureFocusInViewport();return}}if(o&&(!o.isConnected||t.indexOf(o)<0)){t.length>0&&this._focusFirstVisible();return}if(this._focusIndex>=0&&this._focusIndex<t.length&&((g=t[this._focusIndex])!=null&&g.isConnected)){this._setFocus(this._focusIndex),this._ensureFocusInViewport();return}t.length>0&&this._focusFirstVisible()}_ensureFocusInViewport(){if(this._focusIndex<0)return;const t=this._currentItems[this._focusIndex];if(!(t!=null&&t.isConnected))return;const e=t.getBoundingClientRect(),i=window.innerHeight;(e.bottom<0||e.top>i)&&this._focusFirstVisible()}_queryVisibleItems(t){return[...document.querySelectorAll(t)].filter(e=>{const i=e.getBoundingClientRect();return i.width>0&&i.height>0})}_selfHealInvalidFocusIfNeeded(){if(this._destroyed)return!1;const t=this._currentItems[this._focusIndex];if(t!=null&&t.isConnected&&z(t))return!1;let e=null;this._lastFocusRect?e={...this._lastFocusRect}:t!=null&&t.isConnected&&(e=t.getBoundingClientRect());const i=ei(e);if(!i)return!1;this._scanItems();const s=this._currentItems.indexOf(i);return s<0?!1:(this._setFocus(s),!0)}_applyGeometricFocus(t,e,i){this._scanItems();let s=this._currentItems.indexOf(t);if(s<0&&(this._scanItems(),s=this._currentItems.indexOf(t)),s<0)return!1;this._setFocus(s);const o=t.getBoundingClientRect(),a=window.innerHeight,l=window.innerWidth;return o.top>=0&&o.bottom<=a&&o.left>=0&&o.right<=l||t.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"}),this._trackScrollPosition(),console.warn("[Nodex] browse fallback:",e,"from",i,"to",t),!0}_tryGeometricVerticalMove(t,e){const i=t<0?"up":"down",s=e!=null&&e.isConnected?e.getBoundingClientRect():this._lastFocusRect?{...this._lastFocusRect}:null,o=tt(s,i,e??null);return o?this._applyGeometricFocus(o,i,e):!1}_findRowCol(){var i;let t=!1;if((i=this._focusedElement)!=null&&i.isConnected){const s=this._currentItems.indexOf(this._focusedElement);s>=0&&(this._focusIndex=s,t=!0)}if(!t&&this._focusedHref){const s=this._currentItems.findIndex(o=>At(this._focusedHref,o.href));s>=0&&(this._focusIndex=s,this._focusedElement=this._currentItems[s],t=!0)}if(!t)return null;const e=this._currentItems[this._focusIndex];if(!e)return null;for(let s=0;s<this._rows.length;s++){const o=this._rows[s].indexOf(e);if(o>=0)return{rowIdx:s,colIdx:o}}return null}_moveFocus(t,e=0){var m;if(this._destroyed||(this._resetStickyColumn(),this._scanItems(),this._rows.length===0||this._currentItems.length===0))return!1;this._selfHealInvalidFocusIfNeeded();const i=t>0?"right":"left";let s=this._findRowCol();s||(this._scanItems(),s=this._findRowCol());const o=this._currentItems[this._focusIndex],a=o!=null&&o.isConnected?o.getBoundingClientRect():this._lastFocusRect?{...this._lastFocusRect}:null;if(!s){const d=tt(a,i,o??null);return!!(d&&this._applyGeometricFocus(d,i,o))}const{rowIdx:l,colIdx:u}=s,g=this._rows[l],p=u+t;if(p<0||p>=g.length){const d=(m=o==null?void 0:o.closest)==null?void 0:m.call(o,"ytd-reel-shelf-renderer, ytd-rich-shelf-renderer");if(d&&e<1){const E=d.querySelector("#scroll-container")??d.querySelector('[class*="scroll-container"]');if(E){const n=t>0?1:-1;return E.scrollBy({left:n*300,behavior:"smooth"}),setTimeout(()=>{this._destroyed||(this._scanItems(),this._moveFocus(t,e+1))},500),!0}}const v=tt(a,i,o??null);return v&&this._applyGeometricFocus(v,i,o)?!0:(this._pulseEdge(),"edge")}const b=g[p];if(!(b!=null&&b.isConnected)||!z(b)){this._scanItems();const d=tt(a,i,o??null);return d&&this._applyGeometricFocus(d,i,o)?!0:(this._focusIndex>=0&&this._highlightItem(this._focusIndex),this._pulseEdge(),"edge")}const x=this._currentItems.indexOf(b);if(x<0){const d=tt(a,i,o??null);return d&&this._applyGeometricFocus(d,i,o)?!0:(this._pulseEdge(),"edge")}this._setFocus(x);const R=b.getBoundingClientRect();return R.top>=0&&R.bottom<=window.innerHeight&&R.left>=0&&R.right<=window.innerWidth||b.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"}),this._trackScrollPosition(),!0}_moveFocusVertical(t,e=0){if(this._destroyed)return!1;if(this._scanItems(),this._selfHealInvalidFocusIfNeeded(),this._scanItems(),this._rows.length===0||this._focusIndex<0)return!!this._tryGeometricVerticalMove(t,null);const i=this._currentItems[this._focusIndex];if(!(i!=null&&i.isConnected))return this._scanItems(),this._tryGeometricVerticalMove(t,i)?!0:(this._focusIndex>=0&&this._highlightItem(this._focusIndex),"edge");let s=this._rows.findIndex(d=>d.includes(i));if(s<0&&(this._scanItems(),s=this._rows.findIndex(d=>d.includes(i))),s<0)return!!this._tryGeometricVerticalMove(t,i);const o=i.getBoundingClientRect(),a=performance.now(),l=a-this._stickyColumnAt>Ze;(this._stickyColumnX===null||l)&&(this._stickyColumnX=o.left+o.width/2),this._stickyColumnAt=a;const u=this._stickyColumnX,g=!!i.closest("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer"),p=(d,v)=>{for(let E=d+v;E>=0&&E<this._rows.length;E+=v)if(!pt(this._rows[E]))return E;return-1},b=d=>{const v=this._rows[d];let E=null,n=1/0;for(const c of v){if(!c.isConnected)continue;const w=c.getBoundingClientRect(),f=Math.abs(w.left+w.width/2-u);f<n&&(n=f,E=c)}return E},x=d=>{const v=this._currentItems.indexOf(d);if(v<0)return!1;this._setFocus(v);const E=d.getBoundingClientRect(),n=window.innerHeight,c=window.innerWidth;return E.top>=0&&E.bottom<=n&&E.left>=0&&E.right<=c||d.scrollIntoView({behavior:"smooth",block:"center"}),this._trackScrollPosition(),this._lastVerticalCmdAt=a,this._lastVerticalDirection=t,!0},R=()=>e>=1?!1:(window.scrollBy({top:t*600,behavior:"smooth"}),setTimeout(()=>{this._destroyed||(this._scanItems(),this._moveFocusVertical(t,e+1))},700),!0);if(g){const d=p(s,t);if(d<0)return R()||this._tryGeometricVerticalMove(t,i)?!0:"edge";const v=b(d);return v?x(v)?!0:"edge":this._tryGeometricVerticalMove(t,i)?!0:"edge"}let C=s+t;if(C<0||C>=this._rows.length)return R()||this._tryGeometricVerticalMove(t,i)?!0:"edge";if(pt(this._rows[C]))if(this._lastVerticalDirection===t&&a-this._lastVerticalCmdAt<$e){for(;C>=0&&C<this._rows.length&&pt(this._rows[C]);)C+=t;if(C<0||C>=this._rows.length)return R()||this._tryGeometricVerticalMove(t,i)?!0:"edge"}else{const v=b(C);return v?x(v)?!0:"edge":this._tryGeometricVerticalMove(t,i)?!0:"edge"}const m=b(C);return m?x(m)?!0:"edge":this._tryGeometricVerticalMove(t,i)?!0:"edge"}_setFocus(t){var e;this._focusIndex=t,this._focusedElement=this._currentItems[t]??null,this._focusedHref=((e=this._focusedElement)==null?void 0:e.href)??null,this._highlightItem(t)}_highlightItem(t){if(this._destroyed)return;this._ensureFocusRing(),this._focusIndex=t;const e=this._currentItems[t];if(!e||!e.isConnected){this._focusRing&&(this._focusRing.style.display="none"),this._applyCardScale(null);return}const i=o=>{var a;(a=this._focusRing)!=null&&a.isConnected&&Object.assign(this._focusRing.style,{display:"block",top:`${o.top-4}px`,left:`${o.left-4}px`,width:`${o.width+8}px`,height:`${o.height+8}px`})};this._applyCardScale(e);const s=e.getBoundingClientRect();if(s.width===0||s.height===0){requestAnimationFrame(()=>{if(this._destroyed||!e.isConnected)return;const o=e.getBoundingClientRect();o.width>0&&o.height>0?(i(o),z(e)&&(this._lastFocusRect={left:o.left,top:o.top,right:o.right,bottom:o.bottom,width:o.width,height:o.height})):this._focusRing&&(this._focusRing.style.display="none")});return}i(s),e.isConnected&&z(e)&&(this._lastFocusRect={left:s.left,top:s.top,right:s.right,bottom:s.bottom,width:s.width,height:s.height})}_trackScrollPosition(){clearTimeout(this._scrollTrackTimer),this._focusRing&&(this._focusRing.style.transition="none");const t=Date.now(),e=()=>{this._destroyed||(this._focusIndex>=0&&this._highlightItem(this._focusIndex),Date.now()-t<ze?this._scrollTrackTimer=setTimeout(e,16):this._focusRing&&(this._focusRing.style.transition="top 0.15s ease-out, left 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out"))};e()}_selectCurrent(){if(this._focusIndex<0)return!1;const t=this._currentItems[this._focusIndex];if(!t)return!1;if(!t.isConnected||!z(t))return this._selfHealInvalidFocusIfNeeded(),!1;const e=t.getBoundingClientRect(),i=window.innerHeight,s=window.innerWidth;return e.bottom<0||e.top>i||e.right<0||e.left>s?(this._focusFirstVisible(),!1):(t.href?window.location.href=t.href:t.click(),!0)}_handleScroll(){this._destroyed||this._scrollRaf||(this._scrollRaf=requestAnimationFrame(()=>{this._scrollRaf=null,!this._destroyed&&this._focusIndex>=0&&(this._focusRing&&(this._focusRing.style.transition="none"),this._highlightItem(this._focusIndex))}))}};Pt(dt,"CARD_CONTAINER_SEL",["ytd-rich-item-renderer","yt-lockup-view-model","ytd-video-renderer","ytd-compact-video-renderer","ytd-grid-video-renderer","ytd-reel-item-renderer"].join(","));let gt=dt;function oi(r){const t=r.length;if(t===0)return[];const e=Math.floor(t*.15),i=Math.floor(t*.35),s=t-i;return e<s?r.slice(e,s):r.slice(e)}function ri(r){const t=r.length;if(t===0)return[];const e=Math.floor(t*.1),i=Math.floor(t*.2),s=t-i;return e>=s?[]:r.slice(e,s)}function Mt(r){if(r.length===0)return 0;const t=[...r].sort((i,s)=>i-s),e=Math.floor(t.length/2);return t.length%2?t[e]:(t[e-1]+t[e])/2}function ai(r){if(r.length<2)return 0;const t=r.reduce((i,s)=>i+s,0)/r.length,e=r.reduce((i,s)=>i+(s-t)**2,0)/(r.length-1);return Math.sqrt(e)}function li(r,t){const e=Array.isArray(r)?r.filter(m=>typeof m=="number"&&Number.isFinite(m)):[],i=Array.isArray(t)?t.filter(m=>typeof m=="number"&&Number.isFinite(m)):[],s=[...e].sort((m,d)=>m-d),o=[...i].sort((m,d)=>m-d),a=oi(s),l=ri(o);if(a.length===0||l.length===0)return{ok:!1,reason:"insufficient_range"};const u=Mt(a),g=Mt(l),p=u-g;if(p<.02)return{ok:!1,reason:"insufficient_range"};let b=.35;p>.25&&(console.warn("[Nodex] blink calibration: unusually large EAR range — using conservative threshold coefficient 0.5"),b=.5);let x=g+p*b;x>.3&&u<.35&&(x=g+p*.5),x=Math.min(x,u*.85);const R=Math.min(x+.03,u*.8),C=ai(a);return{ok:!0,earOpen:u,earClosed:g,range:p,threshold:x,exitThreshold:R,noiseFloor:C,samplesOpen:e.length,samplesClosed:i.length,calibratedAt:Date.now(),signalType:"ear"}}const H="#5bffd8",U=window.matchMedia("(prefers-reduced-motion: reduce)").matches,W={face:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M19 3l2 2-2 2"/><path d="M5 3L3 5l2 2"/></svg>',cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',arL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18 9 12l6-6"/></svg>',arR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>',arU:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>',chk:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>'},G=U?"120ms":"300ms",Ot=U?"120ms":"400ms",ht="cubic-bezier(0.34, 1.56, 0.64, 1)",D="cubic-bezier(0.2, 0, 0, 1)",ci=`
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Backdrop ── */
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.68);
    backdrop-filter: blur(8px) saturate(0.7);
    -webkit-backdrop-filter: blur(8px) saturate(0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    opacity: 0;
    transition: opacity ${U?"120ms":"250ms"} ${D};
  }
  .backdrop.visible { opacity: 1; }

  /* ── Card ── */
  .card {
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    overflow-x: hidden;
    background: rgba(12,12,12,0.94);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03),
      0 4px 16px rgba(0,0,0,0.3),
      0 16px 48px rgba(0,0,0,0.45),
      0 40px 96px rgba(0,0,0,0.55);
    padding: 40px 40px 36px;
    opacity: 0;
    transform: ${U?"none":"translateY(20px) scale(0.97)"};
    transition:
      opacity ${Ot} ${ht},
      transform ${Ot} ${ht};
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .card::-webkit-scrollbar { display: none; }
  .card.visible { opacity: 1; transform: none; }

  /* ── Step header (back button + dots) ── */
  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.3);
    font-family: inherit;
    font-size: 13px;
    padding: 6px 2px;
    border-radius: 8px;
    transition: color 120ms ${D};
    outline: none;
    visibility: hidden; /* hidden on step 0; shown programmatically */
  }
  .btn-back.visible { visibility: visible; }
  .btn-back:hover  { color: rgba(255,255,255,0.65); }
  .btn-back:focus-visible { outline: 2px solid ${H}; outline-offset: 2px; }
  .btn-back svg { width: 16px; height: 16px; }

  .dots {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .dot {
    height: 5px;
    width: 5px;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
    transition: background ${G} ${D}, width ${G} ${D};
    flex-shrink: 0;
  }
  .dot.active { width: 22px; background: ${H}; }
  .dot.done   { background: rgba(91,255,216,0.35); }

  /* Spacer to keep dots centred even when back button is visible */
  .header-spacer { width: 54px; }

  /* ── Step content transition ── */
  .step-content {
    opacity: 1;
    transform: none;
    transition:
      opacity ${U?"80ms":"180ms"} ${D},
      transform ${U?"80ms":"180ms"} ${D};
  }
  .step-content.exit  { opacity: 0; transform: ${U?"none":"translateY(-10px)"}; }
  .step-content.enter { opacity: 0; transform: ${U?"none":"translateY(10px)"}; }

  /* ── Typography ── */
  .label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
    margin-bottom: 12px;
  }
  .title {
    font-size: 27px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: rgba(255,255,255,0.96);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .body {
    font-size: 15px;
    line-height: 1.65;
    color: rgba(255,255,255,0.55);
    margin-bottom: 28px;
  }

  /* ── Buttons ── */
  .btn {
    display: block;
    width: 100%;
    height: 50px;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: transform 120ms ${D}, background 120ms, opacity 120ms;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:focus-visible { outline: 2px solid ${H}; outline-offset: 3px; }
  .btn:disabled { opacity: 0.38; cursor: not-allowed; transform: none !important; }

  .btn-primary { background: ${H}; color: #0a0a0a; }
  .btn-primary:hover:not(:disabled) { background: #80ffe9; }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }

  .btn-ghost {
    background: transparent;
    color: rgba(255,255,255,0.3);
    height: 40px;
    margin-top: 6px;
    font-size: 13px;
  }
  .btn-ghost:hover { color: rgba(255,255,255,0.55); }

  /* ── Feature rows (step 1) ── */
  .logo-wrap {
    text-align: center;
    margin-bottom: 32px;
  }
  .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    border-radius: 18px;
    background: rgba(91,255,216,0.07);
    border: 1px solid rgba(91,255,216,0.18);
    margin-bottom: 16px;
    color: ${H};
  }
  .logo-icon svg { width: 28px; height: 28px; }
  .logo-name {
    display: block;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: rgba(255,255,255,0.97);
    line-height: 1;
  }
  .logo-sub {
    font-size: 14px;
    color: rgba(255,255,255,0.38);
    margin-top: 6px;
  }

  .features { display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px; }
  .feature {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 13px;
  }
  .feature-icon {
    width: 34px; height: 34px;
    border-radius: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.45);
    flex-shrink: 0;
  }
  .feature-icon svg { width: 16px; height: 16px; }
  .feature-h { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.88); margin-bottom: 3px; }
  .feature-p { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; }

  /* ── Camera visual (step 2) ── */
  .cam-visual {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }
  .cam-ring {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cam-pulse {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(91,255,216,0.28);
    animation: ${U?"none":"rpulse 2.4s ease-in-out infinite"};
  }
  .cam-pulse-2 {
    position: absolute;
    inset: -16px;
    border-radius: 50%;
    border: 1px solid rgba(91,255,216,0.10);
    animation: ${U?"none":"rpulse 2.4s ease-in-out infinite 0.5s"};
  }
  .cam-inner {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(91,255,216,0.07);
    border: 1.5px solid rgba(91,255,216,0.22);
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${H};
    transition: background ${G} ${D}, border-color ${G} ${D};
  }
  .cam-inner.ready { background: rgba(91,255,216,0.14); border-color: ${H}; }
  .cam-inner svg { width: 28px; height: 28px; }

  @keyframes rpulse {
    0%, 100% { transform: scale(1); opacity: 0.9; }
    50%       { transform: scale(1.15); opacity: 0.3; }
  }

  /* ── Status row ── */
  .status {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 22px;
    margin-bottom: 22px;
  }
  .sdot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(255,255,255,0.18);
    transition: background ${G} ${D};
  }
  .sdot.on  { background: ${H}; }
  .sdot.err { background: #ef4444; }
  .stext {
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    transition: color ${G} ${D};
  }
  .stext.on  { color: ${H}; }
  .stext.err { color: #ef4444; }

  /* ── No-face warning (step 3) ── */
  .no-face-warn {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: rgba(251,191,36,0.07);
    border: 1px solid rgba(251,191,36,0.22);
    border-radius: 11px;
    margin-bottom: 16px;
    font-size: 13px;
    color: rgba(251,191,36,0.9);
    line-height: 1.45;
  }
  .no-face-warn.show { display: flex; }
  .no-face-warn svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }

  /* ── Pose bars (step 3) ── */
  .bars { display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px; }
  .bar-row { display: flex; align-items: center; gap: 12px; }
  .bar-lbl {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.3);
    width: 32px;
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.07);
    border-radius: 3px;
    position: relative;
    overflow: hidden;
  }
  /* The fill is centered and expands outward; width driven by JS */
  .bar-fill {
    position: absolute;
    top: 0; bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    border-radius: 3px;
    background: rgba(255,255,255,0.22);
    transition: background 0.35s ${D};
  }
  .bar-fill.stable { background: ${H}; }
  .bar-val {
    width: 42px;
    font-size: 11px;
    font-family: "SF Mono", "Fira Code", ui-monospace, monospace;
    color: rgba(255,255,255,0.28);
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Countdown circle ── */
  .cd-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
  }
  .cd-svg { width: 60px; height: 60px; }
  .cd-bg { stroke: rgba(255,255,255,0.08); fill: none; stroke-width: 3; }
  .cd-arc {
    stroke: ${H};
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    transform-origin: center;
    transform: rotate(-90deg);
    transition: stroke-dashoffset 80ms linear;
  }
  .cd-num {
    font-size: 17px;
    font-weight: 700;
    fill: rgba(255,255,255,0.75);
    dominant-baseline: middle;
    text-anchor: middle;
  }

  /* ── Eye SVG (step 4) ── */
  .eye-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
    height: 76px;
  }
  .eye-svg { width: 180px; height: 76px; overflow: visible; }

  /* ── Tutorial gesture cards (step 5) ── */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 28px;
  }
  .gcard {
    padding: 20px 12px 16px;
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transition: background ${G} ${D}, border-color ${G} ${D};
  }
  .gcard.done {
    background: rgba(91,255,216,0.06);
    border-color: rgba(91,255,216,0.28);
  }
  .gcard-icon {
    width: 42px; height: 42px;
    border-radius: 13px;
    background: rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.42);
    transition: color ${G} ${D}, background ${G} ${D};
  }
  .gcard-icon svg { width: 20px; height: 20px; }
  .gcard.done .gcard-icon { color: ${H}; background: rgba(91,255,216,0.1); }
  .gcard-lbl {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.42);
    text-align: center;
    transition: color ${G} ${D};
    line-height: 1.35;
  }
  .gcard.done .gcard-lbl { color: rgba(255,255,255,0.82); }
  .gcheck {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: ${H};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
    opacity: 0;
    transform: scale(0.4);
    transition: opacity ${G} ${ht}, transform ${G} ${ht};
  }
  .gcard.done .gcheck { opacity: 1; transform: scale(1); }
  .gcheck svg { width: 12px; height: 12px; }

  /* ── Success icon ── */
  .success-wrap { display: flex; justify-content: center; margin-bottom: 22px; }
  .success-circle {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: rgba(91,255,216,0.1);
    border: 1.5px solid rgba(91,255,216,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${H};
    animation: ${U?"none":"pop 0.5s cubic-bezier(0.34,1.56,0.64,1)"};
  }
  .success-circle svg { width: 32px; height: 32px; }

  @keyframes pop {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  /* ── Error text ── */
  .err {
    display: none;
    font-size: 13px;
    color: #ef4444;
    margin-top: 14px;
    line-height: 1.5;
    padding: 10px 14px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
  }
`;class hi{constructor(t){this._p=t,this._host=null,this._shadow=null,this._card=null,this._content=null,this._step=0,this._dead=!1,this._camStarted=!1,this._camReady=!1,this._neutralEl=null,this._neutralYaws=[],this._neutralPitches=[],this._neutralStableMs=null,this._neutralDone=!1,this._capturedBaseline=null,this._blinkEl=null,this._blinkPhase="idle",this._openSamples=[],this._closedSamples=[],this._blinkTimer=null,this._earSmooth=.32,this._earTarget=.32,this._rafId=null,this._tutorialEl=null,this._done=new Set,this._lastMetricAt=0,this._noFaceTimerRef=null,this._onMetrics=this._handleMetrics.bind(this),this._onCommand=this._handleCommand.bind(this)}mount(){var i;if(this._host||this._dead)return;this._host=document.createElement("div"),this._shadow=this._host.attachShadow({mode:"open"});const t=document.createElement("style");t.textContent=ci,this._shadow.appendChild(t);const e=document.createElement("div");e.className="backdrop",e.setAttribute("role","dialog"),e.setAttribute("aria-modal","true"),e.setAttribute("aria-label","Nodex setup"),this._backdrop=e,this._shadow.appendChild(e),this._card=document.createElement("div"),this._card.className="card",e.appendChild(this._card),document.documentElement.appendChild(this._host),this._p._overlayMetricsListener=this._onMetrics,this._p._overlayCommandListener=this._onCommand,(i=this._p._gestureEngine)==null||i.updateSettings({blocked:!0}),requestAnimationFrame(()=>{e.classList.add("visible"),setTimeout(()=>{this._card.classList.add("visible"),this._goStep(0)},U?0:120)})}unmount(){var t;this._dead||(this._dead=!0,this._p._overlayMetricsListener=null,this._p._overlayCommandListener=null,this._rafId&&(cancelAnimationFrame(this._rafId),this._rafId=null),this._blinkTimer&&(clearTimeout(this._blinkTimer),this._blinkTimer=null),this._clearNoFaceTimer(),(t=this._p._gestureEngine)==null||t.updateSettings({blocked:!1}),this._p._tutorialMode&&(this._p._tutorialMode=!1),this._card&&(this._card.style.transition="opacity 380ms ease-out, transform 380ms ease-out",this._card.style.opacity="0",this._card.style.transform="scale(1.025) translateY(-6px)"),this._backdrop&&(this._backdrop.style.transition="opacity 380ms ease-out",this._backdrop.style.opacity="0"),setTimeout(()=>{var e;(e=this._host)==null||e.remove(),this._host=null},420))}_goStep(t){this._step=t;const e=document.createElement("div");e.className="step-content enter",this._buildHeader(e,t);const i=document.createElement("div");switch(e.appendChild(i),t){case 0:this._buildWelcome(i);break;case 1:this._buildCamera(i);break;case 2:this._buildNeutral(i);break;case 3:this._buildBlink(i);break;case 4:this._buildTutorial(i);break}const s=this._content;s?(s.classList.add("exit"),setTimeout(()=>{s.remove(),this._appendContent(e)},U?60:190)):this._appendContent(e)}_appendContent(t){this._card.appendChild(t),this._content=t,requestAnimationFrame(()=>{t.classList.remove("enter"),setTimeout(()=>{var e;return(e=t.querySelector("button:not(:disabled)"))==null?void 0:e.focus()},40)})}_next(){this._step<4&&this._goStep(this._step+1)}_goBack(){var t;this._step<=0||(this._step===2&&(this._neutralDone=!1,this._neutralYaws=[],this._neutralPitches=[],this._neutralStableMs=null,this._neutralEl=null,this._clearNoFaceTimer()),this._step===3&&(this._blinkTimer&&(clearTimeout(this._blinkTimer),this._blinkTimer=null),this._rafId&&(cancelAnimationFrame(this._rafId),this._rafId=null),(t=this._p._gestureEngine)==null||t.updateSettings({blocked:!1}),this._blinkPhase="idle",this._openSamples=[],this._closedSamples=[],this._blinkEl=null),this._step===4&&(this._p._tutorialMode=!1,this._tutorialEl=null,this._done=new Set),this._step===1&&this._camStarted&&(this._p.stop(),this._camStarted=!1,this._camReady=!1),this._goStep(this._step-1))}_buildHeader(t,e){const i=document.createElement("div");i.className="step-header";const s=document.createElement("button");s.className="btn-back"+(e>0&&e<5?" visible":""),s.setAttribute("aria-label","Go back"),s.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18 9 12l6-6"/></svg>',s.addEventListener("click",()=>this._goBack()),i.appendChild(s);const o=document.createElement("div");o.className="dots",o.setAttribute("aria-label",`Step ${e+1} of 5`);for(let l=0;l<5;l++){const u=document.createElement("div");u.className="dot"+(l===e?" active":l<e?" done":""),o.appendChild(u)}i.appendChild(o);const a=document.createElement("div");a.className="header-spacer",i.appendChild(a),t.appendChild(i)}_buildWelcome(t){t.innerHTML=`
      <div class="logo-wrap">
        <div class="logo-icon">${W.face}</div>
        <span class="logo-name">Nodex</span>
        <p class="logo-sub">Hands-free YouTube control</p>
      </div>
      <div class="features">
        <div class="feature">
          <div class="feature-icon">${W.face}</div>
          <div>
            <div class="feature-h">Head gestures</div>
            <div class="feature-p">Nod, turn, tilt — seek, volume, play/pause without touching anything</div>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">${W.lock}</div>
          <div>
            <div class="feature-h">100% on-device</div>
            <div class="feature-p">MediaPipe runs in your browser. No video ever leaves your machine.</div>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">${W.eye}</div>
          <div>
            <div class="feature-h">Calibrates to you</div>
            <div class="feature-p">A 2-minute setup adapts thresholds to your unique face and posture.</div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" id="ob-start">Get started →</button>
      <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin-top:12px;letter-spacing:0.02em;">Setup takes about 2 minutes</p>
    `,t.querySelector("#ob-start").addEventListener("click",()=>this._next())}_buildCamera(t){t.innerHTML=`
      <p class="label">Step 1 of 3 — Camera</p>
      <h2 class="title">Allow camera access</h2>
      <p class="body">Your video is processed locally by MediaPipe. Nothing is recorded or transmitted.</p>
      <div class="cam-visual">
        <div class="cam-ring">
          <div class="cam-pulse"></div>
          <div class="cam-pulse-2"></div>
          <div class="cam-inner" id="ob-cam-inner">${W.cam}</div>
        </div>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot" id="ob-sdot"></div>
        <span class="stext" id="ob-stext">Ready to connect</span>
      </div>
      <button class="btn btn-primary" id="ob-cam-btn">Enable camera</button>
    `;const e=t.querySelector("#ob-cam-btn"),i=t.querySelector("#ob-sdot"),s=t.querySelector("#ob-stext"),o=t.querySelector("#ob-cam-inner");let a=null;e.addEventListener("click",()=>{this._camStarted||(this._camStarted=!0,e.disabled=!0,i.className="sdot on",s.textContent="Starting camera…",s.className="stext on",this._p.start(),a=setTimeout(()=>{this._camReady||this._dead||(i.className="sdot err",s.textContent="Camera did not start — check browser permissions",s.className="stext err",e.disabled=!1,this._camStarted=!1)},1e4),this._camErrTimer=a,this._camInnerEl=o)})}_signalCameraReady(){var s,o;if(this._camReady||this._step!==1)return;this._camReady=!0,clearTimeout(this._camErrTimer);const t=this._camInnerEl,e=(s=this._content)==null?void 0:s.querySelector("#ob-sdot"),i=(o=this._content)==null?void 0:o.querySelector("#ob-stext");t&&t.classList.add("ready"),e&&(e.className="sdot on"),i&&(i.textContent="Camera connected",i.className="stext on"),setTimeout(()=>this._next(),1100)}_clearNoFaceTimer(){this._noFaceTimerRef&&(clearInterval(this._noFaceTimerRef),this._noFaceTimerRef=null)}_buildNeutral(t){this._neutralYaws=[],this._neutralPitches=[],this._neutralStableMs=null,this._neutralDone=!1,this._lastMetricAt=Date.now(),this._clearNoFaceTimer(),t.innerHTML=`
      <p class="label">Step 2 of 3 — Neutral Pose</p>
      <h2 class="title">Look straight ahead</h2>
      <p class="body">Hold your head the way you normally watch video. Stay still for 2 seconds to set your resting position.</p>
      <div class="no-face-warn" id="ob-noface" aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5"/>
        </svg>
        Face not visible — move closer or check lighting, then hold still
      </div>
      <div class="bars">
        <div class="bar-row">
          <span class="bar-lbl">Yaw</span>
          <div class="bar-track"><div class="bar-fill" id="ob-yf"></div></div>
          <span class="bar-val" id="ob-yv">—</span>
        </div>
        <div class="bar-row">
          <span class="bar-lbl">Pitch</span>
          <div class="bar-track"><div class="bar-fill" id="ob-pf"></div></div>
          <span class="bar-val" id="ob-pv">—</span>
        </div>
      </div>
      <div class="cd-wrap" id="ob-cd" style="display:none;">
        <svg class="cd-svg" viewBox="0 0 60 60">
          <circle class="cd-bg" cx="30" cy="30" r="24"/>
          <circle class="cd-arc" id="ob-arc" cx="30" cy="30" r="24"
            stroke-dasharray="${(2*Math.PI*24).toFixed(2)}"
            stroke-dashoffset="0"/>
          <text class="cd-num" x="30" y="30" id="ob-num">2</text>
        </svg>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot on"></div>
        <span class="stext on" id="ob-ns">Hold your head still…</span>
      </div>
    `,this._neutralEl=t,this._noFaceTimerRef=setInterval(()=>{if(this._dead||!this._neutralEl||this._neutralDone){this._clearNoFaceTimer();return}const e=this._neutralEl.querySelector("#ob-noface");if(!e)return;const i=Date.now()-this._lastMetricAt>1800;e.classList.toggle("show",i),i&&(this._neutralStableMs=null)},800)}_tickNeutral(t,e){const i=this._neutralEl;if(!i||this._neutralDone)return;this._neutralYaws.push(t),this._neutralPitches.push(e),this._neutralYaws.length>24&&(this._neutralYaws.shift(),this._neutralPitches.shift());const s=n=>n.length<2?99:Math.max(...n)-Math.min(...n),o=this._neutralYaws.length>=12&&s(this._neutralYaws)<3.5&&s(this._neutralPitches)<3.5,a=i.querySelector("#ob-yf"),l=i.querySelector("#ob-pf"),u=i.querySelector("#ob-yv"),g=i.querySelector("#ob-pv"),p=i.querySelector("#ob-ns"),b=i.querySelector("#ob-cd"),x=i.querySelector("#ob-arc"),R=i.querySelector("#ob-num");if(!a)return;const C=n=>{const c=[...n].sort((f,y)=>f-y),w=Math.floor(c.length/2);return c.length%2?c[w]:(c[w-1]+c[w])/2},m=this._neutralYaws.length?C(this._neutralYaws):0,d=this._neutralPitches.length?C(this._neutralPitches):0,v=Math.abs(t-m),E=Math.abs(e-d);if(a.style.width=Math.min(Math.max(v/4,.05)*100,100)+"%",l.style.width=Math.min(Math.max(E/4,.05)*100,100)+"%",a.classList.toggle("stable",o),l.classList.toggle("stable",o),u.textContent=(t>=0?"+":"")+t.toFixed(1)+"°",g.textContent=(e>=0?"+":"")+e.toFixed(1)+"°",o){this._neutralStableMs||(this._neutralStableMs=Date.now());const n=Date.now()-this._neutralStableMs,c=2*Math.PI*24,w=Math.min(n/2e3,1);if(b.style.display="flex",x.style.strokeDashoffset=String(c*(1-w)),R.textContent=w>=1?"✓":String(Math.max(0,Math.ceil((2e3-n)/1e3))),p&&(p.textContent="Hold still…",p.className="stext on"),n>=2e3&&!this._neutralDone){const f=C(this._neutralYaws),y=C(this._neutralPitches);this._neutralDone=!0,this._neutralEl=null,this._capturedBaseline={yaw:f,pitch:y},this._clearNoFaceTimer(),this._saveNeutralAndAdvance(f,y)}}else this._neutralStableMs=null,b.style.display="none",p&&(p.textContent="Hold your head still…",p.className="stext")}async _saveNeutralAndAdvance(t,e){var i;try{(i=this._p._gestureEngine)==null||i.setNeutralPose({yawBaseline:t,pitchBaseline:e,rollBaseline:0}),await rt({yaw:t,pitch:e,roll:0})}catch(s){console.error("[Nodex] overlay: neutral save failed",s)}this._next()}_buildBlink(t){var e;this._blinkPhase="open",this._openSamples=[],this._closedSamples=[],this._earSmooth=.32,this._earTarget=.32,this._blinkTimer&&(clearTimeout(this._blinkTimer),this._blinkTimer=null),t.innerHTML=`
      <p class="label">Step 3 of 3 — Eye Blink</p>
      <h2 class="title">Calibrate your blink</h2>
      <p class="body" id="ob-bb">Keep your eyes open naturally. We're sampling your baseline — 3 seconds.</p>
      <div class="eye-wrap">
        <svg class="eye-svg" viewBox="0 0 180 76">
          <defs>
            <clipPath id="ob-eye-clip">
              <path d="M8,38 Q90,2 172,38 Q90,74 8,38 Z"/>
            </clipPath>
          </defs>
          <!-- eye white -->
          <path d="M8,38 Q90,2 172,38 Q90,74 8,38 Z"
            fill="rgba(255,255,255,0.035)"
            stroke="rgba(255,255,255,0.14)"
            stroke-width="1.5"/>
          <!-- iris ring -->
          <circle cx="90" cy="38" r="20"
            fill="rgba(91,255,216,0.12)"
            stroke="rgba(91,255,216,0.45)"
            stroke-width="1.5"/>
          <!-- pupil -->
          <circle cx="90" cy="38" r="9"
            fill="rgba(91,255,216,0.65)"/>
          <!-- upper eyelid — closes down from top -->
          <rect id="ob-lid-t" x="0" y="0" width="180" height="40"
            fill="rgba(12,12,12,0.98)"
            clip-path="url(#ob-eye-clip)"
            style="transform-origin: 90px 0px; transform: scaleY(0);"/>
          <!-- lower eyelid — closes up from bottom -->
          <rect id="ob-lid-b" x="0" y="36" width="180" height="40"
            fill="rgba(12,12,12,0.98)"
            clip-path="url(#ob-eye-clip)"
            style="transform-origin: 90px 76px; transform: scaleY(0);"/>
        </svg>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot on" id="ob-bsdot"></div>
        <span class="stext on" id="ob-bst">Sampling open eyes… 3s</span>
      </div>
      <button class="btn btn-primary" id="ob-blink-btn" style="display:none;">Close my eyes now</button>
      <div class="err" id="ob-berr"></div>
    `,this._blinkEl=t,(e=this._p._gestureEngine)==null||e.updateSettings({blocked:!0}),this._startEyeAnim(),this._blinkTimer=setTimeout(()=>{var l;this._blinkTimer=null,this._blinkPhase="await_close",(l=this._p._gestureEngine)==null||l.updateSettings({blocked:!1});const i=t.querySelector("#ob-bb"),s=t.querySelector("#ob-bst"),o=t.querySelector("#ob-bsdot"),a=t.querySelector("#ob-blink-btn");i&&(i.textContent=`Open-eye baseline captured (${this._openSamples.length} frames). Now gently close your eyes when ready.`),s&&(s.textContent="Ready for closed-eye phase",s.className="stext"),o&&(o.className="sdot"),a&&(a.style.display="block"),a==null||a.addEventListener("click",()=>this._startClosedPhase(t))},3100)}_startEyeAnim(){this._rafId&&cancelAnimationFrame(this._rafId);const t=()=>{if(this._dead||!this._blinkEl)return;this._earSmooth+=(this._earTarget-this._earSmooth)*.28;const e=.3,i=.09,s=1-Math.max(0,Math.min(1,(this._earSmooth-i)/(e-i))),o=this._blinkEl.querySelector("#ob-lid-t"),a=this._blinkEl.querySelector("#ob-lid-b");o&&(o.style.transform=`scaleY(${s.toFixed(3)})`),a&&(a.style.transform=`scaleY(${s.toFixed(3)})`),this._rafId=requestAnimationFrame(t)};this._rafId=requestAnimationFrame(t)}_startClosedPhase(t){var a;if(this._blinkPhase!=="await_close")return;this._blinkPhase="closed",this._closedSamples=[];const e=t.querySelector("#ob-blink-btn"),i=t.querySelector("#ob-bst"),s=t.querySelector("#ob-bsdot"),o=t.querySelector("#ob-berr");e&&(e.style.display="none"),o&&(o.style.display="none"),s&&(s.className="sdot on"),i&&(i.textContent="Listening for countdown…",i.className="stext on"),(a=this._p._gestureEngine)==null||a.updateSettings({blocked:!0}),this._speakCountdown(),this._blinkTimer=setTimeout(async()=>{var l;this._blinkTimer=null,(l=this._p._gestureEngine)==null||l.updateSettings({blocked:!1}),await this._finishBlink(t)},3200)}_speakCountdown(){const t=(e,i)=>setTimeout(()=>{try{const s=new SpeechSynthesisUtterance(e);s.lang="en-US",s.rate=1,window.speechSynthesis.speak(s)}catch{}},i);t("Close your eyes.",0),t("Three",700),t("Two",1400),t("One",2100),t("Open",2800)}async _finishBlink(t){var i;const e=li(this._openSamples,this._closedSamples);if(!e.ok){const s=t.querySelector("#ob-berr"),o=t.querySelector("#ob-blink-btn"),a=t.querySelector("#ob-bst"),l=t.querySelector("#ob-bsdot");s&&(s.style.display="block",s.textContent=e.reason==="insufficient_range"?"Not enough contrast between open and closed — try a more deliberate close, then retry.":"Calibration failed. Retry."),a&&(a.textContent="Retry",a.className="stext"),l&&(l.className="sdot"),o&&(o.textContent="Try again",o.style.display="block"),this._blinkPhase="await_close",this._closedSamples=[],o==null||o.removeEventListener("click",this._closedBtnHandler),this._closedBtnHandler=()=>this._startClosedPhase(t),o==null||o.addEventListener("click",this._closedBtnHandler);return}this._blinkPhase="done",(i=this._p._gestureEngine)==null||i.setBlinkCalibration(e);try{await chrome.storage.local.set({earCalibration:e,calibrationCompleted:!0,calibrationCompletedAt:Date.now()})}catch(s){console.error("[Nodex] overlay: blink calibration save failed",s)}this._rafId&&(cancelAnimationFrame(this._rafId),this._rafId=null),this._blinkEl=null,this._next()}_buildTutorial(t){var s,o,a;this._done=new Set,this._tutorialEl=t,(s=this._p._gestureEngine)==null||s.updateSettings({blocked:!1}),this._p._tutorialMode=!0,this._p._tutorialModeDeadline=Date.now()+300*1e3;const i=[{g:_.HEAD_LEFT,icon:W.arL,label:"Head Left"},{g:_.HEAD_RIGHT,icon:W.arR,label:"Head Right"},{g:_.HEAD_UP,icon:W.arU,label:"Head Up"},{g:_.EYES_CLOSED,icon:W.eye,label:"Blink"}].map(({g:l,icon:u,label:g})=>`
      <div class="gcard" id="gc-${l}" tabindex="-1" aria-label="${g}">
        <div class="gcard-icon">${u}</div>
        <span class="gcard-lbl">${g}</span>
        <div class="gcheck">${W.chk}</div>
      </div>
    `).join("");t.innerHTML=`
      <h2 class="title">Try it out</h2>
      <p class="body">Do each gesture — Nodex will confirm it detected them.</p>
      <div class="grid">${i}</div>
      <button class="btn btn-primary" id="ob-finish" style="display:none;">You're all set →</button>
      <button class="btn btn-ghost"   id="ob-skip">Skip tutorial</button>
    `,(o=t.querySelector("#ob-finish"))==null||o.addEventListener("click",()=>this._finish()),(a=t.querySelector("#ob-skip"))==null||a.addEventListener("click",()=>this._finish())}_markGesture(t){var i,s,o,a;const e=[_.HEAD_LEFT,_.HEAD_RIGHT,_.HEAD_UP,_.EYES_CLOSED];if(!(!e.includes(t)||this._done.has(t))&&(this._done.add(t),(s=(i=this._tutorialEl)==null?void 0:i.querySelector(`#gc-${t}`))==null||s.classList.add("done"),this._done.size===e.length)){const l=(o=this._tutorialEl)==null?void 0:o.querySelector("#ob-finish"),u=(a=this._tutorialEl)==null?void 0:a.querySelector("#ob-skip");l&&(l.style.display="block"),u&&(u.style.display="none"),l==null||l.focus()}}async _finish(){this._p._tutorialMode=!1;try{await chrome.storage.local.set({onboarding_complete:!0})}catch(t){console.error("[Nodex] overlay: finish save failed",t)}if(this._content){const t=this._content;t.classList.add("exit"),setTimeout(()=>{t.innerHTML=`
          <div style="padding:8px 0;text-align:center;">
            <div class="success-wrap">
              <div class="success-circle">${W.chk}</div>
            </div>
            <h2 class="title" style="text-align:center;margin-bottom:8px;">All set!</h2>
            <p class="body"  style="text-align:center;margin-bottom:0;">Nodex is active. Nod to control YouTube.</p>
          </div>
        `,t.classList.remove("exit")},U?60:180)}setTimeout(()=>this.unmount(),2200)}_handleMetrics(t){if(!this._dead){if(this._step===1&&this._camStarted&&!this._camReady&&this._signalCameraReady(),this._step===2){this._lastMetricAt=Date.now();const e=typeof t.yaw=="number"?t.yaw:0,i=typeof t.pitch=="number"?t.pitch:0;this._tickNeutral(e,i)}if(this._step===3){const e=t.ear;typeof e=="number"&&Number.isFinite(e)&&(this._earTarget=e,this._blinkPhase==="open"?this._openSamples.push(e):this._blinkPhase==="closed"&&this._closedSamples.push(e))}}}_handleCommand({gesture:t}){this._dead||this._step!==4||this._markGesture(t)}}if(!window.__nodexLoaded){let r=function(E){if(!Array.isArray(E)||E.length!==468&&E.length!==478)return!1;for(let n=0;n<E.length;n++){const c=E[n];if(!c||typeof c.x!="number"||typeof c.y!="number"||typeof c.z!="number")return!1}return!0},t=function(E){if(E.length===0)return 0;const n=[...E].sort((w,f)=>w-f),c=Math.floor(n.length/2);return n.length%2?n[c]:(n[c-1]+n[c])/2},C=function(){if(window.__nodexPersistent!=null)return window.__nodexPersistent;const E=new R;b=E;const n=E.init();return n.catch(c=>{console.error("[Nodex] persistent init failed:",c)}),window.__nodexPersistent={get gestureEngine(){return E._gestureEngine},bridge:null,get watchdog(){return{running:E._watchdogTimer!=null}},destroy(){E.destroyPersistent()},_initPromise:n},window.__nodexPersistent},d=function(){setTimeout(()=>{m()},100)};window.__nodexLoaded=!0;const e=5,i=3e3,s=5e3,o=3,a=2e3,l=20,u=2e3,g=50,p="https://www.youtube.com";let b=null;class x{constructor(n){this._persistent=n,this._destroyed=!1,this._ac=new AbortController,this._hud=null,this._ytController=new We,this._browseController=new gt,this._browseMode=!1,this._manualModeOverride=!1,this._frameCount=0,this._lastPath=location.pathname,this._lastHref=location.href,this._urlHistory=[],this._navPollTimer=null,this._autoModeTimer=null,this._onVisibilityChange=this._handleVisibilityChange.bind(this)}async init(){this._hud=new zt,this._hud.mount(),window.__nodexBrowseController=this._browseController,document.addEventListener("visibilitychange",this._onVisibilityChange,{signal:this._ac.signal}),this._observeNavigation(),this._manualModeOverride||this._autoSetMode(),this._persistent._pendingAutoStart&&(this._persistent._pendingAutoStart=!1,await this._persistent.start()),this._persistent._ensureGesturePipelineReady(),this._persistent._sendStatus()}destroy(){var n,c;this._destroyed||(this._destroyed=!0,this._persistent._page===this&&this._persistent.detachPage(this),this._setMode(!1),clearInterval(this._navPollTimer),this._navPollTimer=null,clearTimeout(this._autoModeTimer),this._autoModeTimer=null,window.__nodexBrowseController===this._browseController&&(window.__nodexBrowseController=null),(n=this._browseController)==null||n.destroy(),(c=this._hud)==null||c.unmount(),this._hud=null,this._ac.abort())}handleCommand(n,c,w){var k,S,N,O,M;const f=this._persistent;if(f._tutorialMode&&Date.now()>f._tutorialModeDeadline&&(f._tutorialMode=!1),document.visibilityState==="hidden"||(f._tutorialMode&&c===_.EYES_CLOSED&&(f._sendToSidePanel({type:T.BLINK_DETECTED,tutorial:!0}),(k=f._overlayCommandListener)==null||k.call(f,{gesture:_.EYES_CLOSED})),n===h.NONE))return;if(f._tutorialMode){f._sendToSidePanel({type:T.COMMAND_EXECUTED,command:n,gesture:c,applied:!1,metrics:w,browseMode:this._browseMode,tutorial:!0}),(S=f._overlayCommandListener)==null||S.call(f,{gesture:c});return}let y=!1;if(n===h.BACK)this._safeGoBack(),y=!0;else if(n===h.PREV)y=!!this._ytController.execute(n);else if(n===h.TOGGLE_MODE)this._manualModeOverride=!0,this._setMode(!this._browseMode),(N=this._hud)==null||N.showCommand(this._browseMode?"BROWSE_ON":"BROWSE_OFF"),y=!0;else{const B=(this._browseMode?this._browseController:this._ytController).execute(n);B==="edge"?((O=this._hud)==null||O.showCommand(n,this._browseMode),y=!1):y=!!B}y&&((M=this._hud)==null||M.showCommand(n,this._browseMode)),f._sendToSidePanel({type:T.COMMAND_EXECUTED,command:n,gesture:c,applied:y||!1,metrics:w,browseMode:this._browseMode})}handleMetrics(n){var c;this._frameCount++,(c=this._hud)==null||c.updateMetrics(n),this._frameCount%e===0&&this._persistent._sendToSidePanel({type:T.METRICS_UPDATE,metrics:n})}_setMode(n){var w,f,y;if(n===this._browseMode)return;this._browseMode=n;const c=n?this._persistent._browseGestureMap:this._persistent._playerGestureMap;if((w=this._persistent._gestureEngine)==null||w.updateSettings({gestureMap:c}),n){const k=this._browseController.activate();k===0&&((f=this._hud)==null||f.showCommand("NO_VIDEOS"));const S=k>0;(async()=>{var N;try{(await chrome.storage.local.get("nodex_browse_hint_shown")).nodex_browse_hint_shown||(S&&((N=this._hud)==null||N.showBrowseHint()),chrome.storage.local.set({nodex_browse_hint_shown:!0}))}catch(O){console.error("[Nodex] browse hint storage check failed",O)}})()}else this._browseController.deactivate();(y=this._hud)==null||y.setModeIndicator(n),this._persistent._sendToSidePanel({type:T.BROWSE_MODE_CHANGED,browseMode:n})}_handleVisibilityChange(){this._destroyed||document.visibilityState!=="visible"||this._browseMode&&this._browseController.refreshIfActive()}_observeNavigation(){const n=()=>{const c=location.pathname;this._lastPath!==c&&(this._urlHistory.push(this._lastHref),this._urlHistory.length>g&&this._urlHistory.splice(0,this._urlHistory.length-g),this._lastPath=c,this._lastHref=location.href,this._persistent._running&&(this._manualModeOverride=!1,clearTimeout(this._autoModeTimer),this._autoModeTimer=setTimeout(()=>this._autoSetMode(),800)))};try{typeof navigation<"u"&&navigation.addEventListener("navigatesuccess",n,{signal:this._ac.signal})}catch{}this._navPollTimer=setInterval(n,1e3)}_autoSetMode(){if(this._manualModeOverride)return;const n=location.pathname,c=/^\/(watch|shorts\/|live\/|clip\/|embed\/)/.test(n);this._setMode(!c)}_safeGoBack(){if(this._urlHistory.length>0){const n=this._urlHistory.pop();window.location.href=n}else window.location.href=p+"/"}}class R{constructor(){this._ac=new AbortController,this._page=null,this._gestureEngine=null,this._running=!1,this._destroyed=!1,this._calibrating=!1,this._inlineCalibrationTimer=null,this._tutorialMode=!1,this._tutorialModeDeadline=0,this._pendingAutoStart=!1,this._playerGestureMap=null,this._browseGestureMap=null,this._onMessage=this._handleMessage.bind(this),this._onWindowMessage=this._handleWindowMessage.bind(this),this._onBridgeRecoveryMessage=this._handleBridgeRecoveryMessage.bind(this),this._bridgeRecovering=!1,this._lastLandmarkTime=0,this._watchdogTimer=null,this._restartAttempts=0,this._contextValid=!0,this._lastFrameProcessedAt=0,this._autoPauseEnabled=!1,this._noFaceStartedAt=null,this._autoPausedByUs=!1,this._noFaceTimeoutMs=2e3}attachPage(n){this._page&&this._page!==n&&this._page.destroy(),this._page=n}detachPage(n){this._page===n&&(this._page=null)}async init(){const[n,c,w,f]=await Promise.all([mt(),Ht({thresholds:ut,cooldowns:_t,engine_active:!1}),Ut(bt),Yt(Bt)]);this._destroyed||(this._playerGestureMap=w,this._browseGestureMap=f,this._pendingAutoStart=!!c.engine_active,this._autoPauseEnabled=!!c.auto_pause_on_no_face,window.__nodexGestureEngine&&window.__nodexGestureEngine.destroy(),this._gestureEngine=new He({thresholds:{...ut,...c.thresholds},cooldowns:c.cooldowns??_t,gestureMap:this._playerGestureMap,baseline:n,onCommand:(y,k,S)=>{var N;(N=this._page)==null||N.handleCommand(y,k,S)},onMetrics:y=>{var k,S;(k=this._page)==null||k.handleMetrics(y),(S=this._overlayMetricsListener)==null||S.call(this,y)},onPanelNotify:y=>{this._sendToSidePanel(y)}}),window.__nodexGestureEngine=this._gestureEngine,this._ensureGesturePipelineReady(),await this._gestureEngine.loadEarCalibrationFromStorage(),window.addEventListener("message",this._onWindowMessage,{signal:this._ac.signal}),window.addEventListener("message",this._onBridgeRecoveryMessage,{signal:this._ac.signal}),chrome.runtime.onMessage.addListener(this._onMessage),window.addEventListener("beforeunload",()=>{this.destroyPersistent()},{signal:this._ac.signal}),!this._destroyed&&(window.__nodexContentScript=this))}_ensureGesturePipelineReady(){var n;(n=this._gestureEngine)==null||n.updateSettings({blocked:!1})}_handleBridgeRecoveryMessage(n){var c,w;n.source===window&&(((c=n.data)==null?void 0:c.type)===Y.RECOVERING&&(this._bridgeRecovering=!0),((w=n.data)==null?void 0:w.type)===Y.RECOVERED&&(this._bridgeRecovering=!1))}async start(){var n,c,w;if(!this._destroyed){if(this._running){this._ensureGesturePipelineReady(),this._sendStatus(),(n=this._page)!=null&&n._browseMode&&this._page._browseController.refreshIfActive();return}this._running=!0,window.postMessage({type:"NODEX_START_CAMERA",extensionBaseUrl:chrome.runtime.getURL("")},"*"),(w=(c=this._page)==null?void 0:c._hud)==null||w.show(),this._startWatchdog(),this._page&&!this._page._manualModeOverride&&this._page._autoSetMode(),this._ensureGesturePipelineReady(),await Q({engine_active:!0}).catch(()=>{}),this._sendStatus()}}async stop(){var n,c,w,f;if(!this._destroyed){if(!this._running){this._sendStatus();return}(n=this._gestureEngine)==null||n.stopCalibrationWizard(),this._calibrating=!1,clearTimeout(this._inlineCalibrationTimer),this._inlineCalibrationTimer=null,this._stopWatchdog(),this._running=!1,(c=this._page)==null||c._setMode(!1),window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),(f=(w=this._page)==null?void 0:w._hud)==null||f.hide(),await Q({engine_active:!1}).catch(()=>{}),this._sendStatus()}}async destroyPersistent(){var n,c;if(!this._destroyed){if(this._stopWatchdog(),this._destroyed=!0,window.__nodexContentScript===this&&(window.__nodexContentScript=void 0),window.__nodexOrchestrator){try{window.__nodexOrchestrator.destroy()}catch{}window.__nodexOrchestrator=null}window.__nodexPersistent&&(window.__nodexPersistent=null),b=null,(n=this._page)==null||n.destroy(),this._page=null,clearTimeout(this._inlineCalibrationTimer),this._inlineCalibrationTimer=null,window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),chrome.runtime.onMessage.removeListener(this._onMessage),window.__nodexGestureEngine===this._gestureEngine&&(window.__nodexGestureEngine=void 0),(c=this._gestureEngine)==null||c.destroy(),this._ac.abort(),this._gestureEngine=null}}_handleWindowMessage(n){var c,w,f,y,k,S,N,O,M,P,B,I,Z,et,it,st,L,V,Dt;if(n.source===window){if(((c=n.data)==null?void 0:c.type)==="NODEX_LANDMARKS"){if(!this._running||this._destroyed||!r(n.data.data))return;if(this._lastLandmarkTime=Date.now(),this._restartAttempts=0,this._noFaceStartedAt!==null&&(this._noFaceStartedAt=null,this._autoPausedByUs)){this._autoPausedByUs=!1;const K=document.querySelector("video");K!=null&&K.paused&&((f=(w=this._page)==null?void 0:w._ytController)==null||f.execute(h.PLAY_PAUSE),(k=(y=this._page)==null?void 0:y._hud)==null||k.showCommand(h.PLAY))}const F=performance.now();if(F-this._lastFrameProcessedAt<l)return;this._lastFrameProcessedAt=F,(S=this._gestureEngine)==null||S.processFrame(n.data.data)}if(((N=n.data)==null?void 0:N.type)===Y.NO_FACE){if(!this._running||!this._autoPauseEnabled||this._autoPausedByUs)return;const F=Date.now();if(this._noFaceStartedAt===null){this._noFaceStartedAt=F;return}if(F-this._noFaceStartedAt>=this._noFaceTimeoutMs){const K=document.querySelector("video");K&&!K.paused&&(this._autoPausedByUs=!0,(M=(O=this._page)==null?void 0:O._ytController)==null||M.execute(h.PLAY_PAUSE),(B=(P=this._page)==null?void 0:P._hud)==null||B.showWarning("Auto-paused — no face detected"))}}if(((I=n.data)==null?void 0:I.type)==="NODEX_CAMERA_DENIED"){this._running=!1,this._stopWatchdog(),console.warn("[Nodex] Camera access denied"),(et=(Z=this._page)==null?void 0:Z._hud)==null||et.showWarning("Camera access denied. Click the camera icon in the address bar to enable."),Q({engine_active:!1}).catch(()=>{}),this._sendStatus();return}if(((it=n.data)==null?void 0:it.type)==="NODEX_BRIDGE_ERROR"&&(console.error("[Nodex] Bridge error:",n.data.error),this._running=!1,this._stopWatchdog(),(L=(st=this._page)==null?void 0:st._hud)==null||L.showWarning(n.data.error??"Unknown error"),Q({engine_active:!1}).catch(()=>{}),this._sendStatus()),((V=n.data)==null?void 0:V.type)==="NODEX_INJECT_MEDIAPIPE")try{chrome.runtime.sendMessage({type:"INJECT_MEDIAPIPE"},F=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:(F==null?void 0:F.ok)??!1,error:(F==null?void 0:F.error)??null},"*")})}catch(F){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:F.message},"*")}if(((Dt=n.data)==null?void 0:Dt.type)==="NODEX_INJECT_SCRIPT"){const{path:F,requestId:K}=n.data;try{chrome.runtime.sendMessage({type:"INJECT_SCRIPT",path:F,requestId:K},j=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:K,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:(j==null?void 0:j.ok)??!1,requestId:K,error:(j==null?void 0:j.error)??null},"*")})}catch(j){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:K,error:j.message},"*")}}}}_handleMessage(n,c,w){var y,k,S,N,O,M,P,B,I,Z,et,it,st;const f=this._page;switch(n.type){case T.START_ENGINE:this.start();break;case T.STOP_ENGINE:this.stop();break;case T.SET_AUTO_PAUSE:{const L=!!n.enabled;if(this._autoPauseEnabled=L,!L&&(this._noFaceStartedAt=null,this._autoPausedByUs)){this._autoPausedByUs=!1;const V=document.querySelector("video");V!=null&&V.paused&&((k=(y=this._page)==null?void 0:y._ytController)==null||k.execute(h.PLAY_PAUSE))}Q({auto_pause_on_no_face:L}).catch(console.error);break}case T.CALIBRATION_START:(S=this._gestureEngine)==null||S.updateSettings({blocked:!0});break;case T.CALIBRATION_CANCEL:(N=this._gestureEngine)==null||N.updateSettings({blocked:!1});break;case T.TUTORIAL_START:this._tutorialMode=!0,this._tutorialModeDeadline=Date.now()+300*1e3;break;case T.TUTORIAL_END:this._tutorialMode=!1,f!=null&&f._browseMode&&f._browseController.refreshIfActive();break;case T.SAVE_CALIBRATION:n.baseline?rt(n.baseline).then(()=>{var L;(L=this._gestureEngine)==null||L.updateSettings({baseline:n.baseline,blocked:!1}),f!=null&&f._browseMode&&f._browseController.refreshIfActive()}).catch(L=>{var V;console.error(L),(V=this._gestureEngine)==null||V.updateSettings({blocked:!1})}):(O=this._gestureEngine)==null||O.updateSettings({blocked:!1});break;case T.UPDATE_SETTINGS:{const L=n.settings??{};Q(L).catch(console.error),L.playerGestureMap&&(this._playerGestureMap=L.playerGestureMap,Gt(L.playerGestureMap).catch(console.error)),L.browseGestureMap&&(this._browseGestureMap=L.browseGestureMap,Wt(L.browseGestureMap).catch(console.error));const V=f!=null&&f._browseMode?this._browseGestureMap:this._playerGestureMap;(M=this._gestureEngine)==null||M.updateSettings({...L,gestureMap:V});break}case T.REQUEST_STATUS:this._sendStatus();break;case T.TOGGLE_BROWSE_MODE:f&&(f._manualModeOverride=!0,f._setMode(!f._browseMode),(P=f._hud)==null||P.showCommand(f._browseMode?"BROWSE_ON":"BROWSE_OFF"));break;case T.WIZARD_START:(B=this._gestureEngine)==null||B.startCalibrationWizard(n.mode??"full");break;case T.WIZARD_ENTER_TEST:n.earCalibration&&((I=this._gestureEngine)==null||I.setBlinkCalibration(n.earCalibration)),(Z=this._gestureEngine)==null||Z.enterWizardTestPhase();break;case T.WIZARD_CANCEL:(et=this._gestureEngine)==null||et.stopCalibrationWizard();break;case T.CALIBRATION_COMPLETE:this._handleCalibrationComplete(n);break;case T.BLINK_THRESHOLD_ADJUST:typeof n.delta=="number"&&((it=this._gestureEngine)==null||it.adjustBlinkThreshold(n.delta));break;case T.BLINK_THRESHOLD_UPDATED:typeof n.threshold=="number"&&typeof n.exitThreshold=="number"&&((st=this._gestureEngine)==null||st.applyBlinkThresholdUpdate({threshold:n.threshold,exitThreshold:n.exitThreshold}));break}w==null||w({ok:!0})}_startInlineCalibration(){var N,O;if(this._calibrating)return;const n=this._gestureEngine;if(!n)return;this._calibrating=!0;const c=n._onMetrics,w=[],f=Date.now();let y=!1,k=!1;const S=()=>{k||(k=!0,this._inlineCalibrationTimer!=null&&(clearTimeout(this._inlineCalibrationTimer),this._inlineCalibrationTimer=null),n._onMetrics=c)};try{(O=(N=this._page)==null?void 0:N._hud)==null||O.showWarning("Calibrating… Look straight ahead (2 sec)"),n.updateSettings({blocked:!0}),n._onMetrics=M=>{try{w.push(M),c==null||c(M),!y&&Date.now()-f>=u&&w.length>0&&(y=!0,n._onMetrics=c,this._finishInlineCalibration(w).catch(P=>{console.error("[Nodex] inline calibration finish:",P),n.updateSettings({blocked:!1})}).finally(()=>{this._calibrating=!1,S()}))}catch(P){console.error("[Nodex] inline calibration metrics:",P),y||(y=!0,this._calibrating=!1,n.updateSettings({blocked:!1}),S())}},this._inlineCalibrationTimer=setTimeout(()=>{var M,P;try{if(!this._calibrating||y){S();return}n._onMetrics=c,w.length>0?(y=!0,this._finishInlineCalibration(w).catch(B=>{console.error("[Nodex] inline calibration finish:",B),n.updateSettings({blocked:!1})}).finally(()=>{this._calibrating=!1,S()})):(this._calibrating=!1,n.updateSettings({blocked:!1}),(P=(M=this._page)==null?void 0:M._hud)==null||P.showWarning("Calibration failed"),S())}catch(B){console.error("[Nodex] inline calibration timer:",B),this._calibrating=!1,n.updateSettings({blocked:!1}),S()}},u+2e3)}catch(M){console.error("[Nodex] inline calibration start:",M),this._calibrating=!1,n.updateSettings({blocked:!1}),S()}}async _finishInlineCalibration(n){var c,w,f,y,k;try{if(!this._calibrating)return;if(!(n!=null&&n.length)){(c=this._gestureEngine)==null||c.updateSettings({blocked:!1});return}const S=n.map(I=>I.ear).filter(I=>typeof I=="number"&&Number.isFinite(I)&&I>.015&&I<.55),N=S.length>0?t(S):n.reduce((I,Z)=>I+(Z.ear??0),0)/n.length,O=n.map(I=>I.yaw).filter(I=>typeof I=="number"&&Number.isFinite(I)),M=n.map(I=>I.pitch).filter(I=>typeof I=="number"&&Number.isFinite(I)),P=n.map(I=>I.roll).filter(I=>typeof I=="number"&&Number.isFinite(I)),B={yaw:O.length?t(O):0,pitch:M.length?t(M):0,roll:P.length?t(P):0,ear:N};try{await rt(B)}catch(I){console.error("[Nodex]",I)}finally{(w=this._gestureEngine)==null||w.updateSettings({baseline:B,blocked:!1})}(y=(f=this._page)==null?void 0:f._hud)==null||y.showCommand("CALIBRATED"),this._sendToSidePanel({type:T.SAVE_CALIBRATION,baseline:B})}catch(S){console.error("[Nodex] inline calibration processing:",S),(k=this._gestureEngine)==null||k.updateSettings({blocked:!1})}}_startWatchdog(){clearInterval(this._watchdogTimer),this._lastLandmarkTime=Date.now(),this._restartAttempts=0,this._watchdogTimer=setInterval(()=>{this._watchdogCheck()},i)}_stopWatchdog(){clearInterval(this._watchdogTimer),this._watchdogTimer=null}_requestBridgeHealth(){return new Promise(n=>{const c=crypto.randomUUID(),f=setTimeout(()=>{window.removeEventListener("message",y),n(null)},400),y=k=>{var S;k.source===window&&((S=k.data)==null?void 0:S.type)===Y.HEALTH_CHECK_RESULT&&k.data.requestId===c&&(clearTimeout(f),window.removeEventListener("message",y),n(k.data))};window.addEventListener("message",y),window.postMessage({type:Y.HEALTH_CHECK,requestId:c},"*")})}async _watchdogCheck(){var w,f,y,k,S,N;if(!this._running||this._destroyed)return;try{chrome.runtime.getURL("")}catch{this._handleContextInvalidated();return}const n=Date.now()-this._lastLandmarkTime;if(n<s||this._bridgeRecovering)return;if(this._restartAttempts++,this._restartAttempts>o){(f=(w=this._page)==null?void 0:w._hud)==null||f.showWarning("Camera lost. Reload the page."),this.stop(),this._sendToSidePanel({type:T.ENGINE_STATUS,running:!1,error:"bridge_dead"});return}const c=await this._requestBridgeHealth();if(c&&c.trackState!=="live"){console.warn("[Nodex] Watchdog: camera track not live; skipping blind bridge restart"),this._restartAttempts=0,(k=(y=this._page)==null?void 0:y._hud)==null||k.showWarning("Camera lost. Stop, then Start the engine."),this.stop();return}console.warn(`[Nodex] Watchdog: no landmarks for ${n}ms, restarting bridge (attempt ${this._restartAttempts}/${o})`),(N=(S=this._page)==null?void 0:S._hud)==null||N.showWarning("Reconnecting camera…"),window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),this._lastLandmarkTime=Date.now(),setTimeout(()=>{!this._running||this._destroyed||window.postMessage({type:"NODEX_START_CAMERA",extensionBaseUrl:chrome.runtime.getURL("")},"*")},a)}_handleContextInvalidated(){var n,c;this._contextValid=!1,(c=(n=this._page)==null?void 0:n._hud)==null||c.showWarning("Extension updated. Reload the page."),this._stopWatchdog()}_sendToSidePanel(n){if(this._contextValid)try{chrome.runtime.sendMessage({type:T.CONTENT_TO_SIDEPANEL,payload:n}).catch(()=>{})}catch{}}_sendStatus(){this._sendToSidePanel({type:T.ENGINE_STATUS,running:this._running})}async _handleCalibrationComplete(n){var w;const c=this._gestureEngine;if(!(!c||this._destroyed))try{if(typeof n.yawBaseline=="number"&&Number.isFinite(n.yawBaseline)&&typeof n.pitchBaseline=="number"&&Number.isFinite(n.pitchBaseline)){const y=await mt(),k=typeof n.rollBaseline=="number"&&Number.isFinite(n.rollBaseline)?n.rollBaseline:(y==null?void 0:y.roll)??0,S={...y&&typeof y=="object"?y:{},yaw:n.yawBaseline,pitch:n.pitchBaseline,roll:k,ear:typeof n.earFromPose=="number"&&Number.isFinite(n.earFromPose)?n.earFromPose:(y==null?void 0:y.ear)??((w=n.earCalibration)==null?void 0:w.earOpen)};c.setNeutralPose({yawBaseline:n.yawBaseline,pitchBaseline:n.pitchBaseline,rollBaseline:k}),await rt(S),c.updateSettings({baseline:S})}n.earCalibration&&typeof n.earCalibration=="object"&&(nt&&n.earCalibration.signalType==="iris"||!nt&&n.earCalibration.signalType==="ear")&&(await chrome.storage.local.set({earCalibration:n.earCalibration}),c.setBlinkCalibration(n.earCalibration)),await chrome.storage.local.set({calibrationCompleted:!0,calibrationCompletedAt:Date.now()})}catch(f){console.error("[Nodex] CALIBRATION_COMPLETE failed:",f)}finally{c.stopCalibrationWizard()}}}async function m(){const E=b;if(!E||E._destroyed){console.error("[Nodex] createPageScoped: persistent missing");return}if(window.__nodexOrchestrator){try{window.__nodexOrchestrator.destroy()}catch{}window.__nodexOrchestrator=null}const n=new x(E);E.attachPage(n),await n.init(),window.__nodexOrchestrator={browseController:n._browseController,youTubeController:n._ytController,hud:n._hud,destroy(){n.destroy()}}}document.addEventListener("yt-navigate-finish",d),C()._initPromise.then(async()=>{await m();try{const{onboarding_complete:E}=await chrome.storage.local.get("onboarding_complete");!E&&b&&!b._destroyed&&new hi(b).mount()}catch(E){console.error("[Nodex] onboarding overlay check failed:",E)}})}})();
