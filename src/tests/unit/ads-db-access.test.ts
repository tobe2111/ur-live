import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  resolveAdsDbAccess, checkAdsDbQuota, ADS_DB_DEFAULT_DAILY_ROW_CAP, ADS_DB_ACCESS_META_KEY,
} from '@/worker/utils/ads-db-access'

/**
 * 🔒 2026-08-27 대표 지시 — *"대행사로 가입하면 유어애즈의 DB를 볼 수 없게끔"*.
 *
 * ## 이 테스트가 지키는 것
 *   ① 등록 유형이 '중개(관리 대행)' 면 **차단**
 *   ② 등록 유형이 '직접' 이면 **허용**
 *   ③ 미분류(레거시 — 선택지가 생기기 전 계정)는 **허용** ← 이게 없으면 기존 매장 10개가 통째로 막힌다
 *   ④ 대표 수동 지정이 자동 판정을 **언제나 이긴다**(오탐 한 건이 장애가 되지 않게)
 *   ⑤ owner 없이 operator 만 있는 매장은 차단, owner 가 승계하면 허용
 *   ⑥ 일일 열람 상한
 *   ⑦ **배선** — 데이터 엔드포인트가 실제로 게이트를 부르는가(순수함수만 맞아선 소용없다)
 *
 * ## 못 막는 것 (알고 남긴다)
 *   - 대행사가 등록할 때 '직접'을 고르는 경우. 자기신고 필드라 판정 불가 —
 *     그 대신 수수료가 5%→10% 로 오르고, 열람 총량(⑥)과 감사 로그가 남는다.
 *   - 실제 D1 동작(여기선 mock). 스키마 존재는 repair-schema 등록으로 보장.
 */

interface Cfg {
  channel?: string | null
  override?: string | null
  ownerGrant?: boolean
  operatorGrant?: boolean
  rowsToday?: number
  cap?: number | null
}
function makeDB(cfg: Cfg) {
  const firstFor = (sql: string, args: unknown[]) => {
    if (sql.includes('seller_meta') && args[1] === ADS_DB_ACCESS_META_KEY) {
      return cfg.override == null ? null : { value: cfg.override }
    }
    if (sql.includes("key = 'store_channel'")) return cfg.channel == null ? null : { value: cfg.channel }
    if (sql.includes("role = 'owner'")) return cfg.ownerGrant ? { x: 1 } : null
    if (sql.includes("role = 'operator'")) return cfg.operatorGrant ? { x: 1 } : null
    if (sql.includes('ads_db_daily_row_cap')) return cfg.cap == null ? null : { value: String(cfg.cap) }
    if (sql.includes('seller_ads_db_usage')) return { rows_served: cfg.rowsToday ?? 0 }
    return null
  }
  const db = {
    prepare(sql: string) {
      const make = (args: unknown[]) => ({
        first: async () => firstFor(sql, args),
        run: async () => ({ meta: { changes: 1 } }),
        all: async () => ({ results: [] }),
      })
      return { ...make([]), bind: (...args: unknown[]) => make(args) }
    },
  }
  return db as never
}

describe('resolveAdsDbAccess — 대행사 차단', () => {
  it('① 중개(brokered) 등록 = 차단', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: 'brokered' }), 14)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.code).toBe('ADS_DB_AGENCY_BLOCKED')
  })

  it('② 직접(direct) 등록 = 허용', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: 'direct', ownerGrant: true }), 20)
    expect(r.allowed).toBe(true)
  })

  it('③ 미분류(레거시)는 허용 — 지시는 "대행사로 가입하면"이지 "분류가 없으면"이 아니다', async () => {
    // ⚠️ 수수료 계산은 미지정을 brokered 로 폴백하지만, 그 폴백을 여기로 끌고 오면
    //    등록 유형이 생기기 전에 만들어진 매장이 통째로 막힌다.
    const r = await resolveAdsDbAccess(makeDB({ channel: null }), 11)
    expect(r.allowed).toBe(true)
    expect(r.allowed === true && r.reason).toBe('unclassified')
  })

  it('④-a 대표가 allow 하면 중개여도 열린다', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: 'brokered', override: 'allow' }), 14)
    expect(r.allowed).toBe(true)
  })

  it('④-b 대표가 deny 하면 직접이어도 막힌다', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: 'direct', override: 'deny' }), 20)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.code).toBe('ADS_DB_ADMIN_DENIED')
  })

  it('⑤-a 채널 미기록이어도 operator 만 있고 owner 가 없으면 차단(보강 신호)', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: null, operatorGrant: true }), 14)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.code).toBe('ADS_DB_AGENCY_BLOCKED')
  })

  it('⑤-b 사장님이 owner 로 승계하면 열린다', async () => {
    const r = await resolveAdsDbAccess(makeDB({ channel: null, operatorGrant: true, ownerGrant: true }), 14)
    expect(r.allowed).toBe(true)
  })

  it('셀러 ID 가 이상하면 거절한다', async () => {
    expect((await resolveAdsDbAccess(makeDB({}), 0)).allowed).toBe(false)
    expect((await resolveAdsDbAccess(makeDB({}), NaN)).allowed).toBe(false)
  })
})

describe('checkAdsDbQuota — 일일 열람 상한', () => {
  it('⑥-a 상한 미만이면 통과', async () => {
    const r = await checkAdsDbQuota(makeDB({ rowsToday: ADS_DB_DEFAULT_DAILY_ROW_CAP - 1 }), 20)
    expect(r.allowed).toBe(true)
  })

  it('⑥-b 상한에 닿으면 차단', async () => {
    const r = await checkAdsDbQuota(makeDB({ rowsToday: ADS_DB_DEFAULT_DAILY_ROW_CAP }), 20)
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.code).toBe('ADS_DB_QUOTA_EXCEEDED')
  })

  it('⑥-c platform_settings 로 상한을 바꿀 수 있다', async () => {
    expect((await checkAdsDbQuota(makeDB({ rowsToday: 60, cap: 50 }), 20)).allowed).toBe(false)
    expect((await checkAdsDbQuota(makeDB({ rowsToday: 60, cap: 100 }), 20)).allowed).toBe(true)
  })
})

describe('⑦ 배선 — 데이터 엔드포인트가 실제로 게이트를 부르는가', () => {
  // 순수함수가 아무리 맞아도 라우트가 안 부르면 DB 는 그대로 열려 있다.
  // 그래서 판정이 아니라 **호출**을 검사한다.
  const src = readFileSync('src/features/seller/api/seller-influencers.routes.ts', 'utf-8')

  /** 라우트 핸들러 본문만 잘라 낸다 — 파일 전체 검색은 다른 라우트의 호출에 걸려 헛돈다. */
  function handler(start: string): string {
    const i = src.indexOf(start)
    expect(i, `라우트가 사라졌다: ${start}`).toBeGreaterThan(-1)
    const j = src.indexOf('\n})', i)
    return src.slice(i, j > -1 ? j : undefined)
  }

  it('GET /list — 게이트 + 일일 상한 + 열람량 적립', () => {
    const h = handler("app.get('/list'")
    expect(h).toContain('await gateAdsDb(c as Ctx, { quota: true })')
    expect(h).toContain('if (denied) return denied')
    expect(h).toContain('recordAdsDbRows(')
  })

  it('GET /categories — 게이트 (카테고리 분포도 자산이다)', () => {
    const h = handler("app.get('/categories'")
    expect(h).toContain('await gateAdsDb(c as Ctx)')
    expect(h).toContain('if (denied) return denied')
  })

  it('POST /outreach — 게이트 (우리 발송 레일을 빌려주지 않는다)', () => {
    const h = handler("app.post('/outreach'")
    expect(h).toContain('await gateAdsDb(c as Ctx)')
    expect(h).toContain('if (denied) return denied')
  })

  it('연락처 컬럼은 여전히 SELECT 목록에 없다 (기존 정책 회귀 방지)', () => {
    const sel = src.slice(src.indexOf('SELECT id, platform, handle'), src.indexOf('FROM ad_influencer_leads'))
    expect(sel.length).toBeGreaterThan(0)
    for (const col of ['email', 'instagram', 'links', 'phone']) expect(sel).not.toContain(col)
  })

  it('어드민 수동 스위치는 /:id 보다 먼저 등록돼 있다 (Hono 는 등록 순서로 매칭)', () => {
    const admin = readFileSync('src/features/admin/api/admin-influencer-outreach.routes.ts', 'utf-8')
    const gate = admin.indexOf("app.get('/ads-db-access'")
    const byId = admin.indexOf("app.get('/:id'")
    expect(gate).toBeGreaterThan(-1)
    expect(byId).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(byId)
  })
})
