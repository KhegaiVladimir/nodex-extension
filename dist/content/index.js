(function(){"use strict";const f=Object.freeze({METRICS_UPDATE:"METRICS_UPDATE",GESTURE_FIRED:"GESTURE_FIRED",COMMAND_EXECUTED:"COMMAND_EXECUTED",ENGINE_STATUS:"ENGINE_STATUS",CALIBRATION_PROGRESS:"CALIBRATION_PROGRESS",START_ENGINE:"START_ENGINE",STOP_ENGINE:"STOP_ENGINE",SAVE_CALIBRATION:"SAVE_CALIBRATION",UPDATE_SETTINGS:"UPDATE_SETTINGS",REQUEST_STATUS:"REQUEST_STATUS",CONTENT_TO_SIDEPANEL:"CONTENT_TO_SIDEPANEL",SIDEPANEL_TO_CONTENT:"SIDEPANEL_TO_CONTENT"}),n=Object.freeze({HEAD_LEFT:"HEAD_LEFT",HEAD_RIGHT:"HEAD_RIGHT",HEAD_UP:"HEAD_UP",HEAD_DOWN:"HEAD_DOWN",EYES_CLOSED:"EYES_CLOSED",MOUTH_OPEN:"MOUTH_OPEN",TILT_LEFT:"TILT_LEFT",TILT_RIGHT:"TILT_RIGHT",NONE:"NONE"}),_=Object.freeze({PLAY:"PLAY",PAUSE:"PAUSE",PLAY_PAUSE:"PLAY_PAUSE",VOL_UP:"VOL_UP",VOL_DOWN:"VOL_DOWN",NEXT:"NEXT",PREV:"PREV",REWIND:"REWIND",MUTE:"MUTE",SKIP:"SKIP",NONE:"NONE"}),D={[n.HEAD_LEFT]:_.REWIND,[n.HEAD_RIGHT]:_.SKIP,[n.HEAD_UP]:_.VOL_UP,[n.HEAD_DOWN]:_.VOL_DOWN,[n.TILT_LEFT]:_.PREV,[n.TILT_RIGHT]:_.NEXT,[n.EYES_CLOSED]:_.PAUSE,[n.MOUTH_OPEN]:_.MUTE},O={[n.HEAD_UP]:300,[n.HEAD_DOWN]:300,[n.HEAD_LEFT]:600,[n.HEAD_RIGHT]:600,[n.TILT_LEFT]:800,[n.TILT_RIGHT]:800,[n.EYES_CLOSED]:1200,[n.MOUTH_OPEN]:600},I={yaw:18,pitch:12,roll:15,earClose:.18,mouthOpen:.55,hysteresis:4},U=350,A={CALIBRATION:"nodex_calibration",SETTINGS:"nodex_settings",GESTURE_MAP:"nodex_gesture_map"};async function g(e){return(await chrome.storage.local.get(e))[e]??null}async function L(e,t){await chrome.storage.local.set({[e]:t})}async function b(){return g(A.CALIBRATION)}async function v(e){if(e===null||typeof e!="object"||Array.isArray(e))throw new TypeError("calibration data must be a plain object");await L(A.CALIBRATION,e)}async function H(e={}){const t=await g(A.SETTINGS);return{...e,...t}}async function C(e){const s={...await g(A.SETTINGS),...e};return await L(A.SETTINGS,s),s}async function G(e={}){return await g(A.GESTURE_MAP)??e}const F=1500,k=Object.freeze({[_.PLAY]:"▶ Воспроизведение",[_.PAUSE]:"⏸ Пауза",[_.PLAY_PAUSE]:"⏯ Плей / Пауза",[_.VOL_UP]:"🔊 Громче",[_.VOL_DOWN]:"🔉 Тише",[_.MUTE]:"🔇 Без звука",[_.REWIND]:"⏪ Назад",[_.SKIP]:"⏩ Вперёд",[_.NEXT]:"⏭ Следующее",[_.PREV]:"⏮ Предыдущее"}),W=`
  :host {
    all: initial;
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 2147483647;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    color: #f5f3ee;
    pointer-events: none;
  }

  .nodex-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .nodex-video {
    width: 160px;
    height: 120px;
    border-radius: 8px;
    border: 2px solid #c8f55a;
    object-fit: cover;
    background: #000;
    transform: scaleX(-1);
  }

  .nodex-metrics {
    display: flex;
    gap: 8px;
    background: rgba(10, 10, 10, 0.85);
    padding: 6px 10px;
    border-radius: 6px;
    backdrop-filter: blur(6px);
  }

  .nodex-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 40px;
  }

  .nodex-metric-label {
    font-size: 9px;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 2px;
  }

  .nodex-metric-value {
    font-size: 13px;
    font-weight: bold;
    color: #c8f55a;
  }

  .nodex-toast {
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 10, 10, 0.9);
    color: #f5f3ee;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    border: 1px solid #c8f55a;
    backdrop-filter: blur(8px);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .nodex-toast.visible {
    opacity: 1;
  }

  .nodex-toast.warning {
    border: 1px solid #ef4444;
    background: rgba(40, 10, 10, 0.92);
    font-size: 13px;
  }

  .hidden {
    display: none !important;
  }
`;class Y{constructor(){this._host=null,this._shadow=null,this._videoEl=null,this._container=null,this._metrics=null,this._toast=null,this._toastTimer=null,this._stream=null}async mount(){this._host=document.createElement("div"),this._host.id="nodex-hud-host",this._shadow=this._host.attachShadow({mode:"closed"});const t=document.createElement("style");return t.textContent=W,this._shadow.appendChild(t),this._container=document.createElement("div"),this._container.className="nodex-container",this._videoEl=document.createElement("video"),this._videoEl.className="nodex-video",this._videoEl.setAttribute("playsinline",""),this._videoEl.setAttribute("autoplay",""),this._videoEl.muted=!0,this._metrics=this._buildMetrics(),this._toast=document.createElement("div"),this._toast.className="nodex-toast",this._container.appendChild(this._videoEl),this._container.appendChild(this._metrics),this._shadow.appendChild(this._container),this._shadow.appendChild(this._toast),document.body.appendChild(this._host),this._stream=await this._requestCamera(),this._videoEl.srcObject=this._stream,await this._videoEl.play(),this._videoEl}show(){this._container&&this._container.classList.remove("hidden")}hide(){this._container&&this._container.classList.add("hidden")}showCommand(t){if(!this._toast)return;this._toast.classList.remove("warning");const s=k[t]??t;this._toast.textContent=s,this._toast.classList.add("visible"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible")},F)}showWarning(t){this._toast&&(this._toast.textContent=t,this._toast.classList.add("visible","warning"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible","warning")},5e3))}updateMetrics(t){this._metrics&&(this._setMetric("yaw",t.yaw),this._setMetric("pitch",t.pitch),this._setMetric("ear",t.ear))}unmount(){var t;if(clearTimeout(this._toastTimer),this._stream){for(const s of this._stream.getTracks())s.stop();this._stream=null}this._videoEl&&(this._videoEl.srcObject=null,this._videoEl=null),(t=this._host)!=null&&t.parentNode&&this._host.parentNode.removeChild(this._host),this._host=null,this._shadow=null,this._container=null,this._metrics=null,this._toast=null}_buildMetrics(){const t=document.createElement("div");t.className="nodex-metrics";for(const s of["yaw","pitch","ear"]){const i=document.createElement("div");i.className="nodex-metric";const o=document.createElement("span");o.className="nodex-metric-label",o.textContent=s;const a=document.createElement("span");a.className="nodex-metric-value",a.dataset.metric=s,a.textContent="—",i.appendChild(o),i.appendChild(a),t.appendChild(i)}return t}_setMetric(t,s){var o;const i=(o=this._metrics)==null?void 0:o.querySelector(`[data-metric="${t}"]`);i&&(i.textContent=typeof s=="number"?s.toFixed(1):"—")}async _requestCamera(){try{return await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:640,height:480},audio:!1})}catch(t){throw t.name==="NotAllowedError"?new Error("Доступ к камере запрещён. Разрешите доступ в настройках браузера и перезагрузите страницу."):t.name==="NotFoundError"?new Error("Камера не найдена. Подключите камеру и перезагрузите страницу."):new Error(`Ошибка камеры: ${t.message}`)}}}class X{constructor(t){if(typeof t!="number"||t<0)throw new TypeError("intervalMs must be a non-negative number");this._interval=t,this._lastFired=0}canFire(){return Date.now()-this._lastFired>=this._interval}fire(){return this.canFire()?(this._lastFired=Date.now(),!0):!1}reset(){this._lastFired=0}setInterval(t){if(typeof t!="number"||t<0)throw new TypeError("ms must be a non-negative number");this._interval=t}}const M=1,P=234,R=454,K=10,V=152,z=159,B=145,j=133,J=33,q=386,$=374,Q=362,Z=263,tt=13,et=14,st=78,it=308,y=.001;function w(e,t){return Math.sqrt((e.x-t.x)**2+(e.y-t.y)**2+(e.z-t.z)**2)}function nt(e){if(!(e!=null&&e.length))return 0;const t=e[M],s=e[P],i=e[R];if(!t||!s||!i)return 0;const o=(s.x+i.x)/2,a=Math.abs(i.x-s.x)/2;return a<y?0:-((t.x-o)/a)*45}function ot(e){if(!(e!=null&&e.length))return 0;const t=e[M],s=e[K],i=e[V];if(!t||!s||!i)return 0;const o=(s.y+i.y)/2,a=Math.abs(i.y-s.y)/2;return a<y?0:(o-t.y)/a*40}function rt(e){if(!(e!=null&&e.length))return 0;const t=e[P],s=e[R];if(!t||!s)return 0;const i=s.x-t.x,o=s.y-t.y;return Math.abs(i)<y&&Math.abs(o)<y?0:-Math.atan2(o,i)*(180/Math.PI)}function at(e){if(!(e!=null&&e.length))return .3;const t=e[z],s=e[B],i=e[j],o=e[J],a=e[q],h=e[$],d=e[Q],S=e[Z];if(!t||!s||!i||!o||!a||!h||!d||!S)return .3;const r=w(i,o),c=w(d,S);return r<y||c<y?.3:(w(t,s)/r+w(a,h)/c)/2}function _t(e){if(!(e!=null&&e.length))return 0;const t=e[tt],s=e[et],i=e[st],o=e[it];if(!t||!s||!i||!o)return 0;const a=w(i,o);return a<y?0:w(t,s)/a}class ct{constructor({thresholds:t=I,cooldowns:s=O,gestureMap:i=D,baseline:o=null,onCommand:a=null,onMetrics:h=null}={}){this._thresholds={...t},this._gestureMap={...i},this._baseline=o,this._onCommand=a,this._onMetrics=h,this._active=n.NONE,this._eyeCloseStart=null,this._eyeCloseFired=!1,this._destroyed=!1,this._cooldowns={};for(const d of Object.values(n))d!==n.NONE&&(this._cooldowns[d]=new X(s[d]??600))}processFrame(t){var E;if(this._destroyed||!(t!=null&&t.length))return;const s=this._thresholds,i=s.hysteresis??4,o=this._baseline;let a=nt(t),h=ot(t),d=rt(t);const S=at(t),r=_t(t);o&&(a-=o.yaw??0,h-=o.pitch??0,d-=o.roll??0);const c={yaw:a,pitch:h,roll:d,ear:S,mouth:r};(E=this._onMetrics)==null||E.call(this,c);const l=(o==null?void 0:o.ear)>0?o.ear*.65:s.earClose;if(S<l?this._eyeCloseStart===null?(this._eyeCloseStart=Date.now(),this._eyeCloseFired=!1):this._eyeCloseFired||Date.now()-this._eyeCloseStart>=U&&(this._eyeCloseFired=!0,this._fire(n.EYES_CLOSED,c)):this._eyeCloseStart!==null&&(this._eyeCloseStart=null,this._eyeCloseFired=!1,this._active===n.EYES_CLOSED&&(this._active=n.NONE)),this._active!==n.NONE&&this._active!==n.EYES_CLOSED&&this._shouldDeactivate(this._active,a,h,d,r,s,i)&&(this._active=n.NONE),this._active===n.NONE){const N=this._detect(a,h,d,r,s);N!==n.NONE&&(this._active=N,this._fire(N,c))}(this._active===n.HEAD_UP||this._active===n.HEAD_DOWN)&&this._fire(this._active,c)}updateSettings({thresholds:t,gestureMap:s,baseline:i,cooldowns:o}={}){if(t&&(this._thresholds={...t}),s&&(this._gestureMap={...s}),i!==void 0&&(this._baseline=i),o)for(const[a,h]of Object.entries(o))this._cooldowns[a]&&this._cooldowns[a].setInterval(h)}destroy(){this._destroyed=!0,this._active=n.NONE,this._eyeCloseStart=null,this._eyeCloseFired=!1,this._onCommand=null,this._onMetrics=null;for(const t of Object.values(this._cooldowns))t.reset()}_fire(t,s){var a;if(this._destroyed)return;const i=this._cooldowns[t];if(!i||!i.fire())return;const o=this._gestureMap[t]??_.NONE;o!==_.NONE&&((a=this._onCommand)==null||a.call(this,o,t,s))}_detect(t,s,i,o,a){return t<-a.yaw?n.HEAD_LEFT:t>a.yaw?n.HEAD_RIGHT:s>a.pitch?n.HEAD_UP:s<-a.pitch?n.HEAD_DOWN:i<-a.roll?n.TILT_LEFT:i>a.roll?n.TILT_RIGHT:o>a.mouthOpen?n.MOUTH_OPEN:n.NONE}_shouldDeactivate(t,s,i,o,a,h,d){switch(t){case n.HEAD_LEFT:return s>=-(h.yaw-d);case n.HEAD_RIGHT:return s<=h.yaw-d;case n.HEAD_UP:return i<=h.pitch-d;case n.HEAD_DOWN:return i>=-(h.pitch-d);case n.TILT_LEFT:return o>=-(h.roll-d);case n.TILT_RIGHT:return o<=h.roll-d;case n.MOUTH_OPEN:return a<=h.mouthOpen*.8;default:return!0}}}const ht={[_.PLAY]:{key:"k",code:"KeyK",keyCode:75},[_.PAUSE]:{key:"k",code:"KeyK",keyCode:75},[_.PLAY_PAUSE]:{key:"k",code:"KeyK",keyCode:75},[_.VOL_UP]:{key:"ArrowUp",code:"ArrowUp",keyCode:38},[_.VOL_DOWN]:{key:"ArrowDown",code:"ArrowDown",keyCode:40},[_.MUTE]:{key:"m",code:"KeyM",keyCode:77},[_.REWIND]:{key:"j",code:"KeyJ",keyCode:74},[_.SKIP]:{key:"l",code:"KeyL",keyCode:76},[_.NEXT]:{key:"N",code:"KeyN",keyCode:78,shiftKey:!0}};class dt{execute(t){if(document.querySelector(".ad-showing"))return!1;if(t===_.PREV)return history.back(),!0;const s=ht[t];return s?this._sendKey(s):!1}_sendKey({key:t,code:s,keyCode:i,shiftKey:o=!1}){const a=document.querySelector("#movie_player")??document.body,h={key:t,code:s,keyCode:i,which:i,shiftKey:o,bubbles:!0,cancelable:!0};return a.dispatchEvent(new KeyboardEvent("keydown",h)),!0}}if(!window.__nodexLoaded){window.__nodexLoaded=!0;const e=3,t=3e3,s=5e3,i=3,o=2e3,a=38;class h{constructor(){this._hud=null,this._gestureEngine=null,this._ytController=new dt,this._running=!1,this._frameCount=0,this._destroyed=!1,this._onMessage=this._handleMessage.bind(this),this._onWindowMessage=this._handleWindowMessage.bind(this),this._lastLandmarkTime=0,this._watchdogTimer=null,this._restartAttempts=0,this._contextValid=!0,this._lastFrameProcessedAt=0}async init(){const[r,c,l]=await Promise.all([b(),H({thresholds:I,cooldowns:O,engine_active:!1}),G(D)]);this._hud=new Y,await this._hud.mount(),this._gestureEngine=new ct({thresholds:c.thresholds??I,cooldowns:c.cooldowns??O,gestureMap:l,baseline:r,onCommand:(u,E,N)=>this._handleCommand(u,E,N),onMetrics:u=>this._handleMetrics(u)}),window.addEventListener("message",this._onWindowMessage),chrome.runtime.onMessage.addListener(this._onMessage),c.engine_active&&await this.start(),this._sendStatus()}async start(){this._running||this._destroyed||(this._running=!0,window.postMessage({type:"NODEX_START_CAMERA",extensionBaseUrl:chrome.runtime.getURL("")},"*"),this._hud.show(),this._startWatchdog(),await C({engine_active:!0}).catch(()=>{}),this._sendStatus())}async stop(){var r;this._running&&(this._stopWatchdog(),this._running=!1,window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),(r=this._hud)==null||r.hide(),await C({engine_active:!1}).catch(()=>{}),this._sendStatus())}async destroy(){var r,c;this._destroyed||(this._stopWatchdog(),this._destroyed=!0,window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),window.removeEventListener("message",this._onWindowMessage),chrome.runtime.onMessage.removeListener(this._onMessage),(r=this._gestureEngine)==null||r.destroy(),(c=this._hud)==null||c.unmount(),this._gestureEngine=null,this._hud=null)}_handleWindowMessage(r){var c,l,u,E,N,x;if(r.source===window){if(((c=r.data)==null?void 0:c.type)==="NODEX_LANDMARKS"){if(!this._running||this._destroyed)return;this._lastLandmarkTime=Date.now();const T=performance.now();if(T-this._lastFrameProcessedAt<a)return;this._lastFrameProcessedAt=T,(l=this._gestureEngine)==null||l.processFrame(r.data.data)}if(((u=r.data)==null?void 0:u.type)==="NODEX_BRIDGE_ERROR"&&(console.error("[Nodex] Bridge error:",r.data.error),(E=this._hud)==null||E.showWarning("Ошибка камеры: "+(r.data.error??"неизвестно"))),((N=r.data)==null?void 0:N.type)==="NODEX_INJECT_MEDIAPIPE")try{chrome.runtime.sendMessage({type:"INJECT_MEDIAPIPE"},T=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:(T==null?void 0:T.ok)??!1,error:(T==null?void 0:T.error)??null},"*")})}catch(T){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:T.message},"*")}if(((x=r.data)==null?void 0:x.type)==="NODEX_INJECT_SCRIPT"){const{path:T,requestId:m}=r.data;try{chrome.runtime.sendMessage({type:"INJECT_SCRIPT",path:T,requestId:m},p=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:m,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:(p==null?void 0:p.ok)??!1,requestId:m,error:(p==null?void 0:p.error)??null},"*")})}catch(p){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:m,error:p.message},"*")}}}}_handleCommand(r,c,l){var E;const u=this._ytController.execute(r);(E=this._hud)==null||E.showCommand(r),this._sendToSidePanel({type:f.COMMAND_EXECUTED,command:r,gesture:c,applied:u,metrics:l})}_handleMetrics(r){var c;this._frameCount++,(c=this._hud)==null||c.updateMetrics(r),this._frameCount%e===0&&this._sendToSidePanel({type:f.METRICS_UPDATE,metrics:r})}_handleMessage(r,c,l){var u;switch(r.type){case f.START_ENGINE:this.start();break;case f.STOP_ENGINE:this.stop();break;case f.SAVE_CALIBRATION:r.baseline&&v(r.baseline).then(()=>{var E;return(E=this._gestureEngine)==null?void 0:E.updateSettings({baseline:r.baseline})}).catch(console.error);break;case f.UPDATE_SETTINGS:{const E=r.settings??{};C(E).catch(console.error),(u=this._gestureEngine)==null||u.updateSettings(E);break}case f.REQUEST_STATUS:this._sendStatus();break}l==null||l({ok:!0})}_startWatchdog(){clearInterval(this._watchdogTimer),this._lastLandmarkTime=Date.now(),this._restartAttempts=0,this._watchdogTimer=setInterval(()=>this._watchdogCheck(),t)}_stopWatchdog(){clearInterval(this._watchdogTimer),this._watchdogTimer=null}_watchdogCheck(){var c,l;if(!this._running||this._destroyed)return;try{chrome.runtime.getURL("")}catch{this._handleContextInvalidated();return}const r=Date.now()-this._lastLandmarkTime;if(r<s){this._restartAttempts=0;return}if(this._restartAttempts++,this._restartAttempts>i){(c=this._hud)==null||c.showWarning("Камера потеряна. Перезагрузите страницу."),this.stop(),this._sendToSidePanel({type:f.ENGINE_STATUS,running:!1,error:"bridge_dead"});return}console.warn(`[Nodex] Watchdog: no landmarks for ${r}ms, restarting bridge (attempt ${this._restartAttempts}/${i})`),(l=this._hud)==null||l.showWarning("Переподключение камеры..."),window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),this._lastLandmarkTime=Date.now(),setTimeout(()=>{!this._running||this._destroyed||window.postMessage({type:"NODEX_START_CAMERA",extensionBaseUrl:chrome.runtime.getURL("")},"*")},o)}_handleContextInvalidated(){var r;this._contextValid=!1,(r=this._hud)==null||r.showWarning("Расширение обновлено. Перезагрузите страницу."),this._stopWatchdog()}_sendToSidePanel(r){if(this._contextValid)try{chrome.runtime.sendMessage({type:f.CONTENT_TO_SIDEPANEL,payload:r}).catch(()=>{})}catch{}}_sendStatus(){this._sendToSidePanel({type:f.ENGINE_STATUS,running:this._running})}}const d=new h;d.init().catch(S=>console.error("[Nodex] init failed:",S)),window.addEventListener("beforeunload",()=>{d.destroy()})}})();
