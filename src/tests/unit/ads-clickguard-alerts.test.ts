import { describe, it, expect, beforeEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { registerSite, recordHit, clickReport, domainMatches } from '@/features/marketing/api/clickguard'
import { computeAlerts, saveAlertSettings, runAlertsAll, type AlertSettings } from '@/features/marketing/api/alerts'

/**
 * 🆕 2026-06-30 유어애즈 — 부정클릭 탐지 집계 + 임계값 알림(가격 역전) 실행 검증.
 */
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

describe('UR Ads 부정클릭 — recordHit / clickReport', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('도메인 검증: 등록 도메인만 기록, 스푸핑 origin 거부', async () => {
    const reg = await registerSite(DB, 7, 'example.com')
    expect(reg.ok).toBe(true)
    const key = reg.advertiser_key!
    const hit = (origin: string) => recordHit(DB, 'salt', { key, ip: '1.2.3.4', country: 'KR', ua: 'ua', referrer: '', landingUrl: '', isAd: true, originOrReferer: origin })
    expect((await hit('https://example.com/land')).ok).toBe(true)   // 일치
    expect((await hit('https://shop.example.com/x')).ok).toBe(true) // 서브도메인 허용
    expect((await hit('https://evil.com/x')).ok).toBe(false)        // 스푸핑 거부(행 미기록)
    const rep = await clickReport(DB, 7)
    expect(rep.totalClicks).toBe(2) // evil.com 제외
  })

  it('같은 IP 8회+ → 의심 IP 로 리포트', async () => {
    const reg = await registerSite(DB, 9, 'shop.co.kr')
    const key = reg.advertiser_key!
    for (let i = 0; i < 9; i++) {
      await recordHit(DB, 'salt', { key, ip: '203.0.113.7', country: 'KR', ua: 'ua', referrer: '', landingUrl: '', isAd: true, originOrReferer: 'https://shop.co.kr/p' })
    }
    await recordHit(DB, 'salt', { key, ip: '198.51.100.2', country: 'US', ua: 'ua', referrer: '', landingUrl: '', isAd: false, originOrReferer: 'https://shop.co.kr/p' })
    const rep = await clickReport(DB, 9) // sellerId 9 (registerSite 와 일치)
    expect(rep.totalClicks).toBe(10)
    expect(rep.uniqueIps).toBe(2)
    expect(rep.adClicks).toBe(9)
    const suspect = rep.suspects.find(s => s.clicks >= 8)
    expect(suspect?.suspicious).toBe(true)  // 9회 ≥ 8 임계
    expect(rep.suspects.find(s => s.clicks === 1)?.suspicious).toBe(false)
  })

  it('domainMatches(순수): 서브도메인 허용 / 타도메인 거부 / 헤더 없으면 허용', () => {
    expect(domainMatches('example.com', 'https://example.com/a')).toBe(true)
    expect(domainMatches('example.com', 'https://www.example.com/a')).toBe(true)
    expect(domainMatches('example.com', 'https://a.example.com/a')).toBe(true)
    expect(domainMatches('example.com', 'https://evil.com')).toBe(false)
    expect(domainMatches('example.com', null)).toBe(true) // best-effort
  })
})

describe('UR Ads 임계값 알림 — computeAlerts 가격 역전(연동 없이)', () => {
  let DB: D1Database
  beforeEach(async () => {
    DB = makeD1()
    // computeAlerts 는 ad_price_watches 를 직접 조회 → 테이블만 준비하면 연동 없이 가격 알림 검증 가능
    await DB.prepare(`CREATE TABLE ad_price_watches (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER, query TEXT, my_price INTEGER, last_lowest INTEGER, last_mall TEXT)`).run()
  })
  const settings = (over: Partial<AlertSettings> = {}): AlertSettings => ({ enabled: 1, budget_pace_pct: 90, price_undercut: 1, rank_drop: 0, ...over })
  const env = (db: D1Database) => ({ DB: db, DATA_ENCRYPTION_KEY: 'k'.repeat(32) }) as unknown as Parameters<typeof computeAlerts>[0]

  it('내 판매가 > 최저가 → price 알림 1건', async () => {
    await DB.prepare('INSERT INTO ad_price_watches (seller_id, query, my_price, last_lowest, last_mall) VALUES (?,?,?,?,?)').bind(42, '무선이어폰', 15000, 12000, '경쟁몰').run()
    const alerts = await computeAlerts(env(DB), 42, settings())
    const price = alerts.filter(a => a.kind === 'price')
    expect(price).toHaveLength(1)
    expect(price[0].title).toContain('무선이어폰')
  })

  it('price_undercut=0 이면 가격 알림 억제', async () => {
    await DB.prepare('INSERT INTO ad_price_watches (seller_id, query, my_price, last_lowest, last_mall) VALUES (?,?,?,?,?)').bind(42, '무선이어폰', 15000, 12000, '경쟁몰').run()
    const alerts = await computeAlerts(env(DB), 42, settings({ price_undercut: 0 }))
    expect(alerts.filter(a => a.kind === 'price')).toHaveLength(0)
  })

  it('내 판매가 ≤ 최저가면 알림 없음(정상)', async () => {
    await DB.prepare('INSERT INTO ad_price_watches (seller_id, query, my_price, last_lowest, last_mall) VALUES (?,?,?,?,?)').bind(42, '무선이어폰', 11000, 12000, '경쟁몰').run()
    const alerts = await computeAlerts(env(DB), 42, settings())
    expect(alerts.filter(a => a.kind === 'price')).toHaveLength(0)
  })

  it('회귀: runAlertsAll dedup_key = 종류 조합(고정 daily 아님) → 새 종류는 재발송', async () => {
    // 알림 켠 계정 + 최저가 역전 워치 → 오늘 'price' 종류 1건.
    await saveAlertSettings(DB, 42, { enabled: true, price_undercut: true })
    await DB.prepare('INSERT INTO ad_price_watches (seller_id, query, my_price, last_lowest, last_mall) VALUES (?,?,?,?,?)').bind(42, '무선이어폰', 15000, 12000, '경쟁몰').run()
    const first = await runAlertsAll(env(DB))
    expect(first.sent).toBe(1)
    // dedup_key 가 'price'(종류 기반) 여야 함 — 'daily' 고정이면 새 종류가 억제됨(버그).
    const row = await DB.prepare("SELECT dedup_key FROM ad_alert_sent WHERE account_id = 42").first<{ dedup_key: string }>()
    expect(row?.dedup_key).toBe('price')
    // 같은 종류 재실행 → 멱등(재발송 0).
    expect((await runAlertsAll(env(DB))).sent).toBe(0)
  })
})
