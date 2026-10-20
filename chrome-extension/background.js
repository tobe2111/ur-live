/**
 * UR Live Extension — Background Service Worker
 *
 * 역할:
 *   1. ws://localhost:4455 (OBS WebSocket) 연결을 페이지 대신 수립.
 *      HTTPS 프로덕션에서 Mixed Content 차단을 우회.
 *   2. content-main.js 로부터 OBS_CONNECT/OBS_SEND 메시지 받아 처리.
 *
 * 메시지 프로토콜:
 *   페이지 → ext: { type: 'OBS_CONNECT', host, port } | { type: 'OBS_SEND', payload } | { type: 'OBS_DISCONNECT' }
 *   ext → 페이지: { type: 'OBS_CONNECT_RESULT', ok, error? } | { type: 'OBS_MESSAGE', data } | { type: 'OBS_CLOSED' }
 */

const sockets = new Map() // tabId -> WebSocket

function send(tabId, payload) {
  chrome.tabs.sendMessage(tabId, { __urlive: true, ...payload }).catch(() => { /* tab 닫힘 */ })
}

function closeSocket(tabId) {
  const ws = sockets.get(tabId)
  if (ws) {
    try { ws.close() } catch {}
    sockets.delete(tabId)
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.__urlive) return false
  const tabId = sender.tab?.id
  if (!tabId) return false

  switch (msg.type) {
    case 'OBS_CONNECT': {
      closeSocket(tabId)
      const { host = 'localhost', port = 4455 } = msg
      try {
        const ws = new WebSocket(`ws://${host}:${port}`)
        sockets.set(tabId, ws)
        ws.onopen = () => send(tabId, { type: 'OBS_CONNECT_RESULT', ok: true })
        ws.onerror = () => send(tabId, { type: 'OBS_CONNECT_RESULT', ok: false, error: 'connection failed' })
        ws.onclose = () => { sockets.delete(tabId); send(tabId, { type: 'OBS_CLOSED' }) }
        ws.onmessage = (e) => {
          // forward raw text (OBS WS v5 = JSON)
          send(tabId, { type: 'OBS_MESSAGE', data: typeof e.data === 'string' ? e.data : '' })
        }
      } catch (e) {
        send(tabId, { type: 'OBS_CONNECT_RESULT', ok: false, error: String(e?.message || e) })
      }
      sendResponse({ ok: true })
      return true
    }
    case 'OBS_SEND': {
      const ws = sockets.get(tabId)
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)) }
        catch (e) { send(tabId, { type: 'OBS_ERROR', error: String(e?.message || e) }) }
      }
      sendResponse({ ok: true })
      return true
    }
    case 'OBS_DISCONNECT': {
      closeSocket(tabId)
      sendResponse({ ok: true })
      return true
    }
    case 'PING': {
      sendResponse({ ok: true, version: chrome.runtime.getManifest().version })
      return true
    }
    // YouTube Studio 에서 웹캠 방송 시작 감지 (content-studio.js → background)
    case 'WEBCAM_BROADCAST_STARTED': {
      const { urStreamId, youtubeVideoId } = msg
      if (urStreamId && youtubeVideoId) {
        chrome.storage.session.set({ ur_linked_broadcast: { urStreamId, youtubeVideoId, ts: Date.now() } })
      }
      sendResponse({ ok: true })
      return true
    }
    // 우리 페이지(content-main.js)가 연결된 방송 조회
    case 'GET_LINKED_BROADCAST': {
      const { streamId } = msg
      chrome.storage.session.get('ur_linked_broadcast', (result) => {
        const linked = result?.ur_linked_broadcast
        if (linked && String(linked.urStreamId) === String(streamId)) {
          sendResponse({ ok: true, youtubeVideoId: linked.youtubeVideoId })
          // 한 번 사용 후 삭제
          chrome.storage.session.remove('ur_linked_broadcast')
        } else {
          sendResponse({ ok: true, youtubeVideoId: null })
        }
      })
      return true // async
    }
  }
  return false
})

// 탭 닫힘 시 소켓 정리
chrome.tabs.onRemoved.addListener((tabId) => closeSocket(tabId))
