import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  verifyMetaSignature, parseCommentEvents, pickRule, ruleMatches, renderDm, pickPublicReply,
  isSafeLink, normalizeForMatch, type AutoDmRule,
} from '@/features/instagram-autodm/api/autodm-core'
import {
  saveConnection, setEnabled, createRule, updateRule, deleteRule, listRules, listSends, ensureVerifyToken,
  saveAppConfig, getAccountByOwner, ensureAccountRow, purgeByIgUserId, PLATFORM_OWNER, sellerOwnerKey,
  disconnect, disconnectByIgUserId, pruneOldSends, SEND_RETENTION_DAYS,
} from '@/features/instagram-autodm/api/autodm-store'
import { processWebhookPayload } from '@/features/instagram-autodm/api/autodm-service'
import { signState, verifyState, safeReturnPath, authorizeUrl, STATE_TTL_MS, parseSignedRequest } from '@/features/instagram-autodm/api/autodm-oauth'
import { canonicalOrigin } from '@/features/instagram-autodm/api/autodm.routes'
import { readCode } from '../helpers/source-text'

/**
 * 💬 2026-10-01 인스타 댓글 → 자동 DM.
 *   ① 서명 검증이 위조·누락을 거절하는가 ② 키워드 매칭 ③ **같은 댓글에 DM 이 두 번 안 나가는가**(웹훅 재전송)
 *   ④ 우리 계정의 댓글(공개 답글이 되돌아온 것)에 반응하지 않는가 — 무한 루프 ⑤ 꺼져 있으면 0통 ⑥ 일일 상한.
 *   ⑦ 다중 계정: 댓글이 **그 인스타 계정의 주인 규칙**으로만 가는가 · 매장 계정은 앱 전체 스위치가 닫히면 0통
 *      · 다른 매장의 규칙 id 로 수정·삭제 못 함(IDOR) · 같은 인스타를 두 가게에 못 붙임
 *   ⑧ 인스타 로그인 state: 위조·만료·주인 문법·돌아갈 주소 화이트리스트.
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
  let platformId: number

  beforeEach(async () => {
    DB = makeD1()
    calls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null })
      return new Response(JSON.stringify({ recipient_id: '999', message_id: 'm1', id: 'r1' }), { status: 200 })
    }))
    await ensureVerifyToken(DB)
    await saveAppConfig(DB, undefined, { app_id: '123456', app_secret: SECRET })
    const saved = await saveConnection(DB, undefined, { owner_key: PLATFORM_OWNER, seller_id: null, ig_user_id: OUR, username: 'urdeal', access_token: 'TOKEN' })
    if (!saved.ok) throw new Error('setup')
    platformId = saved.id
    await createRule(DB, platformId, { name: null, keywords: '링크', match_mode: 'contains', media_id: null, dm_text: 'DM {username}', link_url: 'https://urdeal.kr/x', public_reply: '보냈어요', is_active: true })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  const dmCalls = () => calls.filter(c => c.url.endsWith('/messages'))

  it('꺼져 있으면(기본값) 한 통도 안 보낸다', async () => {
    expect((await getAccountByOwner(DB, undefined, PLATFORM_OWNER))?.enabled).toBe(false)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }]))
    expect(dmCalls()).toHaveLength(0)
  })

  it('켜면 키워드 댓글에 DM + 공개 답글, 아닌 댓글은 무시', async () => {
    await setEnabled(DB, platformId, true)
    const r = await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크 주세요' }, { id: 'c2', text: '예뻐요' }]))
    expect(r.sent).toBe(1)
    expect(dmCalls()).toHaveLength(1)
    expect(dmCalls()[0].url).toContain(`/${OUR}/messages`)
    expect(dmCalls()[0].body).toEqual({ recipient: { comment_id: 'c1' }, message: { text: 'DM @kim\n\nhttps://urdeal.kr/x' } })
    expect(calls.some(c => c.url.includes('/c1/replies'))).toBe(true)
    const log = await listSends(DB, platformId)
    expect(log.map(l => [l.comment_id, l.status])).toEqual([['c1', 'sent']])
  })

  it('같은 댓글이 다시 와도(웹훅 재전송) DM 은 한 통', async () => {
    await setEnabled(DB, platformId, true)
    const p = payload([{ id: 'c1', text: '링크' }])
    await Promise.all([processWebhookPayload(DB, undefined, p), processWebhookPayload(DB, undefined, p)])
    await processWebhookPayload(DB, undefined, p)
    expect(dmCalls()).toHaveLength(1)
  })

  it('그 계정이 단 댓글(공개 답글이 되돌아온 것)에는 반응하지 않는다', async () => {
    await setEnabled(DB, platformId, true)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c9', text: '링크 보냈어요', from: OUR, fromName: 'urdeal' }]))
    expect(dmCalls()).toHaveLength(0)
  })

  it('연결되지 않은 인스타 계정의 이벤트는 무시', async () => {
    await setEnabled(DB, platformId, true)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }], '42'))
    expect(dmCalls()).toHaveLength(0)
  })

  it('일일 상한을 넘으면 건너뛰고 기록한다', async () => {
    await setEnabled(DB, platformId, true, 1)
    await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }, { id: 'c2', text: '링크' }]))
    expect(dmCalls()).toHaveLength(1)
    const log = await listSends(DB, platformId)
    expect(log.find(l => l.comment_id === 'c2')?.status).toBe('skipped')
  })

  it('메타가 거절하면 failed 로 남고 공개 답글은 안 단다', async () => {
    await setEnabled(DB, platformId, true)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push({ url: String(url), body: null })
      return new Response(JSON.stringify({ error: { message: 'too old', code: 10 } }), { status: 400 })
    }))
    const r = await processWebhookPayload(DB, undefined, payload([{ id: 'c1', text: '링크' }]))
    expect(r.failed).toBe(1)
    expect(calls.some(c => c.url.includes('/replies'))).toBe(false)
    const log = await listSends(DB, platformId)
    expect(log[0].status).toBe('failed')
    expect(log[0].error).toContain('too old')
  })

  describe('매장 계정(사장님·중개사)', () => {
    const STORE_IG = '1784000000000777'
    let storeId: number

    beforeEach(async () => {
      const saved = await saveConnection(DB, undefined, { owner_key: sellerOwnerKey(7), seller_id: 7, ig_user_id: STORE_IG, username: 'cafe', access_token: 'STORE_TOKEN' })
      if (!saved.ok) throw new Error('setup')
      storeId = saved.id
      await createRule(DB, storeId, { name: null, keywords: '쿠폰', match_mode: 'contains', media_id: null, dm_text: '쿠폰 여기', link_url: null, public_reply: null, is_active: true })
      await setEnabled(DB, storeId, true)
      await setEnabled(DB, platformId, true)
    })

    it('앱 전체 스위치(sellers_enabled)가 닫혀 있으면 켜 둔 매장 계정도 0통', async () => {
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }], STORE_IG))
      expect(dmCalls()).toHaveLength(0)
    })

    it('열리면 그 매장 계정의 토큰·규칙으로만 보낸다(공식 계정 규칙과 섞이지 않는다)', async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      // 매장 인스타에 '링크'(공식 계정 키워드) 댓글 → 매장 규칙엔 없으니 0통
      await processWebhookPayload(DB, undefined, payload([{ id: 's0', text: '링크' }], STORE_IG))
      expect(dmCalls()).toHaveLength(0)
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰 주세요' }], STORE_IG))
      expect(dmCalls()).toHaveLength(1)
      expect(dmCalls()[0].url).toContain(`/${STORE_IG}/messages`)
      expect((await listSends(DB, storeId)).map(l => l.comment_id)).toEqual(['s1'])
      expect(await listSends(DB, platformId)).toEqual([])
    })

    it('다른 계정의 규칙 id 로는 수정·삭제가 안 된다(IDOR)', async () => {
      const platformRule = (await listRules(DB, platformId))[0]
      const input = { name: null, keywords: '해킹', match_mode: 'contains' as const, media_id: null, dm_text: 'x', link_url: null, public_reply: null, is_active: true }
      expect(await updateRule(DB, storeId, platformRule.id, input)).toBe(false)
      expect(await deleteRule(DB, storeId, platformRule.id)).toBe(false)
      expect((await listRules(DB, platformId))[0].keywords).toBe('링크')
    })

    it('같은 인스타 계정을 다른 가게에 붙일 수 없다', async () => {
      const r = await saveConnection(DB, undefined, { owner_key: sellerOwnerKey(8), seller_id: 8, ig_user_id: STORE_IG, username: 'cafe', access_token: 'X' })
      expect(r.ok).toBe(false)
      // 같은 주인이 다시 연결(토큰 교체)은 된다
      const again = await saveConnection(DB, undefined, { owner_key: sellerOwnerKey(7), seller_id: 7, ig_user_id: STORE_IG, username: 'cafe2', access_token: 'NEW' })
      expect(again.ok).toBe(true)
    })

    it('데이터 삭제 요청이 오면 그 계정의 규칙·기록·계정이 지워지고 공식 계정은 남는다', async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }], STORE_IG))
      expect(await purgeByIgUserId(DB, STORE_IG)).toBe(1)
      expect(await getAccountByOwner(DB, undefined, sellerOwnerKey(7))).toBeNull()
      expect(await listSends(DB, storeId)).toEqual([])
      expect(await listRules(DB, storeId)).toEqual([])
      expect((await listRules(DB, platformId)).length).toBe(1)
    })

    // 개인정보 처리방침 `#instagram` 이 약속한 것 — 문서와 코드가 갈리면 처리방침이 거짓말이 된다.
    it('연결 해제하면 발송 기록(댓글 단 사람 정보)은 지우고 규칙은 남긴다', async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }], STORE_IG))
      expect((await listSends(DB, storeId)).length).toBe(1)
      await disconnect(DB, storeId)
      expect(await listSends(DB, storeId)).toEqual([])
      expect((await listRules(DB, storeId)).length).toBe(1)
      expect((await getAccountByOwner(DB, undefined, sellerOwnerKey(7)))?.ig_user_id ?? null).toBeNull()
    })

    it('메타의 권한 해제 알림도 같은 방식으로 지운다', async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }], STORE_IG))
      await disconnectByIgUserId(DB, STORE_IG)
      expect(await listSends(DB, storeId)).toEqual([])
      expect((await listSends(DB, platformId))).toEqual([])
    })

    it(`발송 기록은 ${SEND_RETENTION_DAYS}일이 지나면 지워지고, 그 안의 기록은 남는다`, async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }, { id: 's2', text: '쿠폰 주세요' }], STORE_IG))
      await DB.prepare(`UPDATE ig_autodm_sends SET created_at = datetime('now', ?) WHERE comment_id = 's1'`).bind(`-${SEND_RETENTION_DAYS + 1} days`).run()
      await pruneOldSends(DB, storeId)
      expect((await listSends(DB, storeId)).map(l => l.comment_id)).toEqual(['s2'])
    })

    it('웹훅이 들어오면 그 계정의 묵은 기록을 정리한다(배선)', async () => {
      await saveAppConfig(DB, undefined, { sellers_enabled: true })
      await processWebhookPayload(DB, undefined, payload([{ id: 's1', text: '쿠폰' }], STORE_IG))
      await DB.prepare(`UPDATE ig_autodm_sends SET created_at = datetime('now', ?) WHERE comment_id = 's1'`).bind(`-${SEND_RETENTION_DAYS + 1} days`).run()
      await processWebhookPayload(DB, undefined, payload([{ id: 's9', text: '안녕' }], STORE_IG))
      expect((await listSends(DB, storeId)).map(l => l.comment_id)).toEqual([])
    })

    it('연결 전에도 계정 행을 만들어 규칙을 먼저 써 둘 수 있다', async () => {
      const id = await ensureAccountRow(DB, sellerOwnerKey(9), 9)
      expect(id).toBeGreaterThan(0)
      expect(await ensureAccountRow(DB, sellerOwnerKey(9), 9)).toBe(id)
    })
  })
})

describe('인스타 로그인 state', () => {
  const JWT = 'jwt-secret-for-test'
  it('서명한 state 는 그대로 돌아온다', async () => {
    const t = await signState(JWT, { o: 'seller:7', s: 7, u: 3, r: '/seller/instagram-dm', m: true })
    const st = await verifyState(JWT, t)
    expect(st).toMatchObject({ o: 'seller:7', s: 7, u: 3, r: '/seller/instagram-dm', m: true })
  })
  it('다른 비밀로 서명했거나 내용을 바꾸면 거절', async () => {
    const t = await signState(JWT, { o: 'seller:7', s: 7, u: null, r: '/seller/instagram-dm' })
    expect(await verifyState('other-secret', t)).toBeNull()
    const [body, sig] = t.split('.')
    const forged = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((body.length + 3) % 4)))
    forged.o = 'seller:8'
    const forgedBody = btoa(JSON.stringify(forged)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verifyState(JWT, `${forgedBody}.${sig}`)).toBeNull()
  })
  it('만료되면 거절', async () => {
    const t = await signState(JWT, { o: 'platform', s: null, u: null, r: '/admin/instagram-autodm' }, 0)
    expect(await verifyState(JWT, t, STATE_TTL_MS + 1)).toBeNull()
  })
  it('돌아갈 주소는 화이트리스트만', () => {
    expect(safeReturnPath('/admin/instagram-autodm')).toBe('/admin/instagram-autodm')
    expect(safeReturnPath('https://evil.com')).toBe('/seller/instagram-dm')
    expect(safeReturnPath('//evil.com')).toBe('/seller/instagram-dm')
  })
  it('인스타 로그인 주소에 권한 3종과 state 가 실린다', () => {
    const u = new URL(authorizeUrl('123', 'https://urdeal.kr/api/instagram/oauth/callback', 'ST'))
    expect(u.hostname).toBe('www.instagram.com')
    expect(u.searchParams.get('scope')).toBe('instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages')
    expect(u.searchParams.get('state')).toBe('ST')
  })
  it('메타 signed_request: 앱 시크릿 서명만 통과', async () => {
    const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const body = b64(new TextEncoder().encode(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '777' })))
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))))
    expect(await parseSignedRequest(`${sig}.${body}`, SECRET)).toEqual({ user_id: '777' })
    expect(await parseSignedRequest(`${sig}.${body}`, 'f'.repeat(32))).toBeNull()
    expect(await parseSignedRequest(`${sig}.${body}x`, SECRET)).toBeNull()
    expect(await parseSignedRequest(null, SECRET)).toBeNull()
  })
  it('메타에 등록하는 주소는 구 도메인으로 들어와도 정본(urdeal.kr)', () => {
    expect(canonicalOrigin('https://live.ur-team.com/api/x')).toBe('https://urdeal.kr')
    expect(canonicalOrigin('http://localhost:8787/api/x')).toBe('http://localhost:8787')
  })
})

describe('개인정보 처리방침 — 인스타 연결 문단(메타 심사 요건)', () => {
  it('처리방침 페이지가 국문·영문 모두에 그 문단을 싣는다', () => {
    const page = readCode('src/pages/PrivacyPolicyPage.tsx')
    expect(page.match(/<InstagramConnectSection\b/g)?.length).toBe(2)
  })
  it('데이터 삭제 콜백이 돌려주는 상태 주소가 그 문단을 가리킨다', () => {
    const routes = readCode('src/features/instagram-autodm/api/autodm.routes.ts')
    expect(routes).toMatch(/\/privacy\?ig_deletion=\$\{encodeURIComponent\(code\)\}#instagram/)
    const section = readCode('src/pages/privacy/InstagramConnectSection.tsx')
    expect(section).toMatch(/id="instagram"/)
    expect(section).toMatch(/params\.get\('ig_deletion'\)/)
  })
  it('문단이 적은 보관 기간이 코드의 값과 같다', () => {
    const section = readCode('src/pages/privacy/InstagramConnectSection.tsx')
    expect(section).toContain(`${SEND_RETENTION_DAYS}일이 지나면 파기`)
  })
})
