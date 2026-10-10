/**
 * 🔗 **딜 링크로 팔리면 그 소개자에게 귀속된다** · 🛑 **영입 몫은 기본 꺼짐** (2026-10-10 대표 *"1. 고쳐줘 2. 몫 꺼줘"*)
 *
 * ## G1 — 무엇이 깨져 있었나
 * 딜 링크·유어샵·핀은 소개자를 `affiliate_ref`(localStorage + 쿠키)에 심고 `lib/api.ts` 가 모든 요청에
 * `X-Affiliate-Ref` 헤더로 싣는다. 그런데 이용권 구매(`/join`·`/confirm-toss`·장바구니)는 **본문 `ref`** 만
 * 읽었고, 화면은 본문에 다른 저장소(`?seller=`)만 넣었다 ⇒ 딜 커미션이 안 붙었다.
 *
 * ## G2 — 무엇을 껐나
 * `recordIntroductionCommissionShare` 는 이용권 사용마다 유어딜 수수료의 20% 를 영입자에게 줬고
 * 직접 입점 여부를 보지 않았다. 이제 `influencer_intro_share_enabled = 'true'` 일 때만 돈다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - 실제 HTTP 요청에 헤더·쿠키가 실리는지(브라우저) — staging 실결제로 본다(STAGING_CHECKLIST S-MATCH).
 * - 커미션 금액 계산 자체(그건 `calcInfluencerCommissionPct` 시험의 몫).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { pickGbRefSource } from '@/features/group-buy/api/gb-purchase-guards'
import { recordIntroductionCommissionShare } from '@/worker/utils/ledger'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

describe('🔗 pickGbRefSource — 본문 → 헤더 → 쿠키', () => {
  it('본문이 있으면 본문 그대로 (종전과 byte-동일)', () => {
    expect(pickGbRefSource('77', '11', '22')).toBe('77')
    expect(pickGbRefSource(' seller:5 ', '11', null)).toBe('seller:5')
  })
  it('🔴 본문이 없으면 헤더 — 딜 링크가 심은 소개자 (이게 깨져 있던 것)', () => {
    expect(pickGbRefSource(undefined, '11', '22')).toBe('11')
    expect(pickGbRefSource('', '11', null)).toBe('11')
  })
  it('헤더도 없으면 쿠키 (localStorage 가 유실된 재방문)', () => {
    expect(pickGbRefSource(null, null, '22')).toBe('22')
  })
  it('헤더·쿠키는 숫자 1~12자리만 — 클라 저장 규칙과 같은 모양', () => {
    expect(pickGbRefSource(null, 'abc', '22')).toBe('22')
    expect(pickGbRefSource(null, '1234567890123', 'x')).toBe('')
    expect(pickGbRefSource(undefined, undefined, undefined)).toBe('')
  })
})

describe('🔌 배선 — 이용권 구매 세 곳이 같은 출처·같은 자기귀속 판정을 쓴다', () => {
  const gb = stripComments(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8'))
  const cart = stripComments(readFileSync('src/features/group-buy/api/cart-checkout.routes.ts', 'utf8'))
  const SRC = /pickGbRefSource\((?:ref|body\.ref), c\.req\.header\('X-Affiliate-Ref'\), getCookie\(c, 'affiliate_ref'\)\)/g

  it('/join 과 /confirm-toss 둘 다', () => {
    expect((gb.match(SRC) || []).length).toBe(2)
    expect(gb).not.toMatch(/body\.ref \? String\(body\.ref\)\.trim\(\)/)
  })
  it('/confirm-toss 도 isSelfReferral (연결 셀러 id 로 자기 커미션 차단 — /join 과 같은 판정)', () => {
    const fn = gb.slice(gb.indexOf("groupBuyRoutes.post('/confirm-toss'"))
    expect(fn).toMatch(/referralInfluencerId && await isSelfReferral\(DB, referralInfluencerId, userId\)\) referralInfluencerId = ''/)
    expect(fn).not.toMatch(/referralInfluencerId === userId\) referralInfluencerId = ''/)
  })
  it('장바구니 결제 시작도 같은 출처 + 같은 자기귀속 판정', () => {
    expect(cart).toMatch(/normalizeRef\(DB, pickGbRefSource\(body\.ref, c\.req\.header\('X-Affiliate-Ref'\), getCookie\(c, 'affiliate_ref'\)\), userId\)/)
    expect(cart).toMatch(/await isSelfReferral\(DB, s, userId\)\) return ''/)
  })
})

function db(intro: string | null) {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  if (intro !== null) d.prepare(`INSERT INTO platform_settings VALUES ('influencer_intro_share_enabled', ?)`).run(intro)
  let touched = 0
  const D1 = {
    prepare(sql: string) {
      let b: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { b = a; return self },
        first: async () => {
          if (!/influencer_intro_share_enabled/.test(sql)) touched++
          try { return d.prepare(sql).get(...(b as never[])) ?? null } catch { return null }
        },
        all: async () => ({ results: [] }), run: async () => { touched++; return { meta: { changes: 0 } } },
      }
      return self
    },
    exec: async () => { touched++ },
    batch: async () => { touched++; return [] },
  } as unknown as D1Database
  return { D1, touched: () => touched }
}

describe('🛑 recordIntroductionCommissionShare — 기본 꺼짐', () => {
  const P = { voucher_id: 1, merchant_id: 2, platform_fee: 10_000 }
  it('설정이 없으면 0 이고 원장·매장 조회를 하나도 안 한다', async () => {
    const { D1, touched } = db(null)
    expect(await recordIntroductionCommissionShare(D1, P)).toEqual({ influencer_id: null, amount: 0 })
    expect(touched()).toBe(0)
  })
  it("'false'·오타값도 꺼짐 — 명시 'true' 만 켠다", async () => {
    for (const v of ['false', 'TRUE', '1', '']) {
      const { D1, touched } = db(v)
      expect(await recordIntroductionCommissionShare(D1, P)).toEqual({ influencer_id: null, amount: 0 })
      expect(touched()).toBe(0)
    }
  })
  it("'true' 면 종전 경로로 들어간다(게이트 다음 줄을 읽는다)", async () => {
    const { D1, touched } = db('true')
    await recordIntroductionCommissionShare(D1, P).catch(() => null)
    expect(touched()).toBeGreaterThan(0)
  })
  it('운영 명부와 설정 검증에 등록돼 있다 (켜는 조건이 화면에 보인다)', () => {
    const ops = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    expect(ops).toMatch(/key: 'influencer_intro_share_enabled', kind: 'setting'[^\n]*default_value: 'false'/)
    expect(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf8')).toMatch(/influencer_intro_share_enabled: boolStr/)
  })
})
