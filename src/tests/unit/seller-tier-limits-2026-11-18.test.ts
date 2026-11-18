/**
 * 🩸 2026-11-18 셀러 등급별 이용권 월 한도 — 대표 "영구적으로 고쳐줘".
 *
 * 종전: `seller_tier_history.tier_name`(라이브에 없는 칸)을 읽다 조회가 던져 **모든 셀러가 브론즈 5개**였다.
 * 지키는 것(진짜 SQLite · 라이브 표 모양):
 *  1. 등급의 진실은 `sellers.tier`(등급 계산 cron 이 쓰는 영어 코드) — 실버 셀러는 실버 한도(20)를 받는다.
 *  2. 다이아는 무제한, new·모르는 값·null 은 브론즈(종전 기본값).
 *  3. 소개 할인 권한도 같은 등급에서 나온다(브론즈 X · 실버 O).
 *  4. 매핑 표가 등급 계산 cron 의 코드 전부를 덮는다(새 등급이 생기면 여기서 빨개진다).
 * 못 막는 것: 한도 표(`seller_tiers`) 값 자체 — 그건 어드민 데이터다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { checkVoucherLimit, canEnableReferral, TIER_CODE_TO_NAME } from '@/worker/utils/seller-tier-limits'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

function env() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, tier TEXT);
    CREATE TABLE seller_tiers (name TEXT, voucher_monthly_limit INT, referral_allowed INT);
    CREATE TABLE seller_tier_history (id INTEGER PRIMARY KEY, seller_id INT, prev_tier TEXT, new_tier TEXT, changed_at TEXT);
    CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INT, category TEXT, created_at TEXT);
    INSERT INTO seller_tiers VALUES ('브론즈',5,0),('실버',20,1),('골드',50,1),('플래티넘',200,1),('다이아',-1,1);
    INSERT INTO sellers VALUES (1,'silver'),(2,'diamond'),(3,'new'),(4,NULL),(5,'weird'),(6,'bronze'),(7,'Gold');`)
  const DB = {
    prepare: (sql: string) => {
      let args: unknown[] = []
      const st = {
        bind: (...a: unknown[]) => { args = a; return st },
        first: async () => (db.prepare(sql).get(...(args as never[])) ?? null),
      }
      return st
    },
  } as unknown as D1Database
  return { DB }
}

describe('셀러 등급별 이용권 월 한도', () => {
  it('sellers.tier 로 등급을 정한다', async () => {
    const e = env()
    expect((await checkVoucherLimit(e, 1)).monthly_limit).toBe(20)
    expect((await checkVoucherLimit(e, 1)).tier_name).toBe('실버')
    expect((await checkVoucherLimit(e, 2)).monthly_limit).toBe(-1)
    expect((await checkVoucherLimit(e, 7)).monthly_limit).toBe(50) // 대소문자 무관
    for (const id of [3, 4, 5, 6]) expect((await checkVoucherLimit(e, id)).monthly_limit, String(id)).toBe(5)
  })
  it('소개 할인 권한도 같은 등급에서', async () => {
    const e = env()
    expect(await canEnableReferral(e, 6)).toBe(false)
    expect(await canEnableReferral(e, 1)).toBe(true)
  })
  it('등급 계산 cron 의 코드를 전부 덮는다', () => {
    const src = fs.readFileSync('src/worker/cron/seller-tier-eval.ts', 'utf8')
    const codes = /export type SellerTier = ([^;]+);/.exec(src)![1].match(/'([a-z]+)'/g)!.map((x) => x.slice(1, -1))
    for (const c of codes) expect(TIER_CODE_TO_NAME[c], c).toBeTruthy()
  })
})

// 🗑️ 같은 날 [UNLOCK_LOADING] — 호출자 0 인 `/api/home/bundle` 을 5분 예열에서 뺐다(대표 승인).
describe('예열 목록에 아무도 안 부르는 주소가 없다', () => {
  it('/api/home/bundle 은 예열하지 않는다(화면 호출자 0)', () => {
    const src = fs.readFileSync('src/worker/cron/cache-prewarm.ts', 'utf8')
    const list = /const HOT_PATHS: readonly string\[\] = \[([\s\S]*?)\n\]/.exec(src)![1]
    expect(list.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')).not.toMatch(/'\/api\/home\/bundle'/)
  })
})
