import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  verifyMetaSignature, parseCommentEvents, pickRule, ruleMatches, renderDm, pickPublicReply,
  isSafeLink, normalizeForMatch, type AutoDmRule,
} from '@/features/instagram-autodm/api/autodm-core'
import {
  saveConnection, setEnabled, createRule, listSends, ensureVerifyToken, getAccount,
} from '@/features/instagram-autodm/api/autodm-store'
import { processWebhookPayload } from '@/features/instagram-autodm/api/autodm-service'

/**
 * 💬 2026-10-01 인스타 댓글 → 자동 DM.
 *   ① 서명 검증이 위조·누락을 거절하는가 ② 키워드 매칭 ③ **같은 댓글에 DM 이 두 번 안 나가는가**(웹훅 재전송)
 *   ④ 우리 계정의 댓글(공개 답글이 되돌아온 것)에 반응하지 않는가 — 무한 루프 ⑤ 꺼져 있으면 0통 ⑥ 일일 상한.
 *   ⚠️ 못 보는 것: 메타 실제 응답 모양(fetch 는 가짜다). 실계정 1회 확인이 필요하다.
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
  return {
    prepare: (sql: string) => wrap(sql),
    batch: async (stmts: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of stmts) out.push(await s.run()); return out },
  } as unknown as D1Database
}

const SECRET = '0123456789abcdef0123456789abcdef'
async function sign(body: string, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return 'sha256=' + [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

const rule = (over: Partial<AutoDmRule> = {}): AutoDmRule => ({
  id: 1, keywords: '링크, 정보', match_mode: 'contains', media_id: null,
  dm_text: '{username}님 링크 보내드려요', link_url: 'https://urdeal.kr/x', public_reply: null, is_active: 1, ...over,
})

const OUR = '1784000000000001'
function payload(comments: Array<{ id: string; text: string; from?: string; fromName?: string; media?: string }>, account = OUR) {
  return {
    object: 'instagram',
    entry: [{
      id: account, time: 1,
      changes: comments.map(c => ({
        field: 'comments',
        value: { id: c.id, text: c.text, from: { id: c.from ?? '999', username: c.fromName ?? 'kim' }, media: { id: c.media ?? '555', media_product_type: 'FEED' } },
      })),
    }],
  }
}

describe('서명 검증', () => {
  it('맞는 서명만 통과한다', async () => {
    const body = '{"a":1}'
    expect(await verifyMetaSignature(body, await sign(body), SECRET)).toBe(true)
  })
  it('본문이 바뀌면 거절', async () => {
    expect(await verifyMetaSignature('{"a":2}', await sign('{"a":1}'), SECRET)).toBe(false)
  })
  it('다른 시크릿으로 서명하면 거절', async () => {
    const body = '{"a":1}'
    expect(await verifyMetaSignature(body, await sign(body, 'f'.repeat(32)), SECRET)).toBe(false)
  })
  it('헤더나 시크릿이 없으면 거절(검증 못 한 요청을 믿지 않는다)', async () => {
    const body = '{"a":1}'
    expect(await verifyMetaSignature(body, null, SECRET)).toBe(false)
    expect(await verifyMetaSignature(body, await sign(body), '')).toBe(false)
    expect(await verifyMetaSignature(body, 'sha1=abcd', SECRET)).toBe(false)
  })
})

describe('키워드 매칭', () => {
  it('띄어쓰기·기호·대소문자를 무시하고 포함 여부를 본다', () => {
    expect(normalizeForMatch('링크 주세요!!')).toBe('링크주세요')
    expect(ruleMatches(rule(), { text: '링크 주세요!!', mediaId: '1' })).toBe(true)
    expect(ruleMatches(rule({ keywords: 'LINK' }), { text: 'link pls', mediaId: '1' })).toBe(true)
    expect(ruleMatches(rule(), { text: '좋아요', mediaId: '1' })).toBe(false)
  })
  it('exact 는 댓글 전체가 키워드여야 한다', () => {
    const r = rule({ match_mode: 'exact' })
    expect(ruleMatches(r, { text: '링크!', mediaId: '1' })).toBe(true)
    expect(ruleMatches(r, { text: '링크 안 와요', mediaId: '1' })).toBe(false)
  })
  it('특정 게시물 규칙은 그 게시물에서만, 그리고 전체 규칙보다 먼저', () => {
    const global = rule({ id: 1 })
    const specific = rule({ id: 2, media_id: '555', dm_text: '특정' })
    expect(pickRule([global, specific], { text: '링크', mediaId: '555' })?.id).toBe(2)
    expect(pickRule([global, specific], { text: '링크', mediaId: '777' })?.id).toBe(1)
  })
  it('꺼진 규칙은 안 고른다', () => {
    expect(pickRule([rule({ is_active: 0 })], { text: '링크', mediaId: '1' })).toBeNull()
  })
})

describe('메시지', () => {
  it('{username} 치환 + 링크를 끝에 붙인다(본문에 이미 있으면 중복 안 함)', () => {
    expect(renderDm(rule(), 'kim')).toBe('@kim님 링크 보내드려요\n\nhttps://urdeal.kr/x')
    expect(renderDm(rule({ dm_text: '여기 https://urdeal.kr/x' }), null)).toBe('여기 https://urdeal.kr/x')
  })
  it('공개 답글은 후보 중 하나, 없으면 null', () => {
    expect(pickPublicReply('a\nb\nc', null, () => 0.99)).toBe('c')
    expect(pickPublicReply('', null)).toBeNull()
  })
  it('링크는 http(s) 만', () => {
    expect(isSafeLink('https://urdeal.kr')).toBe(true)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
    expect(isSafeLink(null)).toBe(true)
  })
  it('웹훅 본문에서 댓글만 뽑는다', () => {
    const evs = parseCommentEvents({ object: 'instagram', entry: [{ id: OUR, changes: [{ field: 'mentions', value: {} }, ...payload([{ id: 'c1', text: '링크' }]).entry[0].changes] }] })
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ accountId: OUR, commentId: 'c1', mediaId: '555', fromUsername: 'kim' })
    expect(parseCommentEvents({ object: 'page', entry: [] })).toEqual([])
  })
})

describe('웹훅 처리(실제 SQLite)', () => {
  let DB: D1Database
  let calls: Array<{ url: string; body: unknown }>

  beforeEach(async () => {
    DB = makeD1()
    calls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
      return new Response(JSON.stringify({ recipient_id: '999', message_id: 'm1', id: 'r1' }), { status: 200 })
    }))
    await ensureVerifyToken(DB)
    await saveConnection(DB, undefined, { ig_user_id: OUR, username: 'urdeal', access_token: 'TOKEN', app_secret: SECRET })
    await createRule(DB, { name: null, keywords: '링크', match_mode: 'contains', media_id: null, dm_text: 'DM {username}', link_url: 'https://urdeal.kr/x', public_reply: '보냈어요', is_active: true })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  const dmCalls = () => calls.filter(c => c.url.endsWith('/messages'))

  it('꺼져 있으면(기본값) 한 통도 안 보낸다', async () => {
    const acc = await getAccount(DB, undefined)
    expect(acc?.enabled).toBe(false)
    const r = await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }]))
    expect(r.reason).toBe('disabled')
    expect(dmCalls()).toHaveLength(0)
  })

  it('켜면 키워드 댓글에 DM + 공개 답글, 아닌 댓글은 무시', async () => {
    await setEnabled(DB, true)
    const r = await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크 주세요' }, { id: 'c2', text: '예뻐요' }]))
    expect(r.sent).toBe(1)
    expect(dmCalls()).toHaveLength(1)
    expect(dmCalls()[0].body).toEqual({ recipient: { comment_id: 'c1' }, message: { text: 'DM @kim\n\nhttps://urdeal.kr/x' } })
    expect(calls.some(c => c.url.includes('/c1/replies'))).toBe(true)
    const log = await listSends(DB)
    expect(log.map(l => [l.comment_id, l.status])).toEqual([['c1', 'sent']])
  })

  it('같은 댓글이 다시 와도(웹훅 재전송) DM 은 한 통', async () => {
    await setEnabled(DB, true)
    const p = payload([{ id: 'c1', text: '링크' }])
    await Promise.all([processWebhookPayload(DB, undefined, p), processWebhookPayload(DB, undefined, p)])
    await processWebhookPayload(DB, undefined, p)
    expect(dmCalls()).toHaveLength(1)
  })

  it('우리 계정이 단 댓글(공개 답글이 되돌아온 것)에는 반응하지 않는다', async () => {
    await setEnabled(DB, true)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c9', text: '링크 보냈어요', from: OUR, fromName: 'urdeal' }]))
    expect(dmCalls()).toHaveLength(0)
  })

  it('다른 계정의 이벤트는 무시', async () => {
    await setEnabled(DB, true)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }], '42'))
    expect(dmCalls()).toHaveLength(0)
  })

  it('일일 상한을 넘으면 건너뛰고 기록한다', async () => {
    await setEnabled(DB, true, 1)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }, { id: 'c2', text: '링크' }]))
    expect(dmCalls()).toHaveLength(1)
    const log = await listSends(DB)
    expect(log.find(l => l.comment_id === 'c2')?.status).toBe('skipped')
  })

  it('메타가 거절하면 failed 로 남고 공개 답글은 안 단다', async () => {
    await setEnabled(DB, true)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push({ url: String(url), body: null })
      return new Response(JSON.stringify({ error: { message: 'too old', code: 10 } }), { status: 400 })
    }))
    const r = await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }]))
    expect(r.failed).toBe(1)
    expect(calls.some(c => c.url.includes('/replies'))).toBe(false)
    const log = await listSends(DB)
    expect(log[0].status).toBe('failed')
    expect(log[0].error).toContain('too old')
  })
})
