import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
// @ts-expect-error — 순수 .mjs 모듈(타입 선언 없음)
import { fixWeights, fixSource, sourceViolations, fixWeightNum } from '../../../scripts/codemods/weight-scale.mjs'

/**
 * 🏋️ **글자 굵기 체계 — 400 · 500 · 700 (+ 디스플레이 800)** (2026-10-25 대표 *"굵기, 크기 등의
 *   전반적인 것들이 투박함이 남아있는 것 같아"* → 다른 서비스 화면 넷 비교 → *"체계적으로 하자"*).
 *
 * 규칙 SSOT 는 `scripts/codemods/weight-scale.mjs` 머리말(CLAUDE.md 🎫 ⑨). 이 시험은 셋을 본다:
 *  ① 변환 규칙이 의도대로 움직이는가 (진짜 함수를 돌린다)
 *  ② 이행을 마친 화면(교환권·이용권 상세)이 정본 밖 굵기를 0 으로 유지하는가
 *  ③ 나머지 소비자 화면의 정본 밖 굵기가 **늘지 않는가**(래칫 — 줄이면 기준을 내린다)
 *
 * ⚠️ 이 시험이 못 막는 것: 크기를 부모에서 상속받는 자리(같은 문자열에 크기가 없으면 판정을 못 한다) ·
 *   굵기가 *맞는 자리*인지(15px 설명을 bold 로 둬도 통과) — 그건 그려서 봐야 한다.
 */

/** 이행을 마친 화면의 파일들 — 여기는 정본 밖 굵기가 0 이어야 한다. */
const DONE = [
  'src/pages/VouchersPage.tsx',
  'src/pages/GroupBuyDetailPage.tsx',
  'src/shared/voucher-tile.ts',
  'src/shared/pass-head.ts',
  'src/worker/utils/vouchers-first-screen.ts',
  'src/worker/utils/detail-ssr-body.ts',
  'src/components/home/HomeBannerStrip.tsx',
  'src/features/group-buy/FcfsApplyBlock.tsx',
  'src/components/ui/sort-menu.tsx',
  ...execSync("git ls-files 'src/pages/vouchers/*.tsx' 'src/pages/group-buy/*.tsx'", { encoding: 'utf8' }).trim().split('\n').filter(Boolean),
]

/** 나머지 소비자 화면의 정본 밖 굵기 — 2026-10-25 실측. 줄였으면 같은 커밋에서 내린다. */
const REST_BASELINE = 1343

const consumer = execSync(
  "git ls-files 'src/pages/*.tsx' 'src/pages/**/*.tsx' 'src/components/*.tsx' 'src/components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean)
  .filter((f) => !/(admin|seller|agency|wholesale|supplier|marketing|debug|design-variants|Admin|Seller|Agency|Wholesale|Supplier)/.test(f))

describe('① 변환 규칙', () => {
  it('semibold — 17px 이상은 bold, 그 아래는 medium', () => {
    expect(fixWeights('text-[17px] font-semibold')).toBe('text-[17px] font-bold')
    expect(fixWeights('text-[15px] font-semibold')).toBe('text-[15px] font-medium')
    expect(fixWeights('font-semibold')).toBe('font-medium')
  })
  it('extrabold·black — 디스플레이(28+)만 800, 작은 글자는 medium, 그 사이는 bold', () => {
    expect(fixWeights('text-[34px] font-black')).toBe('text-[34px] font-extrabold')
    expect(fixWeights('text-[15px] font-extrabold')).toBe('text-[15px] font-bold')
    expect(fixWeights('text-[12px] font-extrabold')).toBe('text-[12px] font-medium')
  })
  it('12·13px 의 bold 는 medium — 칩·배지도 예외가 없다', () => {
    expect(fixWeights('rounded-full bg-white text-[13px] font-bold')).toBe('rounded-full bg-white text-[13px] font-medium')
    expect(fixWeights('text-[15px] font-bold')).toBe('text-[15px] font-bold')
  })
  it('변형 접두사는 그 변형의 크기를 본다', () => {
    expect(fixWeights('text-[13px] lg:text-[17px] lg:font-semibold')).toBe('text-[13px] lg:text-[17px] lg:font-bold')
  })
  it('여러 줄 백틱 템플릿도 잡는다 (첫 판이 놓친 자리)', () => {
    const src = 'className={`h-9 text-[13px] font-bold ${\n  a ? \'x\' : \'y\'\n}`}'
    expect(fixSource(src)).toContain('text-[13px] font-medium')
  })
  it('인라인 style 의 fontWeight 도 같은 규칙', () => {
    expect(fixSource('style={{ fontSize: 14, fontWeight: 800 }}')).toBe('style={{ fontSize: 14, fontWeight: 700 }}')
    expect(fixSource('style={{ fontWeight: 700, fontSize: 12 }}')).toBe('style={{ fontWeight: 500, fontSize: 12 }}')
    expect(fixWeightNum(600, 17)).toBe(700)
  })
})

describe('② 이행을 마친 화면', () => {
  it('정본 밖 굵기 0', () => {
    expect(DONE.length).toBeGreaterThan(30)
    const bad = DONE.flatMap((f) => sourceViolations(readFileSync(f, 'utf8')).map((v: string) => `${f}: ${v}`))
    expect(bad).toEqual([])
  })
  it('교환권 타일 — 이름 줄은 medium, 가격 숫자만 bold', () => {
    const s = readFileSync('src/shared/voucher-tile.ts', 'utf8')
    // 2026-10-25 D안: 브랜드는 보조 정보(12px 보통 회색), 이름이 주인공(13px 잉크).
    expect(s).toMatch(/brand: '[^']*text-\[12px\] text-gray-500/)
    expect(s).toMatch(/title: '[^']*text-\[13px\][^']*text-gray-900/)
    expect(s).toMatch(/price: 'text-\[15px\] font-bold/)
  })
  it('옵션 카드 — 굵은 제목은 하나(옵션), 옵션 이름은 medium', () => {
    // 2026-10-25 D안: '이렇게 써요' 는 옵션 카드에서 빠졌다(아래 이용권 정보가 같은 말을 한다).
    const s = readFileSync('src/pages/group-buy/PassOptionCard.tsx', 'utf8')
    expect(s).toMatch(/text-\[17px\] font-bold[^>]*>옵션</)
    expect(s).toMatch(/text-\[15px\] font-medium leading-\[1\.4\]/)
  })
})

describe('③ 나머지 소비자 화면 — 늘지 않는다', () => {
  it(`정본 밖 굵기 ≤ ${REST_BASELINE}`, () => {
    const done = new Set(DONE)
    const rest = consumer.filter((f) => !done.has(f))
    expect(rest.length).toBeGreaterThan(300)
    let n = 0
    for (const f of rest) n += sourceViolations(readFileSync(f, 'utf8')).length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThanOrEqual(REST_BASELINE)
  })
})
