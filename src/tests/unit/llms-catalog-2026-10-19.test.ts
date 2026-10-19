/**
 * 🗂️ 2026-10-19 — `/llms-full.txt`: AI 비서가 읽는 "지금 살 수 있는 할인 이용권" 목록.
 *
 * 대표 *"AI 비서들이 참고하는 '할인 이용권 공급처' 를 목표로"*. 라이브 실측: `/llms.txt` 는 소개만 있고 이용권 0건,
 * 상품 API 는 AI 봇에게 403 — AI 가 우리가 무엇을 어디서 얼마에 파는지 볼 곳이 없었다.
 * 라이브 4페이지(400행)로 렌더해 보니 345건·시/도 9곳·숙소 49건이 지역별로 나온다.
 *
 * ⚠️ 못 보는 것: AI 가 실제로 읽고 인용하는지(외부 판정) · KV 에 요약이 실제로 있는지(cron 이 매시 올린다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildLlmsCatalog, catalogLine } from '@/shared/seo/llms-catalog'
import { buildLlmsTxt } from '@/shared/seo/llms-txt'

const B = 'https://urdeal.kr'
const meal = { id: 2911, name: '항정살 + 목살 반반 세트', restaurant_name: '고냉지김치삼겹살', category: 'meal_voucher', restaurant_address: '서울 중구 남대문로 116', price: 36800, original_price: 44000, discount_rate: 0, avg_rating: 4.6, review_count: 9, deal_only: 0 }
const stay = { id: 2720, name: '레스트 글램핑 주말 1박 숙박권', restaurant_name: '레스트 글램핑', category: 'stay_voucher', restaurant_address: '강원특별자치도 춘천시 사북면 화악지암길 600-112', price: 181000, original_price: 235000, deal_only: 0 }
const gift = { id: 2192, name: '아메리카노 T', brand_name: '스타벅스', category: '커피/음료', price: 4300, deal_only: 1 }

describe('한 줄이 말하는 것', () => {
  it('가게·상품·분류·가격·정가·할인율·주소·별점·정본 링크', () => {
    expect(catalogLine(meal, B)).toBe('- [고냉지김치삼겹살 항정살 + 목살 반반 세트](https://urdeal.kr/pass/2911) · 식사 · 36,800원 (정가 44,000원, 16% 할인) · 서울 중구 남대문로 116 · 별점 4.6 (리뷰 9개)')
  })
  it('숙소는 숙소 상세(/stays/:id)를 가리킨다 — 정본 SSOT', () => {
    expect(catalogLine(stay, B)).toContain('](https://urdeal.kr/stays/2720)')
  })
  it('리뷰가 없으면 별점을 쓰지 않는다(0점이라고 말하지 않는다)', () => {
    expect(catalogLine({ ...meal, review_count: 0, avg_rating: 0 }, B)).not.toContain('별점')
  })
  it('교환권(noindex 상세)·가격 없는 행은 싣지 않는다', () => {
    expect(catalogLine(gift, B)).toBeNull()
    expect(catalogLine({ ...meal, price: 0 }, B)).toBeNull()
  })
  it('이름 안의 대괄호·줄바꿈이 마크다운 링크를 깨지 않는다', () => {
    const l = catalogLine({ ...meal, name: '세트]\n(2인)' }, B)!
    expect(l.split('\n')).toHaveLength(1)
    expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/urdeal\.kr\/pass\/2911\)/)
  })
})

describe('목록 전체', () => {
  it('지역별로 묶고 머리말에 건수·기준 시각·한계를 적는다', () => {
    const out = buildLlmsCatalog([meal, stay, gift], B, '2026-10-19 14:00')!
    expect(out).toContain('- 기준 시각: 2026-10-19 14:00')
    expect(out).toContain('- 이용권 2건 · 매장 2곳 · 시/도 1곳 · 숙소 1건')
    expect(out).toContain('## 서울 (1건)')
    expect(out).toContain('### 서울 중구')
    expect(out).toContain('## 숙소 이용권 (1건)')
    expect(out).toContain(`${B}/region`)
    expect(out).not.toContain('/vouchers/2192')
  })
  it('행이 0건이면 null — 빈 목록을 "파는 게 없다" 로 내보내지 않는다', () => {
    expect(buildLlmsCatalog([], B)).toBeNull()
    expect(buildLlmsCatalog([gift], B)).toBeNull()
  })
  it('같은 id 는 한 번만', () => {
    const out = buildLlmsCatalog([meal, meal], B)!
    expect(out.match(/\/pass\/2911/g)).toHaveLength(1)
  })
})

describe('배선', () => {
  const route = readFileSync('src/worker/routes/sitemap.routes.ts', 'utf8')
  it('/llms-full.txt 가 KV 요약만 읽는다(DB 조회 0)', () => {
    const block = route.slice(route.indexOf("sitemapRoutes.get('/llms-full.txt'"), route.indexOf('IndexNow **소유 증명 키 파일**'))
    expect(block).toContain('getWithMetadata')
    expect(block).toContain('REGION_DIGEST_KV_KEY')
    expect(block).not.toMatch(/\.prepare\(|DB\./)
  })
  it('요약이 없으면 503 — 200 으로 빈 목록을 내지 않는다', () => {
    const block = route.slice(route.indexOf("sitemapRoutes.get('/llms-full.txt'"), route.indexOf('IndexNow **소유 증명 키 파일**'))
    expect(block).toMatch(/if \(!body\) \{[\s\S]*?status: 503/)
  })
  it('cron 이 만든 시각을 메타데이터로 싣는다', () => {
    expect(readFileSync('src/worker/cron/cache-prewarm.ts', 'utf8')).toMatch(/put\(REGION_DIGEST_KV_KEY, digest, \{[^}]*metadata: \{ at: Date\.now\(\) \}/)
  })
  it('llms.txt 가 목록을 가리킨다', () => {
    expect(buildLlmsTxt(B)).toContain(`${B}/llms-full.txt`)
  })
})
