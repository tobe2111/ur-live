/**
 * 🗺️ 지도 미리 데우기 (2026-10-15 대표 *"지도 부분 다시 확인해봐 속도"*).
 *
 * 손님 대부분은 지도를 **홈의 지도 알약**으로 연다(SPA 이동 — 하단 탭엔 지도가 없다). 그 경로를 재니
 * (느린 4G·CPU 4배) 알약을 누른 뒤 [지도 화면 코드 ~1.0초 → sdk.js → kakao.js → services.js] 가
 * **줄줄이** 이어져 타일 요청이 3.0~3.2초에야 출발했다. 그 셋은 합쳐 ~38KB 인데 서로를 기다리느라
 * 2초를 먹는다(바이트가 아니라 왕복이 비용이다).
 *
 * ⇒ 홈이 다 뜬 뒤(`load` + 한가할 때) SDK 를 미리 받아 둔다. 알약을 누르면 지도 화면이
 *   `ensureKakaoMaps()` 의 **이미 풀린 약속**을 받아 곧바로 지도를 만든다.
 *
 * - `load` 뒤라 홈 첫 화면과 회선을 나눠 쓰지 않는다(`runAfterLoad` — 2026-10-12 센트리가 idle 만으로
 *   부팅 중에 끼어든 사고의 처방).
 * - 데이터 절약 모드면 안 받는다(지도를 안 열 사람에게 38KB 를 쓰게 하지 않는다).
 * - SDK 모듈은 **동적 import** — 홈 첫 화면 묶음에 카카오 SDK 청크를 싣지 않는다.
 * - 알약을 누르는 순간 타일 호스트에 미리 연결한다(DNS·TCP·TLS 를 지도 생성과 겹친다).
 *   ⚠️ crossorigin 을 붙이지 않는다 — 타일은 no-cors 이미지라 crossorigin 연결 풀을 안 쓴다
 *   (index.html 의 /map 이른 시작 스크립트와 같은 규칙).
 *
 * - 🆕 2026-10-15 (대표 2번 승인): **지도 화면 코드도** 미리 받는다 — 알약을 누른 뒤 ~1초가 그 청크였다.
 *   SDK 를 다 받은 **다음에** 받는다(같은 회선을 둘이 나눠 쓰지 않게). 홈에서 `import()` 를 직접 쓰지 않고
 *   App.tsx 가 등록한 로더를 이름으로 부른다(`lib/route-preload` — 묶음기 봉투가 안 바뀐다).
 *   누르는 순간에도 한 번 더 부른다(한가할 때가 아직 안 왔으면 거기서 출발 — 한 번만 받는다).
 */
import { runAfterLoad } from '@/lib/after-load'
import { preloadRoute } from '@/lib/route-preload'

const TILE_HOST = 'https://mts.kakaocdn.net'

function saveData(): boolean {
  const c = (navigator as { connection?: { saveData?: boolean } }).connection
  return !!c?.saveData
}

/** 홈이 다 뜬 뒤 카카오 지도 SDK 를 미리 받는다. 취소 함수를 돌려준다. */
export function warmKakaoMapsAfterLoad(): () => void {
  return runAfterLoad(() => {
    if (saveData()) return
    import('@/lib/kakao-sdk').then((m) => m.ensureKakaoMaps())
      .catch(() => { /* 지도 화면이 다시 시도한다 */ })
      .then(() => preloadRoute('map'))
  }, 4000)
}

let preconnected = false
/** 지도로 가기 직전(누르는 순간) 지도 화면 코드를 받기 시작하고, 타일 호스트에 연결을 미리 연다. 한 번만. */
export function preconnectMapTiles(): void {
  preloadRoute('map')
  if (preconnected || typeof document === 'undefined') return
  preconnected = true
  try {
    const l = document.createElement('link')
    l.rel = 'preconnect'
    l.href = TILE_HOST
    document.head.appendChild(l)
  } catch { /* 연결 힌트 실패는 지도를 막지 않는다 */ }
}
