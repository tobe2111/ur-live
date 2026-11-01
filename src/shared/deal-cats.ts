/**
 * 🏷️ 동네딜 카테고리 라벨 **SSOT**(순수 — 아이콘 없음).
 *
 * ## 왜 떼냈나
 * 원래 `pages/pc-home/PcHomeRail.tsx` 의 `DEAL_CATS` 가 라벨과 아이콘을 함께 들고 있었다.
 * 그 파일은 `lucide-react` 를 import 하므로 **워커가 못 읽는다** — 읽으면 lucide 가 통째로
 * `_worker.js` 로 따라 들어온다. 워커 번들은 gzip **1,032,000B 게이트**(main.yml)에 여유가
 * 40KB 뿐이고, 이 게이트는 이미 한 번 배포를 깨뜨린 자리다(#533 → #537 응급 다이어트).
 *
 * ⇒ 홈 첫 화면을 **서버가 그릴 때** 카테고리 줄을 같은 라벨로 그려야 하므로(갈리면 마운트 때
 *   그 줄의 글자가 바뀐다) 라벨만 이 순수 모듈로 내린다. 아이콘은 `PcHomeRail` 에 남는다.
 *
 * ⚠️ 라벨·순서를 바꿀 때는 **여기만** 바꾼다. `PcHomeRail.DEAL_CATS` 가 이 표를 읽어 아이콘을
 *   붙이고, 워커(`home-first-screen.ts`)가 같은 표로 첫 화면을 그린다.
 */

export type DealCategory = 'all' | 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'home_voucher' | 'etc_voucher'

/** 홈 카테고리 탭의 키·라벨(표시 순서 그대로). */
export const DEAL_CAT_LABELS: ReadonlyArray<{ key: DealCategory; label: string }> = [
  { key: 'all',            label: '전체' },
  { key: 'meal_voucher',   label: '식사' },
  { key: 'beauty_voucher', label: '미용' },
  { key: 'stay_voucher',   label: '숙소' },
  { key: 'home_voucher',   label: '생활' },
  { key: 'etc_voucher',    label: '기타' },
]

/**
 * 🏠 2026-10-31 (대표 "생활 카테고리의 이용권들은 메인에서는 안보이게 해줘").
 *
 * 생활(`home_voucher` — 이사·청소 같은 방문 서비스)은 **메인(홈)** 의 탭·피드·섹션 어디에도 안 뜬다.
 * 생활 이용권이 사라지는 것은 아니다 — 생활 서비스 페이지(`/life`, 견적 + 생활 이용권)와 지도·검색에는 그대로 있다.
 * PC 상단 네비의 '생활' 버튼도 홈 필터가 아니라 `/life` 로 가므로 그대로 둔다(`DEAL_CAT_LABELS` 전체를 쓴다).
 *
 * ⚠️ 홈의 탭·카드는 **이 두 값만** 읽는다 — 화면(모바일·PC)과 워커 첫 화면이 같은 값을 써야
 *   마운트 때 탭 줄이 바뀌거나 첫 카드가 갈아끼워지지 않는다.
 */
export const HOME_HIDDEN_CATEGORIES: ReadonlySet<string> = new Set(['home_voucher'])

/** 홈(메인) 카테고리 탭 — 생활 제외. */
export const HOME_DEAL_CAT_LABELS = DEAL_CAT_LABELS.filter(c => !HOME_HIDDEN_CATEGORIES.has(c.key))

/** 홈 피드·섹션에 그려도 되는 상품인가(생활 이용권이면 false). */
export function isHomeVisibleProduct(p: { category?: string | null } | null | undefined): boolean {
  return !HOME_HIDDEN_CATEGORIES.has(String(p?.category ?? ''))
}
