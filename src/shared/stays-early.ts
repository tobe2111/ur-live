/**
 * 🏨 숙소 목록(`/stays`) 첫 데이터 — HTML 도착 직후 미리 출발 (2026-10-15 대표 *"계속 개선점 찾아줘 최대한 끝까지"*).
 *
 * 라이브 실측(느린 4G · CPU 4배): [앱 공통 코드 다운로드(2.2초) → 실행 → 화면 그림] 뒤에야 검색 요청이 나가
 * 3.4초에 출발했고 사진은 그 뒤라 LCP 가 ~7초였다. 화면 청크·번역을 일찍 받아도 이 요청은 React 가 그린 뒤라
 * 안 당겨진다(A/B 실측: 3.19 → 3.15초). ⇒ index.html 인라인 스크립트가 HTML 파싱 중에 같은 요청을 보내고
 * (`window.__urStaysEarly`), 화면의 질의 함수가 같은 주소면 그 결과를 이어받는다(지도 SDK 조기 출발과 같은 수법).
 *
 * 🔴 주소가 **바이트 단위로** 같아야 이어받는다 — 인라인 스크립트(ES5 손글씨)와 이 함수가 같은 순서·같은 기본값을 쓴다.
 *   시험이 인라인 스크립트를 실제로 돌려 이 함수와 대조한다.
 * 📅 날짜는 **한국 시간**이다 — 종전 `toISOString()`(UTC)은 한국 0~9시에 체크인을 **어제**로 잡았다.
 */

const DAY = 86400000
const KST = 9 * 3600000

/** 한국 시간 기준 YYYY-MM-DD (offsetDays: 0=오늘, 1=내일). */
export function kstYmd(offsetDays = 0, now: number = Date.now()): string {
  return new Date(now + KST + offsetDays * DAY).toISOString().slice(0, 10)
}

/** 아무 조건 없는 `/stays` 진입의 검색 질의 — 화면 `buildQs(filters)` 와 같은 순서·같은 기본값. */
export function defaultStaysQs(now: number = Date.now()): string {
  return `check_in=${kstYmd(0, now)}&check_out=${kstYmd(1, now)}&guests=2&sort=recent`
}

type Early = { qs: string; p: Promise<unknown> }

/** 인라인 스크립트가 미리 보낸 요청을 **한 번만** 가져간다(주소가 다르면 null — 일반 경로로). */
export function takeStaysEarly(qs: string): Promise<unknown> | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { __urStaysEarly?: Early }
  const e = w.__urStaysEarly
  if (!e || e.qs !== qs) return null
  w.__urStaysEarly = undefined
  return e.p
}

/** 서버가 `/stays` 첫 화면과 함께 실어 보낸 검색 결과의 script id(워커 보조 시드 슬롯 이름에서 온다). */
export const STAYS_SEED_ID = '__SSR_INITIAL_STAYS__'

/**
 * 🏨 2026-10-19 서버 첫 화면이 그린 검색 결과를 **첫 렌더에** 쓴다 — 없으면 화면이 '검색 중...' 을 그렸다가
 * 다시 그려 서버가 그린 카드가 한 번 사라진다. 기본 질의(`defaultStaysQs`)일 때만, **한 번만** 가져간다
 * (SPA 로 다시 들어오면 일반 경로). 실패·모양 불일치는 undefined(일반 경로).
 */
export function readStaysSeed<T = unknown>(qs: string, now: number = Date.now()): T[] | undefined {
  if (typeof document === 'undefined' || qs !== defaultStaysQs(now)) return undefined
  const el = document.getElementById(STAYS_SEED_ID)
  if (!el) return undefined
  el.remove()
  try {
    const j = JSON.parse(el.textContent || '') as { success?: boolean; data?: T[] }
    return j?.success && Array.isArray(j.data) ? j.data : undefined
  } catch { return undefined }
}
