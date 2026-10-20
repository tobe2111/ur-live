/**
 * 🚰 '사이트 없는 리드'의 슬롯 상한 — 수율 0인 99%가 수율 있는 1%의 예산을 먹지 않게.
 *
 * ## 실측 근거 (2026-07-29, 파트너풀 148,479건 백로그)
 * ```
 *   온라인판매 133,161 · 사이트 보유  0.0%   ← 크롤 대상이 아예 없다
 *   전문서비스  12,384 · 사이트 보유  4.5%
 *   대행사       1,372 · 사이트 보유 40.0%
 *   ⇒ 즉시 크롤 가능 ≈ 1,315건(0.9%) / 사이트 없음 ≈ 147,164건(99.1%)
 * ```
 * 결정적: 연락처가 있는 온라인판매 리드는 **100% `contact_source='commerce'`**(원부가 준 것).
 * 크롤로 연락처를 얻은 온라인판매 리드는 한 건도 없다.
 *
 * ⚠️ 이 테스트가 **못 보는 것**: 상한값 0.5 가 옳은지. 그건 라이브의 출처별 발견 수율
 *    (`ns_src_*` 대비 `nsok_*`)이 쌓여야 답이 나온다 — 그래서 배제가 아니라 상한으로 두었다.
 *    13만 건을 추측으로 버리지 않기 위한 설계다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { noSiteSlotCap, NO_SITE_SLOT_SHARE } from '@/features/marketing/api/enrich-lane'

describe('noSiteSlotCap — 상한이지 배제가 아니다', () => {
  it('대상의 절반까지', () => {
    expect(noSiteSlotCap(120)).toBe(60)
    expect(noSiteSlotCap(400)).toBe(200)
  })
  it('대상이 아주 적어도 최소 1건은 보장 — 탐색이 완전히 멈추면 수율을 영영 못 잰다', () => {
    expect(noSiteSlotCap(1)).toBe(1)
    expect(noSiteSlotCap(3)).toBe(1)
  })
  it('대상이 없으면 0', () => {
    expect(noSiteSlotCap(0)).toBe(0)
    expect(noSiteSlotCap(-5)).toBe(0)
  })
  it('share 는 0~1 로 클램프 · 이상값에 throw 하지 않는다', () => {
    expect(noSiteSlotCap(100, 5)).toBe(100)
    expect(noSiteSlotCap(100, -1)).toBe(1)   // 최소 보장이 우선
    expect(noSiteSlotCap(100, NaN)).toBe(Math.floor(100 * NO_SITE_SLOT_SHARE))
    expect(noSiteSlotCap(NaN as unknown as number)).toBe(0)
  })
})

describe('🚧 배선 — 순수함수만 고치면 라이브는 그대로다', () => {
  const src = readFileSync('src/features/marketing/api/enrich-lane.ts', 'utf8')

  it('루프가 상한을 실제로 적용한다(초과분은 건너뛰고 건수를 남긴다)', () => {
    expect(src).toMatch(/const noSiteCap = noSiteSlotCap\(targets\.length\)/)
    // ⚠️ 루프 형태에 따라 중단 구문이 다르다 — for 루프면 `continue`, 동시 처리(`handleLead` 함수)면 `return`.
    //    2026-07-29 에 실제로 for → 동시 처리로 바뀌면서 이 검사가 깨졌다. 고정할 것은 구문이 아니라
    //    **"상한에 닿으면 그 리드를 건너뛰고 건수를 남긴다"** 는 의미다.
    expect(src).toMatch(/if \(noSiteUsed >= noSiteCap\) \{ bump\('no_site_capped'\); (continue|return) \}/)
    expect(src).toMatch(/noSiteUsed\+\+/)   // 세지 않으면 상한은 영원히 안 걸린다
  })

  it('출처별 발견 수율을 시도·성공 **양쪽** 센다 — 한쪽만 세면 비율을 못 만든다', () => {
    expect(src).toMatch(/bump\(`ns_src_\$\{t\.source/)   // 시도
    expect(src).toMatch(/bump\(`nsok_\$\{t\.source/)      // 성공
  })

  it('상한은 사이트 **없는** 리드에만 걸린다 — 크롤 가능분을 막으면 정반대가 된다', () => {
    const block = /if \(!site\) \{[\s\S]{0,600}?\n    \}/.exec(src)?.[0] || ''
    expect(block).toContain('noSiteUsed >= noSiteCap')
    expect(block.length).toBeGreaterThan(100)  // 블록을 못 찾으면 검사가 헛도는 것이다
  })
})
