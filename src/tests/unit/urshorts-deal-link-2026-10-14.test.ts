/**
 * 🔗 `/urshorts` 크롤러 본문의 **딜 링크** (2026-10-14 — 대표 *"또 개선점 찾아보자. SEO 와 GEO 부분에서"*).
 *
 * ## 왜
 *
 * 라이브 실측(Googlebot UA): `/urshorts` 는 `index, follow` · 본문 496자인데 **`<a href>` 가 0개**였다.
 * 다른 목록 표면은 전부 항목을 링크한다(2026-10-12 *"허브 → 상세 길이 없다"* 처방 — `/map` 8 ·
 * `/stays` 8 · `/region/서울` 22 · `/blog` 21). `urshorts-noscript.ts` 가 그 처방 **다음날** 쓰여서
 * 규칙이 여기까지 오지 않았다 ⇒ **결정이 아니라 누락**이다(모듈 머리말에 링크 얘기가 없다).
 *
 * ## 🔴 이 가드가 지키는 반대 방향이 더 중요하다
 *
 * 이 API 행은 `deal_only` 를 **안 싣는다**(실측 키: category · channel · discount_rate ·
 * duration_sec · id · original_price · price · product_id · product_image · region_* ·
 * store_name · thumb_url · title · video_id). 그래서 `rowHref` 의 `/products/:id` 폴백을 쓰면
 * **교환권을 링크**할 수 있고, 교환권 상세는 2026-07-07 결정으로 **noindex** 다 — 색인하지 말라고
 * 한 URL 로 크롤 예산이 빠진다. ⇒ `canonicalDetailPath` 가 **경로를 주는 행만** 링크한다.
 *
 * 그 게이트는 구조적으로 안전하다(라이브 실측): `deal_only=1` 상품 100건의 카테고리는 전부
 * 한글 표시명(`외식` 18 · `피자` 25 · `치킨` 14 · `커피/음료` 8 …)이고 `VOUCHER_CATEGORIES` 는
 * 영문 슬러그 넷뿐이며 `LEGACY_CATEGORY_MAP` 에도 한글 항목이 없다.
 * ⚠️ **그 전제가 바뀌면 이 게이트가 샌다** — ④가 그 전제 자체를 고정한다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 *
 * - 구글·네이버가 그 링크를 실제로 따라가는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다)
 * - 사람 화면: 그 블록은 `<noscript>` 라 JS 가 돌면 렌더조차 안 된다(**byte-동일**)
 * - 딜이 붙은 행의 **개수** — 라이브는 10행 중 2행뿐이고 그건 데이터 사실이다
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildUrshortsNoscript } from '../../worker/utils/urshorts-noscript'
import { LEGACY_CATEGORY_MAP, VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'
import { stripComments } from '../helpers/source-text'

const SRC = 'src/worker/utils/urshorts-noscript.ts'
const code = () => stripComments(readFileSync(SRC, 'utf8'))
const H1 = '<h1>유어쇼츠</h1>'

/** 라이브 `/api/urshorts` 응답 모양 그대로 — 손으로 지어내지 않는다(실측 키만). */
const seed = (rows: unknown[]) => JSON.stringify({ success: true, data: rows })

const deal = {
  title: '베트남 쌀국수 실패 없는 곳 #shorts', channel: '부산이야',
  store_name: '라이옥베트남쌀국수 부산시청점', region_si: '부산',
  product_id: 2580, product_name: '쌀국수 + 분짜 2인 세트', category: 'meal_voucher',
  price: 23400, original_price: 27000, discount_rate: 0,
}
const plain = {
  title: '싸와디캅~ 기장 바다 보며 태국 음식 #shorts', channel: '부산일보TV',
  store_name: null, region_si: '부산',
  product_id: null, product_name: null, category: null,
  price: null, original_price: null, discount_rate: null,
}

const hrefs = (h: string) => Array.from(h.matchAll(/<a href="([^"]+)"/g)).map(m => m[1])

describe('① 딜이 붙은 행을 그 딜로 링크한다', () => {
  it('정본 경로로 링크하고, 링크 글자가 그 딜(이름 + 판매가)이다', () => {
    const out = buildUrshortsNoscript(seed([deal]), H1)
    expect(hrefs(out), '딜 행이 링크를 못 받았다').toEqual(['/pass/2580'])
    const anchor = out.match(/<a href="[^"]+">([^<]*)<\/a>/)?.[1] ?? ''
    expect(anchor, 'anchor 가 목적지를 설명하지 않는다').toContain('쌀국수 + 분짜 2인 세트')
    expect(anchor, 'anchor 에 판매가가 없다').toContain('23,400원')
    // 영상 제목·채널은 링크 **밖**이다 — 그 글자는 딜 페이지를 설명하지 않는다.
    expect(anchor).not.toContain('#shorts')
    expect(anchor).not.toContain('부산이야')
  })

  it('딜이 없는 행은 글만 남는다 (빈 링크를 만들지 않는다)', () => {
    const out = buildUrshortsNoscript(seed([plain]), H1)
    expect(hrefs(out), '딜이 없는데 링크가 생겼다').toEqual([])
    expect(out, '영상 제목이 사라졌다').toContain('태국 음식')
    expect(out, '출처 채널 표기가 사라졌다 — 남의 영상이다').toContain('부산일보TV')
  })

  it('섞인 시드에서 딜 행만 링크된다 (라이브 분포: 10행 중 2행)', () => {
    const out = buildUrshortsNoscript(seed([plain, deal, plain]), H1)
    expect(hrefs(out)).toEqual(['/pass/2580'])
    expect((out.match(/<li>/g) || []).length, '행이 사라졌다').toBe(3)
  })
})

describe('② 교환권·순수 쇼핑은 링크하지 않는다 (색인 말라고 한 URL 로 예산이 빠진다)', () => {
  it('🔴 교환권 모양(한글 카테고리)은 링크가 없다', () => {
    for (const category of ['외식', '피자', '치킨', '커피/음료', '편의점', '백화점상품권']) {
      const out = buildUrshortsNoscript(seed([{ ...deal, category, product_id: 9999 }]), H1)
      expect(hrefs(out), `교환권 카테고리 '${category}' 가 링크를 받았다`).toEqual([])
    }
  })

  it('🔴 카테고리가 없는 행(= 순수 쇼핑일 수 있다)도 링크가 없다', () => {
    const out = buildUrshortsNoscript(seed([{ ...deal, category: null }]), H1)
    expect(hrefs(out), 'category 가 비었는데 링크가 생겼다').toEqual([])
  })

  it('🔴 `/products/` 폴백을 쓰지 않는다 (소스)', () => {
    expect(code(), 'rowHref 폴백이 들어왔다 — 이 행엔 deal_only 가 없다').not.toMatch(/rowHref|standard_checkout/)
    expect(code(), '정본 SSOT 를 안 쓴다').toContain('canonicalDetailPath(')
  })
})

describe('③ 주소·가격은 SSOT 에서 온다 (손으로 적으면 갈린다)', () => {
  it('경로를 손으로 조립하지 않는다', () => {
    expect(code(), '`/pass/` 를 손으로 적었다 — sitemap·ItemList 와 갈린다').not.toMatch(/`\/pass\/\$\{/)
  })

  it('가격 표시는 priceDisplay + won 을 쓴다', () => {
    expect(code()).toContain('priceDisplay(')
    expect(code()).toContain('won(')
    // 선언 할인율이 0 이어도 정가·판매가에서 계산된다(라이브 2580 이 그 경우: 선언 0, 실제 13%).
    const out = buildUrshortsNoscript(seed([deal]), H1)
    expect(out, '계산 할인율이 안 나왔다').toContain('13% 할인')
  })

  it('이스케이프가 동작한다 (시드 값으로 판정 — 상수만 싸면 판정이 안 된다)', () => {
    const out = buildUrshortsNoscript(seed([{
      ...deal, title: 'a&b', channel: 'x</script><b>y', product_name: 'p&q',
    }]), H1)
    expect(out).toContain('a&amp;b')
    expect(out, '채널명이 날것으로 들어갔다').not.toContain('</script>')
    expect(out).toContain('p&amp;q')
  })
})

describe('④ 게이트의 전제 — 교환권은 voucher 카테고리를 통과하지 못한다', () => {
  it('VOUCHER_CATEGORIES 는 영문 슬러그뿐이고 LEGACY 매핑에 한글이 없다', () => {
    for (const c of VOUCHER_CATEGORIES) expect(c, `'${c}' 가 영문 슬러그가 아니다`).toMatch(/^[a-z_]+$/)
    for (const k of Object.keys(LEGACY_CATEGORY_MAP))
      expect(k, `LEGACY 매핑에 한글 카테고리 '${k}' 가 들어왔다 — 교환권이 링크를 받게 된다`).toMatch(/^[a-z_]+$/)
  })
})

describe('⑤ 시드가 없으면 아무것도 내지 않는다 (지어내지 않는다)', () => {
  it.each([['null', null], ['빈 문자열', ''], ['깨진 JSON', '{'], ['data 없음', '{"success":true}'],
    ['빈 배열', '{"success":true,"data":[]}'], ['제목 없는 행', '{"success":true,"data":[{"channel":"x"}]}']])(
    '%s → 빈 문자열', (_label, payload) => {
      expect(buildUrshortsNoscript(payload as string | null, H1)).toBe('')
    })
})
