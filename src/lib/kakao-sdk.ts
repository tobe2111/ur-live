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
 * Kakao Maps SDK를 로드 (지도 전용 — 별도 스크립트)
 */
export function ensureKakaoMaps(): Promise<void> {
  if (kakaoMapsPromise) return kakaoMapsPromise

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
