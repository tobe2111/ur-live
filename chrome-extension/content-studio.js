/**
 * UR Live Extension — Content Script (YouTube Studio)
 *
 * studio.youtube.com/video/{vid}/livestreaming 진입 시:
 *   - URL 에 ?ur_stream_id= 가 있으면 우리 서비스 사이드바 iframe 자동 주입
 *   - 셀러가 YouTube Studio 안에서 우리 채팅/상품/타임딜 컨트롤 사용 가능
 */

const SIDEBAR_ID = 'ur-live-sidebar-root'
const TOGGLE_ID = 'ur-live-sidebar-toggle'

function getStreamIdFromUrl() {
  try {
    const url = new URL(window.location.href)
    return url.searchParams.get('ur_stream_id')
  } catch { return null }
}

function getVideoIdFromUrl() {
  try {
    const m = window.location.pathname.match(/\/video\/([a-zA-Z0-9_-]+)\/livestreaming/)
    return m ? m[1] : null
  } catch { return null }
}

// 웹캠 모드: ur_stream_id 를 들고 channel 페이지에 진입 → 셀러가 방송 시작 → URL이 /video/{vid}/livestreaming 으로 변경
let pendingStreamId = null
function checkWebcamBroadcastStarted() {
  const vid = getVideoIdFromUrl()
  if (vid && pendingStreamId) {
    chrome.runtime.sendMessage({
      __urlive: true,
      type: 'WEBCAM_BROADCAST_STARTED',
      urStreamId: pendingStreamId,
      youtubeVideoId: vid,
    })
    pendingStreamId = null // 한 번만 전송
  }
}

function getOriginBase() {
  // staging / production 자동 감지
  // 기본: production 도메인. 추후 storage 로 dynamic 가능.
  return 'https://live.ur-team.com'
}

function inject(streamId) {
  if (document.getElementById(SIDEBAR_ID)) return

  const origin = getOriginBase()
  const src = `${origin}/embed/seller-control/${streamId}?source=ext`

  const root = document.createElement('div')
  root.id = SIDEBAR_ID

  const iframe = document.createElement('iframe')
  iframe.src = src
  iframe.title = 'UR Live Seller Control'
  iframe.allow = 'clipboard-read; clipboard-write'

  const toggle = document.createElement('button')
  toggle.id = TOGGLE_ID
  toggle.textContent = '◀'
  toggle.title = 'UR Live 사이드바 접기/펼치기'
  toggle.onclick = () => {
    root.classList.toggle('ur-collapsed')
    toggle.textContent = root.classList.contains('ur-collapsed') ? '▶' : '◀'
  }

  root.appendChild(iframe)
  root.appendChild(toggle)
  document.body.appendChild(root)
}

function tryInject() {
  const streamId = getStreamIdFromUrl()
  if (streamId) {
    pendingStreamId = streamId  // 웹캠 대기 중 저장
    inject(streamId)
  } else {
    // URL 에 ur_stream_id 없어도 video 페이지면 webcam 감지 시도
    checkWebcamBroadcastStarted()
  }
}

tryInject()

// SPA URL 변경 감지 (YouTube Studio 는 SPA)
let lastUrl = location.href
const obs = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    // URL 바뀌면 기존 사이드바 제거 후 재주입
    const old = document.getElementById(SIDEBAR_ID)
    if (old) old.remove()
    setTimeout(() => {
      tryInject()
      checkWebcamBroadcastStarted()
    }, 500)
  }
})
obs.observe(document, { subtree: true, childList: true })
