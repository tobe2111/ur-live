/**
 * 🎬 유어쇼츠 **전량 목록 한 벌** (2026-11-09 대표 *"계속 최적화"*).
 *
 * 목록 화면(`UrShortsBrowsePage`)·상세의 매장 영상 알약(`StoreShortsPill`)·뷰어(`VideosPage`)가 **같은 주소**(`/api/urshorts?all=1`)를
 * 각자 받았다. 실측(폰 4G·CPU 4배): 목록에서 카드를 눌러 뷰어로 가면 뷰어가 그 목록을 **다시 받아**(≈0.5초 왕복) 그 뒤에야
 * 영상 자리를 찾아 재생기를 만들었다 — 카드 누름 → 첫 프레임 1.4초. 이미 손에 든 목록을 또 기다린 것이다.
 *
 * 탭 수명 동안 한 번만 받는다(메모리). 실패하면 다음 호출이 다시 받는다. 서버 시드(`readUrShortsSeed`, 10편)는 **자리값**으로만
 * 둔다 — 전량(`?all=1`)이 오면 바꾼다(2026-10-13 규율: 10편이 전량을 대체하면 안 된다).
 */
import type { UrShortItem } from './urshorts'

let full: UrShortItem[] | null = null
let inflight: Promise<UrShortItem[]> | null = null

/** 이미 받은 전량(없으면 null) — 렌더 첫 프레임에서 동기로 쓴다. */
/**
 * 전량 목록 주소 — 뷰어(`/videos`)는 이 목록이 와야 첫 영상을 안다. 워커가 그 화면의 응답 헤더에 같은 주소를
 * `Link: rel=preload; as=fetch` 로 실어, 앱이 켜지기 전에(HTML 이 오자마자) 받기 시작하게 한다(2026-11-11 — 라이브 실측: 목록 요청이 3.3s 에야 출발).
 * 🔴 주소가 한 글자라도 다르면 브라우저가 미리 받은 것을 버리고 다시 받는다 — 그래서 워커와 이 파일이 이 상수 하나를 읽는다.
 */
export const SHORTS_ALL_PATH = '/api/urshorts?all=1'
/** 워커가 응답 헤더에 싣는 값. `crossorigin` 이 있어야 `fetch()` 의 요청 모드(cors · same-origin 자격)와 맞아 재사용된다. */
export const SHORTS_ALL_PRELOAD_LINK = `<${SHORTS_ALL_PATH}>; rel=preload; as=fetch; crossorigin`

export function peekShortsAll(): UrShortItem[] | null { return full }

/** 전량 목록. 받는 중이면 같은 약속을 돌려준다(요청 1회). */
export function loadShortsAll(): Promise<UrShortItem[]> {
  if (full) return Promise.resolve(full)
  if (!inflight) {
    inflight = fetch(SHORTS_ALL_PATH)
      .then((r) => r.json() as Promise<{ success?: boolean; data?: UrShortItem[] }>)
      .then((r) => { const list = r?.success && Array.isArray(r.data) ? r.data : []; if (list.length) full = list; return list })
      .catch(() => [] as UrShortItem[])
      .finally(() => { inflight = null })
  }
  return inflight
}

/** 시험용 — 모듈 상태를 비운다. */
export function __resetShortsAllForTest(): void { full = null; inflight = null }
