/**
 * 🎬 유튜브 **IFrame Player API** 로더 — `/videos` 뷰어 전용.
 *
 * ## 왜 재생기를 우리가 쥐는가 (2026-09-08 대표 *"가장 이상적으로 하자"*)
 * 대표가 라이브 화면에서 본 것: `controls=0` 으로 유튜브 아래 컨트롤 바와 위 아이콘은 사라졌는데
 * **자막이 계속 켜진 채로 나온다**(스크린샷의 "여기는"). URL 파라미터에는 자막을 *끄는* 공식 값이
 * 없다 — `cc_load_policy=1` 이 "켜라"이고 0 은 문서에 없다(무시될 수 있다). iframe 안은 교차
 * 출처라 CSS 로도 못 건드린다.
 *
 * ⇒ 확실한 길은 하나뿐이다: **재생기 객체를 우리가 들고 `unloadModule('captions')` 을 부른다.**
 * 덤으로 `controls=0` 때문에 잃었던 **탭 일시정지**도 우리가 돌려줄 수 있다(제스처 층이 iframe 을
 * 덮고 있어 유튜브가 탭을 못 받는다).
 *
 * ## 🔴 이 모듈이 절대 안 하는 것 — 화면을 못 켜게 만드는 일
 * 스크립트가 안 오면(광고 차단기·네트워크) `/videos` 가 **검은 화면**이 된다. 그래서 이 함수는
 * **절대 거부하지 않는다** — 실패도 타임아웃도 `null` 로 돌려주고, 호출부는 그때 예전 방식
 * (고정 iframe)으로 튼다. 자막은 남지만 영상은 나온다.
 *
 * ## CSP
 * `script-src` 에 `'strict-dynamic'` 이 있어 **우리 번들이 동적으로 넣은 script 는 신뢰를 물려받는다**
 * (`www.youtube.com` 은 host 목록에도 이미 있다). 그래서 별도 허용이 필요 없다.
 */

/** 우리가 실제로 부르는 것만. 전체 타입을 끌어오지 않는다(런타임에 없는 객체다). */
export interface YtPlayer {
  loadVideoById(videoId: string): void
  playVideo(): void
  pauseVideo(): void
  getPlayerState(): number
  unloadModule(name: string): void
  getIframe(): HTMLIFrameElement
  destroy(): void
}

export interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId?: string
      host?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YtPlayer }) => void
        onStateChange?: (e: { target: YtPlayer; data: number }) => void
        onError?: (e: { data: number }) => void
      }
    },
  ) => YtPlayer
  PlayerState?: { PLAYING?: number; PAUSED?: number; ENDED?: number }
}

declare global {
  interface Window {
    YT?: YtNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_SRC = 'https://www.youtube.com/iframe_api'

/**
 * 스크립트가 이 시간 안에 안 오면 없는 셈 친다. 뷰어는 목록 fetch 를 기다리는 동안 이걸 **동시에**
 * 로드하므로, 정상 상황에서는 이 타이머가 끝까지 가는 일이 없다(스크립트는 작고 캐시된다).
 */
export const YT_API_TIMEOUT_MS = 2500

/** 자막 모듈 이름. 유튜브가 플레이어 세대에 따라 둘 중 하나를 쓴다 — 둘 다 부른다. */
export const CAPTION_MODULES = ['captions', 'cc'] as const

let pending: Promise<YtNamespace | null> | null = null

/** API 를 불러온다. **실패하면 `null`** — 던지지 않는다(위 "검은 화면" 절 참고). */
export function loadYouTubePlayerApi(timeoutMs = YT_API_TIMEOUT_MS): Promise<YtNamespace | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null)
  // 이미 와 있으면 즉시. ⚠️ 이 검사가 `pending` 보다 **앞**이라야 한다 — 한 번 타임아웃으로 null 을
  // 캐시한 뒤 스크립트가 뒤늦게 도착한 경우에도 다음 진입에서 살아난다.
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (pending) return pending

  pending = new Promise<YtNamespace | null>((resolve) => {
    let settled = false
    const finish = (v: YtNamespace | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)

    // 유튜브는 준비되면 **전역 콜백 하나**를 부른다. 남이 먼저 걸어 뒀을 수 있으니 이어 붙인다.
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try { prev?.() } catch { /* 남의 콜백이 터져도 우리 재생기는 떠야 한다 */ }
      clearTimeout(timer)
      finish(window.YT ?? null)
    }

    const s = document.createElement('script')
    s.src = API_SRC
    s.async = true
    s.onerror = () => { clearTimeout(timer); finish(null) }
    document.head.appendChild(s)
  })
  return pending
}

/**
 * 자막을 끈다. **한 번으로 안 끝난다** — `loadVideoById` 로 다음 영상이 오면 유튜브가 자막 모듈을
 * 다시 싣기 때문에 상태가 바뀔 때마다 부른다. 모듈이 없으면 예외가 나므로 통째로 삼킨다
 * (자막 하나 때문에 화면이 죽으면 안 된다).
 */
export function killCaptions(player: YtPlayer | null | undefined): void {
  if (!player) return
  for (const m of CAPTION_MODULES) {
    try { player.unloadModule(m) } catch { /* 그 세대에 없는 모듈 — 없는 게 목적이라 성공이다 */ }
  }
}

/** 테스트 전용 — 모듈 캐시 초기화. */
export function __resetYouTubeApiForTest(): void {
  pending = null
}
