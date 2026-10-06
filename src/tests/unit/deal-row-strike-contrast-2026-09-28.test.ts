/**
 * 🩸 공용 줄(DealRow)의 **취소선 정가**가 읽히는가 — 색 이름이 아니라 **대비를 계산해서** 잰다
 *
 * ■ 왜 생겼나 (실측)
 *   2026-09-28 유어샵이 `DealRow` 로 옮겨 온 날, 배포 뒤 라이브(iPhone 13, `urdeal.kr/u/jiwon1228`)를
 *   재 보니 취소선 정가가 **다크 2.14:1 · 라이트 1.50:1** 이었다. 유어샵의 종전 카드
 *   (`GroupBuyFeedCard`, `text-gray-500 dark:text-gray-400`)는 같은 글자를 **5.04:1** 로 그렸으니
 *   그 화면에서는 후퇴였고, `DealRow` 를 쓰는 나머지 9개 화면은 원래부터 이 값이었다.
 *
 * ■ 왜 아무도 못 잡았나
 *   `check-dark-contrast` 는 목록 화면에서 **빈 껍데기**를 잰다(유어샵 8건 vs 실데이터 60건).
 *   상품이 없으면 가격 줄 자체가 안 그려지므로 이 글자는 **한 번도 측정된 적이 없다.**
 *   → 결재 `docs/decisions/2026-09-28-dark-contrast-guard-coverage.md`
 *
 * ■ 이 시험이 하는 일
 *   클래스 이름을 문자열로 대조하지 **않는다**(`gray-400` 이라고 적혀 있어도 스케일이 바뀌면 무의미).
 *   `tailwind.config.js` 의 INK 스케일에서 **실제 hex 를 읽어** WCAG 대비를 계산하고 3.0 을 요구한다.
 *   그래서 색 이름을 바꾸든 스케일을 바꾸든, **읽히지 않게 되는 순간** 빨간불이 된다.
 *
 * ■ 이 시험이 **못** 보는 것
 *   - 실제 렌더 결과(특이도 싸움·`light-island`·부모 배경 상속)는 못 본다 — 그건 브라우저만 안다.
 *   - `DealRow` 밖의 취소선(다른 부품)은 안 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ROW = readFileSync('src/components/deal/DealRow.tsx', 'utf-8')
const TW = readFileSync('tailwind.config.js', 'utf-8')

/** 카드 표면 — 디자인 시스템 SSOT 값(라이트 #FFFFFF · 다크 #1D1F29) */
const SURFACE_LIGHT = '#FFFFFF'
const SURFACE_DARK = '#1D1F29'
const MIN_RATIO = 3.0

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const lin = ch.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** tailwind.config.js 의 `const INK = { 50: '#…', … }` 에서 실제 hex 를 읽는다 */
function inkScale(): Record<string, string> {
  const m = TW.match(/const INK = \{([\s\S]*?)\}/)
  expect(m, 'tailwind.config.js 에서 INK 스케일을 못 찾았다 — 이 시험이 헛돈다').toBeTruthy()
  const out: Record<string, string> = {}
  for (const pair of m![1].matchAll(/(\d+):\s*'(#[0-9A-Fa-f]{6})'/g)) out[pair[1]] = pair[2]
  return out
}

/** DealRow 의 취소선 span 에서 `text-gray-N` / `dark:text-gray-M` 을 뽑는다 */
function strikeTokens(): { light: string; dark: string } {
  const line = ROW.split('\n').find((l) => l.includes('line-through'))
  expect(line, 'DealRow 에 취소선(line-through) 줄이 없다 — 앵커가 낡았다').toBeTruthy()
  const light = line!.match(/(?:^|["\s])text-gray-(\d+)/)?.[1]
  const dark = line!.match(/dark:text-gray-(\d+)/)?.[1]
  expect(light, '취소선의 라이트 글자색(text-gray-N)을 못 읽었다').toBeTruthy()
  expect(dark, '취소선의 다크 글자색(dark:text-gray-N)을 못 읽었다').toBeTruthy()
  return { light: light!, dark: dark! }
}

describe('DealRow 취소선 정가 — 대비 (2026-09-28)', () => {
  const INK = inkScale()
  const tok = strikeTokens()

  it('⓪ 측정이 비어 있지 않다 — 스케일을 실제로 읽었는가', () => {
    // 0건이면 통과가 아니라 고장이다(이 레포가 반복해 당한 "헛도는 가드")
    expect(Object.keys(INK).length).toBeGreaterThanOrEqual(8)
    expect(INK['400']).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(INK['500']).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('① 라이트: 흰 카드 위에서 3.0:1 이상', () => {
    const hex = INK[tok.light]
    expect(hex, `INK 스케일에 gray-${tok.light} 이 없다`).toBeTruthy()
    const r = contrast(hex, SURFACE_LIGHT)
    expect(r, `취소선 정가 ${hex} on ${SURFACE_LIGHT} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_RATIO)
  })

  it('② 다크: #1D1F29 카드 위에서 3.0:1 이상', () => {
    const hex = INK[tok.dark]
    expect(hex, `INK 스케일에 gray-${tok.dark} 이 없다`).toBeTruthy()
    const r = contrast(hex, SURFACE_DARK)
    expect(r, `취소선 정가 ${hex} on ${SURFACE_DARK} = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_RATIO)
  })

  it('③ 위계는 그대로 — 취소선은 판매가보다 확실히 약하다', () => {
    // 판매가는 gray-900(라이트) / white(다크). 취소선이 그만큼 진해지면 위계가 무너진다.
    expect(contrast(INK[tok.light], SURFACE_LIGHT)).toBeLessThan(contrast(INK['900'], SURFACE_LIGHT))
    expect(contrast(INK[tok.dark], SURFACE_DARK)).toBeLessThan(contrast('#FFFFFF', SURFACE_DARK))
  })

  it('④ 계산기 자신이 맞다 — 알려진 값으로 검산', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 1)
    // ⚠️ 이 둘은 **팔레트와 무관한 고정 검산값**이다(계산기가 맞는지만 본다). 2026-09-30 온도 정정
    //    이전 램프의 gray-300·gray-600 이었고, 그래서 "되돌리면 이 값" 이라는 뜻이 이제는 없다.
    //    값을 새 hex 로 갈면 계산기 검산이 램프에 묶여 **함께 틀려도 초록**이 되므로 그대로 둔다.
    expect(contrast('#D8D2CC', '#FFFFFF')).toBeCloseTo(1.5, 1)
    expect(contrast('#55534F', '#1D1F29')).toBeCloseTo(2.14, 1)
  })
})
