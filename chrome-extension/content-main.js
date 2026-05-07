/**
 * UR Live Extension — Content Script (UR Live 페이지)
 *
 * 페이지 ↔ background 메시지 브릿지.
 *   - 페이지가 window.postMessage 로 OBS 명령 전달
 *   - background WebSocket 결과를 페이지로 다시 postMessage
 *
 * 페이지 코드는 hasOBSExtension() 으로 자동 감지하고 이 프록시 사용.
 */

const VERSION = chrome.runtime.getManifest().version

// 페이지에 "Extension 설치됨" 알림 (이벤트 + 글로벌 마커)
function announce() {
  try {
    document.documentElement.dataset.urExtension = VERSION
    window.dispatchEvent(new CustomEvent('ur-live-extension-ready', {
      detail: { version: VERSION }
    }))
  } catch {}
}
announce()
// SPA 라우팅 후에도 다시 알림
const observer = new MutationObserver(() => {
  if (!document.documentElement.dataset.urExtension) announce()
})
observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ur-extension'] })

const ALLOWED_TYPES = ['OBS_CONNECT', 'OBS_SEND', 'OBS_DISCONNECT', 'GET_LINKED_BROADCAST']

// 페이지 → background 프록시
window.addEventListener('message', async (e) => {
  if (e.source !== window) return
  const msg = e.data
  if (!msg || !msg.__urlive) return
  if (!ALLOWED_TYPES.includes(msg.type)) return

  if (msg.type === 'GET_LINKED_BROADCAST') {
    try {
      chrome.runtime.sendMessage({ __urlive: true, ...msg }, (res) => {
        if (chrome.runtime.lastError) return
        window.postMessage({
          __urlive: true,
          type: 'LINKED_BROADCAST_RESULT',
          streamId: msg.streamId,
          youtubeVideoId: res?.youtubeVideoId || null,
        }, '*')
      })
    } catch { /* extension reloaded */ }
    return
  }

  try {
    chrome.runtime.sendMessage({ __urlive: true, ...msg })
  } catch (err) {
    window.postMessage({ __urlive: true, type: 'OBS_ERROR', error: String(err?.message || err) }, '*')
  }
})

// background → 페이지 프록시 (background sendMessage to tab)
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || !msg.__urlive) return
  // 페이지로 전달
  window.postMessage(msg, '*')
})
