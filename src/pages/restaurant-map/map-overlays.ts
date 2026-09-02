import { escapeHtml } from '@/shared/utils/html'
import { formatNumber } from '@/utils/format'
import { cfImage } from '@/utils/cf-image'
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

/** 사진+카운트+최저가 버블(서버 집계/로컬 클러스터 공용 비주얼). */
function bubbleHtml(thumbUrl: string, minPrice: number, count: number, photoClass: string): string {
  return `
    <div style="position:relative;width:64px;height:64px;transform:translate(-50%,-50%);cursor:pointer;">
      <div style="width:100%;height:100%;border-radius:16px;overflow:hidden;border:2.5px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,0.28);position:relative;background:${PIN_FALLBACK_BG};">
        ${thumbUrl ? `<img class="${photoClass}" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />` : ''}
        <span style="position:absolute;left:0;right:0;bottom:0;background:rgba(17,24,39,0.72);color:#fff;font-size:9.5px;font-weight:700;text-align:center;padding:3px 0;">${formatNumber(minPrice || 0)}원~</span>
      </div>
      <span style="position:absolute;top:-7px;right:-7px;background:#1C69EF;color:#fff;border:2px solid #fff;border-radius:999px;min-width:23px;height:23px;padding:0 5px;font-size:11.5px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.22);">${count}</span>
    </div>
  `
}

/** img 로드 실패 시 제거 → 뒤 중립 회색 바탕이 보인다 (CSP 로 inline onerror 불가 → addEventListener). */
function wireImgFallback(root: HTMLElement, selector: string) {
  const img = root.querySelector(selector)
  if (img) img.addEventListener('error', () => img.remove())
}

/** 🌍 줌아웃 서버 집계 버블. */
export function buildAggContent(sc: ServerCluster): HTMLElement {
  const thumb = sc.image_url ? cfImage(sc.image_url, { width: 132, height: 132, fit: 'cover', format: 'auto' }) : ''
  const el = document.createElement('div')
  el.innerHTML = bubbleHtml(thumb, sc.min_price, sc.count, 'ur-agg-photo')
  wireImgFallback(el, 'img.ur-agg-photo')
  return el
}

/** 로컬 그리드 클러스터 버블 — 대표 딜 실사진 + 카운트 + 최저가(Airbnb식, 2026-07-08 시안 ③). */
export function buildClusterContent(items: Restaurant[], minPrice: number): HTMLElement {
  const rep = items.find(x => x.image_url) || items[0]
  const thumb = rep?.image_url ? cfImage(rep.image_url, { width: 132, height: 132, fit: 'cover', format: 'auto' }) : ''
  const el = document.createElement('div')
  el.innerHTML = bubbleHtml(thumb, minPrice, items.length, 'ur-cluster-photo')
  wireImgFallback(el, 'img.ur-cluster-photo')
  return el
}

/** 딜 핀 — 상품 사진 원형 + 잉크 링(선택·라이브 = 블루) + 모서리 배지. */
export function buildPinContent(r: Restaurant, opts: {
  isLive: boolean
  isFav: boolean
  isSelected: boolean
  groupSize: number
}): HTMLElement {
  const { isLive, isFav, isSelected, groupSize } = opts
  const hasDiscount = r.original_price > r.price
  const cornerBadge = isLive
    ? `<span style="position:absolute;top:-4px;right:-4px;background:#1C69EF;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;animation:live-pulse 1.2s infinite;">●</span>`
    : hasDiscount
    ? `<span style="position:absolute;top:-6px;right:-8px;background:#1C69EF;color:#fff;border-radius:8px;padding:1px 4px;font-size:9px;font-weight:800;line-height:1.2;">-${Math.round((1 - r.price / r.original_price) * 100)}%</span>`
    : isFav
    ? `<span style="position:absolute;top:-3px;right:-3px;color:#1C69EF;font-size:11px;line-height:1;">❤</span>`
    : groupSize > 1
    ? `<span style="position:absolute;top:-4px;right:-6px;background:#374151;color:#fff;border-radius:9px;padding:0 4px;font-size:9px;font-weight:800;line-height:1.4;">+${groupSize - 1}</span>`
    : ''
  const ring = isLive || isSelected ? PIN_RING_BRAND : PIN_RING_INK
  const photoSize = isSelected ? 50 : 42
  const thumb = cfImage(r.image_url, { width: 96, height: 96, fit: 'cover', format: 'auto' })
  const el = document.createElement('div')
  el.innerHTML = `
    <div style="
      position: relative;
      width: ${photoSize}px;
      height: ${photoSize}px;
      border-radius: 50%;
      background: ${ring};
      padding: 3px;
      box-sizing: border-box;
      box-shadow: 0 4px 12px rgba(0,0,0,0.30)${isSelected ? ', 0 0 0 3px rgba(28,105,239,0.9)' : ''};
      cursor: pointer;
      transform: translate(-50%, -50%) scale(${isSelected ? 1.08 : 1});
      transition: transform 0.15s;
    ">
      <div style="
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        overflow: hidden;
        border: 2px solid #fff;
        box-sizing: border-box;
        background: ${PIN_FALLBACK_BG};
      ">
        ${thumb ? `<img class="ur-pin-photo" src="${escapeHtml(thumb)}" alt="" loading="lazy" style="position:relative;z-index:1;width:100%;height:100%;object-fit:cover;" />` : ''}
      </div>
      ${cornerBadge}
    </div>
  `
  wireImgFallback(el, 'img.ur-pin-photo')
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
