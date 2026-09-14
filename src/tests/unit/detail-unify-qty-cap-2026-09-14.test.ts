/**
 * 🎟️ 이용권 상세 안 B + 1인당 구매 상한 (2026-09-14)
 *
 * 대표 확정: *"안 B로 하자."* + *"셀러가 이용권 한 계정 당 구매 갯수 제한이 걸리게끔 해야할 것 같아."*
 *
 * ## 이 시험이 지키는 것
 * ① 안 B 의 각 항목이 **실제로 배선돼 있는가**(문구·중복·자리)
 * ② 상한의 진실이 **한 곳**인가 — `/join` 사전검증과 과금 전 재검증이 같은 함수를 부르는가
 * ③ 순수함수(`resolveQtyCap`)가 하드 상한·미설정·0 을 제대로 다루는가 — **실제로 실행해서** 잰다
 *
 * ## 이 시험이 **못** 막는 것
 * - 화면이 실제로 어떻게 보이는지(렌더 결과·대비·레이아웃) — 그건 브라우저 워크플로의 몫이다
 * - `platform_settings` 에 실제로 어떤 값이 들어 있는지 — 그건 라이브 데이터라 레포가 못 본다
 * - 서버가 400 을 실제로 주는지 — D1 이 필요하다(staging 검증 항목)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { resolveQtyCap, HARD_QTY_CAP } from '../../worker/utils/purchase-cap'
import { DEFAULT_QTY_CAP } from '../../shared/purchase-cap-default'

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (p: string) => stripComments(read(p))

const GB = 'src/pages/GroupBuyDetailPage.tsx'
const STAY = 'src/pages/StayDetailPage.tsx'
const STAY_SECTIONS = 'src/pages/stay-detail/StayInfoSections.tsx'
const STAY_BAR = 'src/pages/stay-detail/StayStickyBar.tsx'
const USAGE = 'src/pages/group-buy/UsageGuide.tsx'
const JOIN = 'src/features/group-buy/api/group-buy.routes.ts'
const META = 'src/features/group-buy/api/detail-meta-enrich.ts'
const CAP = 'src/worker/utils/purchase-cap.ts'

describe('안 B — 공구 상세', () => {
  it('① 매장명 4회차였던 이용 안내의 `사용처` 행이 없다', () => {
    expect(code(GB)).not.toContain("k: '사용처'")
    expect(code(USAGE)).not.toContain("k: '사용처'")
  })

  it('② 설명이 제목과 같은 문자열이면 안 그린다 (상품명 3회 → 1회)', () => {
    const s = code(GB)
    expect(s).toMatch(/detail\.description\.trim\(\)\s*!==\s*\(detail\.name \|\| ''\)\.trim\(\)/)
  })

  it('③ 할인 문구가 줄었다 — `1매당 N원 저렴` 이 없다(바로 위 줄이 정가·할인율·판매가를 이미 말한다)', () => {
    expect(code(GB)).not.toContain('저렴')
  })

  it('④ 수량이 본문 카드에 있다 — 숙소 인원 행과 **같은 부품**(FieldRow)', () => {
    const s = code(GB)
    expect(s).toContain("from '@/components/ticket/FieldCard'")
    expect(s).toMatch(/<FieldRow[\s\S]{0,200}label="수량"/)
  })

  it('④-b 하단 바에는 수량 스테퍼가 남아 있지 않다(두 곳에 두면 어느 쪽이 진짜인지 흐려진다)', () => {
    const s = code(GB)
    // 스테퍼의 표식은 aria-label — 본문 카드 안 것 하나뿐이어야 한다
    expect(s.match(/aria-label="수량 조절"/g) || []).toHaveLength(1)
  })

  it('⑤ 이용 안내 3단계가 접힌다 — 기본 닫힘 + 펼치는 트리거', () => {
    const s = code(USAGE)
    expect(s).toContain('useState(false)')
    expect(s).toMatch(/aria-expanded=\{howToOpen\}/)
    expect(s).toContain('<RedeemHowTo hideTitle />')
  })

  it('⑥ 리뷰 0건이면 상단 탭에서 리뷰를 뺀다 — 다만 **섹션은 남긴다**', () => {
    const s = code(GB)
    expect(s).toMatch(/Number\(detail\.review_count \|\| 0\) > 0 \?/)
    // 🔑 섹션 자체를 지우면 리뷰를 쓸 자리가 사라진다(주문 상세의 작성 버튼은 배송완료 조건이라
    //    배송이 없는 이용권엔 열리지 않는다). 그래서 렌더는 **조건 없이** 남아야 한다.
    //    ⚠️ 문자열 존재만 보면 `{n > 0 && <ProductReviews …>}` 로 감싸도 통과한다(주입이 잡았다).
    expect(s).toContain('<ProductReviews productId={productId}')
    expect(s).not.toMatch(/&&\s*<ProductReviews/)
  })
})

describe('안 B — 숙소 상세', () => {
  it('① 하단 구매 바가 담기 전에도 뜬다 — 종전엔 `cartItems.length > 0` 일 때만이라 가격이 0회 노출', () => {
    const s = code(STAY)
    expect(s).toContain('<StayStickyBar')
    expect(s).not.toMatch(/\{cartItems\.length > 0 && \(\s*<div className="lg:hidden fixed bottom-0/)
    // 담기 전 값 = 팔 수 있는 객실 최저가
    expect(s).toContain('minPrice={minRoomPrice}')
    expect(s).toMatch(/sellableRooms\.length \? Math\.min\(/)
  })

  it('②  바 자신도 담기 전 상태를 그린다(가격 + 객실 고르기)', () => {
    const s = code(STAY_BAR)
    expect(s).toContain('부터')
    expect(s).toContain('객실 고르기')
    // 팔 수 있는 객실이 없으면 바를 안 그린다 — 만실 카드가 그 말을 대신한다
    expect(s).toMatch(/if \(!hasCart && minPrice == null\) return null/)
  })

  it('③ 리뷰가 붙었다 — 공구가 쓰는 그 컴포넌트를 재사용(새로 만들지 않는다)', () => {
    const s = code(STAY_SECTIONS)
    expect(s).toContain("import('../product-detail/ProductReviews')")
    expect(code(STAY)).toContain('<StayReviews productId={productId} />')
  })

  it('④ 만실이 카드 + 주 행동이다 — 다만 객실 목록은 남긴다(어떤 객실이 있는 숙소인지 잃지 않게)', () => {
    expect(code(STAY_SECTIONS)).toContain('다른 날짜 고르기')
    const s = code(STAY)
    expect(s).toMatch(/rooms\.every\(\(r\) => !r\.available\) && \(/)
    expect(s).toContain('{rooms.map((r) => (')
  })

  it('⑤ 상시 바에 마지막 콘텐츠가 가리지 않게 자리를 비운다', () => {
    expect(code(STAY_SECTIONS)).toContain('h-[76px]')
  })
})

describe('1인당 구매 상한 — 상한의 진실은 한 곳', () => {
  it('① `/join` 사전검증과 과금 전 재검증이 **같은 함수**를 부른다', () => {
    const s = code(JOIN)
    // ⚠️ 이름 등장 횟수로 세면 안 된다 — 호출을 지워도 import 줄에 이름이 남아 통과한다(주입이 잡았다).
    //    실제로 **부르고 결과를 판정하는** 자리 둘을 센다.
    const awaited = s.match(/await (checkPerPersonLimit|recheck)\(DB, productId, userId, qty, mppRaw\)/g) || []
    expect(awaited).toHaveLength(2)
    const rejects = s.match(/if \(!lim2?\.ok\) return c\.json/g) || []
    expect(rejects).toHaveLength(2)
    // 옛 인라인 판정이 남아 있으면 한쪽만 고쳐질 수 있다
    expect(s).not.toMatch(/const maxPerPerson = .*max_per_person/)
  })

  it('② 상세 응답이 실효 상한을 싣는다 — 표시용 한도와 분리된 별도 필드', () => {
    const s = code(META)
    expect(s).toContain('qty_cap')
    // ⚠️ `resolveQtyCap` 은 import 줄에도 있다 — 실제 **대입**을 앵커로(주입이 잡았다).
    expect(s).toMatch(/qty_cap = resolveQtyCap\(mppRaw, await getPlatformQtyCap\(DB\)\)/)
    // 표시용은 여전히 "셀러가 정한 값" 만 — 플랫폼 기본을 배지로 띄우지 않는다
    expect(s).toMatch(/max_per_person = mppRaw != null/)
  })

  it('③ 화면이 서버 값을 쓴다 — 자기 상수 10 을 우선하지 않는다', () => {
    for (const p of [GB, 'src/pages/VoucherDetailPage.tsx']) {
      const s = code(p)
      expect(s).toContain('qty_cap')
      expect(s).toContain('DEFAULT_QTY_CAP')
      // 옛 하드코딩 폴백이 그대로 남아 있으면 서버 설정이 화면에 안 먹는다
      expect(s).not.toMatch(/max_per_person > 0 \? \w+\.max_per_person : 10/)
    }
  })

  it('④ 화면 폴백과 서버 기본이 **한 곳**에서 온다 (두 벌이면 언젠가 갈린다)', async () => {
    const server = await import('../../worker/utils/purchase-cap')
    expect(server.DEFAULT_QTY_CAP).toBe(DEFAULT_QTY_CAP)
    // ⚠️ 위 한 줄만으로는 부족하다 — worker 가 자기 리터럴을 따로 들면 값이 같은 동안은 통과한다.
    //    그러니 **재수출인지**를 본다(주입이 이 구멍을 잡았다).
    const src = code(CAP)
    expect(src).toContain("export { DEFAULT_QTY_CAP } from '../../shared/purchase-cap-default'")
    expect(src).not.toMatch(/const DEFAULT_QTY_CAP\s*=\s*\d/)
  })
})

describe('resolveQtyCap — 실제로 실행해서 잰다', () => {
  it('셀러가 정한 값이 있으면 그것을 쓴다', () => {
    expect(resolveQtyCap('3', 10)).toBe(3)
    expect(resolveQtyCap(7, 10)).toBe(7)
  })

  it('미설정·0·음수·비숫자는 플랫폼 기본으로 떨어진다 (0 을 무제한으로 읽지 않는다)', () => {
    for (const v of [undefined, null, '', '0', 0, -5, 'abc']) {
      expect(resolveQtyCap(v, 10)).toBe(10)
    }
  })

  it('무엇을 넣어도 하드 상한을 못 넘는다', () => {
    expect(resolveQtyCap('9999', 10)).toBe(HARD_QTY_CAP)
    expect(resolveQtyCap(undefined, 9999)).toBe(HARD_QTY_CAP)
  })

  it('소수는 내림 — 2.9 개를 살 수는 없다', () => {
    expect(resolveQtyCap('2.9', 10)).toBe(2)
  })
})
