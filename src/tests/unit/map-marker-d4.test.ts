/**
 * 🗺️ 지도 마커 안 N1 + D4 계약 (2026-09-09 대표 확정 "안 D4로 하자")
 *
 * 시안·근거: `docs/design/map-marker-declutter-2026-09.md`
 * 실제 출력 증거: `docs/design/assets/map-marker-d4-actual-2026-09.png`
 *
 * ⚠️ **이 테스트가 못 막는 것**: 카카오 지도 위에서의 실제 겹침·가독성. 마커는 CustomOverlay 라
 *   유닛에서 지도를 못 띄운다. 라벨 솎아내기 규칙(순수함수)은 여기서 재지만, 그 규칙이 실제
 *   화면에서 충분한지는 **배포 후 눈으로** 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mapMarkerTier, shouldShowMarkerLabel, MAP_HIGHLIGHT_DISCOUNT_PCT } from '@/shared/map-marker'
import { mapMarkerIconSvg, MAP_ICON_INNER_FOR_TEST } from '@/shared/map-marker-icons'
import { buildPinContent, pinTierStyle, applyPinTierStyle } from '@/pages/restaurant-map/map-overlays'
import type { Restaurant } from '@/pages/restaurant-map/types'

const R = (o: Partial<Restaurant> = {}): Restaurant => ({
  id: 1, name: '', restaurant_name: '홍대돈까스', restaurant_address: '', restaurant_phone: '',
  restaurant_lat: 0, restaurant_lng: 0, price: 16500, original_price: 25000,
  image_url: '', rating: 0, category: 'meal_voucher', ...o,
} as Restaurant)
const OPTS = { isSelected: false, isSeen: false, showLabel: true, isFav: false, groupSize: 1 }

describe('① 무게 3단계 — 순서가 규칙이다', () => {
  it('선택이 모든 것을 이긴다', () => {
    expect(mapMarkerTier({ discount: 90, isSelected: true, isSeen: true })).toBe('selected')
  })
  it('🔴 이미 본 것이 할인 강조를 이긴다 (뒤집히면 "무엇이 새 것인가"를 못 읽는다)', () => {
    expect(mapMarkerTier({ discount: 99, isSelected: false, isSeen: true })).toBe('seen')
  })
  it('임계값 경계 — 딱 그 값이면 강조, 하나 아래면 아니다', () => {
    const at = MAP_HIGHLIGHT_DISCOUNT_PCT
    expect(mapMarkerTier({ discount: at, isSelected: false, isSeen: false })).toBe('highlight')
    expect(mapMarkerTier({ discount: at - 1, isSelected: false, isSeen: false })).toBe('normal')
  })
  it('임계값이 0 이면 전부 강조가 되어 D4 가 무의미해진다 — 하한을 지킨다', () => {
    expect(MAP_HIGHLIGHT_DISCOUNT_PCT).toBeGreaterThanOrEqual(20)
  })
})

describe('② 이름 라벨 솎아내기', () => {
  it('옆 칸(8-이웃)이 차 있으면 이름을 안 준다', () => {
    expect(shouldShowMarkerLabel('5_5', new Set(['5_5', '6_5']))).toBe(false)
    expect(shouldShowMarkerLabel('5_5', new Set(['5_5', '6_6']))).toBe(false) // 대각선도 이웃
  })
  it('혼자면 이름을 준다', () => {
    expect(shouldShowMarkerLabel('5_5', new Set(['5_5', '9_9']))).toBe(true)
  })
  it('격자가 없으면(최대 줌) 전부 준다', () => {
    expect(shouldShowMarkerLabel(null, new Set(['0_0']))).toBe(true)
  })
})

describe('③ 마커 DOM — 걷어낸 것이 돌아오지 않는다', () => {
  const html = (o: Partial<typeof OPTS> = {}) => buildPinContent(R(), { ...OPTS, ...o }).innerHTML
  it('사진(<img>)이 없다 — 마커에서 사진을 뺀 것이 이 시안의 요지다', () => {
    expect(html()).not.toContain('<img')
  })
  it('떠 있는 배지(absolute)가 없다 — 배지는 자기 테두리·그림자를 또 갖는다', () => {
    expect(html({ isFav: true, groupSize: 3 })).not.toContain('position:absolute')
  })
  it('가격이 있다', () => { expect(html()).toContain('16,500') })
  it('꼬리는 선택된 것에만 보인다', () => {
    expect(html({ isSelected: true })).toContain('border-top-color')
    expect(html({ isSelected: true })).toMatch(/ur-pin-tail[^>]*display:block/)
    expect(html()).toMatch(/ur-pin-tail[^>]*display:none/)
  })
})

describe('④ D4 — 할인율은 임계값 위·선택된 것에만', () => {
  it('34% 는 잉크 알약 + 퍼센트', () => {
    const h = buildPinContent(R(), OPTS).innerHTML
    expect(h).toContain('34%')
    expect(h).toContain(pinTierStyle('highlight').pillBg)
  })
  it('18% 는 퍼센트를 안 그린다 — 전부 띄우면 배경음이 된다', () => {
    const h = buildPinContent(R({ price: 28000, original_price: 34000 }), OPTS).innerHTML
    expect(h).toContain('28,000')
    expect(h).not.toContain('%<')
  })
  it('이미 본 것은 할인율을 안 그린다(seen 이 highlight 를 이긴다)', () => {
    expect(buildPinContent(R(), { ...OPTS, isSeen: true }).innerHTML).not.toContain('34%')
  })
})

describe('⑤ seen 라벨은 display 로 뺀다 (visibility 면 자리를 차지해 핀이 위로 뜬다)', () => {
  it('빌드 시', () => {
    const h = buildPinContent(R(), { ...OPTS, isSeen: true }).innerHTML
    expect(h).not.toContain('visibility:hidden')
    expect(h).toMatch(/ur-pin-label[^>]*display:none/)
  })
  it('restyle 시', () => {
    const el = buildPinContent(R(), OPTS)
    const root = el.firstElementChild as HTMLElement
    applyPinTierStyle(root, 'seen')
    const label = root.querySelector('.ur-pin-label') as HTMLElement
    expect(label.style.display).toBe('none')
    expect(label.style.visibility).not.toBe('hidden')
  })
  it('seen 글자는 물러나되 읽힌다 — 알약 배경과 대비 4:1 이상', () => {
    const st = pinTierStyle('seen')
    const lum = (hex: string) => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const a = lum(st.pillFg), b = lum(st.pillBg)
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    expect(ratio, `seen 대비 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4)
  })
})

/** jsdom 은 색을 rgb() 로 정규화해 돌려준다 — SSOT 의 hex 를 같은 모양으로 바꿔 비교한다. */
const toRgb = (hex: string) => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
  expect(n.every(Number.isFinite), `hex 파싱 실패: ${hex}`).toBe(true)
  return `rgb(${n[0]}, ${n[1]}, ${n[2]})`
}

describe('⑥ 빌드와 restyle 이 같은 값을 쓴다 (두 곳에 적으면 반드시 갈린다)', () => {
  // ⚠️ jsdom 은 style **속성 문자열**의 `background` 단축을 `.style.background` 로 못 읽는다(빈 문자열).
  //    그래서 빌드 쪽은 마크업 문자열로, restyle 쪽은 DOM 으로 각각 같은 SSOT 값과 대조한다.
  it('두 경로가 모두 pinTierStyle 의 값을 그대로 쓴다', () => {
    for (const tier of ['selected', 'seen', 'highlight', 'normal'] as const) {
      const st = pinTierStyle(tier)
      const root = buildPinContent(R(), OPTS).firstElementChild as HTMLElement
      applyPinTierStyle(root, tier)
      const pill = root.querySelector('.ur-pin-pill') as HTMLElement
      expect(pill.style.background, tier).toBe(toRgb(st.pillBg))
      expect(pill.style.boxShadow, tier).toBe(st.shadow)
      expect(pill.style.padding, tier).toBe(st.padding)
    }
    // 빌드 마크업도 같은 값을 쓴다(선택 알약 배경).
    const builtSel = buildPinContent(R(), { ...OPTS, isSelected: true }).innerHTML
    expect(builtSel).toContain(`background:${pinTierStyle('selected').pillBg}`)
    expect(builtSel).toContain(pinTierStyle('selected').padding)
  })
  it('useKakaoMap 은 스타일 값을 직접 안 적는다 — applyPinTierStyle 위임', () => {
    const s = readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8')
    expect(s).toContain('applyPinTierStyle')
    expect(s, 'restyle 이 다시 자기 숫자를 적기 시작했다').not.toMatch(/el\.style\.boxShadow\s*=/)
  })
  it('🔴 꼬리가 좌표를 가리키려면 yAnchor 가 1 이어야 한다(0.5 면 알약이 좌표 위에 얹힌다)', () => {
    const s = readFileSync('src/pages/restaurant-map/useKakaoMap.ts', 'utf8')
    const at = s.indexOf('content, yAnchor')
    expect(at, '핀 오버레이 생성부').toBeGreaterThan(0)
    expect(s.slice(at, at + 60)).toContain('yAnchor: 1')
  })
})

describe('⑦ 아이콘은 칩과 같은 그림이다 (거울)', () => {
  it('여기 path 는 urdeal-icons 안에 실제로 있다', () => {
    const icons = readFileSync('src/components/icons/urdeal-icons.tsx', 'utf8')
    const ds = Object.values(MAP_ICON_INNER_FOR_TEST)
      .flatMap(m => [...m.matchAll(/d="([^"]+)"/g)].map(x => x[1]))
    expect(ds.length, '검사 대상 0 이면 이 검사는 무의미하다').toBeGreaterThan(3)
    const missing = ds.filter(d => !icons.includes(d))
    expect(missing, `칩과 마커의 그림이 갈렸다: ${missing.join(' | ')}`).toEqual([])
  })
  it('모르는 카테고리는 그림을 지어내지 않고 기타로 떨어진다', () => {
    expect(mapMarkerIconSvg('없는카테고리', 13)).toBe(mapMarkerIconSvg('etc_voucher', 13))
  })
})

describe('⑧ 할인율 정의는 한 곳이다 — 지도 한 화면에 다섯 벌이 있었다', () => {
  /**
   * 🩸 2026-09-09: 마커만 SSOT 로 옮기고 끝낼 뻔했다. 실제로는 **같은 화면**에 계산이 다섯 벌이었다
   *   — 마커 · 목록 행 · 선택 카드 3종. 목록 행은 지도 바로 아래라, 마커가 34% 라고 한 상품이
   *   그 행에서 다른 숫자면 사용자가 두 값을 동시에 본다(선언값 > 계산값일 때 실제로 갈린다).
   */
  const SURFACES = [
    'src/pages/RestaurantMapPage.tsx',
    'src/pages/restaurant-map/RestaurantRow.tsx',
    'src/pages/restaurant-map/SelectedPeekCard.tsx',
    'src/pages/restaurant-map/SelectedDealCard.tsx',
    'src/pages/restaurant-map/SelectedDetailCard.tsx',
    'src/pages/restaurant-map/map-overlays.ts',
  ]
  it.each(SURFACES)('%s 가 SSOT 를 쓴다', (f) => {
    expect(readFileSync(f, 'utf8')).toContain('priceDisplay')
  })
  it.each(SURFACES)('%s 가 자체 계산식으로 되돌아가지 않는다', (f) => {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(src, '할인율을 다시 손으로 계산한다').not.toMatch(/1\s*-\s*\w+\.price\s*\/\s*\w+\.original_price/)
  })
})
