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

export type DealCategory = 'all' | 'meal_voucher' | 'beauty_voucher' | 'stay_voucher' | 'etc_voucher'

/** 홈 카테고리 탭의 키·라벨(표시 순서 그대로). */
export const DEAL_CAT_LABELS: ReadonlyArray<{ key: DealCategory; label: string }> = [
  { key: 'all',            label: '전체' },
  { key: 'meal_voucher',   label: '식사' },
  { key: 'beauty_voucher', label: '미용' },
  { key: 'stay_voucher',   label: '숙소' },
  { key: 'etc_voucher',    label: '기타' },
]
