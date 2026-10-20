/**
 * ⭐ 상세 본문의 평점 한 줄 — 2026-10-14
 *
 * 대표 *"머지하고 또 개선점 찾아"*. 라이브를 Googlebot UA 로 받아 **noscript 본문과 JSON-LD 를
 * 따로** 재니 둘이 어긋나 있었다:
 *
 *     표면            JSON-LD aggregateRating        크롤러 본문 '평점'
 *     /pass/2793      ratingValue 4.7 · 9개 리뷰      ❌ 없음
 *     /pass/2906      ratingValue 4.8 · 9개 리뷰      ❌ 없음
 *     /stays/2887     (Product 에 있음 — #83)         ✅ "평점 4.6 (9개 리뷰)"
 *
 * 그리고 `/pass` **310건 중 약 294건(95%)** 이 `avg_rating`·`review_count` 를 갖고 있다
 * (API 샘플 60건 중 57건). 즉 **sitemap 455건의 65%** 가 가진 숫자를 본문에서 잃고 있었다.
 *
 * 🔎 **원인은 선언 누락 하나였다** — 값은 시드에 이미 와 있고(`detail-ssr-body` 의 `DetailSeed`
 *    가 받는 payload 그대로) `NoscriptDetailSeed` 에 두 필드가 없어서 빌더가 쓸 수 없었다.
 *    **에러가 안 나고** 숙소는 멀쩡해서 재 본 사람만 안다. #83(숙소 `Product` 별점)과 같은 비대칭.
 *
 * 🔑 **왜 JSON-LD 로 끝나지 않나**: 둘은 다른 층이다 — 구조화 데이터는 *리치결과*, 본문은
 *    *스니펫·인용*. AI 검색엔진은 본문을 인용하고, 네이버는 `aggregateRating` 지원이 약하다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 숫자를 실제로 스니펫에 쓰는지(색인 수일~수주 ·
 *    서치콘솔은 대표만 본다) · 사람 화면(`<noscript>` 라 JS 가 돌면 렌더조차 안 된다).
 */
import { describe, it, expect } from 'vitest'
import { ratingLine } from '@/worker/utils/crawler-noscript'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import { buildStayDetailFirstScreen } from '@/worker/utils/stay-detail-ssr-body'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const LOADER = '<div style="min-height:100dvh"></div>'
const ns = (h: string) => {
  const m = /<noscript>([\s\S]*?)<\/noscript>/.exec(h)
  return m ? m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''
}
const PASS = {
  id: 2793, name: '모둠초밥 2인 세트', category: 'meal_voucher', restaurant_name: '스시호센',
  restaurant_address: '서울 종로구 사직로8길 4', price: 32400, original_price: 37000,
  image_url: 'https://media.ur-team.com/a.jpg',
}
const pass = (extra: Record<string, unknown> = {}) =>
  ns(buildDetailFirstScreen(JSON.stringify({ data: { ...PASS, ...extra } }), LOADER))
const stay = (p: Record<string, unknown> = {}) =>
  ns(buildStayDetailFirstScreen(JSON.stringify({
    data: {
      product: {
        id: 2887, name: '평일 1박', restaurant_name: '그랑블루', region_sido: '강원',
        region_sigungu: '속초시', address: '강원 양양군', image_url: 'https://media.ur-team.com/b.jpg', ...p,
      },
      rooms: [{ name: '스탠다드', base_price_weekday: 149000 }],
    },
  }), LOADER))

describe('① 이용권 상세가 평점을 본문에 낸다', () => {
  it('별점·리뷰가 있으면 숙소와 **같은 문구**', () => {
    const s = pass({ avg_rating: 4.7, review_count: 9 })
    expect(s, '/pass 310건 중 294건이 가진 숫자가 본문에서 빠졌다').toContain('평점 4.7 (9개 리뷰)')
    // 두 상세가 같은 함수를 쓰는지 **출력으로** 판정한다(문구를 베끼면 조용히 갈린다).
    expect(stay({ avg_rating: 4.7, review_count: 9 })).toContain('평점 4.7 (9개 리뷰)')
  })

  it('자리는 가격과 주소 사이 — 두 상세가 같은 순서로 읽힌다', () => {
    const s = pass({ avg_rating: 4.4, review_count: 12 })
    const [p, r, a] = ['판매가', '평점', '주소'].map((k) => s.indexOf(k))
    expect(p, '가격 줄이 없다').toBeGreaterThanOrEqual(0)
    expect(r).toBeGreaterThan(p)
    expect(a).toBeGreaterThan(r)
    const t = stay({ avg_rating: 4.4, review_count: 12 })
    expect(t.indexOf('평점')).toBeGreaterThan(t.indexOf('1박'))
    expect(t.indexOf('주소')).toBeGreaterThan(t.indexOf('평점'))
  })

  it('소수 한 자리로 — 4 가 "4.0", 4.66 이 "4.7"', () => {
    expect(ratingLine(4, 3)).toBe('평점 4.0 (3개 리뷰)')
    expect(ratingLine(4.66, 3)).toBe('평점 4.7 (3개 리뷰)')
  })
})

describe('② 반대 방향 — 지어내지 않는다', () => {
  it('리뷰 0 · 별점만 · 필드 없음 · 음수 — 전부 아무것도 안 낸다', () => {
    expect(ratingLine(4.9, 0), '리뷰 0인데 평점을 말하면 지어내기다').toBe('')
    expect(ratingLine(0, 9), '2026-10-11 에 `ratingValue: 0` 으로 값을 치른 그 자리').toBe('')
    expect(ratingLine(undefined, undefined)).toBe('')
    expect(ratingLine(null, null)).toBe('')
    expect(ratingLine('x', 'y')).toBe('')
    expect(ratingLine(-1, 9)).toBe('')
    for (const extra of [{ avg_rating: 0, review_count: 0 }, { avg_rating: 4.9, review_count: 0 }, {}]) {
      expect(pass(extra), `평점이 새어 나왔다: ${JSON.stringify(extra)}`).not.toContain('평점')
    }
    expect(stay({ review_count: 0 })).not.toContain('평점')
  })

  it('그 줄 말고는 아무것도 안 바뀐다 — 가격·주소·설명은 종전 그대로', () => {
    const a = pass()
    const b = pass({ avg_rating: 4.7, review_count: 9 })
    expect(b.replace(' 평점 4.7 (9개 리뷰)', '')).toBe(a)
  })
})

describe('③ 배선 — 두 벌이 될 수 없다', () => {
  const code = () => stripComments(readFileSync('src/worker/utils/crawler-noscript.ts', 'utf8'))

  it('평점 문구는 파일 전체에서 `ratingLine` 안에만 있다', () => {
    const c = code()
    const hits = c.match(/평점 \$\{|개 리뷰\)/g) || []
    expect(hits.length, '평점 문구가 두 곳 이상 — 손으로 베낀 자리가 생겼다').toBe(2)
    expect(c.match(/ratingLine\(/g) || [], '두 빌더가 그 함수를 부르지 않는다').toHaveLength(3)
  })

  // 🩸 첫 판은 두 선언을 **파일 전체**에서 찾았다 — 숙소 시드(`NoscriptStaySeed`)에도 같은
  //   두 줄이 있어서, 이용권 시드에서 통째로 지워도 **늘 통과했다**(주입이 잡았다).
  //   ⇒ 블록을 떼어 내 **그 인터페이스 안**에서만 센다.
  const block = (src: string, name: string) => {
    const i = src.indexOf(`interface ${name} {`)
    expect(i, `인터페이스 ${name} 가 사라졌다 — 앵커가 낡았다`).toBeGreaterThanOrEqual(0)
    const j = src.indexOf('\n}', i)
    expect(j).toBeGreaterThan(i)
    return src.slice(i, j)
  }

  it('시드 타입 둘에 두 필드가 선언돼 있다 — 없으면 값이 와도 못 쓴다', () => {
    const seed = block(code(), 'NoscriptDetailSeed')
    expect(seed, '`NoscriptDetailSeed` 에 없으면 빌더가 값을 못 쓴다(294건을 잃은 원인)').toMatch(/avg_rating\?: number \| null/)
    expect(seed).toMatch(/review_count\?: number \| null/)
    const d = block(stripComments(readFileSync('src/worker/utils/detail-ssr-body.ts', 'utf8')), 'DetailSeed')
    expect(d, '`DetailSeed` 에 없으면 호출부에서 타입이 막는다').toMatch(/avg_rating\?: number \| null/)
    expect(d).toMatch(/review_count\?: number \| null/)
  })
})
