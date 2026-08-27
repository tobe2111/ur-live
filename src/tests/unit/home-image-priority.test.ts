/**
 * 🖼️ 홈 첫 화면 이미지 우선순위 (2026-08-22 라이브 실측)
 *
 * `GroupBuyFeedCard` 의 `aboveFold` 는 **eager + fetchPriority=high** 를 켠다(잠긴 계약).
 * 그 계약 자체는 옳지만, **어디에 붙이느냐**가 틀려 있었다.
 *
 * 라이브 실측(모바일 390×844 / PC 1920×1080, 브라우저):
 * ```
 *  205px  "지금 인기 이용권"   → 259·516px  EAGER 👁   ← HomeSections, 올바름
 *  823px  "주말에 떠나는 숙소"  → 877·1154px lazy       ← 올바름
 * 1468px  "가까운 동네 딜"      → 1605·1930px EAGER ❌  ← GroupBuyFeed, 화면 밖인데 high
 * ```
 * 홈에서 `GroupBuyFeed` 는 [히어로 → 편성 섹션 2개] **아래 세 번째 블록**이라 첫 행이 늘 접힘
 * 밖인데, 위치와 무관하게 앞 4장을 최우선으로 받았다. 낭비일 뿐 아니라 `fetchPriority=high` 라
 * **진짜 첫 화면 이미지와 대역폭을 다퉜다**(레티나 PC 기준 약 240KB).
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 픽셀 위치. 레이아웃을 바꿔 피드가 위로 올라오면 이 가드는
 *    초록인 채로 `firstScreen={false}` 가 틀린 값이 된다 — 그때는 브라우저로 다시 재야 한다
 *    (인계 문서에 측정 스크립트가 있다). 여기서 고정하는 것은 **배선**뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HOME_CARD_ABOVE_FOLD } from '@/shared/home-card-image'

const read = (p: string) => readFileSync(p, 'utf-8')
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const MOBILE = 'src/pages/mobile-home/MobileHomePage.tsx'
const PC = 'src/pages/pc-home/PcHomePage.tsx'
const SECTIONS = 'src/components/home/HomeSections.tsx'

/** 주석을 제거한 코드만 — 설명 주석이 판정을 통과시키는 함정을 피한다(오늘 실제로 겪었다). */
const code = (s: string) =>
  s.replace(/\/\*\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('피드의 eager 4장은 피드가 첫 화면일 때만', () => {
  it('GroupBuyFeed 가 firstScreen 으로 aboveFold 를 게이트한다', () => {
    const s = code(read(FEED))
    expect(s, 'firstScreen 게이트가 사라졌다 — 화면 밖 4장이 다시 최우선으로 받아진다').toContain(
      'aboveFold={firstScreen && idx < 4}',
    )
    expect(s).toMatch(/firstScreen\s*=\s*true/)   // 기본값 = 기존 동작(다른 호출부 불변)
    expect(s).toMatch(/firstScreen\?:\s*boolean/)
  })

  it('홈 두 곳이 firstScreen={false} 를 넘긴다 (피드가 세 번째 블록이라서)', () => {
    for (const p of [MOBILE, PC]) {
      const s = code(read(p))
      const i = s.indexOf('<GroupBuyFeed')
      expect(i, `${p} 에 GroupBuyFeed 가 없다 — 홈 구조가 바뀌었다면 실측부터`).toBeGreaterThan(-1)
      expect(s.slice(i, i + 400), `${p} 가 firstScreen={false} 를 안 넘긴다`).toContain('firstScreen={false}')
    }
  })

  it('편성 섹션의 aboveFold 는 그대로 — 실측상 첫 섹션은 화면 안이다', () => {
    // ⚠️ 이쪽을 "같이 끄는" 과잉 수정을 막는다. 259·516px 로 실제 화면 안이고,
    //    끄면 진짜 LCP 이미지가 우선순위를 잃는다.
    // 🔁 2026-08-27: 개수가 리터럴 4 → `HOME_CARD_ABOVE_FOLD` 상수가 됐다(워커의 카드 preload 가
    //   **같은 수**만 당겨야 해서 SSOT 로 뺐다). 지키는 값은 그대로 — 첫 섹션 4장은 eager 다.
    expect(code(read(SECTIONS))).toContain('aboveFold={i < HOME_CARD_ABOVE_FOLD && sIdx === 0}')
    expect(HOME_CARD_ABOVE_FOLD).toBe(4)
  })
})
