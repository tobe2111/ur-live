/**
 * 🧭 누가 데려왔나 · 무엇을 보고 샀나 (2026-11-11 대표 *"인플루언서 링크를 통해서 들어와선 유어쇼츠를 볼 수도 있잖아. 24시간 내에.
 *    그럼 인플루언서 성과로 안잡히면 안되지. 이런 케이스들을 체계적으로 잡아줘"*)
 *
 * 지키는 것:
 *   A. 소개 링크가 **홈·유어쇼츠 등 어느 손님 화면으로 들어와도** 24시간 저장된다(종전엔 상세·유어샵만) — 단 ref 뜻이 다른
 *      화면(`/store/new` 매장 영입, 대시보드, 로그인)은 저장하지 않는다.
 *   B. 장바구니 카드 확정이 본문뿐 아니라 헤더·쿠키의 소개 링크도 읽는다(완료 주소에 ref 가 없어 늘 무귀속이었다).
 *   C. 갈래 규칙 — 소개 링크가 있으면 무엇을 봤든 **인플루언서**. 없으면 유어쇼츠 → 다녀온 사람들 → 유어딜.
 *   D. 주문당 한 줄 · 헤더 위조 모양은 버린다 · 결제 세 곳(딜·카드·장바구니)이 모두 적는다.
 * ⚠️ 못 보는 것: 실제 결제(staging) · 손님이 탭을 닫아 저장소가 지워진 경우(설계상 귀속 없음) · 다른 기기에서 산 경우.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/api', () => ({ default: { post: vi.fn(() => Promise.resolve({})) } }))
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { captureLandingRef, isConsumerLandingPath } from '@/utils/affiliate-track'
import { readAffiliateRef } from '@/utils/affiliate-ref-store'
import { writeTouch, readTouch, TOUCH_TTL_MS } from '@/utils/touch-store'
import { touchBucket, parseVia, recordOrderTouch, loadTouchSummary } from '@/worker/utils/order-touch'

const read = (p: string) => readFileSync(p, 'utf8')
beforeEach(() => localStorage.clear())

describe('A. 소개 링크 — 어느 손님 화면으로 들어와도', () => {
  it('홈·유어쇼츠·뷰어로 들어온 링크가 구매 귀속에 저장된다', () => {
    for (const p of ['/', '/videos', '/urshorts', '/map', '/vouchers']) {
      localStorage.clear()
      captureLandingRef(p, '777')
      expect(readAffiliateRef()?.ref, p).toBe('777')
    }
  })
  it('ref 뜻이 다른 화면은 저장하지 않는다', () => {
    for (const p of ['/store/new', '/seller/products', '/admin', '/agency/stores', '/login']) {
      localStorage.clear()
      captureLandingRef(p, '777')
      expect(readAffiliateRef(), p).toBeNull()
    }
    expect(isConsumerLandingPath('/stores')).toBe(true) // 접두어만 같은 다른 경로는 손님 화면
  })
  it('App 이 처음 들어온 주소로 이 함수를 부른다', () => {
    expect(read('src/App.tsx')).toContain("captureLandingRef(window.location.pathname, params.get('ref') || params.get('aff'))")
  })
})

describe('B. 장바구니 카드 확정', () => {
  it('본문 → 헤더 → 쿠키 순으로 소개 링크를 읽는다', () => {
    expect(read('src/features/group-buy/api/cart-checkout.routes.ts'))
      .toContain("const referralInfluencerId = await normalizeRef(DB, pickGbRefSource(body.ref, c.req.header('X-Affiliate-Ref'), getCookie(c, 'affiliate_ref')), userId)")
  })
})

describe('C. 갈래 규칙', () => {
  it('소개 링크가 있으면 무엇을 봤든 인플루언서', () => {
    expect(touchBucket('777', 'urshorts')).toBe('influencer')
    expect(touchBucket('777', 'content')).toBe('influencer')
    expect(touchBucket('777', null)).toBe('influencer')
  })
  it('없으면 유어쇼츠 → 다녀온 사람들 → 유어딜', () => {
    expect(touchBucket(null, 'urshorts')).toBe('urshorts')
    expect(touchBucket('', 'content')).toBe('content')
    expect(touchBucket(null, null)).toBe('direct')
  })
  it('본 것 꼬리표 — 24시간 · 마지막이 이긴다 · 모양이 틀리면 안 남는다', () => {
    const t0 = 1_000_000
    writeTouch('urshorts:abcdefghijk', t0)
    writeTouch('content:c:12', t0 + 1)
    expect(readTouch(t0 + 2)).toBe('content:c:12')
    expect(readTouch(t0 + 1 + TOUCH_TTL_MS + 1)).toBeNull()
    writeTouch('javascript:alert(1)<x>', t0)
    expect(readTouch(t0 + 2)).toBe('content:c:12')
    expect(parseVia('urshorts:abc')).toEqual({ kind: 'urshorts', id: 'abc' })
    expect(parseVia('evil:1')).toBeNull()
  })
  it('유어쇼츠 구매 · 콘텐츠 열기가 꼬리표를 남기고, 모든 요청이 그것을 싣는다', () => {
    expect(read('src/pages/VideosPage.tsx')).toMatch(/to=\{`\/pass\/\$\{cur\.product_id\}`\}\s*\n\s*onClick=\{\(\) => writeTouch\(`urshorts:\$\{cur\.video_id\}`\)\}/)
    const row = read('src/pages/group-buy/creator-content/CreatorContentRow.tsx')
    expect(row).toContain('writeTouch(`content:${list[index].id}`)')
    expect(row).toContain('writeTouch(`content:${b.id}`)')
    expect(read('src/lib/api.ts')).toContain("config.headers['X-Ur-Via'] = via")
  })
})

function makeD1() {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => db.prepare(sql).get(...(args as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { db, D1: { prepare: (s: string) => wrap(s) } as unknown as D1Database }
}

describe('D. 주문마다 한 줄', () => {
  it('두 번 와도 한 줄 · 갈래가 같이 적힌다 · 집계가 센다', async () => {
    const { db, D1 } = makeD1()
    await recordOrderTouch(D1, { orderRef: 'GB-1', userId: 5, productId: 9, ref: '777', viaRaw: 'urshorts:abcdefghijk' })
    await recordOrderTouch(D1, { orderRef: 'GB-1', userId: 5, productId: 9, ref: null, viaRaw: null })
    await recordOrderTouch(D1, { orderRef: 'GB-2', userId: 6, productId: 9, ref: null, viaRaw: 'urshorts:abcdefghijk' })
    await recordOrderTouch(D1, { orderRef: 'GB-3', userId: 7, productId: 9, ref: null, viaRaw: 'bad header' })
    const rows = db.prepare('SELECT order_ref, bucket, via_kind FROM order_touch ORDER BY order_ref').all()
    expect(rows).toEqual([
      { order_ref: 'GB-1', bucket: 'influencer', via_kind: 'urshorts' },
      { order_ref: 'GB-2', bucket: 'urshorts', via_kind: 'urshorts' },
      { order_ref: 'GB-3', bucket: 'direct', via_kind: null },
    ])
    const s = await loadTouchSummary(D1, 30)
    expect(s.top_videos).toEqual([{ video_id: 'abcdefghijk', n: 2, via_influencer: 1 }])
    expect(s.influencer_via).toEqual([{ via: 'urshorts', n: 1 }])
  })
  it('결제 세 곳(딜 · 카드 · 장바구니)이 모두 적는다', () => {
    const gb = read('src/features/group-buy/api/group-buy.routes.ts')
    expect(gb.match(/recordOrderTouch\(DB, \{ orderRef: orderNumber, userId, productId: Number\(productId\), ref: referralInfluencerId, viaRaw: c\.req\.header\('X-Ur-Via'\) \}\)/g)?.length).toBe(2)
    expect(read('src/features/group-buy/api/cart-checkout.routes.ts')).toMatch(/recordOrderTouch\(DB, \{ orderRef: orderNumber, userId, productId: null, ref: referralInfluencerId, viaRaw: c\.req\.header\('X-Ur-Via'\) \}\)/)
  })
})
