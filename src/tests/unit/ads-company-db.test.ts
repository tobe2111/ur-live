import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  ADS_COMPANY_TABLES, ADS_LEADS_TABLES, adsLeadsDb,
  touchesAdsCompanyTable, touchesAdsLeadsTable,
} from '../../shared/ads/leads-db'

/**
 * 🏢 **업체 계열이 자기 DB로 간다** (2026-08-23)
 *
 * 유어애즈 DB 가 500MB 한도의 94% 에 닿았다 — 본진에서 겪은 "꽉 차서 새 행 INSERT 실패 →
 * 로그인·주문 정지" 를 유어애즈에서 반복하기 직전이었다. 실측으로 회수량이 가장 큰 조합
 * (업체 리드 358,185행 × 6인덱스)을 골라 `ADS_COMPANY_DB` 로 옮겼다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 바인딩 존재 여부(Cloudflare 대시보드 소관)와 이관 완결성.
 *    후자는 키 집합 전수 대조로만 판정되고, 그 절차는 인계 문서에 있다.
 */
function fakeDb(tag: string) {
  const seen: string[] = []
  const mk = (sql: string) => ({
    bind: () => mk(sql), first: async () => null, all: async () => ({ results: [] }),
    run: async () => ({ meta: {} }), raw: async () => [],
  })
  return {
    tag, seen,
    prepare(sql: string) { seen.push(sql); return mk(sql) },
    async batch(stmts: unknown[]) { seen.push(`BATCH:${stmts.length}`); return [] },
    async exec(sql: string) { seen.push(`EXEC:${sql}`); return {} },
    async dump() { return {} },
  }
}

describe('업체 전용 DB 라우팅', () => {
  it('🔑 업체 테이블은 ADS_COMPANY_DB 로 간다', () => {
    const main = fakeDb('main'); const ads = fakeDb('ads'); const co = fakeDb('company')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads, ADS_COMPANY_DB: co } as never) as never as ReturnType<typeof fakeDb>
    db.prepare('SELECT * FROM ad_company_leads WHERE id = ?')
    db.prepare('SELECT * FROM ad_company_keywords')
    expect(co.seen.length, '업체 쿼리가 업체 DB로 안 갔다').toBe(2)
    expect(ads.seen.length).toBe(0)
    expect(main.seen.length).toBe(0)
  })

  it('🔑 업체가 아닌 리드는 여전히 ADS_DB 로 간다', () => {
    const main = fakeDb('main'); const ads = fakeDb('ads'); const co = fakeDb('company')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads, ADS_COMPANY_DB: co } as never) as never as ReturnType<typeof fakeDb>
    db.prepare('SELECT * FROM ad_influencer_leads')
    db.prepare('SELECT * FROM store_prospects')
    expect(ads.seen.length, '인플루언서·매장이 엉뚱한 DB로 갔다').toBe(2)
    expect(co.seen.length).toBe(0)
  })

  it('🔑 리드가 아닌 것은 메인 DB로 간다', () => {
    const main = fakeDb('main'); const ads = fakeDb('ads'); const co = fakeDb('company')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads, ADS_COMPANY_DB: co } as never) as never as ReturnType<typeof fakeDb>
    db.prepare("SELECT value FROM platform_settings WHERE key = 'x'")
    expect(main.seen.length).toBe(1)
    expect(ads.seen.length + co.seen.length).toBe(0)
  })

  it('🩸 ADS_COMPANY_DB 미바인딩이면 ADS_DB 로 폴백한다 (배선 선배포가 안전해야 한다)', () => {
    const main = fakeDb('main'); const ads = fakeDb('ads')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads } as never) as never as ReturnType<typeof fakeDb>
    db.prepare('SELECT * FROM ad_company_leads')
    expect(ads.seen.length, '미바인딩인데 업체 쿼리가 사라졌다').toBe(1)
    expect(main.seen.length).toBe(0)
  })

  it('🩸 업체 판정이 리드 판정보다 **먼저**여야 한다 (순서가 뒤집히면 새 DB로 안 간다)', () => {
    // 업체 테이블은 ADS_LEADS_TABLES 에도 들어 있다 — 리드를 먼저 보면 전부 ads 로 샌다.
    for (const t of ADS_COMPANY_TABLES) {
      expect(ADS_LEADS_TABLES as readonly string[]).toContain(t)
      expect(touchesAdsCompanyTable(`SELECT 1 FROM ${t}`), `${t} 가 업체 판정에서 빠졌다`).toBe(true)
      expect(touchesAdsLeadsTable(`SELECT 1 FROM ${t}`)).toBe(true)
    }
    const src = readFileSync('src/shared/ads/leads-db.ts', 'utf8')
    const m = /const sideOf[\s\S]{0,220}?=>\s*\(([\s\S]{0,220}?)\)\n/.exec(src)
    expect(m, 'sideOf 판정식을 못 찾았다').toBeTruthy()
    expect(m![1].indexOf('touchesAdsCompanyTable'), '업체 판정이 먼저가 아니다')
      .toBeLessThan(m![1].indexOf('touchesAdsLeadsTable'))
  })

  it('🩸 서로 다른 DB를 섞은 batch 는 조용히 반쪽 반영되지 않고 터진다', async () => {
    const main = fakeDb('main'); const ads = fakeDb('ads'); const co = fakeDb('company')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads, ADS_COMPANY_DB: co } as never) as never as {
      prepare: (s: string) => unknown; batch: (a: unknown[]) => Promise<unknown>
    }
    const a = db.prepare('UPDATE ad_company_leads SET status = ?')
    const b = db.prepare('UPDATE ad_influencer_leads SET status = ?')
    await expect(db.batch([a, b])).rejects.toThrow(/섞었다/)
    // 같은 DB끼리는 정상 통과해야 한다(과잉 차단 방지).
    const c = db.prepare('UPDATE ad_company_keywords SET hits = 1')
    await expect(db.batch([a, c])).resolves.toBeDefined()
  })

  it('🔁 미바인딩 창에서는 업체+리드 batch 가 터지면 안 된다(둘이 같은 DB다)', async () => {
    // 배선을 먼저 배포하는 창(=`ADS_COMPANY_DB` 아직 없음)에서 company 는 ads 로 폴백한다.
    // 그때 이름으로 판정하면 멀쩡한 batch 가 죽어 **수집 레인이 통째로 멈춘다** —
    // 그래서 판정은 이름이 아니라 실제 DB 객체로 한다. (CI 가 이 회귀를 실제로 잡았다.)
    const main = fakeDb('main'); const ads = fakeDb('ads')
    const db = adsLeadsDb({ DB: main, ADS_DB: ads } as never) as never as {
      prepare: (s: string) => unknown; batch: (a: unknown[]) => Promise<unknown>
    }
    const a = db.prepare('INSERT INTO ad_company_leads (a) VALUES (1)')
    const b = db.prepare('DELETE FROM store_prospects WHERE id = 1')
    await expect(db.batch([a, b])).resolves.toBeDefined()
    expect(ads.seen.includes('BATCH:2'), '폴백 batch 가 옛 리드 DB로 안 갔다').toBe(true)
  })
})
