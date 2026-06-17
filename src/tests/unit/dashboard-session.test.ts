/**
 * 단일 세션 강제(dashboard-session) 단위 테스트.
 *
 * 검증: iat 에포크 비교 / 역할·서브계정·레거시 grandfather / fail-open.
 * 경량 in-memory D1 fake 로 prepare().bind().first()/.run() 서브셋만 흉내.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  startDashboardSession,
  isDashboardSessionCurrent,
  deriveDashboardSeat,
  SINGLE_SESSION_ROLES,
} from '@/worker/utils/dashboard-session'

type Row = { min_valid_iat: number }

function makeFakeDB() {
  const store = new Map<string, number>() // `${type}:${id}` -> min_valid_iat
  let failNext = false
  const db = {
    setFail(v: boolean) { failNext = v },
    prepare(sql: string) {
      return {
        _args: [] as unknown[],
        bind(...args: unknown[]) { this._args = args; return this },
        async run() {
          if (failNext) throw new Error('D1 down')
          if (/INSERT INTO dashboard_sessions/i.test(sql)) {
            const [type, id, miat] = this._args as [string, number, number]
            store.set(`${type}:${id}`, Number(miat))
          }
          // CREATE TABLE 등은 no-op
          return { meta: { changes: 1 } }
        },
        async first<T = unknown>(): Promise<T | null> {
          if (failNext) throw new Error('D1 down')
          if (/SELECT min_valid_iat/i.test(sql)) {
            const [type, id] = this._args as [string, number]
            const v = store.get(`${type}:${id}`)
            return (v === undefined ? null : ({ min_valid_iat: v } as unknown as T))
          }
          return null
        },
      }
    },
    _store: store,
  }
  return db
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asDB = (db: ReturnType<typeof makeFakeDB>) => db as any

describe('dashboard-session 단일 세션 강제', () => {
  let db: ReturnType<typeof makeFakeDB>
  beforeEach(() => { db = makeFakeDB() })

  it('대상 시트 역할 집합 = admin/seller/supplier/agency/agency_member/seller_sub (user 제외)', () => {
    for (const r of ['admin', 'seller', 'supplier', 'agency', 'agency_member', 'seller_sub']) {
      expect(SINGLE_SESSION_ROLES.has(r)).toBe(true)
    }
    expect(SINGLE_SESSION_ROLES.has('user')).toBe(false)
  })

  it('deriveDashboardSeat — 시트 키 도출', () => {
    expect(deriveDashboardSeat({ type: 'admin', sub: '7' })).toEqual({ role: 'admin', id: 7 })
    expect(deriveDashboardSeat({ type: 'seller', userId: 3 })).toEqual({ role: 'seller', id: 3 })
    expect(deriveDashboardSeat({ type: 'supplier', sub: '9' })).toEqual({ role: 'supplier', id: 9 })
    // 도매 직원 서브계정 → seller_sub(sub_account_id), sub(부모)보다 우선
    expect(deriveDashboardSeat({ type: 'seller', sub: '100', sub_account_id: 42 })).toEqual({ role: 'seller_sub', id: 42 })
    // 에이전시 멤버 → agency_member(member_id)
    expect(deriveDashboardSeat({ type: 'agency', sub: '5', member_id: 11 })).toEqual({ role: 'agency_member', id: 11 })
    // 에이전시 멤버 없음(카카오/레거시) → org 시트
    expect(deriveDashboardSeat({ type: 'agency', sub: '5' })).toEqual({ role: 'agency', id: 5 })
    // 비대상
    expect(deriveDashboardSeat({ type: 'user', sub: '1' })).toBeNull()
    expect(deriveDashboardSeat({})).toBeNull()
  })

  it('서로 다른 시트(직원/멤버)는 독립 단일 세션 — 상호 무영향', async () => {
    // 같은 회사 직원 두 명: seller_sub 42, seller_sub 43
    await startDashboardSession(asDB(db), 'seller_sub', 42, 1000)
    await startDashboardSession(asDB(db), 'seller_sub', 43, 2000)
    // 42 의 옛 토큰(iat=1000) 은 43 로그인에 영향 없음 — 여전히 유효
    expect(await isDashboardSessionCurrent(asDB(db), 'seller_sub', 42, 1000)).toBe(true)
    // 42 가 다른 기기로 재로그인(iat=3000) → 42 의 옛 토큰 무효
    await startDashboardSession(asDB(db), 'seller_sub', 42, 3000)
    expect(await isDashboardSessionCurrent(asDB(db), 'seller_sub', 42, 1000)).toBe(false)
    expect(await isDashboardSessionCurrent(asDB(db), 'seller_sub', 43, 2000)).toBe(true) // 43 무영향
  })

  it('새 로그인이 더 이른 iat 토큰을 무효화(미들웨어 거부)', async () => {
    // device A 로그인 (iat=1000)
    await startDashboardSession(asDB(db), 'admin', 7, 1000)
    // A 토큰(iat=1000)은 유효
    expect(await isDashboardSessionCurrent(asDB(db), 'admin', 7, 1000)).toBe(true)

    // device B 로그인 (iat=2000) → min_valid_iat=2000
    await startDashboardSession(asDB(db), 'admin', 7, 2000)
    // A 토큰(iat=1000) → 거부
    expect(await isDashboardSessionCurrent(asDB(db), 'admin', 7, 1000)).toBe(false)
    // B 토큰(iat=2000) → 통과
    expect(await isDashboardSessionCurrent(asDB(db), 'admin', 7, 2000)).toBe(true)
  })

  it('1초 skew 허용(경계의 자기 토큰 거부 방지)', async () => {
    await startDashboardSession(asDB(db), 'seller', 3, 5000)
    expect(await isDashboardSessionCurrent(asDB(db), 'seller', 3, 4999)).toBe(true)  // -1 허용
    expect(await isDashboardSessionCurrent(asDB(db), 'seller', 3, 4998)).toBe(false) // -2 거부
  })

  it('추적행 없음(롤아웃 전 로그인) = grandfather 통과', async () => {
    expect(await isDashboardSessionCurrent(asDB(db), 'seller', 999, 1000)).toBe(true)
  })

  it('iat 없는 레거시 토큰 = grandfather 통과', async () => {
    await startDashboardSession(asDB(db), 'admin', 7, 2000)
    expect(await isDashboardSessionCurrent(asDB(db), 'admin', 7, undefined)).toBe(true)
  })

  it('비대상 역할(user) = 항상 통과(추적 안 함)', async () => {
    await startDashboardSession(asDB(db), 'user', 1, 1000) // no-op (SINGLE_SESSION_ROLES 아님)
    expect(db._store.size).toBe(0)
    expect(await isDashboardSessionCurrent(asDB(db), 'user', 1, 1)).toBe(true)
  })

  it('D1 오류 시 fail-open(통과) — 대시보드 락아웃 방지', async () => {
    await startDashboardSession(asDB(db), 'admin', 7, 2000)
    db.setFail(true)
    expect(await isDashboardSessionCurrent(asDB(db), 'admin', 7, 1)).toBe(true)
  })

  it('startDashboardSession 도 fail-soft(예외 안 던짐)', async () => {
    db.setFail(true)
    await expect(startDashboardSession(asDB(db), 'admin', 7, 2000)).resolves.toBeUndefined()
  })
})
