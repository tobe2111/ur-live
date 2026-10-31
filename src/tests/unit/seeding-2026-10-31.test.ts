/**
 * 🎁 무상 체험 제공 — 자격 판정 · 신청권(노쇼 방지 보증금) · 상태 전이 · 패널티 (2026-10-31)
 *
 * 신청권은 카드로 사는 **돈**이라 문자열 검사가 아니라 **실제 SQLite** 에 넣고 돌린다:
 *  - 가입 혜택 3회는 평생 한 번 · 같은 결제는 한 번만 지급
 *  - 쓸 때 무료 칸부터 · 같은 신청에 두 번 써도 한 장만 · 잔액 0 이면 아무것도 안 빠진다
 *  - 반환은 쓴 칸으로 한 번만
 *  - 상태 CAS — 기대 상태가 아니면 옮기지 않는다
 *  - 패널티는 신청당 한 번, 2회 30일 · 3회 90일 제한
 *  - 자격: 제공 꺼짐 · 연동 없음 · 팔로워 미달 · 모집 마감 · 이미 신청 · 패널티
 *
 * ⚠️ 못 보는 것: 플랫폼 OAuth 실응답(인스타 프로페셔널 계정·틱톡 심사) · 토스 승인 · 알림톡 실발송.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readCode } from '../helpers/source-text'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    exec: (sql: string) => void
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
  }
}
import {
  SEEDING_TABLES_SQL, addPenalty, chargePasses, grantSignupPasses, passBalance, penaltyState, refundPass, spendPass, transition,
} from '@/features/seeding/api/seeding-db'
import {
  DEFAULT_OFFER, checkEligibility, normalizeOffer, normalizeVisitSlots, parsePassPackages, penaltyBlockDays, validPostUrl,
} from '@/shared/seeding'
import { verifySnsState, signSnsState, safeSnsReturn } from '@/features/seeding/api/sns-link'
import { ALIMTALK_BUTTONS } from '@/lib/alimtalk-buttons'
import { ALL_USED_ALIMTALK_TEMPLATES } from '@/lib/alimtalk-templates'
import { SEEDING_TPL } from '@/shared/seeding'
import { STORE_GO_TARGETS } from '@/shared/store-deep-link'

type Raw = InstanceType<typeof DatabaseSync>
function makeD1(): { DB: D1Database; raw: Raw } {
  const raw = new DatabaseSync(':memory:')
  const stmt = (sql: string) => {
    let args: unknown[] = []
    const api = {
      sql,
      get args() { return args },
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => {
        const r = raw.prepare(sql).run(...(args as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
      first: async () => { const r = raw.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: raw.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const DB = {
    prepare: stmt,
    batch: async (list: ReturnType<typeof stmt>[]) => {
      raw.exec('BEGIN')
      try {
        const out = list.map((s) => ({ meta: { changes: Number(raw.prepare(s.sql).run(...(s.args as never[])).changes) } }))
        raw.exec('COMMIT')
        return out
      } catch (e) { raw.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
  raw.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`)
  for (const s of SEEDING_TABLES_SQL) raw.exec(s)
  return { DB, raw }
}

let DB: D1Database, raw: Raw
beforeEach(() => { ({ DB, raw } = makeD1()) })

const addApp = (status: string, user = 7) => Number(raw.prepare(
  `INSERT INTO seeding_applications (product_id, seller_id, user_id, platform, status, month_key) VALUES (1, 2, ?, 'instagram', ?, '2026-10')`,
).run(...([user, status] as never[])).lastInsertRowid)

describe('💸 신청권 — 가입 혜택 · 구매', () => {
  it('가입 혜택 3회는 몇 번 불러도 한 번', async () => {
    await grantSignupPasses(DB, 7); await grantSignupPasses(DB, 7)
    expect(await passBalance(DB, 7)).toEqual({ free_left: 3, paid_left: 0, total: 3 })
  })
  it('어드민이 무료 횟수를 바꾸면 그 값으로(0~20)', async () => {
    raw.exec(`INSERT INTO platform_settings (key, value) VALUES ('seeding_free_passes', '5')`)
    await grantSignupPasses(DB, 8)
    expect((await passBalance(DB, 8)).free_left).toBe(5)
  })
  it('같은 결제로 두 번 지급해도 한 번만', async () => {
    expect(await chargePasses(DB, 7, 5, 'pk_1', 4500, '5장')).toBe(true)
    expect(await chargePasses(DB, 7, 5, 'pk_1', 4500, '5장')).toBe(false)
    expect(await passBalance(DB, 7)).toEqual({ free_left: 0, paid_left: 5, total: 5 })
  })
})

describe('🧾 보증금 사용 · 반환', () => {
  it('무료 칸부터 쓰고, 같은 신청은 한 장만', async () => {
    await grantSignupPasses(DB, 7); await chargePasses(DB, 7, 1, 'pk', 1000, '')
    const id = addApp('scheduling')
    expect(await spendPass(DB, 7, id)).toBe('free')
    expect(await spendPass(DB, 7, id)).toBe('free') // 두 번째는 기존 기록을 돌려줄 뿐
    expect(await passBalance(DB, 7)).toEqual({ free_left: 2, paid_left: 1, total: 3 })
  })
  it('무료가 다 떨어지면 유료 칸', async () => {
    await chargePasses(DB, 7, 2, 'pk', 2000, '')
    expect(await spendPass(DB, 7, addApp('scheduling'))).toBe('paid')
    expect((await passBalance(DB, 7)).paid_left).toBe(1)
  })
  it('잔액이 없으면 아무것도 안 빠지고 원장에 줄도 없다', async () => {
    expect(await spendPass(DB, 7, addApp('scheduling'))).toBeNull()
    expect((raw.prepare(`SELECT COUNT(*) n FROM seeding_pass_tx`).get() as { n: number }).n).toBe(0)
  })
  it('반환은 쓴 칸으로 한 번만 · 쓰지 않은 신청은 반환 0', async () => {
    await chargePasses(DB, 7, 1, 'pk', 1000, '')
    const id = addApp('scheduling')
    await spendPass(DB, 7, id)
    expect(await refundPass(DB, 7, id, 'x')).toBe(true)
    expect(await refundPass(DB, 7, id, 'x')).toBe(false)
    expect(await passBalance(DB, 7)).toEqual({ free_left: 0, paid_left: 1, total: 1 })
    expect(await refundPass(DB, 7, addApp('approved'), 'x')).toBe(false)
  })
})

describe('🔒 상태 CAS', () => {
  it('기대 상태에서만 옮긴다', async () => {
    const id = addApp('approved')
    expect(await transition(DB, id, ['approved'], 'scheduling')).toBe(true)
    expect(await transition(DB, id, ['approved'], 'scheduling')).toBe(false)
    expect(await transition(DB, id, ['pending', 'sent'], 'approved')).toBe(false)
  })
})

describe('⚠️ 패널티', () => {
  it('같은 신청은 한 번만 · 1회 경고 · 2회 30일 · 3회 90일', async () => {
    const a = addApp('scheduled'), b = addApp('scheduled'), c = addApp('scheduled')
    expect(await addPenalty(DB, 7, a, 'no_show')).toBe(true)
    expect(await addPenalty(DB, 7, a, 'no_show')).toBe(false)
    expect((await penaltyState(DB, 7)).blocked_until).toBeNull()
    await addPenalty(DB, 7, b, 'post_missed')
    expect((await penaltyState(DB, 7)).blocked_until).not.toBeNull()
    await addPenalty(DB, 7, c, 'no_show')
    expect((await penaltyState(DB, 7)).strikes).toBe(3)
    expect([penaltyBlockDays(1), penaltyBlockDays(2), penaltyBlockDays(3)]).toEqual([0, 30, 90])
  })
})

describe('✅ 자격 판정', () => {
  const offer = normalizeOffer({ ...DEFAULT_OFFER, enabled: true, min_followers: 1000, slots_per_month: 2, platforms: ['instagram', 'youtube'] })
  const base = { offer, links: [{ platform: 'instagram' as const, username: 'a', follower_count: 5000 }], usedSlotsThisMonth: 0, hasOpenApplication: false, blockedUntil: null }
  it('통과 — 조건 맞는 플랫폼 중 팔로워 많은 것', () => {
    const r = checkEligibility({ ...base, links: [...base.links, { platform: 'youtube', username: 'b', follower_count: 9000 }] })
    expect(r).toMatchObject({ ok: true, platform: 'youtube', follower_count: 9000 })
  })
  it.each([
    [{ offer: { ...offer, enabled: false } }, 'offer_off'],
    [{ links: [] }, 'no_link'],
    [{ links: [{ platform: 'tiktok' as const, username: 'x', follower_count: 1e6 }] }, 'no_link'],
    [{ links: [{ platform: 'instagram' as const, username: 'x', follower_count: null }] }, 'followers_unknown'],
    [{ links: [{ platform: 'instagram' as const, username: 'x', follower_count: 999 }] }, 'followers_low'],
    [{ usedSlotsThisMonth: 2 }, 'slots_full'],
    [{ hasOpenApplication: true }, 'already_applied'],
    [{ blockedUntil: '2999-01-01 00:00:00' }, 'penalized'],
  ])('%o → %s', (patch, reason) => {
    expect(checkEligibility({ ...base, ...patch }).reason).toBe(reason)
  })
  it('지난 패널티는 막지 않는다', () => {
    expect(checkEligibility({ ...base, blockedUntil: '2000-01-01 00:00:00' }).ok).toBe(true)
  })
})

describe('🧹 정규화', () => {
  it('제공 설정 범위 · 모르는 플랫폼은 버리고 비면 인스타', () => {
    const o = normalizeOffer({ enabled: '1', slots_per_month: 9999, min_followers: -5, platforms: ['x'], post_deadline_days: 0 })
    expect(o).toMatchObject({ enabled: true, slots_per_month: 100, min_followers: 0, platforms: ['instagram'], post_deadline_days: 1 })
  })
  it('방문 일정 — 내일 이후 · 형식 · 최대 3개 · 중복 제거', () => {
    const now = new Date('2026-10-31T03:00:00Z') // KST 12:00
    expect(normalizeVisitSlots(['2026-10-31 18:00', '2026-11-01T12:00', '2026-11-01 12:00', 'bad', '2026-11-02 12:00', '2026-11-03 12:00'], now))
      .toEqual(['2026-11-01 12:00', '2026-11-02 12:00', '2026-11-03 12:00'])
  })
  it('게시물 주소는 그 플랫폼 https 만', () => {
    expect(validPostUrl('https://www.instagram.com/p/abc', 'instagram')).toBeTruthy()
    expect(validPostUrl('http://www.instagram.com/p/abc', 'instagram')).toBeNull()
    expect(validPostUrl('https://evil.com/instagram.com', 'instagram')).toBeNull()
    expect(validPostUrl('https://youtu.be/x', 'youtube')).toBeTruthy()
    expect(validPostUrl('https://www.tiktok.com/@a/video/1', 'instagram')).toBeNull()
  })
  it('묶음 설정 파싱 — 이상하면 기본값', () => {
    expect(parsePassPackages('1:1000,5:4500').map((p) => p.passes)).toEqual([1, 5])
    expect(parsePassPackages('garbage').length).toBe(3)
  })
})

describe('🔐 SNS 연동 state', () => {
  it('서명이 맞고 안 만료된 것만 · 돌아갈 곳은 허용목록', async () => {
    const t = await signSnsState('s3cret', { u: 7, p: 'instagram', r: '/pass/12' })
    expect(await verifySnsState('s3cret', t)).toMatchObject({ u: 7, p: 'instagram', r: '/pass/12' })
    expect(await verifySnsState('other', t)).toBeNull()
    expect(await verifySnsState('s3cret', t, Date.now() + 11 * 60_000)).toBeNull()
    expect(safeSnsReturn('https://evil.com')).toBe('/my-seeding')
    expect(safeSnsReturn('//evil.com')).toBe('/my-seeding')
  })
})

describe('🔘 알림톡 배선', () => {
  it('7개 템플릿 전부 사용 목록 · 버튼 표에 있다', () => {
    for (const t of Object.values(SEEDING_TPL)) {
      expect(ALL_USED_ALIMTALK_TEMPLATES).toContain(t)
      expect(ALIMTALK_BUTTONS[t], t).toBeTruthy()
    }
    expect(STORE_GO_TARGETS.seeding).toBe('/store/seeding')
  })
  it('인플루언서 판정은 서버가 다시 한다(신청 라우트가 checkEligibility 결과로 거절)', () => {
    const src = readCode('src/features/seeding/api/seeding.routes.ts')
    expect(src).toMatch(/if \(!r\.eligibility\?\.ok\)/)
    // 보증금은 상태 CAS 를 먼저 잡은 뒤에만 쓴다(claim-before-spend).
    const i = src.indexOf("transition(DB, a.id, ['approved'], 'scheduling'"), j = src.indexOf('spendPass(DB, a.user_id, a.id)')
    expect(i).toBeGreaterThan(0); expect(j).toBeGreaterThan(i)
  })
  it('체험 이용권은 정산 제외 표식(is_experience=1)으로 발급된다', () => {
    const src = readCode('src/features/seeding/api/seeding-actions.ts')
    expect(src).toMatch(/issueExperienceVoucher\(DB, \{[^}]+\}, String\(a\.user_id\), 'SEED'\)/)
  })
})
