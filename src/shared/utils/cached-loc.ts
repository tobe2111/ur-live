/**
 * 📍 마지막 측위 캐시 — **홈·상세·지도가 같이 읽는 SSOT**.
 *
 * 원래 이 둘은 `pages/group-buy/detail-derived.ts` 에 있었는데, 2026-09-05 에 홈이
 * 기본 정렬을 '가까운 순'으로 바꾸며 그걸 import 하자 **상세 페이지 모듈이 홈 첫 페인트
 * 청크로 딸려 왔다**(`home-chunk-diet` 가드가 잡았다 — app-components·app-features 를
 * 통째로 끌고 온다). 위치 캐시는 어느 화면의 것도 아니므로 공용 자리로 옮긴다.
 * `detail-derived` 는 재수출만 남겨 기존 호출부를 안 건드린다.
 *
 * 🔑 **위치를 새로 묻지 않는다.** 지도 홈·위치바가 저장해 둔 값만 읽는다 — 화면을 열었다고
 *   권한 팝업을 띄우는 건 과하고, 없으면 그 기능(거리 표시·거리순)을 조용히 접는다.
 */

/** 지도 홈(`RestaurantMapPage`)·위치바가 쓰는 것과 **같은 키**여야 한다. */
import { nearKeyOf, writeNearCookie } from '@/shared/home-near'

export const LAST_LOC_KEY = 'ur_last_loc_v1'

/**
 * 📍 마지막 측위를 저장한다 — localStorage **와 위치 쿠키를 함께** (2026-10-13 대표 *"여긴 왜이리 로딩 길어?"*).
 *   쿠키(`ur_loc`)는 워커가 홈 하드로드에서 **그 동네 섹션을 미리 받아** 첫 화면에 싣는 단서다. 종전엔 홈에
 *   들어간 **뒤에야** 쿠키를 맞춰서, 지도에서 위치를 잡고 홈을 새로 열면 서버는 '위치 없음' 섹션을 보냈고
 *   화면은 그걸 버리고 회색 자리만 띄운 채 동네 섹션을 다시 받았다(라이브 재현). 저장하는 순간 쿠키도 맞춘다.
 *   ⚠️ 라벨은 모르므로 건드리지 않는다(`null`) — 같은 격자면 기존 동네 이름이 맞다.
 */
export function rememberLoc(loc: { lat: number; lng: number }): void {
  try { localStorage.setItem(LAST_LOC_KEY, JSON.stringify(loc)) } catch { /* quota */ }
  markHomePick('loc')
  writeNearCookie(nearKeyOf(loc), null)
}

export function readCachedLoc(): { lat: number; lng: number } | null {
  try {
    const c = JSON.parse(localStorage.getItem(LAST_LOC_KEY) || 'null')
    return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? { lat: c.lat as number, lng: c.lng as number } : null
  } catch {
    return null
  }
}

/**
 * 🧭 2026-10-31 (대표 "메인에서 지역을 선택하고 이용권 상세를 보고 뒤로가기를 하면 지역 선택하기 전 메인페이지가 나오네"):
 * 홈은 다시 열릴 때 **마지막 측위가 있으면 저장된 지역을 무시**했다(2026-09-08 규칙). 그런데 지역을 고르는 순간
 * 측위를 지우지 않으니, 지역을 골라 상세에 다녀오면 옛 측위가 다시 이겨 지역이 풀렸다.
 * ⇒ 사람이 **마지막에 고른 쪽**을 적어 두고 그쪽을 따른다. 측위를 잡으면 'loc', 지역을 고르면 'region'.
 */
export const HOME_PICK_KEY = 'ur_home_pick_v1'
export function markHomePick(kind: 'loc' | 'region'): void {
  try { localStorage.setItem(HOME_PICK_KEY, kind) } catch { /* ignore */ }
}
export function readHomePick(): 'loc' | 'region' | null {
  try { const v = localStorage.getItem(HOME_PICK_KEY); return v === 'loc' || v === 'region' ? v : null } catch { return null }
}
