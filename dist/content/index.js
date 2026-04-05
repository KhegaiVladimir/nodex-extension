(function(){"use strict";const l=Object.freeze({METRICS_UPDATE:"METRICS_UPDATE",GESTURE_FIRED:"GESTURE_FIRED",COMMAND_EXECUTED:"COMMAND_EXECUTED",ENGINE_STATUS:"ENGINE_STATUS",CALIBRATION_PROGRESS:"CALIBRATION_PROGRESS",START_ENGINE:"START_ENGINE",STOP_ENGINE:"STOP_ENGINE",SAVE_CALIBRATION:"SAVE_CALIBRATION",UPDATE_SETTINGS:"UPDATE_SETTINGS",REQUEST_STATUS:"REQUEST_STATUS",CONTENT_TO_SIDEPANEL:"CONTENT_TO_SIDEPANEL",SIDEPANEL_TO_CONTENT:"SIDEPANEL_TO_CONTENT"}),r=Object.freeze({HEAD_LEFT:"HEAD_LEFT",HEAD_RIGHT:"HEAD_RIGHT",HEAD_UP:"HEAD_UP",HEAD_DOWN:"HEAD_DOWN",EYES_CLOSED:"EYES_CLOSED",MOUTH_OPEN:"MOUTH_OPEN",TILT_LEFT:"TILT_LEFT",TILT_RIGHT:"TILT_RIGHT",NONE:"NONE"}),a=Object.freeze({PLAY:"PLAY",PAUSE:"PAUSE",PLAY_PAUSE:"PLAY_PAUSE",VOL_UP:"VOL_UP",VOL_DOWN:"VOL_DOWN",NEXT:"NEXT",PREV:"PREV",REWIND:"REWIND",MUTE:"MUTE",SKIP:"SKIP",NONE:"NONE"}),y={[r.HEAD_LEFT]:a.REWIND,[r.HEAD_RIGHT]:a.SKIP,[r.HEAD_UP]:a.VOL_UP,[r.HEAD_DOWN]:a.VOL_DOWN,[r.TILT_LEFT]:a.PREV,[r.TILT_RIGHT]:a.NEXT,[r.EYES_CLOSED]:a.PAUSE,[r.MOUTH_OPEN]:a.MUTE},I={[r.HEAD_UP]:300,[r.HEAD_DOWN]:300,[r.HEAD_LEFT]:600,[r.HEAD_RIGHT]:600,[r.TILT_LEFT]:800,[r.TILT_RIGHT]:800,[r.EYES_CLOSED]:1200,[r.MOUTH_OPEN]:600},A={yaw:18,pitch:12,roll:15,earClose:.18,mouthOpen:.55,hysteresis:4},L=350,f={CALIBRATION:"nodex_calibration",SETTINGS:"nodex_settings",GESTURE_MAP:"nodex_gesture_map"};async function p(i){return(await chrome.storage.local.get(i))[i]??null}async function w(i,t){await chrome.storage.local.set({[i]:t})}async function M(){return p(f.CALIBRATION)}async function P(i){if(i===null||typeof i!="object"||Array.isArray(i))throw new TypeError("calibration data must be a plain object");await w(f.CALIBRATION,i)}async function R(i={}){const t=await p(f.SETTINGS);return{...i,...t}}async function m(i){const e={...await p(f.SETTINGS),...i};return await w(f.SETTINGS,e),e}async function v(i={}){return await p(f.GESTURE_MAP)??i}const x=1500,U=Object.freeze({[a.PLAY]:"▶ Воспроизведение",[a.PAUSE]:"⏸ Пауза",[a.PLAY_PAUSE]:"⏯ Плей / Пауза",[a.VOL_UP]:"🔊 Громче",[a.VOL_DOWN]:"🔉 Тише",[a.MUTE]:"🔇 Без звука",[a.REWIND]:"⏪ Назад",[a.SKIP]:"⏩ Вперёд",[a.NEXT]:"⏭ Следующее",[a.PREV]:"⏮ Предыдущее"}),b=`
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

  .hidden {
    display: none !important;
  }
`;class H{constructor(){this._host=null,this._shadow=null,this._videoEl=null,this._container=null,this._metrics=null,this._toast=null,this._toastTimer=null,this._stream=null}async mount(){this._host=document.createElement("div"),this._host.id="nodex-hud-host",this._shadow=this._host.attachShadow({mode:"closed"});const t=document.createElement("style");return t.textContent=b,this._shadow.appendChild(t),this._container=document.createElement("div"),this._container.className="nodex-container",this._videoEl=document.createElement("video"),this._videoEl.className="nodex-video",this._videoEl.setAttribute("playsinline",""),this._videoEl.setAttribute("autoplay",""),this._videoEl.muted=!0,this._metrics=this._buildMetrics(),this._toast=document.createElement("div"),this._toast.className="nodex-toast",this._container.appendChild(this._videoEl),this._container.appendChild(this._metrics),this._shadow.appendChild(this._container),this._shadow.appendChild(this._toast),document.body.appendChild(this._host),this._stream=await this._requestCamera(),this._videoEl.srcObject=this._stream,await this._videoEl.play(),this._videoEl}show(){this._container&&this._container.classList.remove("hidden")}hide(){this._container&&this._container.classList.add("hidden")}showCommand(t){if(!this._toast)return;const e=U[t]??t;this._toast.textContent=e,this._toast.classList.add("visible"),clearTimeout(this._toastTimer),this._toastTimer=setTimeout(()=>{this._toast.classList.remove("visible")},x)}updateMetrics(t){this._metrics&&(this._setMetric("yaw",t.yaw),this._setMetric("pitch",t.pitch),this._setMetric("ear",t.ear))}unmount(){var t;if(clearTimeout(this._toastTimer),this._stream){for(const e of this._stream.getTracks())e.stop();this._stream=null}this._videoEl&&(this._videoEl.srcObject=null,this._videoEl=null),(t=this._host)!=null&&t.parentNode&&this._host.parentNode.removeChild(this._host),this._host=null,this._shadow=null,this._container=null,this._metrics=null,this._toast=null}_buildMetrics(){const t=document.createElement("div");t.className="nodex-metrics";for(const e of["yaw","pitch","ear"]){const o=document.createElement("div");o.className="nodex-metric";const s=document.createElement("span");s.className="nodex-metric-label",s.textContent=e;const n=document.createElement("span");n.className="nodex-metric-value",n.dataset.metric=e,n.textContent="—",o.appendChild(s),o.appendChild(n),t.appendChild(o)}return t}_setMetric(t,e){var s;const o=(s=this._metrics)==null?void 0:s.querySelector(`[data-metric="${t}"]`);o&&(o.textContent=typeof e=="number"?e.toFixed(1):"—")}async _requestCamera(){try{return await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:640,height:480},audio:!1})}catch(t){throw t.name==="NotAllowedError"?new Error("Доступ к камере запрещён. Разрешите доступ в настройках браузера и перезагрузите страницу."):t.name==="NotFoundError"?new Error("Камера не найдена. Подключите камеру и перезагрузите страницу."):new Error(`Ошибка камеры: ${t.message}`)}}}class G{constructor(t){if(typeof t!="number"||t<0)throw new TypeError("intervalMs must be a non-negative number");this._interval=t,this._lastFired=0}canFire(){return Date.now()-this._lastFired>=this._interval}fire(){return this.canFire()?(this._lastFired=Date.now(),!0):!1}reset(){this._lastFired=0}setInterval(t){if(typeof t!="number"||t<0)throw new TypeError("ms must be a non-negative number");this._interval=t}}const D=1,C=234,g=454,F=10,Y=152,W=159,X=145,V=133,k=33,z=386,j=374,B=362,J=263,q=13,K=14,Q=78,$=308,T=.001;function N(i,t){return Math.sqrt((i.x-t.x)**2+(i.y-t.y)**2+(i.z-t.z)**2)}function Z(i){if(!(i!=null&&i.length))return 0;const t=i[D],e=i[C],o=i[g];if(!t||!e||!o)return 0;const s=(e.x+o.x)/2,n=Math.abs(o.x-e.x)/2;return n<T?0:-((t.x-s)/n)*45}function tt(i){if(!(i!=null&&i.length))return 0;const t=i[D],e=i[F],o=i[Y];if(!t||!e||!o)return 0;const s=(e.y+o.y)/2,n=Math.abs(o.y-e.y)/2;return n<T?0:(s-t.y)/n*40}function et(i){if(!(i!=null&&i.length))return 0;const t=i[C],e=i[g];if(!t||!e)return 0;const o=e.x-t.x,s=e.y-t.y;return Math.abs(o)<T&&Math.abs(s)<T?0:-Math.atan2(s,o)*(180/Math.PI)}function st(i){if(!(i!=null&&i.length))return .3;const t=i[W],e=i[X],o=i[V],s=i[k],n=i[z],_=i[j],c=i[B],h=i[J];if(!t||!e||!o||!s||!n||!_||!c||!h)return .3;const u=N(o,s),E=N(c,h);return u<T||E<T?.3:(N(t,e)/u+N(n,_)/E)/2}function it(i){if(!(i!=null&&i.length))return 0;const t=i[q],e=i[K],o=i[Q],s=i[$];if(!t||!e||!o||!s)return 0;const n=N(o,s);return n<T?0:N(t,e)/n}class nt{constructor({thresholds:t=A,cooldowns:e=I,gestureMap:o=y,baseline:s=null,onCommand:n=null,onMetrics:_=null}={}){this._thresholds={...t},this._gestureMap={...o},this._baseline=s,this._onCommand=n,this._onMetrics=_,this._active=r.NONE,this._eyeCloseStart=null,this._eyeCloseFired=!1,this._destroyed=!1,this._cooldowns={};for(const c of Object.values(r))c!==r.NONE&&(this._cooldowns[c]=new G(e[c]??600))}processFrame(t){var d;if(this._destroyed||!(t!=null&&t.length))return;const e=this._thresholds,o=e.hysteresis??4,s=this._baseline;let n=Z(t),_=tt(t),c=et(t);const h=st(t),u=it(t);s&&(n-=s.yaw??0,_-=s.pitch??0,c-=s.roll??0);const E={yaw:n,pitch:_,roll:c,ear:h,mouth:u};if((d=this._onMetrics)==null||d.call(this,E),h<e.earClose?this._eyeCloseStart===null?(this._eyeCloseStart=Date.now(),this._eyeCloseFired=!1):this._eyeCloseFired||Date.now()-this._eyeCloseStart>=L&&(this._eyeCloseFired=!0,this._fire(r.EYES_CLOSED,E)):this._eyeCloseStart!==null&&(this._eyeCloseStart=null,this._eyeCloseFired=!1,this._active===r.EYES_CLOSED&&(this._active=r.NONE)),this._active!==r.NONE&&this._active!==r.EYES_CLOSED&&this._shouldDeactivate(this._active,n,_,c,u,e,o)&&(this._active=r.NONE),this._active===r.NONE){const O=this._detect(n,_,c,u,e);O!==r.NONE&&(this._active=O,this._fire(O,E))}(this._active===r.HEAD_UP||this._active===r.HEAD_DOWN)&&this._fire(this._active,E)}updateSettings({thresholds:t,gestureMap:e,baseline:o,cooldowns:s}={}){if(t&&(this._thresholds={...t}),e&&(this._gestureMap={...e}),o!==void 0&&(this._baseline=o),s)for(const[n,_]of Object.entries(s))this._cooldowns[n]&&this._cooldowns[n].setInterval(_)}destroy(){this._destroyed=!0,this._active=r.NONE,this._eyeCloseStart=null,this._eyeCloseFired=!1,this._onCommand=null,this._onMetrics=null;for(const t of Object.values(this._cooldowns))t.reset()}_fire(t,e){var n;if(this._destroyed)return;const o=this._cooldowns[t];if(!o||!o.fire())return;const s=this._gestureMap[t]??a.NONE;s!==a.NONE&&((n=this._onCommand)==null||n.call(this,s,t,e))}_detect(t,e,o,s,n){return t<-n.yaw?r.HEAD_LEFT:t>n.yaw?r.HEAD_RIGHT:e>n.pitch?r.HEAD_UP:e<-n.pitch?r.HEAD_DOWN:o<-n.roll?r.TILT_LEFT:o>n.roll?r.TILT_RIGHT:s>n.mouthOpen?r.MOUTH_OPEN:r.NONE}_shouldDeactivate(t,e,o,s,n,_,c){switch(t){case r.HEAD_LEFT:return e>=-(_.yaw-c);case r.HEAD_RIGHT:return e<=_.yaw-c;case r.HEAD_UP:return o<=_.pitch-c;case r.HEAD_DOWN:return o>=-(_.pitch-c);case r.TILT_LEFT:return s>=-(_.roll-c);case r.TILT_RIGHT:return s<=_.roll-c;case r.MOUTH_OPEN:return n<=_.mouthOpen*.8;default:return!0}}}const rt=5,ot=10,at=10;class _t{constructor(){this._volumeStep=rt/100}_getVideo(){if(document.querySelector(".ad-showing"))return null;const t=document.querySelectorAll("video");for(const e of t)if(e.readyState>=2&&e.duration>0)return e;return null}setVolumeStep(t){this._volumeStep=Math.max(.01,Math.min(1,t/100))}execute(t){const e=this._getVideo();if(t===a.NEXT)return this._clickNav(".ytp-next-button");if(t===a.PREV)return this._clickNav(".ytp-prev-button");if(!e)return!1;switch(t){case a.PLAY:return e.play(),!0;case a.PAUSE:return e.pause(),!0;case a.PLAY_PAUSE:return e.paused?e.play():e.pause(),!0;case a.VOL_UP:return e.volume=Math.min(1,e.volume+this._volumeStep),!0;case a.VOL_DOWN:return e.volume=Math.max(0,e.volume-this._volumeStep),!0;case a.MUTE:return e.muted=!e.muted,!0;case a.REWIND:return e.currentTime=Math.max(0,e.currentTime-ot),!0;case a.SKIP:return e.currentTime=Math.min(e.duration,e.currentTime+at),!0;default:return!1}}_clickNav(t){const e=document.querySelector(t);return e?(e.click(),!0):!1}}if(!window.__nodexLoaded){window.__nodexLoaded=!0;const i=3;class t{constructor(){this._hud=null,this._gestureEngine=null,this._ytController=new _t,this._running=!1,this._frameCount=0,this._destroyed=!1,this._onMessage=this._handleMessage.bind(this),this._onWindowMessage=this._handleWindowMessage.bind(this)}async init(){const[s,n,_]=await Promise.all([M(),R({thresholds:A,cooldowns:I,engine_active:!1}),v(y)]);this._hud=new H,await this._hud.mount(),this._gestureEngine=new nt({thresholds:n.thresholds??A,cooldowns:n.cooldowns??I,gestureMap:_,baseline:s,onCommand:(c,h,u)=>this._handleCommand(c,h,u),onMetrics:c=>this._handleMetrics(c)}),window.addEventListener("message",this._onWindowMessage),chrome.runtime.onMessage.addListener(this._onMessage),n.engine_active&&await this.start(),this._sendStatus()}async start(){this._running||this._destroyed||(this._running=!0,window.postMessage({type:"NODEX_START_CAMERA",extensionBaseUrl:chrome.runtime.getURL("")},"*"),this._hud.show(),await m({engine_active:!0}).catch(()=>{}),this._sendStatus())}async stop(){var s;this._running&&(this._running=!1,window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),(s=this._hud)==null||s.hide(),await m({engine_active:!1}).catch(()=>{}),this._sendStatus())}async destroy(){var s,n;this._destroyed||(this._destroyed=!0,window.postMessage({type:"NODEX_STOP_CAMERA"},"*"),window.removeEventListener("message",this._onWindowMessage),chrome.runtime.onMessage.removeListener(this._onMessage),(s=this._gestureEngine)==null||s.destroy(),(n=this._hud)==null||n.unmount(),this._gestureEngine=null,this._hud=null)}_handleWindowMessage(s){var n,_,c,h,u;if(s.source===window){if(((n=s.data)==null?void 0:n.type)==="NODEX_LANDMARKS"){if(!this._running||this._destroyed)return;(_=this._gestureEngine)==null||_.processFrame(s.data.data)}if(((c=s.data)==null?void 0:c.type)==="NODEX_BRIDGE_ERROR"&&console.error("[Nodex] Bridge error:",s.data.error),((h=s.data)==null?void 0:h.type)==="NODEX_INJECT_MEDIAPIPE")try{chrome.runtime.sendMessage({type:"INJECT_MEDIAPIPE"},E=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:(E==null?void 0:E.ok)??!1,error:(E==null?void 0:E.error)??null},"*")})}catch(E){window.postMessage({type:"NODEX_INJECT_MEDIAPIPE_RESULT",ok:!1,error:E.message},"*")}if(((u=s.data)==null?void 0:u.type)==="NODEX_INJECT_SCRIPT"){const{path:E,requestId:S}=s.data;try{chrome.runtime.sendMessage({type:"INJECT_SCRIPT",path:E,requestId:S},d=>{if(chrome.runtime.lastError){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:S,error:chrome.runtime.lastError.message},"*");return}window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:(d==null?void 0:d.ok)??!1,requestId:S,error:(d==null?void 0:d.error)??null},"*")})}catch(d){window.postMessage({type:"NODEX_INJECT_SCRIPT_RESULT",ok:!1,requestId:S,error:d.message},"*")}}}}_handleCommand(s,n,_){var h;const c=this._ytController.execute(s);(h=this._hud)==null||h.showCommand(s),this._sendToSidePanel({type:l.COMMAND_EXECUTED,command:s,gesture:n,applied:c,metrics:_})}_handleMetrics(s){var n;this._frameCount++,(n=this._hud)==null||n.updateMetrics(s),this._frameCount%i===0&&this._sendToSidePanel({type:l.METRICS_UPDATE,metrics:s})}_handleMessage(s,n,_){var c;switch(s.type){case l.START_ENGINE:this.start();break;case l.STOP_ENGINE:this.stop();break;case l.SAVE_CALIBRATION:s.baseline&&P(s.baseline).then(()=>{var h;return(h=this._gestureEngine)==null?void 0:h.updateSettings({baseline:s.baseline})}).catch(console.error);break;case l.UPDATE_SETTINGS:{const h=s.settings??{};m(h).catch(console.error),(c=this._gestureEngine)==null||c.updateSettings(h);break}case l.REQUEST_STATUS:this._sendStatus();break}_==null||_({ok:!0})}_sendToSidePanel(s){try{chrome.runtime.sendMessage({type:l.CONTENT_TO_SIDEPANEL,payload:s}).catch(()=>{})}catch{}}_sendStatus(){this._sendToSidePanel({type:l.ENGINE_STATUS,running:this._running})}}const e=new t;e.init().catch(o=>console.error("[Nodex] init failed:",o)),window.addEventListener("beforeunload",()=>{e.destroy()})}})();
