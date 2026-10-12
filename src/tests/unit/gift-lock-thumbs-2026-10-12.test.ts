/**
 * 🎁🖼️ 2026-10-12 대표 지시 묶음 — 선물한 이용권 잠금 · 후기 보너스 끄기 · 지갑 지도 꽉 채우기 · 중복 썸네일
 *
 * 지키는 것
 *  ① 선물 링크가 살아 있는(받기 전) 이용권은 **어느 사용 경로로도** 쓸 수 없다 — 사용 CAS 전부에 같은 술어
 *     (대표 *"선물을 한 사람은 … 해당 이용권은 쓸 수 없게끔"*). 실제 SQLite 로 그 술어를 돌린다.
 *  ② 받으면 이용권 코드가 새로 바뀐다 — 보낸 사람 손에 남은 옛 QR 로는 못 쓴다
 *     (사용 처리 경로는 계산대 PIN·확인코드만 보고 로그인을 안 본다).
 *  ③ 보낸 사람 지갑: 선물 중이면 `gift_pending`, 받혔으면 `status='gifted'` 기록이 생긴다.
 *  ④ 카카오맵 후기 보너스는 지금 없다 — 버튼 null · 서버 410 (대표 *"카카오맵 후기 관련 보너스 지금 없어"*).
 *     다시 켤 때를 위해 시트는 포털로 그린다(흐린 카드 안에 갇혀 겹쳐 보이던 것).
 *  ⑤ 지갑 '지도에서 보기' 는 화면 높이를 쓴다(고정 460px 아님).
 *  ⑥ 같은 사진은 같은 주소 — R2 이관 키가 내용 해시, 이미 생긴 중복은 내용(etag)으로 접는다.
 *
 * ⚠️ 못 막는 것: 실제 R2 의 etag 가 내용 MD5 인지(단일 업로드일 때만) · 지도 높이가 폰에서 딱 맞는지(그려 봐야 한다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { noPendingGiftSql, withGiftState } from '@/worker/utils/voucher-gift'
import { dedupeGalleryBySig, mediaKeyOf } from '@/worker/cron/gallery-etag-dedupe'
import { contentHash } from '@/worker/utils/rehost-image'
import { KAKAO_REVIEW_BONUS_ENABLED } from '@/shared/feature-flags'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

function makeD1() {
  const db = new DatabaseSync(':memory:')
  for (const sql of [
    'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
    'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, image_url TEXT, restaurant_name TEXT, restaurant_address TEXT)',
    "CREATE TABLE vouchers (id INTEGER PRIMARY KEY, product_id INTEGER, user_id TEXT, code TEXT, status TEXT, used_at TEXT, applied_price INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE voucher_gifts (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, voucher_id INTEGER, order_id INTEGER, sender_user_id TEXT, recipient_user_id TEXT, message TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP, accepted_at TEXT, cancelled_at TEXT)",
    "INSERT INTO users (id, name) VALUES (1, '보낸이'), (2, '친구')",
    "INSERT INTO products (id, name) VALUES (10, '치즈돈가스')",
    "INSERT INTO vouchers (id, product_id, user_id, code, status) VALUES (100, 10, '1', 'UR-AAAA-BBBB', 'unused'), (101, 10, '1', 'UR-CCCC-DDDD', 'unused')",
  ]) db.prepare(sql).run()
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { raw: db, D1: { prepare: (sql: string) => wrap(sql) } as unknown as D1Database }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (f !== 'tests') walk(p, out) } else if (/\.tsx?$/.test(f)) out.push(p)
  }
  return out
}

describe('① 선물 중이면 쓸 수 없다', () => {
  it('술어를 실제 SQLite 로 — 선물 중 0행, 회수하면 1행', () => {
    const { raw } = makeD1()
    raw.prepare("INSERT INTO voucher_gifts (token, voucher_id, sender_user_id) VALUES ('t1', 100, '1')").run()
    const sql = `UPDATE vouchers SET status = 'used' WHERE id = ? AND status = 'unused' AND ${noPendingGiftSql('vouchers.id')}`
    expect(Number(raw.prepare(sql).run(100 as never).changes)).toBe(0)
    expect(Number(raw.prepare(sql).run(101 as never).changes)).toBe(1)   // 다른 이용권은 영향 없음
    raw.prepare("UPDATE voucher_gifts SET status = 'cancelled' WHERE token = 't1'").run()
    expect(Number(raw.prepare(sql).run(100 as never).changes)).toBe(1)
  })

  it('이용권을 "사용됨" 으로 만드는 모든 문장에 같은 술어가 있다(전수)', () => {
    const hits: { file: string; stmt: string }[] = []
    for (const file of walk('src')) {
      const s = stripComments(readFileSync(file, 'utf8'))
      const re = /UPDATE vouchers\s+SET status\s*=\s*'used'[\s\S]*?(?:`|"\s*\))/g
      for (const m of s.matchAll(re)) hits.push({ file, stmt: m[0] })
    }
    // 셀프 사용 · 계산대 PIN · 사장님 스캔 · 부분 사용(전액/일부) = 5
    expect(hits.length).toBeGreaterThanOrEqual(5)
    for (const h of hits) expect({ file: h.file, ok: h.stmt.includes('noPendingGiftSql(') }).toEqual({ file: h.file, ok: true })
  })

  it('경로마다 먼저 친절한 409 를 준다(술어는 경쟁 상태의 최후 방어)', () => {
    const pub = stripComments(readFileSync('src/features/group-buy/api/group-buy-public.routes.ts', 'utf8'))
    expect(pub).toContain("if (await voucherHasPendingGift(DB, { id: pre.id })) return c.json({ success: false, code: 'GIFT_PENDING', error: GIFT_PENDING_USE_BLOCKED }, 409)")
    const vr = stripComments(readFileSync('src/features/group-buy/api/group-buy-voucher.routes.ts', 'utf8'))
    expect(vr).toContain("if (await voucherHasPendingGift(DB, { code })) return c.json({ success: false, code: 'GIFT_PENDING', error: GIFT_PENDING_USE_BLOCKED }, 409)")   // 계산대 PIN
    expect(vr).toContain("if (await voucherHasPendingGift(DB, { id: voucher.id })) return c.json({ success: false, code: 'GIFT_PENDING', error: GIFT_PENDING_USE_BLOCKED }, 409)")   // 부분 사용
    const sr = stripComments(readFileSync('src/worker/utils/voucher-seller-redeem.ts', 'utf8'))
    expect(sr).toContain('if (await voucherHasPendingGift(DB, { id: voucher.id })) return { ok: false, status: 409, error: GIFT_PENDING_USE_BLOCKED }')
  })
})

describe('② 받으면 코드가 바뀐다', () => {
  it('받기 UPDATE 가 새 코드를 함께 쓴다', () => {
    const s = stripComments(readFileSync('src/features/group-buy/api/voucher-gift.routes.ts', 'utf8'))
    expect(s).toMatch(/UPDATE vouchers SET user_id = \?, gift_from_user_id = \?, code = \?/)
    expect(s).toMatch(/generateVoucherCode\(\)/)
  })
})

describe('③ 보낸 사람 지갑', () => {
  it('선물 중 표시 + 받힌 선물 기록', async () => {
    const { raw, D1 } = makeD1()
    raw.prepare("INSERT INTO voucher_gifts (token, voucher_id, sender_user_id) VALUES ('p', 100, '1')").run()
    raw.prepare("INSERT INTO vouchers (id, product_id, user_id, code, status) VALUES (102, 10, '2', 'UR-EEEE-FFFF', 'unused')").run()
    raw.prepare("INSERT INTO voucher_gifts (token, voucher_id, sender_user_id, recipient_user_id, status, accepted_at) VALUES ('a', 102, '1', '2', 'accepted', '2026-10-12 01:00:00')").run()
    const items = [
      { id: 100, source: 'internal', status: 'unused', code: 'UR-AAAA-BBBB' },
      { id: 101, source: 'internal', status: 'unused', code: 'UR-CCCC-DDDD' },
    ]
    const out = await withGiftState(D1, items as never[], ['1']) as Array<Record<string, unknown>>
    expect(out.find(v => v.id === 100)?.gift_pending).toBe(true)
    expect(out.find(v => v.id === 101)?.gift_pending).toBeFalsy()
    const gifted = out.find(v => v.status === 'gifted')
    expect(gifted).toBeTruthy()
    expect(gifted?.gift_to_name).toBe('친구')
    expect(gifted?.code).toBe('')   // 받은 사람의 새 코드는 보낸 사람에게 절대 안 간다
  })

  it('지갑은 받힌 선물을 지난 기록 쪽에 둔다', () => {
    const s = stripComments(readFileSync('src/pages/MyVouchersPage.tsx', 'utf8'))
    expect(s).toMatch(/v\.status === 'refunded' \|\| v\.status === 'gifted'/)
  })

  it('선물 중이면 QR 을 막고 회수 경로를 보여 준다', () => {
    const s = stripComments(readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8'))
    expect(s).toContain("const giftLocked = voucher.status === 'unused' && giftPending")
    expect(s).toContain('const blocked = isUsed || isExpired || giftLocked')
  })
})

describe('④ 후기 보너스는 지금 없다', () => {
  it('플래그 OFF · 버튼 null · 서버 410', () => {
    expect(KAKAO_REVIEW_BONUS_ENABLED).toBe(false)
    const btn = stripComments(readFileSync('src/pages/my-vouchers/ReviewBonusButton.tsx', 'utf8'))
    expect(btn).toMatch(/if \(!KAKAO_REVIEW_BONUS_ENABLED\) return null/)
    const api = stripComments(readFileSync('src/features/group-buy/api/review-bonus.routes.ts', 'utf8'))
    expect(api).toMatch(/if \(!KAKAO_REVIEW_BONUS_ENABLED\) return c\.json\([\s\S]{0,140}410\)/)
  })
  it('시트는 body 에 포털로 — 흐린 카드 안에 갇히지 않는다', () => {
    const btn = stripComments(readFileSync('src/pages/my-vouchers/ReviewBonusButton.tsx', 'utf8'))
    expect(btn).toMatch(/createPortal\([\s\S]*document\.body,?\s*\)/)
  })
})

describe('⑤ 지갑 지도는 화면을 채운다', () => {
  it('고정 460px 이 아니라 화면 높이', () => {
    const s = stripComments(readFileSync('src/pages/MyVouchersPage.tsx', 'utf8'))
    expect(s).not.toMatch(/height:\s*460/)
    expect(s).toMatch(/const MAP_FILL = 'h-\[calc\(100dvh-/)
    expect((s.match(/\$\{MAP_FILL\}/g) || []).length).toBeGreaterThanOrEqual(2)   // 로딩 자리 + 지도 자리
  })
})

describe('⑤-2 이용권을 누르면 핀이 보이는 칸 한가운데', () => {
  const map = stripComments(readFileSync('src/pages/my-vouchers/VoucherMap.tsx', 'utf8'))
  it('카드 줄이 덮는 만큼 위로 — 핀 몸통 기준', async () => {
    const { FOCUS_BOTTOM_COVER, PIN_HALF_HEIGHT } = await import('@/pages/my-vouchers/VoucherMap')
    expect(FOCUS_BOTTOM_COVER / 2 - PIN_HALF_HEIGHT).toBeGreaterThan(0)   // 지도 가운데를 핀보다 아래로 → 핀이 위로
    expect(map).toMatch(/const dy = FOCUS_BOTTOM_COVER \/ 2 - PIN_HALF_HEIGHT/)
    expect(map).toMatch(/proj\.coordsFromPoint\(new w\.kakao\.maps\.Point\(p\.x, p\.y \+ dy\)\)/)
    expect(map).toMatch(/map\.setBounds\(bounds, 56, 40, FOCUS_BOTTOM_COVER, 40\)/)   // 처음 맞춤과 같은 값
  })
  it('지도 칸 크기가 바뀌면 카카오에 알린다(dvh — 주소창 접힘)', () => {
    expect(map).toMatch(/new ResizeObserver\(\(\) => \{[\s\S]{0,200}map\.relayout\(\)/)
    const focusFx = map.slice(map.indexOf('if (!focus || !map'))
    expect(focusFx.indexOf('map.relayout()')).toBeGreaterThan(0)
    expect(focusFx.indexOf('map.relayout()')).toBeLessThan(focusFx.indexOf('getProjection()'))
  })
})

describe('⑥ 같은 사진은 한 장', () => {
  it('이관 키는 내용 해시 — 같은 바이트면 같은 키', async () => {
    const a = new TextEncoder().encode('같은 사진 바이트').buffer
    const b = new TextEncoder().encode('같은 사진 바이트').buffer
    const c = new TextEncoder().encode('다른 사진').buffer
    expect(await contentHash(a)).toBe(await contentHash(b))
    expect(await contentHash(a)).not.toBe(await contentHash(c))
    expect(await contentHash(a)).toMatch(/^[0-9a-f]{32}$/)
    const src = stripComments(readFileSync('src/worker/utils/rehost-image.ts', 'utf8'))
    expect(src).not.toMatch(/randomUUID/)
    expect(src).toMatch(/MEDIA_BUCKET\.head\(key\)/)   // 이미 있으면 다시 안 올린다
  })

  it('주소 → R2 키', () => {
    expect(mediaKeyOf('/api/media/uploads/demo/x.jpg')).toBe('uploads/demo/x.jpg')
    expect(mediaKeyOf('https://urdeal.kr/api/media/uploads/a.jpg?w=1')).toBe('uploads/a.jpg')
    expect(mediaKeyOf('https://media.ur-team.com/uploads/b.png')).toBe('uploads/b.png')
    expect(mediaKeyOf('https://ldb-phinf.pstatic.net/x.jpg')).toBeNull()
  })

  it('내용이 같은 칸을 접는다 — 다른 사진·판정 못 한 사진은 그대로', () => {
    const sig: Record<string, string> = { '/api/media/c': 'S1', '/api/media/c2': 'S1', '/api/media/d': 'S2', '/api/media/d2': 'S2' }
    const sigOf = (u: string) => sig[u] ?? null
    // 실측 모양: [커버, 커버와 같은 바이트의 다른 주소, 다른 사진]
    expect(dedupeGalleryBySig('/api/media/c', ['/api/media/c', '/api/media/c2', '/api/media/d'], sigOf))
      .toEqual(['/api/media/c', '/api/media/d'])
    // 첫 칸이 커버의 다른 주소면 커버 주소로 맞춘다(images[0] = 커버 모델)
    expect(dedupeGalleryBySig('/api/media/c', ['/api/media/c2', '/api/media/d', '/api/media/d2'], sigOf))
      .toEqual(['/api/media/c', '/api/media/d'])
    // 외부 사진은 판정 밖 — 남는다
    expect(dedupeGalleryBySig('/api/media/c', ['/api/media/c', 'https://x/e.jpg'], sigOf)).toBeNull()
    // 바뀔 게 없으면 null(불필요한 UPDATE 안 함)
    expect(dedupeGalleryBySig('/api/media/c', ['/api/media/c', '/api/media/d'], sigOf)).toBeNull()
  })

  it('원본과 그 재축소본도 같은 사진으로 접는다(v2 — 바이트가 다른 19건)', () => {
    // 실측 모양: 커버 = 원본(자기 서명 + "재축소하면 나올" 서명), 첫 칸 = 이관이 재축소한 사본(자기 서명만)
    const sig: Record<string, string[]> = {
      '/api/media/raw': ['9730011:aaa', '438734:bbb'],
      '/api/media/shrunk': ['438734:bbb'],
      '/api/media/other': ['1000:ccc'],
    }
    const sigOf = (u: string) => sig[u] ?? null
    expect(dedupeGalleryBySig('/api/media/raw', ['/api/media/raw', '/api/media/shrunk', '/api/media/other'], sigOf))
      .toEqual(['/api/media/raw', '/api/media/other'])
    // 첫 칸이 재축소본이면 커버 주소로 맞춘다
    expect(dedupeGalleryBySig('/api/media/raw', ['/api/media/shrunk', '/api/media/other'], sigOf))
      .toEqual(['/api/media/raw', '/api/media/other'])
    // 다른 사진의 재축소본은 안 겹친다
    expect(dedupeGalleryBySig('/api/media/other', ['/api/media/other', '/api/media/shrunk'], sigOf)).toBeNull()
  })

  it('재축소 서명은 이관과 같은 옵션·기준으로 만들고, v1 표시를 다시 본다', () => {
    const d = stripComments(readFileSync('src/worker/cron/gallery-etag-dedupe.ts', 'utf8'))
    const r = stripComments(readFileSync('src/worker/utils/rehost-image.ts', 'utf8'))
    // 옵션을 손으로 다시 적으면 이관이 바뀌는 날 두 서명이 갈려 조용히 안 접힌다
    expect(d).toMatch(/cdn-cgi\/image\/\$\{REHOST_SHRINK_OPTS\}/)
    expect(d).not.toMatch(/width=1600/)
    expect(r).toMatch(/cdn-cgi\/image\/\$\{REHOST_SHRINK_OPTS\}/)
    expect(d).toMatch(/obj\.size > REHOST_SHRINK_OVER/)
    // 만든 서명이 그 주소의 서명 목록에 실제로 들어간다(만들고 버리면 19건이 그대로 남는다)
    expect(d).toMatch(/const alt = await shrunkSig\(key\)\s*\n\s*if \(alt\) own\.push\(alt\)/)
    expect(d).toMatch(/sigs\.set\(key, own\)/)
    expect(r).toMatch(/byteLength > REHOST_SHRINK_OVER/)
    expect(d).toMatch(/GALLERY_ETAG_DEDUPE_KEY = 'gallery_etag_dedupe_v2'/)
    // 예산을 넘기면 멈춘다(이 크론은 뒤에서 이관도 한다 — 무료 50/인보케이션)
    expect(d).toMatch(/if \(spent >= budget\) break/)
  })

  it('정리 패스가 이관 크론에 배선돼 있다(버킷 확인 뒤)', () => {
    const s = stripComments(readFileSync('src/worker/cron/demo-image-rehost.ts', 'utf8'))
    const gate = s.indexOf("skipped: 'NO_MEDIA_BUCKET'")
    const call = s.indexOf('await dedupeGalleryByEtag(')
    expect(gate).toBeGreaterThan(0)
    expect(call).toBeGreaterThan(gate)
  })
})
