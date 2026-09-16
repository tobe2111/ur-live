import { escapeHtml } from '@/shared/utils/html'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
import { priceDisplay } from '@/shared/price-display'
import { mapMarkerTier, type MapMarkerTier } from '@/shared/map-marker'
import { mapMarkerIconSvg } from '@/shared/map-marker-icons'
import type { Restaurant, KakaoPlace } from './types'
import type { ServerCluster } from './useKakaoMap'

/**
 * 🗺️ 2026-07-25 (전수조사 H3 동반): 지도 오버레이 DOM 빌더 모음 — useKakaoMap 에서 추출.
 *   useKakaoMap 은 [key → overlay] diff 재조정(전량 파괴·재생성 제거)에 집중하고,
 *   콘텐츠 마크업은 여기서. 비주얼/구조는 기존 initMap 인라인 HTML 과 byte-동일.
 *   클릭 핸들러는 훅 쪽에서 부착(빌더는 순수 DOM 생성만).
 */

/**
 * 🎫 2026-09-02 (대표 "B안으로 진행해줘"): 핀 링은 **잉크 하나**, 선택·라이브만 브랜드 블루.
 *   이전엔 카테고리별 핑크·에메랄드·바이올렛·앰버(2026-06-22 "흑백일 필요 없음")였는데, 지도 위 칩을
 *   블루 하나로 정리하자 핀이 다시 알록달록해 칩 정리가 무효가 됐다. 강조색은 하나, 자리는 선택뿐.
 *   이모지 폴백(🍽️💇🏨…)도 뺐다 — 사진이 없으면 중립 회색 원이다(표면 규칙 ⑥ 이모지 0).
 */
export const PIN_RING_INK = '#16181C'
export const PIN_RING_BRAND = '#1C69EF'
/** 사진 없는 핀·버블의 바탕 — 카드 안 회색 원(category-icons `CategoryTile` 라이트 원과 같은 값). */
const PIN_FALLBACK_BG = '#E4E6EE'

/**
 * 클러스터 알약 — `[아이콘] 12,600원~ [4]`.
 *
 * 🗺️ 2026-09-09 (대표 "안 D4로 하자"): 사진 버블을 걷어냈다. 종전엔 마커 하나가
 *   [사진 + 흰 테두리 + 그림자 + 가격 띠 + 파란 배지 + 배지의 흰 테두리 + 배지의 그림자] **7겹**이라,
 *   스무 개가 겹치면 사진은 "무엇인지"를 말하는 게 아니라 아무 말도 못 했다.
 *   개수는 **알약 안 잉크 칩**으로 흡수한다 — 떠 있는 배지는 자기 테두리·그림자를 또 갖는다.
 */
function bubbleHtml(category: string | null | undefined, minPrice: number, count: number): string {
  return `
    <div style="display:flex;align-items:center;gap:5px;background:#fff;border-radius:999px;padding:5px 6px 5px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.22);white-space:nowrap;cursor:pointer;font-family:inherit;">
      <span style="display:flex;color:#3d4350;">${mapMarkerIconSvg(category, 14)}</span>
      <span style="font-size:13px;font-weight:800;color:${PIN_RING_INK};letter-spacing:-0.02em;">${formatNumber(minPrice || 0)}원~</span>
      <span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:${PIN_RING_INK};color:#fff;font-size:10.5px;font-weight:800;">${count}</span>
    </div>
  `
}

/**
 * 🌍 줌아웃 서버 집계 알약.
 * ⚠️ 카테고리는 `null` — 서버 집계는 여러 카테고리를 한 점으로 뭉친 것이라 하나를 고르면
 *   그건 요약이 아니라 **거짓말**이다(폴백 티켓이 "여러 이용권"에 더 정직하다).
 */
export function buildAggContent(sc: ServerCluster): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = bubbleHtml(null, sc.min_price, sc.count)
  return el
}

/** 로컬 그리드 클러스터 알약 — 그 칸의 최저가 + 곳 수. 칸 안이 **한 카테고리일 때만** 그 아이콘. */
export function buildClusterContent(items: Restaurant[], minPrice: number): HTMLElement {
  const first = items[0]?.category
  const uniform = items.every(x => x.category === first)
  const el = document.createElement('div')
  el.innerHTML = bubbleHtml(uniform ? first : null, minPrice, items.length)
  return el
}

/** 무게 3단계 + 할인 강조의 **색·크기 한 벌**. 빌드와 선택-restyle 이 같은 값을 쓰게 하는 SSOT. */
export interface PinTierStyle {
  pillBg: string
  pillFg: string
  iconFg: string
  discountFg: string
  fontPx: number
  iconPx: number
  padding: string
  shadow: string
  labelFg: string
  /** 🔴 라벨을 `visibility:hidden` 으로 감추면 **자리를 차지해** 핀이 그만큼 위로 뜬다
   *  (yAnchor:1 이라 바닥이 좌표다) → seen 핀만 엉뚱한 자리를 가리킨다. 반드시 display 로 뺀다. */
  hideLabel: boolean
  showTail: boolean
}

export function pinTierStyle(tier: MapMarkerTier): PinTierStyle {
  if (tier === 'selected') {
    return { pillBg: PIN_RING_BRAND, pillFg: '#fff', iconFg: '#fff', discountFg: '#fff',
      fontPx: 15, iconPx: 15, padding: '7px 13px 7px 9px',
      shadow: '0 5px 15px rgba(28,105,239,0.45)', labelFg: PIN_RING_INK, hideLabel: false, showTail: true }
  }
  if (tier === 'seen') {
    // 이미 본 것 — 회색으로 물러난다. 이름 라벨도 빼서 "무엇이 새 것인가"만 남긴다.
    // ⚠️ 글자색은 물러나되 **읽을 수 있어야 한다** — #ECEEF0 위에서 4.3:1(종전 #9298A4 는 2.6:1 로
    //    2026-09-03 대표 신고 "글자가 안 보인다" 와 같은 클래스였다).
    return { pillBg: '#ECEEF0', pillFg: '#6B7280', iconFg: '#8A909C', discountFg: '#8A909C',
      fontPx: 12.5, iconPx: 13, padding: '4px 9px 4px 6px',
      shadow: '0 1px 3px rgba(0,0,0,0.12)', labelFg: '#8A909C', hideLabel: true, showTail: false }
  }
  if (tier === 'highlight') {
    // 🟡 D4 — 임계값(30%) 위만. 잉크 면 + 노란 퍼센트라 흰 알약 사이에서 **두세 개만** 튄다.
    return { pillBg: PIN_RING_INK, pillFg: '#fff', iconFg: '#fff', discountFg: '#FFD34D',
      fontPx: 12.5, iconPx: 13, padding: '4px 9px 4px 6px',
      shadow: '0 3px 10px rgba(0,0,0,0.32)', labelFg: '#2A2F38', hideLabel: false, showTail: false }
  }
  return { pillBg: '#fff', pillFg: PIN_RING_INK, iconFg: '#3D4350', discountFg: PIN_RING_INK,
    fontPx: 12.5, iconPx: 13, padding: '4px 9px 4px 6px',
    shadow: '0 2px 7px rgba(0,0,0,0.22)', labelFg: '#3F454F', hideLabel: false, showTail: false }
}

/** 빌드와 restyle 이 **같은 함수**로 그린다 — 두 곳에 값을 적으면 반드시 갈린다(종전 코드가 그랬다). */
export function applyPinTierStyle(root: HTMLElement, tier: MapMarkerTier): void {
  const st = pinTierStyle(tier)
  const pill = root.querySelector('.ur-pin-pill') as HTMLElement | null
  const icon = root.querySelector('.ur-pin-ic') as HTMLElement | null
  const price = root.querySelector('.ur-pin-price') as HTMLElement | null
  const disc = root.querySelector('.ur-pin-disc') as HTMLElement | null
  const label = root.querySelector('.ur-pin-label') as HTMLElement | null
  const tail = root.querySelector('.ur-pin-tail') as HTMLElement | null
  if (pill) {
    pill.style.background = st.pillBg
    pill.style.padding = st.padding
    pill.style.boxShadow = st.shadow
  }
  if (icon) { icon.style.color = st.iconFg; icon.style.width = `${st.iconPx}px`; icon.style.height = `${st.iconPx}px` }
  if (price) { price.style.color = st.pillFg; price.style.fontSize = `${st.fontPx}px` }
  if (disc) disc.style.color = st.discountFg
  if (label) {
    label.style.color = st.labelFg
    label.style.display = st.hideLabel ? 'none' : 'block'
    label.style.fontSize = tier === 'selected' ? '11.5px' : '10.5px'
  }
  if (tail) {
    tail.style.display = st.showTail ? 'block' : 'none'
    tail.style.borderTopColor = st.pillBg
  }
}

/**
 * 🎯 딜 핀 — **안 N1 + D4** (2026-09-09 대표 확정 "안 D4로 하자").
 *
 * `[카테고리 아이콘] (할인율) 가격` 알약 + 아래 이름 라벨 + 선택 시 꼬리.
 * 사진·모서리 배지·링은 전부 없앴다 — 무엇인지는 **선택한 하나의 카드**가 크게 보여 준다.
 *
 * 시안·근거: `docs/design/map-marker-declutter-2026-09.md`.
 */
export function buildPinContent(r: Restaurant, opts: {
  isSelected: boolean
  isSeen: boolean
  showLabel: boolean
  isFav: boolean
  /** 같은 좌표에 겹친 딜 수(1 이면 혼자). */
  groupSize: number
}): HTMLElement {
  const { isSelected, isSeen, showLabel, isFav, groupSize } = opts
  const { price, discount } = priceDisplay(r)
  const tier = mapMarkerTier({ discount, isSelected, isSeen })
  const st = pinTierStyle(tier)
  // 할인율은 **임계값 위이거나 선택된 것**에만 — 전부 띄우면 다 세일 중이라 배경음이 된다(실측 근거는 SSOT 주석).
  const showDiscount = (tier === 'highlight' || tier === 'selected') && discount > 0
  const name = (r.restaurant_name || r.name || '').slice(0, 9)
  // ❤ 즐겨찾기 — 떠 있는 배지(자기 테두리·그림자를 또 갖는다) 대신 **알약 자신의 윤곽선**으로.
  //   선택은 브랜드 '면', 즐겨찾기는 브랜드 '선' 이라 한 화면에서 구분된다.
  const favOutline = isFav && !isSelected ? `outline:1.5px solid ${PIN_RING_BRAND};outline-offset:-1.5px;` : ''
  // 같은 좌표에 겹친 딜 수 — 클러스터 알약과 **같은 장치**(알약 안 칩)로. 떠 있는 '+N' 배지를 다시 만들지 않는다.
  const stackChip = groupSize > 1
    ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:${tier === 'normal' ? PIN_RING_INK : 'rgba(255,255,255,0.22)'};color:#fff;font-size:10px;font-weight:800;">${groupSize}</span>`
    : ''
  const el = document.createElement('div')
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;font-family:inherit;">
      <div class="ur-pin-pill" style="display:flex;align-items:center;gap:4px;background:${st.pillBg};border-radius:999px;padding:${st.padding};box-shadow:${st.shadow};white-space:nowrap;${favOutline}">
        <span class="ur-pin-ic" style="display:flex;align-items:center;justify-content:center;width:${st.iconPx}px;height:${st.iconPx}px;color:${st.iconFg};">${mapMarkerIconSvg(r.category, st.iconPx)}</span>
        ${showDiscount ? `<span class="ur-pin-disc" style="font-size:11px;font-weight:900;color:${st.discountFg};letter-spacing:-0.02em;">${discount}%</span>` : ''}
        <span class="ur-pin-price" style="font-size:${st.fontPx}px;font-weight:800;color:${st.pillFg};letter-spacing:-0.02em;">${formatNumber(price || 0)}</span>
        ${stackChip}
      </div>
      <div class="ur-pin-tail" style="display:${st.showTail ? 'block' : 'none'};width:0;height:0;border:6px solid transparent;border-top-color:${st.pillBg};margin-top:-1px;"></div>
      ${showLabel && name ? `<div class="ur-pin-label" style="margin-top:3px;font-size:10.5px;font-weight:700;color:${st.labelFg};display:${st.hideLabel ? 'none' : 'block'};white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 5px #fff;">${escapeHtml(name)}</div>` : ''}
    </div>
  `
  return el
}

/** 옵션 B — 카카오 일반 업체 회색 '+' 추천 라벨. */
export function buildPlaceContent(p: KakaoPlace): HTMLElement {
  const safeName = escapeHtml(p.place_name || '')
  const el = document.createElement('div')
  el.innerHTML = `
    <div style="
      background: rgba(255,255,255,0.92);
      color: #6b7280;
      border: 1.5px dashed #d1d5db;
      border-radius: 10px;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      cursor: pointer;
      transform: translateY(-50%);
    ">
      ${safeName}
      <span style="color:#9ca3af; margin-left:3px; font-size:9px;">+</span>
    </div>
  `
  return el
}

/** 내 위치 파란 점(GPS). */
export function buildMeContent(): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = `
    <div style="
      width: 18px; height: 18px; border-radius: 50%;
      background: #2563eb; border: 3px solid #fff;
      box-shadow: 0 0 0 4px rgba(37,99,235,0.25), 0 1px 4px rgba(0,0,0,0.3);
      transform: translate(-50%, -50%);
    "></div>
  `
  return el
}
