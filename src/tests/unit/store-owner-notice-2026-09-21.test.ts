/**
 * 📩 사장님 통보 — "당신 가게가 유어딜에 올라갔습니다".
 *
 * ## 이 시험이 **재는 것**
 * 줄 세우기·중복 차단·게이트·발송 후 상태 전이를 **진짜 SQLite** 에 넣고 잰다.
 * 발송기는 가짜를 끼워 넣어(의존성 주입) **실제로 카카오에 아무것도 안 보낸다.**
 *
 * ## 이 시험이 **못 재는 것**(가드를 과신하지 말 것)
 *  - 카카오가 템플릿을 **승인해 주는지** — 외부 검수라 기계가 못 한다.
 *  - 알리고가 실제로 보내 주는지, 사장님이 그 문자를 **읽는지**.
 *  - 010 이 **진짜 사장님 번호인지**. 사기꾼이 자기 번호를 적었다면 통보는 그에게 간다.
 *    (그래도 손해는 없다 — 그는 이미 다 안다. 이 레일의 값은 흔한 경우에 있다.)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  queueOwnerNotice, listOwnerNotices, ownerNoticeMessage, ownerNoticeSendEnabled,
  sendQueuedOwnerNotices, OWNER_NOTICE_KIND,
} from '@/worker/utils/store-owner-notice'
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
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT, phone TEXT);
           CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT);
           INSERT INTO sellers (id, business_name, phone) VALUES
             (1, '홍대돈까스', '010-1111-2222'),
             (2, '유선번호 가게', '02-333-4444'),
             (3, '번호 없는 가게', NULL);`)
  DB = d1(db)
})

/** 가짜 발송기 — 실제로 아무 데도 안 보낸다. 부른 횟수와 인자를 기록한다. */
function fakeSender(result: { success: boolean; message: string } = { success: true, message: 'ok' }) {
  const calls: Array<Record<string, string>> = []
  return {
    calls,
    deps: {
      apikey: 'k', userid: 'u', senderkey: 's', sender: '07000000000', tplCode: 'TPL_X',
      send: async (p: Record<string, string>) => { calls.push(p); return result },
    },
  }
}

describe('📩 줄 세우기 — 010 만', () => {
  it('휴대폰이면 줄을 선다', async () => {
    expect(await queueOwnerNotice(DB, 1, '010-1111-2222')).toBe('queued')
    const rows = await listOwnerNotices(DB)
    expect(rows.length).toBe(1)
    expect(rows[0].phone).toBe('01011112222') // 하이픈 없이 저장
  })

  it('지역번호·번호 없음은 **행 자체를 안 만든다** (사람이 거는 큐가 맡는다)', async () => {
    expect(await queueOwnerNotice(DB, 2, '02-333-4444')).toBe('skip_not_mobile')
    expect(await queueOwnerNotice(DB, 3, null)).toBe('skip_not_mobile')
    expect((await listOwnerNotices(DB)).length).toBe(0)
  })

  it('한 매장에 두 번 줄 서지 않는다 (같은 안내를 두 번 보내면 스팸이다)', async () => {
    expect(await queueOwnerNotice(DB, 1, '010-1111-2222')).toBe('queued')
    expect(await queueOwnerNotice(DB, 1, '010-1111-2222')).toBe('skip_duplicate')
    expect((await listOwnerNotices(DB)).length).toBe(1)
  })

  it('잘못된 매장 id 는 거부한다', async () => {
    expect(await queueOwnerNotice(DB, 0, '010-1111-2222')).toBe('skip_error')
  })
})

describe('🔒 발송 게이트 — 둘 다 갖춰져야 켜진다', () => {
  it('템플릿이 없으면 꺼져 있다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_owner_notice_enabled','true')`)
    expect(await ownerNoticeSendEnabled(DB, undefined)).toBe(false)
    expect(await ownerNoticeSendEnabled(DB, 'TBD')).toBe(false)
  })

  it('설정이 true 가 아니면 꺼져 있다', async () => {
    expect(await ownerNoticeSendEnabled(DB, 'TPL_X')).toBe(false)
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_owner_notice_enabled','1')`)
    expect(await ownerNoticeSendEnabled(DB, 'TPL_X')).toBe(false)
  })

  it('둘 다 갖춰지면 켜진다', async () => {
    db.exec(`INSERT INTO platform_settings (key, value) VALUES ('store_owner_notice_enabled','true')`)
    expect(await ownerNoticeSendEnabled(DB, 'TPL_X')).toBe(true)
  })
})

describe('📤 발송 — 보낸 뒤엔 다시 안 보낸다', () => {
  it('큐가 비면 아무것도 부르지 않는다', async () => {
    const f = fakeSender()
    expect(await sendQueuedOwnerNotices(DB, f.deps)).toEqual({ sent: 0, failed: 0 })
    expect(f.calls.length).toBe(0)
  })

  it('성공하면 sent 로 바뀌고 두 번째 호출에선 아무 일도 없다', async () => {
    await queueOwnerNotice(DB, 1, '010-1111-2222')
    const f = fakeSender()
    expect(await sendQueuedOwnerNotices(DB, f.deps)).toEqual({ sent: 1, failed: 0 })
    expect(f.calls.length).toBe(1)
    expect(await sendQueuedOwnerNotices(DB, f.deps)).toEqual({ sent: 0, failed: 0 })
    expect(f.calls.length).toBe(1) // 두 번 안 보낸다
  })

  it('실패하면 failed 로 남고 **자동 재시도되지 않는다** (문자 폭탄 방지)', async () => {
    await queueOwnerNotice(DB, 1, '010-1111-2222')
    const f = fakeSender({ success: false, message: '수신거부' })
    expect(await sendQueuedOwnerNotices(DB, f.deps)).toEqual({ sent: 0, failed: 1 })
    expect((await listOwnerNotices(DB, { status: 'queued' })).length).toBe(0)
    const failed = await listOwnerNotices(DB, { status: 'failed' })
    expect(failed[0].error_msg).toBe('수신거부')
    // 두 번째 호출이 다시 집어가지 않는다
    expect(await sendQueuedOwnerNotices(DB, f.deps)).toEqual({ sent: 0, failed: 0 })
  })

  it('🔒 두 어드민이 동시에 눌러도 한 통만 간다 (선점이 없으면 두 통)', async () => {
    // 🩸 처음엔 "보낸 뒤 두 번째 호출에선 아무 일 없다" 로만 쟀는데, 선점(CAS)을 통째로 지워도
    //    **초록이었다** — 순차 호출에서는 앞 호출이 이미 상태를 바꿔 놓기 때문이다. 선점이 지키는
    //    것은 *동시*다. 그래서 두 드레인을 겹쳐 돌린다.
    await queueOwnerNotice(DB, 1, '010-1111-2222')
    const calls: unknown[] = []
    const deps = {
      apikey: 'k', userid: 'u', senderkey: 's', sender: '0700', tplCode: 'T',
      send: async (p: Record<string, string>) => {
        await Promise.resolve() // 두 드레인이 이 지점에서 엇갈린다
        calls.push(p)
        return { success: true, message: 'ok' }
      },
    }
    const [a, b] = await Promise.all([sendQueuedOwnerNotices(DB, deps), sendQueuedOwnerNotices(DB, deps)])
    expect(calls.length, '같은 사장님에게 두 통이 갔다').toBe(1)
    expect(a.sent + b.sent).toBe(1)
  })

  it('발송기가 던져도 실패로 적고 넘어간다 (한 건이 전체를 멈추지 않는다)', async () => {
    await queueOwnerNotice(DB, 1, '010-1111-2222')
    const r = await sendQueuedOwnerNotices(DB, {
      apikey: 'k', userid: 'u', senderkey: 's', sender: '0700', tplCode: 'T',
      send: async () => { throw new Error('network down') },
    })
    expect(r).toEqual({ sent: 0, failed: 1 })
    expect((await listOwnerNotices(DB, { status: 'failed' }))[0].error_msg).toContain('network')
  })

  it('보내는 문구에 매장 이름과 신고 링크가 들어간다', async () => {
    await queueOwnerNotice(DB, 1, '010-1111-2222')
    const f = fakeSender()
    await sendQueuedOwnerNotices(DB, f.deps)
    expect(f.calls[0].message_1).toContain('홍대돈까스')
    expect(f.calls[0].message_1).toContain('/store/find')
    expect(f.calls[0].receiver_1).toBe('01011112222')
    expect(f.calls[0].tpl_code).toBe('TPL_X')
  })

  it('매장 이름이 비어도 문구가 깨지지 않는다', () => {
    expect(ownerNoticeMessage('')).toContain('고객님의 매장')
    expect(ownerNoticeMessage('  ')).toContain('고객님의 매장')
  })

  it('한 번에 가져가는 건수에 상한이 있다', async () => {
    for (let i = 10; i < 40; i++) {
      db.prepare('INSERT INTO sellers (id, business_name, phone) VALUES (?, ?, ?)').run(i, `가게${i}`, `0102222${String(i).padStart(4, '0')}`)
      await queueOwnerNotice(DB, i, `0102222${String(i).padStart(4, '0')}`)
    }
    const f = fakeSender()
    const r = await sendQueuedOwnerNotices(DB, f.deps, { limit: 5 })
    expect(r.sent).toBe(5)
    expect((await listOwnerNotices(DB, { status: 'queued', limit: 200 })).length).toBe(25)
  })
})

describe('🔒 경계 — 셀러 크레딧을 쓰지 않는다', () => {
  const util = stripComments(readFileSync('src/worker/utils/store-owner-notice.ts', 'utf-8'))

  it('셀러 크레딧 차감 경로를 건드리지 않는다 (남의 잔액으로 남에게 보내지 않는다)', () => {
    expect(util).not.toMatch(/seller_credits|sendSellerAlimtalk/)
  })

  it('환불·원장·매장 상태도 건드리지 않는다', () => {
    expect(util).not.toMatch(/refund|환불|ledger_entries|payout/)
    expect(util).not.toMatch(/UPDATE sellers SET/)
  })
})

describe('🔌 배선', () => {
  const route = stripComments(readFileSync('src/features/admin/api/admin-store-owner.routes.ts', 'utf-8'))

  it('승인 경로 **둘 다** 부수효과 훅을 부르고, 그 훅이 줄을 세운다', () => {
    const a = stripComments(readFileSync('src/features/admin/api/admin-sellers.routes.ts', 'utf-8'))
    const b = stripComments(readFileSync('src/features/admin/api/admin-tools.routes.ts', 'utf-8'))
    expect(a).toMatch(/runSellerApprovedHooks\(/)
    expect(b).toMatch(/runSellerApprovedHooks\(/)
    const hook = stripComments(readFileSync('src/worker/utils/seller-approved-hooks.ts', 'utf-8'))
    expect(hook, '훅이 사장님 통보 줄을 안 세운다').toMatch(/queueOwnerNotice\(/)
  })

  it('발송 라우트가 게이트를 **먼저** 확인한다', () => {
    // 🩸 처음엔 파일 전체에서 두 이름의 위치만 비교했는데, 조회 라우트가 게이트를 **먼저** 언급해서
    //    발송 라우트의 조건을 `if (false)` 로 바꿔도 초록이었다. 그래서 발송 라우트 **안**만 본다.
    const start = route.indexOf("'/store-owner-notices/send'")
    expect(start, '발송 라우트를 못 찾았다').toBeGreaterThan(-1)
    const body = route.slice(start)
    const i = body.indexOf('ownerNoticeSendEnabled')
    const j = body.indexOf('sendQueuedOwnerNotices')
    expect(i, '발송 라우트 안에 게이트 확인이 없다').toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(-1)
    expect(i, '게이트 확인이 발송보다 뒤에 있다').toBeLessThan(j)
    // 조건이 통째로 상수로 바뀌는 것도 막는다(`if (false)` 주입이 그 모양이었다).
    expect(body).toMatch(/if \(!\(await m\.ownerNoticeSendEnabled\(/)
  })

  it('발송은 finance + 2FA + 감사로그를 통과해야 한다', () => {
    expect(route).toMatch(/store-owner-notices\/send'[\s\S]{0,200}requireAdminRole\('finance'\)/)
    expect(route).toMatch(/store-owner-notices\/send'[\s\S]{0,220}require2FA\(\)/)
    expect(route).toMatch(/store-owner-notices\/send'[\s\S]{0,260}auditLog\('stores\.send_owner_notice'\)/)
  })

  it('어드민 화면이 붙어 있고, 발송 버튼은 게이트가 꺼지면 비활성이다', () => {
    const page = stripComments(readFileSync('src/pages/AdminStoreOwnerPage.tsx', 'utf-8'))
    expect(page).toMatch(/<StoreOwnerNoticeQueue\b/)
    const ui = stripComments(readFileSync('src/pages/admin-store-owner/StoreOwnerNoticeQueue.tsx', 'utf-8'))
    expect(ui).toMatch(/disabled=\{!sendEnabled \|\| busy\}/)
  })

  it('테이블과 한-번-만 인덱스가 repair-schema 에 등록돼 있다', () => {
    const r = readFileSync('src/worker/routes/repair-schema/column-repairs.ts', 'utf-8')
    expect(r).toMatch(/desc: 'store_owner_notices'/)
    expect(r).toMatch(/idx_store_owner_notices_once[\s\S]{0,120}seller_id, kind/)
  })

  it('통보 종류 이름이 한 곳에서만 온다', () => {
    expect(OWNER_NOTICE_KIND).toBe('store_listed')
  })
})
