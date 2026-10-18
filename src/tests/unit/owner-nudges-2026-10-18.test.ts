/**
 * 📮 2026-10-18 — 자동 안내 셋(④ 일일 리포트 · ⑤ 후기 요청 · ⑥ 서류 보완)의 판정을 고정한다.
 * ⚠️ 못 막는 것: 실제 메일·알림 도착 · 숫자가 보기 좋은지 — S-NUDGES 절차로 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { yesterdayKstRange, missingDocs, docsNudgeDue, escHtml } from '@/worker/utils/owner-nudges'
import { REVIEW_REQUEST_SQL, reviewLink } from '@/worker/cron/review-request'
import { d1Ms, missingLabels, buildDocsNudgeHTML } from '@/worker/cron/seller-docs-nudge'
import { buildReportHTML } from '@/worker/cron/seller-daily-report'

const read = (p: string) => readFileSync(p, 'utf8')

describe('④ 어제(한국시간) 범위', () => {
  it('KST 새벽 3:40 회차는 어제 하루를 D1 형식 UTC 로 준다', () => {
    // 2026-10-18 03:40 KST = 2026-10-17 18:40 UTC
    const r = yesterdayKstRange(new Date('2026-10-17T18:40:00Z'))
    expect(r).toEqual({ date: '2026-10-17', start: '2026-10-16 15:00:00', end: '2026-10-17 15:00:00' })
  })
  it('월말·연말 경계에서 날짜가 32일이 되지 않는다', () => {
    expect(yesterdayKstRange(new Date('2026-10-31T18:40:00Z')).date).toBe('2026-10-31')
    expect(yesterdayKstRange(new Date('2027-01-01T00:30:00Z')).date).toBe('2026-12-31')
  })
  it('D1 형식이라 ISO(T·Z)가 섞이지 않는다', () => {
    const r = yesterdayKstRange(new Date('2026-10-17T18:40:00Z'))
    expect(r.start).not.toMatch(/[TZ]/)
    expect(r.end).not.toMatch(/[TZ]/)
  })
  it('대상은 승인(approved)·active 둘 다, 옛 라이브 문구 없음', () => {
    const src = read('src/worker/cron/seller-daily-report.ts')
    expect(src).toMatch(/\? `status IN \('approved','active'\)`/)  // 게이트 ON 분기(OFF 분기에도 같은 말이 있어 그쪽은 앵커 아님)
    expect(buildReportHTML('가게', '2026-10-17', { sold: 1, soldAmount: 1000, used: 0, orders: 0, orderAmount: 0, newReviews: 0, avgRating: 0 }))
      .not.toMatch(/시청자|라이브/)
  })
  it('HTML 탈출', () => {
    expect(escHtml('<b>&"')).toBe('&lt;b&gt;&amp;&quot;')
    expect(buildReportHTML('<x>', '2026', { sold: 1, soldAmount: 0, used: 0, orders: 0, orderAmount: 0, newReviews: 0, avgRating: 0 })).not.toContain('<x>')
  })
})

describe('⑥ 서류 보완 판정', () => {
  it('빠진 항목을 정확히 고른다', () => {
    const m = missingDocs({ business_number: '1234567890', representative_name: ' ', business_start_date: null, business_registration_image_url: 'x' })
    expect(missingLabels(m)).toEqual(['대표자 이름', '개업일'])
  })
  it('3일째 1회 · 7일째(4일 뒤) 1회 · 그 뒤 없음', () => {
    expect(docsNudgeDue(2, 0, null)).toBe(false)
    expect(docsNudgeDue(3, 0, null)).toBe(true)
    expect(docsNudgeDue(6, 1, 3)).toBe(false)
    expect(docsNudgeDue(7, 1, 3)).toBe(false)
    expect(docsNudgeDue(7, 1, 4)).toBe(true)
    expect(docsNudgeDue(30, 2, 20)).toBe(false)
  })
  it('D1 시각 파싱(Z 없음 = UTC)', () => {
    expect(d1Ms('2026-10-17 15:00:00')).toBe(Date.parse('2026-10-17T15:00:00Z'))
    expect(d1Ms('bad')).toBeNull()
    expect(d1Ms(null)).toBeNull()
  })
  it('안내 메일은 서류 화면으로 보내고 항목을 탈출한다', () => {
    const html = buildDocsNudgeHTML('<가게>', ['대표자 이름'])
    expect(html).toContain('https://urdeal.kr/seller/business-info')
    expect(html).not.toContain('<가게>')
  })
  it('기록을 먼저 남기고 보낸다(실패해도 같은 날 두 번 안 감)', () => {
    const src = read('src/worker/cron/seller-docs-nudge.ts')
    expect(src.indexOf('setSellerMeta(DB, r.id')).toBeGreaterThan(0)
    expect(src.indexOf('setSellerMeta(DB, r.id')).toBeLessThan(src.indexOf('notifySeller(DB, r.id'))
  })
})

describe('⑤ 후기 요청 쿼리(실제 SQLite)', () => {
  const req = createRequire(import.meta.url)
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => { exec(s: string): void; prepare(s: string): { all(...a: unknown[]): unknown[] } } }
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, restaurant_name TEXT, category TEXT, slug TEXT);
    CREATE TABLE vouchers (id INTEGER PRIMARY KEY, user_id TEXT, product_id INTEGER, status TEXT, used_at TEXT, is_experience INTEGER);
    CREATE TABLE product_reviews (id INTEGER PRIMARY KEY, product_id INTEGER, user_id TEXT);
    CREATE TABLE notifications (id INTEGER PRIMARY KEY, user_id TEXT, type TEXT);
    INSERT INTO products VALUES (1,'닭도리탕','달빛','meal_voucher',NULL),(2,'데모','데모집','meal_voucher','demo-deal-1'),(3,'펜션','바다','stay_voucher',NULL);
    INSERT INTO vouchers VALUES
      (10,'u1',1,'used',datetime('now','-30 hours'),0),
      (11,'u2',1,'used',datetime('now','-30 hours'),1),
      (12,'u3',2,'used',datetime('now','-30 hours'),0),
      (13,'u4',1,'used',datetime('now','-3 hours'),0),
      (14,'u5',1,'used',datetime('now','-30 hours'),0),
      (15,'u6',3,'used',datetime('now','-30 hours'),0),
      (16,'u7',1,'used',datetime('now','-30 hours'),0),
      (17,'u8',1,'unused',NULL,0);
    INSERT INTO product_reviews VALUES (1,1,'u5');
    INSERT INTO notifications VALUES (1,'u7','review_request_16');`)
  it('하루 전 사용 · 유료 · 데모 아님 · 후기 없음 · 미요청만 고른다', () => {
    const rows = db.prepare(REVIEW_REQUEST_SQL).all(300) as Array<{ voucher_id: number }>
    expect(rows.map(r => r.voucher_id).sort()).toEqual([10, 15])
  })
  it('숙소는 /stays, 나머지는 /pass', () => {
    expect(reviewLink(3, 'stay_voucher')).toBe('/stays/3')
    expect(reviewLink(1, 'meal_voucher')).toBe('/pass/1')
  })
})

describe('게이트 등록 셋(기본 OFF)', () => {
  const gates = read('src/features/admin/api/admin-system-monitoring.routes.ts')
  const valid = read('src/worker/utils/platform-settings-validation.ts')
  const page = read('src/pages/AdminPlatformSettingsPage.tsx')
  for (const k of ['seller_daily_report_enabled', 'review_request_enabled', 'seller_docs_nudge_enabled']) {
    it(k, () => {
      expect(gates).toMatch(new RegExp(`key: '${k}', kind: 'setting'[^\\n]*default_value: 'false'`))
      expect(valid).toContain(`${k}: boolStr`)
      expect(page).toContain(`'${k}'`)
    })
  }
  it('배치에 셋 다 배선돼 있다', () => {
    const lane = read('src/worker/cron/daily-lane.ts')
    expect(lane).toMatch(/await handleSellerDailyReport\(env\)/)
    expect(lane).toMatch(/await handleReviewRequest\(env\)/)
    expect(lane).toMatch(/await handleSellerDocsNudge\(env\)/)
  })
})
