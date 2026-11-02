/**
 * 🗺️ 네이버 지도 JS v3 로더 — **외국어 손님 전용** (2026-11-02 대표 확정 "외국어일 때만 네이버맵").
 *
 * 왜: 카카오맵 JS 는 공식 문서에서 지명 외국어 표시 옵션을 찾지 못했다(지명이 한국어로만 나온다).
 *   네이버 지도 JS v3 는 스크립트 주소의 `language` 값으로 지명을 영어·일본어·중국어로 그린다.
 *   ⇒ 한국어 손님은 카카오맵 그대로, 외국어(en·ja·zh·…)일 때만 이 로더를 쓴다.
 *
 * 키: `VITE_NAVER_MAP_KEY_ID`(네이버 클라우드 플랫폼 Maps 의 Client ID). **없으면 이 로더는 쓰이지 않는다**
 *   (`isNaverMapAvailable()` 이 false → 호출부가 카카오맵으로 떨어진다). 그래서 키가 등록되기 전에
 *   머지돼도 화면은 한 픽셀도 안 바뀐다.
 */

const NAVER_KEY_ID = (import.meta.env.VITE_NAVER_MAP_KEY_ID as string | undefined) || ''

/** 네이버 지도가 지명을 그릴 수 있는 언어. 그 밖(es·fr …)은 영어로 그린다. */
export function naverMapLanguage(lang: string | undefined): 'en' | 'ja' | 'zh' {
  const base = (lang || '').split('-')[0]
  if (base === 'ja') return 'ja'
  if (base === 'zh') return 'zh'
  return 'en'
}

/** 외국어 손님에게 네이버 지도를 줄 수 있는가 — 키가 있고, 언어가 한국어가 아닐 때. */
export function isNaverMapAvailable(lang: string | undefined): boolean {
  const base = (lang || 'ko').split('-')[0]
  return !!NAVER_KEY_ID && base !== 'ko'
}

const NAVER_MAPS_SRC = (key: string, language: string) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}&language=${language}&submodules=geocoder`

let naverPromise: Promise<void> | null = null
let naverLang: string | null = null

/**
 * 스크립트를 한 번만 넣는다. 언어는 **스크립트 주소에 박히므로** 한 페이지에서 한 언어만 쓴다
 * (도중에 언어를 바꾸면 다음 새로고침부터 새 언어 — 지명 언어 하나 때문에 SDK 를 두 번 받지 않는다).
 */
export function ensureNaverMaps(lang: string | undefined): Promise<void> {
  if (naverPromise) return naverPromise
  const language = naverMapLanguage(lang)
  naverLang = language
  naverPromise = new Promise<void>((resolve, reject) => {
    if (!NAVER_KEY_ID) { reject(new Error('VITE_NAVER_MAP_KEY_ID is not configured')); return }
    const w = window as unknown as { naver?: { maps?: unknown } }
    if (w.naver?.maps) { resolve(); return }
    const s = document.createElement('script')
    s.src = NAVER_MAPS_SRC(NAVER_KEY_ID, language)
    s.async = true
    s.onload = () => (w.naver?.maps ? resolve() : reject(new Error('naver.maps missing after load')))
    s.onerror = () => { naverPromise = null; reject(new Error('naver maps script failed')) }
    document.head.appendChild(s)
  })
  return naverPromise
}

/** 시험용 — 지금 박힌 지명 언어. */
export function loadedNaverMapLanguage(): string | null { return naverLang }
