/**
 * 📝 이용권 상세 설명(meta description) — 2026-10-14
 *
 * 대표 *"머지하고 또 개선점 찾아"*. 라이브를 재니 **같은 상품이 두 할인율을 말하고 있었다.**
 *
 * ## ① 할인율이 310건 전부에서 사라졌다 (서버)
 *
 *     라이브 샘플 45건                       건수
 *     current_discount_pct > 0                0
 *     discount_rate        > 0                0
 *     정가·판매가로 계산    > 0              45  (중앙 20%)
 *
 * 종전 description 은 `d.current_discount_pct` 를 믿었으므로 `🎉 N% 할인` 분기가
 * **한 번도 돈 적이 없다.** 커머스 스니펫에서 가장 강한 신호가 구조적으로 빠져 있었고,
 * **같은 파일의 `<noscript>` 본문은 이미 맞게 말하고 있었다**(`priceDisplay` 를 쓴다) —
 * 즉 한 문서 안에서 본문은 "11% 할인", description 은 침묵이었다.
 *
 * 🔑 이 레포엔 바로 그 사고를 위해 만든 SSOT 가 있다 — `priceDisplay` 의
 *    `Math.max(선언값, 계산값)`(2026-08-19 대표 신고 *"할인율도 나타나야 할 것 같다"*).
 *
 * ## ② 설명이 얇았다 (중앙값 50자 · 46%가 50자 미만 · 전부 80자 미만)
 * 그중 `유어딜에서 할인가로 바로 구매`(14자)는 **310건에 똑같이 붙는 상투구**라 고유한 부분은
 * 25~30자였다. 같은 날 백필을 받은 숙소는 **중앙값 71자**로 별점·지역·가격·소개를 담는다
 * (#83·#84 와 같은 비대칭 — 숙소가 풍부해졌는데 이용권이 안 따라왔다).
 * 가진 값은 다 있었다: 별점 294/310건 · 설명 98% · 주소 · 정가.
 *
 * ## 🔴 화면 쪽 절반은 **대표 판단 대기**다 (고쳐진 척하지 말 것)
 * `GroupBuyDetailPage.tsx` 의 `<SEO description>` 은 **잠금표 파일**이라 승인 없이 못 고친다.
 * 그쪽은 아직 이렇게 낸다:
 *
 *     🎉 {N}% 할인! {가게} {이름} 공동구매 — {group_buy_current}명 함께 구매 중, {가격}원
 *
 * `react-helmet` 이 서버 메타를 덮으므로 **JS 를 렌더하는 Googlebot 이 받는 쪽은 이것**이고,
 * 거기엔 ⓐ **줄표**(#79 가 서버만 고쳤다) ⓑ **`0명 함께 구매 중`**(라이브 `group_buy_current`
 * 중앙값 0 · 98%가 0명)이 들어 있다. 결재 파일: `docs/decisions/2026-10-14-pass-description.md`.
 * ⇒ 이 시험은 **서버 쪽만** 고정한다. 화면 쪽은 승인 뒤 같은 SSOT 로 모은다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 설명을 스니펫으로 쓰는지(쓸지 말지는 그들이
 *    고른다 — 색인 수일~수주, 서치콘솔은 대표만 본다) · 화면 쪽 절반(위 결재 대기).
 */
import { describe, it, expect } from 'vitest'
import { buildDetailMeta } from '@/worker/utils/detail-ssr-meta'
import { priceDisplay } from '@/shared/price-display'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const LIVE = {
  id: 2919, name: '닭도리탕', category: 'meal_voucher', restaurant_name: '달빛한스푼',
  restaurant_address: '서울 서초구 방배중앙로 165', price: 31000, original_price: 35000,
  // 🔴 라이브 그대로 — 선언값이 0 인데 정가 > 판매가다(45/45건이 이 모양이었다).
  current_discount_pct: 0, group_buy_status: 'active',
  avg_rating: 4.7, review_count: 9, description: '매콤한 닭도리탕 2인분.',
  image_url: 'https://media.ur-team.com/a.jpg',
}
const desc = (extra: Record<string, unknown> = {}) =>
  buildDetailMeta(JSON.stringify({ data: { ...LIVE, ...extra } }), 'https://urdeal.kr', '/pass/2919')?.description || ''

describe('① 할인율은 priceDisplay SSOT 에서 온다', () => {
  it('선언값이 0 이어도 정가·판매가로 계산한 할인이 뜬다 — 310건이 잃고 있던 그 숫자', () => {
    const s = desc()
    expect(s, '선언값 0 을 믿으면 310건 전부에서 할인율이 사라진다').toContain('11% 할인')
    expect(s).toContain('정가 35,000원')
    // SSOT 와 **같은 값**인지 — 두 벌이면 같은 상품이 두 할인율을 말한다.
    expect(s).toContain(`${priceDisplay({ price: 31000, original_price: 35000, discount_rate: 0 }).discount}% 할인`)
  })

  it('선언값이 더 크면 그쪽 — Math.max 규칙', () => {
    expect(desc({ current_discount_pct: 30 })).toContain('30% 할인')
  })

  it('할인이 없으면 할인율을 말하지 않는다', () => {
    for (const e of [{ original_price: 31000 }, { original_price: 0 }, { original_price: 20000 }]) {
      expect(desc(e), `없는 할인을 말했다: ${JSON.stringify(e)}`).not.toMatch(/% 할인/)
      expect(desc(e)).not.toContain('정가')
    }
  })
})

describe('② 별점·지역·설명 — 가진 것만 쓴다', () => {
  it('넷이 다 있으면 다 담는다', () => {
    const s = desc()
    expect(s).toContain('⭐4.7')
    expect(s).toContain('서울 서초구')
    expect(s).toContain('매콤한 닭도리탕 2인분.')
    expect(s.length, '숙소 중앙값(71자)에 못 미치면 처방이 안 먹은 것').toBeGreaterThan(55)
    expect(s.length, 'slice(200) 를 넘을 수 없다').toBeLessThanOrEqual(200)
  })

  it('없으면 그 조각만 빠지고 나머지는 종전과 같다', () => {
    expect(desc({ review_count: 0 }), '리뷰 0인데 별점을 말하면 지어내기다').not.toContain('⭐')
    expect(desc({ avg_rating: 0 })).not.toContain('⭐')
    expect(desc({ restaurant_address: '' })).not.toContain('서초구')
    expect(desc({ restaurant_address: '그냥 아무 글자' }), '파싱 실패 시 지어내지 않는다').not.toContain(' · 달빛')
    expect(desc({ description: '' })).not.toContain('매콤한')
    // 설명이 상품명·가게명+상품명과 같으면 같은 말을 두 번 하지 않는다.
    expect(desc({ description: '닭도리탕' }).match(/닭도리탕/g) || []).toHaveLength(1)
  })

  it('아무것도 없어도 빈 문자열이 아니다 — 종전 최소 형태', () => {
    const s = buildDetailMeta(JSON.stringify({
      data: { id: 1, name: '닭도리탕', category: 'meal_voucher', restaurant_name: '달빛한스푼', price: 31000, group_buy_status: 'active' },
    }), 'https://urdeal.kr', '/pass/1')?.description || ''
    expect(s).toContain('달빛한스푼 닭도리탕')
    expect(s).toContain('31,000원')
    expect(s.length).toBeGreaterThan(20)
  })
})

describe('③ 반대 방향 — 섞이면 안 되는 것', () => {
  it('줄표 0 · 상투구는 할인이 없을 때만', () => {
    // 🩸 첫 판은 할인 분기만 봤다 — 줄표 주입이 **할인 없는 분기**에 들어가 통과했다
    //   (주입이 잡았다). 분기가 둘이면 단언도 둘이어야 한다.
    for (const e of [{}, { original_price: 31000 }, { original_price: 0 }]) {
      expect(desc(e), `em-dash 는 anti-slop 가드가 0 으로 동결한 문자다: ${JSON.stringify(e)}`).not.toContain('—')
    }
    expect(desc(), '할인을 말할 수 있으면 상투구로 자리를 쓰지 않는다').not.toContain('할인가로 바로 구매')
    expect(desc({ original_price: 31000 })).toContain('할인가로 바로 구매')
  })

  it('`group_buy_current` 를 설명에 쓰지 않는다 — 라이브 98%가 0명이다', () => {
    const s = desc({ group_buy_current: 0 })
    expect(s, '"0명 함께 구매 중" 이 스니펫에 나간다').not.toContain('명 함께 구매 중')
    expect(s).not.toContain('0명')
    const src = stripComments(readFileSync('src/worker/utils/detail-ssr-meta.ts', 'utf8'))
    expect(src, '서버 메타가 참가자 수를 읽으면 그 숫자가 스니펫에 샌다').not.toContain('group_buy_current')
  })

  it('교환권(noindex)·숙소 설명은 무접촉', () => {
    const v = buildDetailMeta(JSON.stringify({ data: { ...LIVE, deal_only: 1 } }), 'https://urdeal.kr', '/vouchers/2192')
    expect(v?.noindex).toBe(true)
    expect(v?.description).toBe('매콤한 닭도리탕 2인분.')
    expect(v?.description).not.toContain('⭐')
  })

  it('배선 — 할인율 출처가 priceDisplay 다(선언 컬럼 직독 금지)', () => {
    // 🔁 2026-10-15 재조준: 이 블록이 `shared/seo/detail-description.ts` 로 옮겨갔다(클라가 같은
    //   함수를 쓰게 만든 커밋 — 출력은 byte-불변). 지키는 불변식은 그대로이고 **자리만** 옮겼다.
    const src = stripComments(readFileSync('src/shared/seo/detail-description.ts', 'utf8'))
    const i = src.indexOf('export function passDetailDescription')
    expect(i, '앵커가 낡았다').toBeGreaterThanOrEqual(0)
    const block = src.slice(i)
    expect(block, '할인율을 priceDisplay 없이 쓰면 선언값 0 에 다시 묶인다').toMatch(/priceDisplay\(/)
    expect(block).toMatch(/pd\.discount > 0/)
    // 🩸 첫 판은 `/\bdiscount > 0/` 였는데 `\b` 가 `pd.discount` 의 `.` 뒤에서도 매치돼
    //   **멀쩡한 코드에 거짓 빨간불**을 냈다(시험이 제 오류를 잡았다). 점·낱말문자 뒤는 제외한다.
    expect(block, '선언 컬럼을 그대로 분기 조건으로 쓰면 종전 결함으로 돌아간다').not.toMatch(/(?<![.\w])discount > 0/)
    expect(block, 'current_discount_pct 를 분기 조건으로 직독하면 같은 결함이다').not.toMatch(/current_discount_pct\s*>\s*0/)
  })
})
