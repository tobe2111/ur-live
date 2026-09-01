/**
 * 🏷️ 교환권 카드/행 할인율 계약 (2026-09-01)
 *
 * ■ 왜 테스트인가 — 같은 화면에서 **같은 숫자를 두 번** 말하고 있었다
 *   PC `/vouchers` 를 1440px 로 실제 렌더해 보니 카드마다 할인율이 **두 곳**에 있었다:
 *   사진 왼쪽 위 로즈 배지(`bg-brand`) 하나, 바로 아래 가격 줄에 로즈 텍스트 하나.
 *   두 값은 같은 `discountRate` 라 언제나 동일하다 — 정보가 아니라 소음이고, 게다가
 *   위쪽 배지는 상품 사진을 가린다.
 *
 * ■ 이건 새 규칙이 아니라 **이미 정한 규칙의 적용**이다
 *   대표 2026-08-31: *"할인율이 사진 안으로 들어가면 안돼."* 그 지시로 동네딜 카드
 *   (`GroupBuyFeedCard`)는 고쳤는데(`deal-card-price-block.test.ts`), **교환권 카드는
 *   같은 화면의 형제인데 빠져 있었다.** 한 곳만 고치면 다음 세션이 다시 갈린다.
 *
 * ■ 불변식
 *   ① `VoucherCard` — 할인율은 사진 위 오버레이(absolute)가 아니다.
 *   ② `VoucherRow` — 썸네일 위 오버레이가 아니다.
 *   ③ 두 컴포넌트 모두 **본문 가격 줄에 정확히 한 번** 할인율을 렌더한다.
 *
 * ⚠️ 이 테스트가 **못 잡는 것**: CSS 로 위치를 다시 옮기는 경우 · 다른 카드 컴포넌트
 *    (동네딜 카드는 `deal-card-price-block.test.ts` 가 본다) · 실제 렌더 결과.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = readFileSync(resolve(__dirname, '../../pages/vouchers/shared.tsx'), 'utf-8')

/** `export const <Name> = memo(...)` 블록만 잘라낸다 — 다음 `export const` 직전까지. */
function componentBody(name: string): string {
  const start = SRC.indexOf(`export const ${name} = memo(`)
  expect(start, `${name} 를 찾지 못했다 — 컴포넌트가 옮겨졌으면 이 테스트를 함께 고칠 것`).toBeGreaterThan(-1)
  const next = SRC.indexOf('\nexport const ', start + 10)
  return SRC.slice(start, next === -1 ? SRC.length : next)
}

/** 사진/썸네일 위에 얹힌 할인율 = absolute 로 자리잡은 요소 안의 `{discountRate}%`. */
function overlayDiscounts(body: string): string[] {
  return body
    .split('\n')
    .filter((l) => l.includes('{discountRate}%') && /\babsolute\b/.test(l))
}

function discountRenders(body: string): number {
  return (body.match(/\{discountRate\}%/g) || []).length
}

describe('교환권 할인율은 한 화면에 한 번, 사진 밖에', () => {
  for (const name of ['VoucherCard', 'VoucherRow']) {
    it(`${name} — 할인율을 사진 위에 얹지 않는다`, () => {
      expect(overlayDiscounts(componentBody(name))).toEqual([])
    })

    it(`${name} — 할인율을 정확히 한 번 렌더한다`, () => {
      expect(discountRenders(componentBody(name))).toBe(1)
    })
  }

  it('할인율은 브랜드 로즈로 강조된다', () => {
    for (const name of ['VoucherCard', 'VoucherRow']) {
      const line = componentBody(name)
        .split('\n')
        .find((l) => l.includes('{discountRate}%'))!
      expect(line, `${name} 할인율이 로즈가 아니다`).toMatch(/text-brand/)
    }
  })
})
