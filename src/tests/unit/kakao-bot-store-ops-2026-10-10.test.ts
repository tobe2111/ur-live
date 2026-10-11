/**
 * 💬 카카오톡 채널 챗봇으로 매장 관리 (2026-10-10, 대표 "카카오톡으로 유어딜 세팅도 가능해? 이용권 관리같은거")
 *
 * 진짜 `node:sqlite` 에 넣고 **스킬 엔드포인트를 실제로 두드린다** — 문자열 검사가 아니다.
 * 지키는 것:
 *   ① 시크릿 없으면 404 (봇 존재 자체 비노출) · 게이트 OFF 면 연결·명령은 "준비 중", FAQ 는 종전 그대로
 *   ② 연결 코드는 1회용 · 10분 만료 · 봇 키당 시간당 실패 5회에서 잠긴다
 *   ③ 매 명령마다 좌석을 다시 본다 — 회수되면 거절하고 연결을 지운다
 *   ④ 사용 처리는 "네" 확인 뒤에만, **이 매장의** 미사용 이용권만, 한 번만 (원장 기록 포함)
 *   ⑤ 판매 중지/재개는 이 매장 상품만 (목록 스냅샷이 오염돼도 `seller_id` 로 막힌다)
 *   ⑥ 대시보드 연결 코드 발급은 그 매장 좌석에 있는 사람만
 *   ⑦ 계산대 스캔(use-by-seller)과 챗봇이 **같은 사용 처리 함수**를 쓴다 · 원장 블록에 설정 게이트 없음
 *
 * ⚠️ 이 시험이 못 막는 것: 오픈빌더의 실제 요청 모양(`userRequest.user.id`)이 문서와 다른 경우 ·
 *   카카오 쪽 응답 표시(퀵리플라이 렌더) · 원장 3종이 라이브 D1 에서 남기는 행(staging S-KAKAOBOT-5).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { readCode, stripComments } from '../helpers/source-text'
import skillApp, { STORE_OPS_NOT_READY, STORE_SEAT_REVOKED } from '@/worker/routes/kakao-skill-webhook.routes'
import { issueLinkCode, LINK_FAIL_LIMIT_PER_HOUR } from '@/worker/utils/kakao-bot-store'
import { registerKakaoBotLinkRoutes } from '@/features/seller/api/seller-kakao-bot.routes'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
    exec: (sql: string) => void
  }
}

type RawDb = InstanceType<typeof DatabaseSync>

function makeD1(): { DB: D1Database; db: RawDb } {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a.map((v) => (typeof v === 'boolean' ? Number(v) : v)); return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const DB = {
    prepare: (sql: string) => wrap(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of stmts) out.push(await s.run()); return out },
  } as unknown as D1Database
  return { DB, db }
}

const SCHEMA = `
CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT, business_name TEXT, name TEXT, username TEXT, address TEXT, email TEXT, seller_type TEXT, is_distributor INTEGER);
CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, phone TEXT);
CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, restaurant_name TEXT, category TEXT, is_active INTEGER DEFAULT 1, status TEXT, price INTEGER, updated_at TEXT);
CREATE TABLE vouchers (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, user_id TEXT, code TEXT UNIQUE, status TEXT, used_at TEXT, expires_at TEXT, created_at TEXT DEFAULT (datetime('now')), applied_price INTEGER);
CREATE TABLE orders (id INTEGER PRIMARY KEY, seller_id INTEGER, status TEXT, total_amount INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE rate_limit_attempts (key TEXT, action TEXT, window_start INTEGER, count INTEGER, PRIMARY KEY (key, action, window_start));
CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at DATETIME, revoked_at DATETIME, created_at DATETIME);
CREATE TABLE ledger_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT NOT NULL, reference_id TEXT NOT NULL, amount INTEGER NOT NULL, debit_account TEXT NOT NULL, credit_account TEXT NOT NULL, fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
`
// ⚠️ ledger.ts 의 ensureLedgerTable 은 **모듈 전역** 플래그로 DDL 을 한 번만 돈다 — 시험마다 새 DB 를 쓰므로
//   원장 테이블은 스키마에 직접 둔다(DDL 문장은 ledger.ts 와 같다).

function seed(db: RawDb) {
  db.exec(SCHEMA)
  // 매장 10: 사장님 user 100 이 소유(linked) · 매장 20: 다른 사장님 user 200
  db.exec(`INSERT INTO sellers (id, linked_user_id, status, business_name) VALUES (10, 100, 'approved', '김밥천국 역삼점'), (20, 200, 'approved', '남의 가게')`)
  db.exec(`INSERT INTO users (id, name) VALUES (100, '사장님'), (200, '남')`)
  db.exec(`INSERT INTO products (id, seller_id, name, category, is_active, price) VALUES
    (1, 10, '김밥 세트 이용권', 'meal_voucher', 1, 9000),
    (2, 10, '라면 이용권', 'meal_voucher', 1, 5000),
    (3, 20, '남의 이용권', 'meal_voucher', 1, 7000)`)
  db.exec(`INSERT INTO vouchers (id, order_id, product_id, user_id, code, status, expires_at, applied_price) VALUES
    (1, 501, 1, '7', 'UR-AAAA-1111', 'unused', datetime('now', '+30 days'), 9000),
    (2, 502, 3, '8', 'UR-BBBB-2222', 'unused', datetime('now', '+30 days'), 7000),
    (3, 503, 2, '9', 'UR-CCCC-3333', 'unused', datetime('now', '-1 day'), 5000)`)
  db.exec(`INSERT INTO orders (seller_id, status, total_amount) VALUES (10, 'PAID', 9000), (10, 'DONE', 5000), (10, 'CANCELLED', 999), (20, 'PAID', 7000)`)
}

const SECRET = 'skill-secret'
const KEY = 'bot-user-key-abc'

function makeEnv(DB: D1Database, extra: Record<string, string | undefined> = {}) {
  return { DB, KAKAO_SKILL_SECRET: SECRET, KAKAO_BOT_STORE_OPS_ENABLED: 'true', JWT_SECRET: 'jwt-secret', ...extra }
}

async function say(env: Record<string, unknown>, utterance: string, key: string | null = KEY, secret: string | null = SECRET) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (secret !== null) headers['x-skill-secret'] = secret
  const body = { userRequest: { utterance, ...(key ? { user: { id: key } } : {}) } }
  const res = await skillApp.request('/api/cs/kakao-skill', { method: 'POST', headers, body: JSON.stringify(body) }, env)
  const json = await res.json().catch(() => null) as { template?: { outputs?: Array<{ simpleText?: { text?: string } }>; quickReplies?: Array<{ label: string }> } } | null
  return { status: res.status, text: json?.template?.outputs?.[0]?.simpleText?.text ?? '', quick: (json?.template?.quickReplies ?? []).map((q) => q.label) }
}

const one = <T,>(db: RawDb, sql: string): T => db.prepare(sql).get() as T

async function linkAs(env: ReturnType<typeof makeEnv>, userId = 100, sellerId = 10, key = KEY) {
  const code = await issueLinkCode(env.DB, userId, sellerId)
  expect(code).toMatch(/^\d{6}$/)
  const r = await say(env, `연결 ${code}`, key)
  expect(r.text).toContain('연결됐어요')
  return code!
}

describe('① 게이트', () => {
  let DB: D1Database, db: RawDb
  beforeEach(() => { ({ DB, db } = makeD1()); seed(db) })

  it('시크릿이 없으면 404 — 봇 존재 자체를 숨긴다', async () => {
    const r = await say(makeEnv(DB, { KAKAO_SKILL_SECRET: undefined }), '오늘')
    expect(r.status).toBe(404)
  })

  it('헤더 시크릿이 틀리면 403', async () => {
    const r = await say(makeEnv(DB), '오늘', KEY, 'wrong')
    expect(r.status).toBe(403)
  })

  it('매장 관리 게이트 OFF — 연결은 "준비 중", FAQ 는 종전 그대로', async () => {
    const env = makeEnv(DB, { KAKAO_BOT_STORE_OPS_ENABLED: undefined })
    const code = await issueLinkCode(DB, 100, 10)
    const linked = await say(env, `연결 ${code}`)
    expect(linked.status).toBe(200)
    expect(linked.text).toBe(STORE_OPS_NOT_READY)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM kakao_bot_links').n).toBe(0)
    // 코드는 소비되지 않는다(켜진 뒤에 쓸 수 있게)
    expect(one<{ used_at: string | null }>(db, `SELECT used_at FROM kakao_bot_link_codes WHERE code = '${code}'`).used_at).toBeNull()
    const faq = await say(env, 'QR 사용법')
    expect(faq.text).toContain('QR')
    expect(faq.text).not.toBe(STORE_OPS_NOT_READY)
  })

  it('게이트 OFF 인데 이미 연결된 사람의 명령 → "준비 중" (데이터 안 보인다)', async () => {
    await linkAs(makeEnv(DB))
    const r = await say(makeEnv(DB, { KAKAO_BOT_STORE_OPS_ENABLED: undefined }), '오늘')
    expect(r.text).toBe(STORE_OPS_NOT_READY)
  })

  it('어드민 설정값(platform_settings)으로도 켜진다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('kakao_bot_store_ops_enabled', 'true')`)
    const env = makeEnv(DB, { KAKAO_BOT_STORE_OPS_ENABLED: undefined })
    await linkAs(env)
  })
})

describe('② 연결 코드', () => {
  let DB: D1Database, db: RawDb, env: ReturnType<typeof makeEnv>
  beforeEach(() => { ({ DB, db } = makeD1()); seed(db); env = makeEnv(DB) })

  it('1회용 — 같은 코드를 두 번째로 보내면 거절', async () => {
    const code = await linkAs(env)
    const again = await say(env, `연결 ${code}`, 'another-key')
    expect(again.text).toContain('맞지 않거나')
    expect(one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM kakao_bot_links WHERE bot_user_key = 'another-key'").n).toBe(0)
  })

  it('만료된 코드는 거절', async () => {
    const code = await issueLinkCode(DB, 100, 10)
    db.exec(`UPDATE kakao_bot_link_codes SET expires_at = datetime('now', '-1 minute') WHERE code = '${code}'`)
    const r = await say(env, `연결 ${code}`)
    expect(r.text).toContain('맞지 않거나')
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM kakao_bot_links').n).toBe(0)
  })

  it(`무차별 대입 — 실패 ${LINK_FAIL_LIMIT_PER_HOUR}회 뒤에는 맞는 코드도 거절(시도 자체를 안 한다)`, async () => {
    const good = await issueLinkCode(DB, 100, 10)
    let wrong = 0
    for (let i = 0; wrong < LINK_FAIL_LIMIT_PER_HOUR; i++) {
      const guess = String(100000 + i)
      if (guess === good) continue
      const r = await say(env, `연결 ${guess}`)
      expect(r.text).toContain('맞지 않거나')
      wrong++
    }
    const locked = await say(env, `연결 ${good}`)
    expect(locked.text).toContain('너무 많아요')
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM kakao_bot_links').n).toBe(0)
    // 잠긴 동안 코드가 소비되지 않았다
    expect(one<{ used_at: string | null }>(db, `SELECT used_at FROM kakao_bot_link_codes WHERE code = '${good}'`).used_at).toBeNull()
    // 다른 봇 키는 영향 없음
    const other = await say(env, `연결 ${good}`, 'fresh-key')
    expect(other.text).toContain('연결됐어요')
  })

  it('새 코드를 받으면 이전 미사용 코드는 무효', async () => {
    const first = await issueLinkCode(DB, 100, 10)
    await issueLinkCode(DB, 100, 10)
    const r = await say(env, `연결 ${first}`)
    expect(r.text).toContain('맞지 않거나')
  })

  it('연결 안 한 사람의 매장 명령은 FAQ 로 흘러간다(데이터 없음)', async () => {
    const r = await say(env, '오늘')
    expect(r.text).not.toContain('오늘 판매')
  })
})

describe('③ 좌석 재확인', () => {
  let DB: D1Database, db: RawDb, env: ReturnType<typeof makeEnv>
  beforeEach(() => { ({ DB, db } = makeD1()); seed(db); env = makeEnv(DB) })

  it('연결 뒤 소유가 끊기면 명령이 거절되고 연결이 지워진다', async () => {
    await linkAs(env)
    db.exec('UPDATE sellers SET linked_user_id = NULL WHERE id = 10')
    const r = await say(env, '오늘')
    expect(r.text).toBe(STORE_SEAT_REVOKED)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM kakao_bot_links').n).toBe(0)
  })

  it('매장이 정지되면 거절', async () => {
    await linkAs(env)
    db.exec("UPDATE sellers SET status = 'suspended' WHERE id = 10")
    const r = await say(env, '정산')
    expect(r.text).toBe(STORE_SEAT_REVOKED)
  })

  it('위임 운영자는 회수되는 순간 끊긴다', async () => {
    db.exec(`INSERT INTO users (id, name) VALUES (300, '운영자')`)
    const code = await issueLinkCode(DB, 300, 10)
    db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (10, 300, 'operator')`)
    expect((await say(env, `연결 ${code}`, 'op-key')).text).toContain('연결됐어요')
    db.exec("UPDATE seller_operators SET revoked_at = datetime('now') WHERE user_id = 300")
    expect((await say(env, '사용 대기', 'op-key')).text).toBe(STORE_SEAT_REVOKED)
  })
})

describe('④ 조회 명령', () => {
  let DB: D1Database, db: RawDb, env: ReturnType<typeof makeEnv>
  beforeEach(async () => { ({ DB, db } = makeD1()); seed(db); env = makeEnv(DB); await linkAs(env) })

  it('오늘 — 이 매장의 PAID/DONE 만', async () => {
    const r = await say(env, '오늘')
    expect(r.text).toContain('2건')
    expect(r.text).toContain('14,000원')
    expect(r.text).not.toContain('7,000')
  })

  it('사용 대기 — 이 매장의 미사용·미만료만', async () => {
    const r = await say(env, '사용 대기')
    expect(r.text).toContain('1장')
  })

  it('정산 — 원장 헬퍼를 읽기만 한다(원장 없으면 0원)', async () => {
    const r = await say(env, '정산')
    expect(r.text).toContain('0원')
  })

  it('모르는 말 → FAQ 가 없으면 명령 안내', async () => {
    const r = await say(env, '블라블라 아무말')
    expect(r.text).toContain('카카오톡 매장 관리')
    expect(r.quick).toContain('오늘')
  })
})

describe('④ 사용 처리', () => {
  let DB: D1Database, db: RawDb, env: ReturnType<typeof makeEnv>
  beforeEach(async () => { ({ DB, db } = makeD1()); seed(db); env = makeEnv(DB); await linkAs(env) })

  it('확인 전에는 처리하지 않는다 → "네" 로 한 번만 처리 + 원장 기록', async () => {
    const ask = await say(env, '사용 UR-AAAA-1111')
    expect(ask.text).toContain('사용 처리할까요')
    expect(ask.quick).toEqual(['네', '아니요'])
    expect(one<{ status: string }>(db, 'SELECT status FROM vouchers WHERE id = 1').status).toBe('unused')

    const yes = await say(env, '네')
    expect(yes.text).toContain('사용 처리했어요')
    expect(one<{ status: string }>(db, 'SELECT status FROM vouchers WHERE id = 1').status).toBe('used')
    const ledger = one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM ledger_entries WHERE reference_id = 'voucher:1'")
    expect(ledger.n, '사용 처리가 원장을 안 남기면 매장 정산이 빠진다').toBeGreaterThan(0)

    const again = await say(env, '네')
    expect(again.text).toContain('확인할 작업이 없')
  })

  it('다른 매장 이용권은 확인도 묻지 않고 거절', async () => {
    const r = await say(env, '사용 UR-BBBB-2222')
    expect(r.text).toContain('우리 매장의 이용권이 아니에요')
    await say(env, '네')
    expect(one<{ status: string }>(db, 'SELECT status FROM vouchers WHERE id = 2').status).toBe('unused')
  })

  it('만료된 이용권은 거절', async () => {
    const r = await say(env, '사용 UR-CCCC-3333')
    expect(r.text).toContain('기간이 지난')
    expect(one<{ status: string }>(db, 'SELECT status FROM vouchers WHERE id = 3').status).toBe('expired')
  })

  it('"아니요" 는 취소 · 확인 대기 만료 뒤 "네" 는 아무 일도 안 한다', async () => {
    await say(env, '사용 UR-AAAA-1111')
    expect((await say(env, '아니요')).text).toContain('취소')
    expect((await say(env, '네')).text).toContain('확인할 작업이 없')
    await say(env, '사용 UR-AAAA-1111')
    db.exec("UPDATE kakao_bot_pending SET expires_at = datetime('now', '-1 minute')")
    await say(env, '네')
    expect(one<{ status: string }>(db, 'SELECT status FROM vouchers WHERE id = 1').status).toBe('unused')
  })

  it('확인 사이에 다른 곳에서 처리되면 두 번 쓰이지 않는다', async () => {
    await say(env, '사용 UR-AAAA-1111')
    db.exec("UPDATE vouchers SET status = 'used', used_at = '2026-01-01 00:00:00' WHERE id = 1")
    const r = await say(env, '네')
    expect(r.text).not.toContain('사용 처리했어요')
    expect(one<{ used_at: string }>(db, 'SELECT used_at FROM vouchers WHERE id = 1').used_at).toBe('2026-01-01 00:00:00')
  })
})

describe('⑤ 판매 중지/재개', () => {
  let DB: D1Database, db: RawDb, env: ReturnType<typeof makeEnv>
  beforeEach(async () => { ({ DB, db } = makeD1()); seed(db); env = makeEnv(DB); await linkAs(env) })

  it('목록 → 중지 → 네 → is_active 0 → 재개 → 1', async () => {
    const list = await say(env, '이용권')
    expect(list.text).toContain('라면 이용권')
    expect(list.text).not.toContain('남의 이용권')
    // 목록 순서: id DESC (판매 중 먼저) → 1번 = 라면(id 2)
    expect((await say(env, '중지 1')).text).toContain('멈출까요')
    expect(one<{ is_active: number }>(db, 'SELECT is_active FROM products WHERE id = 2').is_active).toBe(1)
    expect((await say(env, '네')).text).toContain('판매를 멈췄어요')
    expect(one<{ is_active: number }>(db, 'SELECT is_active FROM products WHERE id = 2').is_active).toBe(0)
    await say(env, '이용권')
    // 중지된 것은 뒤로 간다 → 2번
    expect((await say(env, '재개 2')).text).toContain('다시 열까요')
    await say(env, '네')
    expect(one<{ is_active: number }>(db, 'SELECT is_active FROM products WHERE id = 2').is_active).toBe(1)
  })

  it('🔒 목록 스냅샷에 남의 상품이 섞여도 바꾸지 못한다(seller_id 로 막힘)', async () => {
    db.exec(`UPDATE kakao_bot_links SET last_list = '[3]' WHERE bot_user_key = '${KEY}'`)
    const r = await say(env, '중지 1')
    expect(r.text).toContain('찾을 수 없어요')
    // 확인 대기를 직접 심어도 실행 단계에서 막힌다
    db.exec(`INSERT OR REPLACE INTO kakao_bot_pending (bot_user_key, action, payload, seller_id, expires_at)
      VALUES ('${KEY}', 'toggle', '{"action":"toggle","productId":3,"active":false}', 10, datetime('now', '+3 minutes'))`)
    await say(env, '네')
    expect(one<{ is_active: number }>(db, 'SELECT is_active FROM products WHERE id = 3').is_active).toBe(1)
  })

  it('목록 없이 "중지 1" → 목록부터 보라고 한다', async () => {
    const r = await say(env, '중지 1')
    expect(r.text).toContain('먼저')
  })
})

describe('⑥ 대시보드 연결 코드 발급', () => {
  let DB: D1Database, db: RawDb
  beforeEach(() => { ({ DB, db } = makeD1()); seed(db) })

  function dashApp() {
    const app = new Hono<{ Bindings: never }>()
    registerKakaoBotLinkRoutes(app as never)
    return app
  }
  const tokenFor = (sellerId: number, extra: Record<string, unknown> = {}) =>
    sign({ type: 'seller', seller_id: sellerId, sub: String(sellerId), exp: Math.floor(Date.now() / 1000) + 600, ...extra }, 'jwt-secret')

  it('좌석에 있는 사람 → 6자리 코드', async () => {
    const res = await dashApp().request('/kakao-bot/link-code', { method: 'POST', headers: { Authorization: `Bearer ${await tokenFor(10)}` } }, makeEnv(DB))
    const j = await res.json() as { success: boolean; data?: { code: string; utterance: string } }
    expect(res.status).toBe(200)
    expect(j.data?.code).toMatch(/^\d{6}$/)
    expect(j.data?.utterance).toBe(`연결 ${j.data?.code}`)
    expect(one<{ user_id: string; seller_id: number }>(db, 'SELECT user_id, seller_id FROM kakao_bot_link_codes').user_id).toBe('100')
  })

  it('회수된 운영자 토큰 → 403 (토큰에 매장이 있어도 좌석을 다시 본다)', async () => {
    db.exec('UPDATE sellers SET linked_user_id = NULL WHERE id = 20')
    const tok = await tokenFor(20, { operator_user_id: 999, store_role: 'operator' })
    const res = await dashApp().request('/kakao-bot/link-code', { method: 'POST', headers: { Authorization: `Bearer ${tok}` } }, makeEnv(DB))
    expect(res.status).toBe(403)
  })

  it('토큰 없음 → 403 · 게이트 OFF → 409(코드 발급 안 함)', async () => {
    const none = await dashApp().request('/kakao-bot/link-code', { method: 'POST' }, makeEnv(DB))
    expect(none.status).toBe(403)
    const off = await dashApp().request('/kakao-bot/link-code', { method: 'POST', headers: { Authorization: `Bearer ${await tokenFor(10)}` } }, makeEnv(DB, { KAKAO_BOT_STORE_OPS_ENABLED: undefined }))
    expect(off.status).toBe(409)
  })

  it('해제는 이 매장의 연결만 지운다', async () => {
    const env = makeEnv(DB)
    await linkAs(env, 200, 20, 'other-store-key')
    const res = await dashApp().request('/kakao-bot/links/other-store-key/revoke', { method: 'POST', headers: { Authorization: `Bearer ${await tokenFor(10)}` } }, env)
    expect(res.status).toBe(404)
    expect(one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM kakao_bot_links WHERE bot_user_key = 'other-store-key'").n).toBe(1)
  })
})

describe('⑦ 배선 — 같은 사용 처리 함수 · 원장 게이트 없음', () => {
  const ROUTE = stripComments(readCode('src/features/group-buy/api/group-buy-voucher.routes.ts'))
  const CORE = stripComments(readCode('src/worker/utils/voucher-seller-redeem.ts'))
  const CMDS = stripComments(readCode('src/worker/utils/kakao-bot-commands.ts'))

  it('계산대 스캔(use-by-seller)이 redeemVoucherForStore 를 호출한다', () => {
    const i = ROUTE.indexOf("'/:code/use-by-seller'")
    expect(i, 'use-by-seller 라우트를 못 찾음').toBeGreaterThan(0)
    const block = ROUTE.slice(i, ROUTE.indexOf("'/voucher/:code/cancel'", i))
    expect(block).toMatch(/await redeemVoucherForStore\(DB, \{/)
    expect(block, 'CAS 를 라우트에 다시 베끼면 두 경로가 갈린다').not.toMatch(/SET status = 'used'/)
  })

  it('챗봇의 "네" 가 같은 함수를 부른다(path kakao_bot)', () => {
    expect(CMDS).toMatch(/redeemVoucherForStore\(ctx\.DB, \{[\s\S]{0,120}path: 'kakao_bot'/)
  })

  it('사용 처리 CAS 는 unused → used 한 문장', () => {
    expect(CORE).toContain("UPDATE vouchers SET status = 'used', used_at = datetime('now') WHERE id = ? AND status = 'unused'")
  })

  it('원장 기록 블록에 설정값 게이트가 없다', () => {
    const blocks = CORE.split('waitUntil(').filter((b) => b.includes('recordVoucherUsedLedger(DB, {'))
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) expect(b).not.toMatch(/platform_settings/)
  })

  it('📵 챗봇 명령은 알림톡·문자를 보내지 않는다', () => {
    expect(CMDS).not.toMatch(/Alimtalk|alimtalk|sendSms|aligo/i)
  })
})
