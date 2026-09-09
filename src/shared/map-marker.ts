/**
 * 🗺️ **지도 마커 규칙 SSOT** — 무게 3단계 + 할인 강조 임계값 + 이름 라벨 솎아내기.
 *
 * ## 왜 생겼나 (2026-09-09 대표 확정 "안 D4로 하자")
 * 시안 `docs/design/map-marker-declutter-2026-09.md`. 지도가 정신없던 실체는 핀 개수가 아니라
 * **열여덟 개가 전부 같은 무게로 "나 중요해"라고 말하는 것**이었다. 마커 하나가 정보 3겹
 * (사진·가격·카운트) + 장식 4겹(흰 테두리·그림자·배지 테두리·배지 그림자)을 이고 있었다.
 *
 * ## 무게는 셋뿐이다
 * `selected`(크고 진하고 꼬리) · `seen`(이미 본 것 — 회색) · `highlight`/`normal`.
 * ⚠️ **`seen` 이 `highlight` 를 이긴다.** 이미 본 것을 할인 때문에 다시 띄우면 3단계 무게가
 * 무너져 "무엇이 새 것인가"를 못 읽는다.
 *
 * ## 할인 강조를 왜 임계값으로 하나 (실측이 방향을 바꿨다)
 * 2026-09-09 라이브 실측 — 활성 이용권 50건 중 **할인 0% 가 한 건도 없다**
 * (10~19% 20건 · 20~29% 21건 · 30%+ 9건). 그래서 할인율을 전부 띄우면 "여기 다 세일 중"이라는
 * 배경음이 되고 정작 싼 곳이 묻힌다. 임계값 위만 다른 무게로 띄우면 화면에 두세 개가 떠서
 * 지도가 **"여기가 진짜 싸다"** 를 말할 수 있다.
 *
 * ⚠️ 이 값은 라인업이 바뀌면 같이 바뀌어야 한다 — 지금은 상수지만 **소비자 설정 채널이 생기면
 *   `platform_settings` 로 옮길 자리**다. 지도는 오늘 설정을 안 받아오고, 숫자 하나 때문에
 *   왕복을 하나 더 만드는 것은 이 레포의 로딩 규칙에 어긋난다(그래서 v1 은 상수).
 */

/** 이 % 이상이면 마커를 다른 무게로 띄운다. 실측 기준 50건 중 9건(화면엔 두세 개). */
export const MAP_HIGHLIGHT_DISCOUNT_PCT = 30

export type MapMarkerTier = 'selected' | 'seen' | 'highlight' | 'normal'

export interface MapMarkerTierInput {
  /** `priceDisplay().discount` — 화면 어디서나 같은 정의여야 한다(SSOT: shared/price-display). */
  discount: number
  isSelected: boolean
  /** 최근 본 이용권(localStorage `gb_recently_viewed_v1`). */
  isSeen: boolean
}

export function mapMarkerTier({ discount, isSelected, isSeen }: MapMarkerTierInput): MapMarkerTier {
  if (isSelected) return 'selected'
  // 🔴 순서 고정: seen 이 highlight 보다 먼저다. 뒤집으면 이미 본 것이 할인 때문에 되살아나
  //    "무엇이 새 것인가"를 못 읽는다(무게 3단계가 무너진다).
  if (isSeen) return 'seen'
  return discount >= MAP_HIGHLIGHT_DISCOUNT_PCT ? 'highlight' : 'normal'
}

/**
 * 이름 라벨을 붙일지 — **겹치면 안 붙인다.**
 *
 * N1 의 실제 구현 비용이 여기다(시안에서도 이름이 이웃 마커를 침범한 자리가 보였다).
 * 네이버는 줌 레벨별로 라벨을 솎아내는데, 우리는 이미 **격자 클러스터링**이 있어 그 격자를 그대로
 * 쓴다: 개별 핀은 정의상 자기 칸에 혼자다(둘 이상이면 클러스터 버블로 접힌다). 그러니 남은 위험은
 * **옆 칸의 핀**뿐이고, 8-이웃 칸이 비어 있을 때만 이름을 준다.
 *
 * `gridSize === 0`(최대 줌)이면 격자가 없다 — 그땐 핀이 몇 안 되고 서로 멀어 전부 이름을 준다.
 */
export function shouldShowMarkerLabel(cellKey: string | null, occupiedCells: Set<string>): boolean {
  if (!cellKey) return true // 격자 없음(최대 줌)
  const [gxs, gys] = cellKey.split('_')
  const gx = Number(gxs), gy = Number(gys)
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return true
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue
      if (occupiedCells.has(`${gx + dx}_${gy + dy}`)) return false
    }
  }
  return true
}
