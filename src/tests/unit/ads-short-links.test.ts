import { describe, it, expect, beforeEach } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  createShortLink, listMyLinks, updateShortLink, deleteShortLink,
  resolveShortLink, recordShortLinkClick, shortLinkStats,
  validateTargetUrl, genCode, adminSetShortLinkActive,
} from '@/features/marketing/api/short-links'

/**
 * 🆕 2026-07-12 유어애즈 무료 단축 링크 — 실제 SQLite 통합 테스트.
 *   생성 검증(스킴 화이트리스트/재귀 차단/커스텀 코드/예약어) · 리다이렉트 해석+클릭 집계 ·
 *   소유 스코프(IDOR) · 어드민 비활성 시 즉시 404 경로.
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

describe('UR Ads 단축 링크', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('target 검증: http/https 만, javascript:/data: 거부, /l/ 재귀 거부', () => {
    expect(validateTargetUrl('https://example.com/page?a=1').ok).toBe(true)
    expect(validateTargetUrl('http://example.com').ok).toBe(true)
    expect(validateTargetUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateTargetUrl('data:text/html,x').ok).toBe(false)
    expect(validateTargetUrl('ftp://example.com').ok).toBe(false)
    expect(validateTargetUrl('not a url').ok).toBe(false)
    expect(validateTargetUrl('').ok).toBe(false)
    expect(validateTargetUrl('https://live.ur-team.com/l/abc123').ok).toBe(false) // 재귀 차단
  })

  it('genCode: 6자, 혼동문자(0/O/1/l/I) 없음', () => {
    for (let i = 0; i < 20; i++) {
      const c = genCode()
      expect(c).toHaveLength(6)
      expect(/[0O1lI]/.test(c)).toBe(false)
    }
  })

  it('생성 → 해석 → 클릭 집계(총계+일별) → 통계', async () => {
    const r = await createShortLink(DB, 1, { target_url: 'https://example.com/promo', title: '프로모' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const hit = await resolveShortLink(DB, r.link.code)
    expect(hit?.target_url).toBe('https://example.com/promo')
    await recordShortLinkClick(DB, hit!.id)
    await recordShortLinkClick(DB, hit!.id)
    const list = await listMyLinks(DB, 1)
    expect(list[0].click_count).toBe(2)
    const stats = await shortLinkStats(DB, 1, hit!.id)
    expect(stats.ok).toBe(true)
    expect(stats.daily?.length).toBe(1)
    expect(stats.daily?.[0].count).toBe(2)
  })

  it('커스텀 코드: 형식/예약어/중복 거부', async () => {
    expect((await createShortLink(DB, 1, { target_url: 'https://a.com', custom_code: 'my-promo_1' })).ok).toBe(true)
    expect((await createShortLink(DB, 1, { target_url: 'https://a.com', custom_code: 'my-promo_1' })).ok).toBe(false) // 중복
    expect((await createShortLink(DB, 1, { target_url: 'https://a.com', custom_code: 'ab' })).ok).toBe(false)        // 너무 짧음
    expect((await createShortLink(DB, 1, { target_url: 'https://a.com', custom_code: '한글코드' })).ok).toBe(false)   // 비허용 문자
    expect((await createShortLink(DB, 1, { target_url: 'https://a.com', custom_code: 'admin' })).ok).toBe(false)     // 예약어
  })

  it('소유 스코프(IDOR): 남의 링크 수정/삭제/통계 불가', async () => {
    const r = await createShortLink(DB, 1, { target_url: 'https://a.com' })
    if (!r.ok) throw new Error('setup')
    expect((await updateShortLink(DB, 2, r.link.id, { active: false })).ok).toBe(false)
    expect((await deleteShortLink(DB, 2, r.link.id)).ok).toBe(false)
    expect((await shortLinkStats(DB, 2, r.link.id)).ok).toBe(false)
    // 본인은 가능
    expect((await updateShortLink(DB, 1, r.link.id, { active: false })).ok).toBe(true)
    expect(await resolveShortLink(DB, r.link.code)).toBeNull() // 비활성 → 해석 불가(404)
    expect((await deleteShortLink(DB, 1, r.link.id)).ok).toBe(true)
  })

  it('어드민 비활성 → 즉시 해석 불가(404) / 재활성 → 복구', async () => {
    const r = await createShortLink(DB, 1, { target_url: 'https://a.com' })
    if (!r.ok) throw new Error('setup')
    await adminSetShortLinkActive(DB, r.link.id, false)
    expect(await resolveShortLink(DB, r.link.code)).toBeNull()
    await adminSetShortLinkActive(DB, r.link.id, true)
    expect((await resolveShortLink(DB, r.link.code))?.id).toBe(r.link.id)
  })
})
