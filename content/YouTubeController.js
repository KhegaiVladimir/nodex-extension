import { COMMANDS } from '../shared/constants/commands.js'

const KEY_MAP = {
  [COMMANDS.PLAY]:       { key: 'k', code: 'KeyK', keyCode: 75 },
  [COMMANDS.PAUSE]:      { key: 'k', code: 'KeyK', keyCode: 75 },
  [COMMANDS.PLAY_PAUSE]: { key: 'k', code: 'KeyK', keyCode: 75 },
  [COMMANDS.VOL_UP]:     { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  [COMMANDS.VOL_DOWN]:   { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  [COMMANDS.MUTE]:       { key: 'm', code: 'KeyM', keyCode: 77 },
  [COMMANDS.REWIND]:     { key: 'j', code: 'KeyJ', keyCode: 74 },
  [COMMANDS.SKIP]:       { key: 'l', code: 'KeyL', keyCode: 76 },
  [COMMANDS.NEXT]:       { key: 'N', code: 'KeyN', keyCode: 78, shiftKey: true },
  [COMMANDS.PREV]:       { key: 'P', code: 'KeyP', keyCode: 80, shiftKey: true },
}

export class YouTubeController {
  execute(command) {
    if (document.querySelector('.ad-showing')) return false

    const mapping = KEY_MAP[command]
    if (!mapping) return false

    return this._sendKey(mapping)
  }

  _sendKey({ key, code, keyCode, shiftKey = false }) {
    const target = document.querySelector('#movie_player') ?? document.body
    const opts = {
      key,
      code,
      keyCode,
      which: keyCode,
      shiftKey,
      bubbles: true,
      cancelable: true,
    }
    target.dispatchEvent(new KeyboardEvent('keydown', opts))
    return true
  }
}
