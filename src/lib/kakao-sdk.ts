/**
 * 통합 Kakao JavaScript SDK 로더
 *
 * 하나의 키(VITE_KAKAO_JAVASCRIPT_KEY)로 로그인/공유/지도를 모두 처리.
 * 도메인 등록과 플랫폼 설정은 Kakao Developers Console에서 필요.
 */

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY as string

const KAKAO_SDK_SRC = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
const KAKAO_MAPS_SDK_SRC = (key: string) =>
  `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`

let kakaoSdkPromise: Promise<void> | null = null
let kakaoMapsPromise: Promise<void> | null = null

/**
 * Kakao JS SDK (로그인/공유/메시지)를 로드하고 init 완료를 보장
 */
export function ensureKakaoSdk(): Promise<void> {
  if (kakaoSdkPromise) return kakaoSdkPromise

  kakaoSdkPromise = new Promise<void>((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error('VITE_KAKAO_JAVASCRIPT_KEY is not configured'))
      return
    }

    const w = window as any

    // 이미 초기화 완료
    if (w.Kakao?.isInitialized?.()) {
      resolve()
      return
    }

    // SDK는 로드됐지만 init 안 됨
    if (w.Kakao) {
      try {
        w.Kakao.init(KAKAO_JS_KEY)
        resolve()
      } catch (e) {
        reject(e)
      }
      return
    }

    // SDK 로드 + init
    const existing = document.querySelector(`script[src="${KAKAO_SDK_SRC}"]`) as HTMLScriptElement | null
    const script = existing || document.createElement('script')
    script.src = KAKAO_SDK_SRC
    script.async = true
    script.crossOrigin = 'anonymous'

    const onLoad = () => {
      try {
        if (!w.Kakao?.isInitialized?.()) w.Kakao.init(KAKAO_JS_KEY)
        resolve()
      } catch (e) {
        kakaoSdkPromise = null
        reject(e)
      }
    }
    const onError = () => {
      kakaoSdkPromise = null
      reject(new Error('Kakao SDK load failed'))
    }

    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)

    if (!existing) document.head.appendChild(script)
    // 이미 로드 중인 경우 load 이벤트를 놓쳤을 수도 있으므로 체크
    else if (w.Kakao) onLoad()
  })

  return kakaoSdkPromise
}


/**
 * 🗺️ 지도 타일 화질은 언제나 고화질 — `kakao.maps.disableHD()` 를 부르지 않는다.
 *   2026-10-15 대표 *"화질은 줄일 수 없어"* → *"저화질도 되돌려줘"*. 2026-10-14 에 느린 회선에서만
 *   일반 화질로 내리던 처방(`prefersLowResMapTiles`)을 걷어냈다. 지도 속도는 화질이 아니라
 *   [SDK 를 일찍 출발 · 시트에 가려진 타일을 안 받기 · 화면 코드 미리받기] 로 줄인다.
 *   가드: `map-tile-quality-2026-10-14.test.ts` — disableHD 호출이 소스에 되살아나면 빨간불.
 */
/**
 * Kakao Maps SDK를 로드 (지도 전용 — 별도 스크립트)
 */
export function ensureKakaoMaps(): Promise<void> {
  if (kakaoMapsPromise) return kakaoMapsPromise

  // 🗺️ 2026-10-12 `/map` 하드로드는 index.html 의 인라인 스크립트가 SDK 를 **HTML 도착 직후** 출발시켜
  //   둔다(`window.__urKakaoMaps`). 그걸 이어받는다 — 앱 부팅·지도 청크를 기다린 뒤 출발하면
  //   sdk.js → kakao.js → 타일이 그 뒤로 줄줄이 밀려 실사용자 LCP p75 가 10초였다.
  //   실패하면 그 스크립트가 자기 <script> 를 지우고 거절하므로 아래 정상 경로로 다시 시도한다.
  const early = (window as unknown as { __urKakaoMaps?: Promise<void> }).__urKakaoMaps
  if (early) {
    delete (window as unknown as { __urKakaoMaps?: Promise<void> }).__urKakaoMaps
    kakaoMapsPromise = early.then(() => {}, () => {
      kakaoMapsPromise = null
      return ensureKakaoMaps()
    })
    return kakaoMapsPromise
  }

  kakaoMapsPromise = new Promise<void>((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error('VITE_KAKAO_JAVASCRIPT_KEY is not configured'))
      return
    }

    const w = window as any
    if (w.kakao?.maps?.Map) {
      resolve()
      return
    }

    const src = KAKAO_MAPS_SDK_SRC(KAKAO_JS_KEY)
    const existing = document.querySelector(`script[src^="https://dapi.kakao.com/v2/maps/sdk.js"]`) as HTMLScriptElement | null
    const script = existing || document.createElement('script')
    if (!existing) script.src = src

    const onLoad = () => {
      if (w.kakao?.maps) {
        w.kakao.maps.load(() => resolve())
      } else {
        kakaoMapsPromise = null
        reject(new Error('Kakao Maps SDK missing after load'))
      }
    }
    const onError = () => {
      kakaoMapsPromise = null
      reject(new Error('Kakao Maps SDK load failed'))
    }

    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)

    if (!existing) document.head.appendChild(script)
    else if (w.kakao?.maps) onLoad()
  })

  return kakaoMapsPromise
}

export const KAKAO_JAVASCRIPT_KEY = KAKAO_JS_KEY
