/**
 * 꺼진 프로그램의 적립을 화면이 약속하지 않는다 (2026-09-06)
 *
 * 배경: 어필리에이트는 2026-08-22 에 꺼졌다(`affiliate_program_enabled`, 행 부재=꺼짐).
 * 지급 경로는 스위치를 보고 즉시 돌아서는데 **화면은 그 스위치를 몰랐다.**
 * 그전엔 배지가 단위 버그(분수를 퍼센트로)로 늘 0 이라 우연히 안 보였고, 2026-09-05 에
 * 그 버그를 고치자 **꺼진 프로그램의 "쓰면 2%" 가 뜨기 시작했다.**
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 렌더. 순수 함수 + 서버 배선만 본다.
 *   그리고 프로그램을 다시 켰을 때 배지가 정상 복귀하는지는 아래 '켜면 그대로' 케이스가 지킨다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import {
  isAffiliateProgramEnabled, gateAffiliateRows, _resetAffiliateProgramMemo,
} from '@/worker/utils/affiliate-program'
import { effectiveAffiliateRate, affiliateRatePct } from '@/shared/affiliate-rate'

const read = (p: string) => readFileSync(p, 'utf8')

/** platform_settings 한 줄만 답하는 최소 D1 스텁. */
function fakeDB(value: string | null, throws = false) {
  return {
    prepare() {
      return {
        first: async () => {
          if (throws) throw new Error('boom')
          return value === null ? null : { value }
        },
      }
    },
  } as unknown as D1Database
}

describe('스위치 판정', () => {
  beforeEach(() => { /* 인스턴스마다 새 스텁이라 메모 충돌 없음 */ })

  it("'true' 일 때만 켜짐", async () => {
    expect(await isAffiliateProgramEnabled(fakeDB('true'))).toBe(true)
  })

  it('행이 없으면 꺼짐 (라이브 현재 상태)', async () => {
    expect(await isAffiliateProgramEnabled(fakeDB(null))).toBe(false)
  })

  it("'false'·오타 값도 꺼짐", async () => {
    expect(await isAffiliateProgramEnabled(fakeDB('false'))).toBe(false)
    expect(await isAffiliateProgramEnabled(fakeDB('TRUE'))).toBe(false)
  })

  it('설정을 못 읽으면 꺼짐 — 확인 못 한 돈은 약속하지 않는다(fail-closed)', async () => {
    expect(await isAffiliateProgramEnabled(fakeDB(null, true))).toBe(false)
  })

  it('같은 DB 는 메모된다 (핫 목록 경로에 D1 읽기를 얹지 않는다)', async () => {
    let calls = 0
    const db = {
      prepare() { calls++; return { first: async () => ({ value: 'true' }) } },
    } as unknown as D1Database
    await isAffiliateProgramEnabled(db)
    await isAffiliateProgramEnabled(db)
    await isAffiliateProgramEnabled(db)
    expect(calls).toBe(1)
    _resetAffiliateProgramMemo(db)
    await isAffiliateProgramEnabled(db)
    expect(calls).toBe(2)
  })
})

describe('행 게이트 — 화면 SSOT 와 맞물린다', () => {
  it('꺼져 있으면 적립 신호를 눕히고, 화면 SSOT 가 배지를 감춘다', () => {
    const rows = [{ id: 1, referral_enabled: 1, referral_commission_rate: null }]
    gateAffiliateRows(rows, false)
    expect(rows[0].referral_enabled).toBe(0)
    expect(effectiveAffiliateRate(rows[0])).toBeNull()
    expect(affiliateRatePct(rows[0])).toBeNull()   // ← 배지 안 뜸
  })

  it('켜져 있으면 손대지 않는다 — 재개하면 배지가 그대로 돌아온다', () => {
    const rows = [{ id: 1, referral_enabled: 1, referral_commission_rate: null }]
    gateAffiliateRows(rows, true)
    expect(rows[0].referral_enabled).toBe(1)
    expect(affiliateRatePct(rows[0])).toBe(2)      // 플랫폼 기본 2%
  })

  it('필드가 없는 행은 건드리지 않는다 (다른 목록 페이로드 오염 방지)', () => {
    const rows = [{ id: 1, name: 'x' }] as Array<Record<string, unknown>>
    gateAffiliateRows(rows, false)
    expect('referral_enabled' in rows[0]).toBe(false)
  })
})

describe('배선 — 적립을 말하는 두 화면의 서버가 게이트를 통과한다', () => {
  it('목록 API(유어샵 담기 picker)', () => {
    const s = read('src/features/products/repositories/ProductRepository.ts')
    expect(s).toContain('isAffiliateProgramEnabled')
    expect(/gateAffiliateRows\(result\.results \|\| \[\], affiliateOn\)/.test(s)).toBe(true)
  })

  it('유어샵 핀 관리 + 추천 핀', () => {
    const s = read('src/worker/routes/curator.routes.ts')
    expect(s.match(/isAffiliateProgramEnabled\(DB\)/g)?.length ?? 0).toBe(2)
    expect(s.match(/gateAffiliateRows\(/g)?.length ?? 0).toBe(2)
  })

  it('지급 경로의 판정과 같은 키를 본다 (표시와 지급이 갈리지 않게)', () => {
    const gate = read('src/worker/utils/affiliate-program.ts')
    const credit = read('src/worker/utils/affiliate-credit.ts')
    expect(gate).toContain("key = 'affiliate_program_enabled'")
    expect(credit).toContain("key = 'affiliate_program_enabled'")
  })
})
