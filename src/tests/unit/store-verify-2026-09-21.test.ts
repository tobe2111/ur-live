/**
 * ☎️⏳ 매장 확인 통화(사기 방어 ①) + 신규 매장 노출 유예(②).
 *
 * ## 이 시험이 **재는 것**
 * `recordVerifyCall` / `markExposureGrace` / `exposureReadySql` 의 실제 동작을 **진짜 SQLite**
 * 에 넣고 잰다 — 문자열 검사가 아니라 행을 세고, 술어를 실제 쿼리에 끼워 보이는 상품 id 를 센다.
 *
 * ## 이 시험이 **못 재는 것**(가드를 과신하지 말 것)
 *  - 어드민이 **실제로 전화를 거는지**. 기계는 "기록이 남을 자리가 있는가" 까지만 안다.
 *  - 010 번호가 **진짜 그 가게 번호인지**. 사기꾼은 자기 휴대폰을 적으면 그만이다.
 *  - 유예 시간이 **적절한지**(4시간? 24시간?). 그건 매출에 닿는 판단이라 대표가 정한다.
 *  - 라이브 D1 에 `seller_meta` 가 있는지 — 있다는 것은 2026-09-21 실측으로 확인했고,
 *    없는 환경을 위해 `repair-schema` 에 등록했다. 그 등록이 도는지는 배포 뒤에 판정된다(E4).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  recordVerifyCall, markExposureGrace, clearExposureGrace, listVerifyQueue, listVerifyCalls,
  getExposureGraceHours, VERIFY_CALL_RESULTS, EXPOSURE_FROM_KEY, VERIFIED_CALL_AT_KEY,
} from '@/worker/utils/store-verify'
import { exposureReadySql, approvedStatusSql, approvedSellerProductSql } from '@/shared/db/consumer-visible-product'
import { isMobileKr, normalizeKrPhone, needsManualCall } from '@/shared/store-phone'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const api = {
        bind(...a: unknown[]) { args = a; return api },
        async run() {
          const r = db.prepare(sql).run(...(args as never[]))
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
        async first<T>() { return (db.prepare(sql).get(...(args as never[])) ?? null) as T | null },
        async all<T>() { return { results: db.prepare(sql).all(...(args as never[])) as T[] } },
      }
      return api
    },
  } as never
}

let db: Db
let DB: never

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, phone TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));
           CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_supply_product INTEGER DEFAULT 0, supply_source_id INTEGER);
           CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT);`)
  db.exec(`INSERT INTO sellers (id, business_name, phone, status) VALUES
             (1, '확인된 가게', '010-1234-5678', 'approved'),
             (2, '방금 승인된 가게', '02-555-1234', 'approved'),
             (3, '심사 중인 가게', '010-9999-0000', 'pending');
           INSERT INTO products (id, seller_id) VALUES (11, 1), (12, 2), (13, 3);
           INSERT INTO products (id, seller_id) VALUES (14, NULL);`)
  DB = d1(db)
})

/** 술어를 실제 쿼리에 끼워서 "보이는 상품 id" 를 센다 — 문자열 검사가 아니다. */
function visibleIds(sql: string): number[] {
  return (db.prepare(`SELECT id FROM products p WHERE ${sql} ORDER BY id`).all() as Array<{ id: number }>)
    .map(r => r.id)
}

describe('☎️ 전화번호 판정', () => {
  it('010·011·016~019 는 휴대폰, 지역번호·대표번호·빈값은 아니다', () => {
    expect(isMobileKr('010-1234-5678')).toBe(true)
    expect(isMobileKr('01012345678')).toBe(true)
    expect(isMobileKr('+82 10 1234 5678')).toBe(true)
    expect(isMobileKr('011-222-3333')).toBe(true)
    expect(isMobileKr('02-555-1234')).toBe(false)
    expect(isMobileKr('1588-0000')).toBe(false)
    expect(isMobileKr('')).toBe(false)
    expect(isMobileKr(null)).toBe(false)
  })

  it('정규화는 하이픈·공백·국가번호를 지운다', () => {
    expect(normalizeKrPhone('010-1234-5678')).toBe('01012345678')
    expect(normalizeKrPhone('+82-10-1234-5678')).toBe('01012345678')
    expect(normalizeKrPhone(' (02) 555 1234 ')).toBe('025551234')
  })

  it('휴대폰이 아니면 사람이 직접 걸어야 한다', () => {
    expect(needsManualCall('02-555-1234')).toBe(true)
    expect(needsManualCall('010-1234-5678')).toBe(false)
  })
})

describe('⏳ 노출 유예 — 기본은 아무것도 안 가린다', () => {
  it('설정이 없으면 유예 0 이고 마커를 아예 안 쓴다', async () => {
    expect(await getExposureGraceHours(DB)).toBe(0)
    expect(await markExposureGrace(DB, 2, 'pending')).toBe(0)
    // 유예가 0 이면 `ensureStoreVerify` 자체가 안 돈다 ⇒ 마커 테이블이 **생기지도** 않는다.
    const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='seller_meta'").get()
    expect(t).toBeUndefined()
  })

  it('마커가 없으면 술어는 모든 상품을 통과시킨다 (= 오늘 라이브와 동일)', () => {
    db.exec(`CREATE TABLE IF NOT EXISTS seller_meta (seller_id INTEGER, key TEXT, value TEXT, updated_at TEXT, PRIMARY KEY (seller_id, key))`)
    expect(visibleIds(exposureReadySql('p'))).toEqual([11, 12, 13, 14])
  })

  it('유예가 켜지면 첫 승인 매장의 상품만 가려지고, 시간이 지나면 다시 보인다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '6')`)
    expect(await markExposureGrace(DB, 2, 'pending')).toBe(6)
    expect(visibleIds(exposureReadySql('p'))).toEqual([11, 13, 14])
    // 유예가 끝난 상태를 흉내 낸다 — 값이 과거면 술어가 통과시킨다.
    db.prepare(`UPDATE seller_meta SET value = datetime('now','-1 hours') WHERE seller_id = 2`).run()
    expect(visibleIds(exposureReadySql('p'))).toEqual([11, 12, 13, 14])
  })

  it('재승인(suspended→approved)에는 유예를 걸지 않는다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '6')`)
    expect(await markExposureGrace(DB, 1, 'suspended')).toBe(0)
    expect(await markExposureGrace(DB, 2, 'rejected')).toBe(6)
  })

  it('유예 시간은 7일을 넘지 못하고, 쓰레기 값은 0 으로 떨어진다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '9999')`)
    expect(await getExposureGraceHours(DB)).toBe(168)
    db.prepare(`UPDATE platform_settings SET value = 'abc' WHERE key = 'store_exposure_grace_hours'`).run()
    expect(await getExposureGraceHours(DB)).toBe(0)
    db.prepare(`UPDATE platform_settings SET value = '-5' WHERE key = 'store_exposure_grace_hours'`).run()
    expect(await getExposureGraceHours(DB)).toBe(0)
  })

  it('승인 술어와 유예 술어가 **둘 다** 걸린다 (합성이 한쪽을 삼키지 않는다)', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '6')`)
    await markExposureGrace(DB, 2, 'pending')
    // 승인 안 된 3 은 승인 술어가, 유예 중인 2 는 유예 술어가 가린다. 판매자 없는 14 는 둘 다 통과.
    expect(visibleIds(approvedStatusSql('p'))).toEqual([11, 12, 14])
    expect(visibleIds(exposureReadySql('p'))).toEqual([11, 13, 14])
    expect(visibleIds(approvedSellerProductSql('p'))).toEqual([11, 14])
  })
})

describe('☎️ 통화 기록', () => {
  it('정의 밖 결과는 거부하고, 없는 매장도 거부한다', async () => {
    expect((await recordVerifyCall(DB, { sellerId: 1, result: 'whatever' })).ok).toBe(false)
    expect((await recordVerifyCall(DB, { sellerId: 999, result: 'confirmed' })).ok).toBe(false)
    expect((await recordVerifyCall(DB, { sellerId: 0, result: 'confirmed' })).ok).toBe(false)
  })

  it('정의된 다섯 결과는 전부 받는다', async () => {
    for (const r of VERIFY_CALL_RESULTS) {
      expect((await recordVerifyCall(DB, { sellerId: 1, result: r })).ok).toBe(true)
    }
    expect((await listVerifyCalls(DB, 1)).length).toBe(VERIFY_CALL_RESULTS.length)
  })

  it('한 매장에 여러 행이 쌓인다 — 마지막 결과만 남기지 않는다', async () => {
    await recordVerifyCall(DB, { sellerId: 1, result: 'no_answer', note: '1차' })
    await recordVerifyCall(DB, { sellerId: 1, result: 'no_answer', note: '2차' })
    await recordVerifyCall(DB, { sellerId: 1, result: 'confirmed', note: '3차 연결' })
    const rows = await listVerifyCalls(DB, 1)
    expect(rows.length).toBe(3)
    expect(rows[0].result).toBe('confirmed') // 최신이 먼저
    expect(rows.map(r => r.note)).toContain('1차')
  })

  it('확인됨이면 확인 시각이 남고 유예가 **즉시** 풀린다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '6')`)
    await markExposureGrace(DB, 2, 'pending')
    expect(visibleIds(exposureReadySql('p'))).not.toContain(12)
    await recordVerifyCall(DB, { sellerId: 2, result: 'confirmed' })
    expect(visibleIds(exposureReadySql('p'))).toContain(12)
    const v = db.prepare('SELECT value FROM seller_meta WHERE seller_id = 2 AND key = ?').get(VERIFIED_CALL_AT_KEY) as { value: string } | undefined
    expect(v?.value).toBeTruthy()
  })

  it('🔴 "본인 아님" 은 매장을 끄지 않는다 — 기록만 남는다', async () => {
    await recordVerifyCall(DB, { sellerId: 1, result: 'denied', note: '다른 사람이 받음' })
    const s = db.prepare('SELECT status FROM sellers WHERE id = 1').get() as { status: string }
    expect(s.status).toBe('approved')
    expect(visibleIds(approvedSellerProductSql('p'))).toContain(11)
  })

  it('메모는 500자에서 자른다', async () => {
    await recordVerifyCall(DB, { sellerId: 1, result: 'no_answer', note: 'ㄱ'.repeat(900) })
    const rows = await listVerifyCalls(DB, 1)
    expect(rows[0].note?.length).toBe(500)
  })

  it('유예 해제는 멱등이다 (마커가 없어도 터지지 않는다)', async () => {
    await clearExposureGrace(DB, 1)
    await clearExposureGrace(DB, 1)
    expect(true).toBe(true)
  })
})

describe('📋 확인 대기 큐', () => {
  it('승인된 매장만, 확인 끝난 곳은 빼고 보여 준다', async () => {
    await recordVerifyCall(DB, { sellerId: 1, result: 'confirmed' })
    const q = await listVerifyQueue(DB)
    const ids = q.map(r => r.seller_id)
    expect(ids).toContain(2)      // 승인됐고 미확인
    expect(ids).not.toContain(1)  // 확인 끝
    expect(ids).not.toContain(3)  // 아직 심사 중 — 노출 자체가 막혀 있다
  })

  it('include_done 이면 확인된 곳도 함께 보여 준다', async () => {
    await recordVerifyCall(DB, { sellerId: 1, result: 'confirmed' })
    const q = await listVerifyQueue(DB, { includeDone: true })
    expect(q.map(r => r.seller_id)).toContain(1)
  })

  it('유예 중인 매장이 맨 위에 온다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_exposure_grace_hours', '6')`)
    await markExposureGrace(DB, 2, 'pending')
    const q = await listVerifyQueue(DB)
    expect(q[0].seller_id).toBe(2)
    expect(q[0].exposure_from).toBeTruthy()
  })

  it('번호가 휴대폰이 아니면 "직접 걸어야 함" 으로 표시된다', async () => {
    const q = await listVerifyQueue(DB, { includeDone: true })
    const byId = new Map(q.map(r => [r.seller_id, r]))
    expect(byId.get(2)?.needs_manual_call).toBe(true)   // 02-555-1234
    expect(byId.get(1)?.needs_manual_call).toBe(false)  // 010-…
  })

  it('지난 통화 결과가 큐에 실려 온다 (두 번 걸 때 무엇을 이어서 할지 알아야 한다)', async () => {
    await recordVerifyCall(DB, { sellerId: 2, result: 'no_answer' })
    const q = await listVerifyQueue(DB)
    expect(q.find(r => r.seller_id === 2)?.last_result).toBe('no_answer')
  })
})

describe('🔒 돈·상태 경계 — 이 레일은 매장을 끄지도 환불하지도 않는다', () => {
  const util = stripComments(readFileSync('src/worker/utils/store-verify.ts', 'utf-8'))
  const route = stripComments(readFileSync('src/features/admin/api/admin-store-owner.routes.ts', 'utf-8'))
  const ui = stripComments(readFileSync('src/pages/admin-store-owner/StoreVerifyQueue.tsx', 'utf-8'))

  it('util 이 환불·원장·정산·매장 비활성화를 건드리지 않는다', () => {
    expect(util).not.toMatch(/refund|Refund|환불/)
    expect(util).not.toMatch(/ledger_entries|adjustUserPoints|payout/)
    expect(util).not.toMatch(/UPDATE sellers SET/)
    expect(util).not.toMatch(/is_active\s*=\s*0/)
  })

  it('어드민 화면에 정지·환불 버튼이 없다', () => {
    expect(ui).not.toMatch(/환불|판매\s*중지|정지/)
  })

  it('통화 기록 라우트는 finance 권한 + 감사로그를 통과해야 한다', () => {
    expect(route).toMatch(/verify-call[\s\S]{0,220}requireAdminRole\('finance'\)/)
    expect(route).toMatch(/verify-call[\s\S]{0,260}auditLog\('stores\.verify_call'\)/)
  })

  it('큐 조회도 로그인 없이는 못 본다', () => {
    expect(route).toMatch(/store-verify\/queue'[^\n]*requireAdminRole\('finance'\)/)
  })
})

describe('🔌 배선 — 한쪽만 붙으면 조용히 안 돈다', () => {
  it('승인 경로 **둘 다** 부수효과 훅을 부른다', () => {
    // 승인 경로가 둘이라 손으로 붙이면 한쪽만 붙는 날이 온다 ⇒ `seller-approved-hooks` 한 함수로 모았다.
    const a = stripComments(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))
    const b = stripComments(readFileSync('src/features/admin/api/admin-tools.routes.ts', 'utf-8'))
    expect(a).toMatch(/runSellerApprovedHooks\(/)
    expect(b).toMatch(/runSellerApprovedHooks\(/)
    const hook = stripComments(readFileSync('src/worker/utils/seller-approved-hooks.ts', 'utf-8'))
    expect(hook, '훅이 유예 마커를 안 부른다').toMatch(/markExposureGrace\(/)
  })

  it('소비자 노출 술어가 유예를 포함한다 (합성을 지우면 유예가 아무 데도 안 걸린다)', () => {
    const s = stripComments(readFileSync('src/shared/db/consumer-visible-product.ts', 'utf-8'))
    expect(s).toMatch(/approvedStatusSql\(alias\)\}\s*AND\s*\$\{exposureReadySql\(alias\)/)
  })

  it('어드민 화면이 실제로 붙어 있다', () => {
    const p = stripComments(readFileSync('src/pages/AdminStoreOwnerPage.tsx', 'utf-8'))
    expect(p).toMatch(/<StoreVerifyQueue\b/)
  })

  it('두 테이블이 repair-schema 에도 등록돼 있다 (런타임 ensure 만 믿지 않는다)', () => {
    const r = readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf-8')
    expect(r).toMatch(/desc: 'store_verify_calls'/)
    expect(r).toMatch(/desc: 'seller_meta'/)
  })

  it('마커 키 이름이 술어와 util 에서 같다 (갈리면 조용히 안 가려진다)', () => {
    expect(exposureReadySql('p')).toContain(`'${EXPOSURE_FROM_KEY}'`)
  })
})
