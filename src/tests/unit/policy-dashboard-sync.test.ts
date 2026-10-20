/**
 * 📖 2026-08-01 (대표: "/admin/policy 여기도 최신화해줘. **항상** 여긴 최신화가 되어야 해")
 *
 * "항상 최신"은 사람이 지킬 수 없다 — 실제로 안 지켜져 있었다. 실측: `policy.ts` 가 선언한 8개 그룹 중
 * **4개(HOSTING/WITHDRAWAL/SHIPPING/CURATOR)가 대시보드에 아예 없었고**, COMMISSION_DEFAULTS 안에서도
 * 3개 키(AGENCY_STORE_INTRO_PCT · INFLUENCER_STORE_INTRO_PCT · CURATOR_AFFILIATE_PCT)가 빠져 있었다.
 * 빠져도 에러가 없으니 화면은 그냥 **조용히 낡는다**.
 *
 * 그래서 약속을 가드로 바꾼다: policy.ts 의 모든 키가 `POLICY_SECTIONS` 에 있어야 한다.
 * 상수를 추가하고 표를 안 고치면 여기서 빨간불.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: `desc` 문구가 낡는 것(값은 상수에서 자동으로 따라오지만 설명은 사람이 쓴다).
 *    그리고 platform_settings 동적 값은 대상이 아니다 — 그건 페이지가 API 로 읽어 겹쳐 보여 준다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import * as POLICY from '@/shared/constants/policy'
import { POLICY_SECTIONS } from '@/pages/admin-policy/policy-rows'

/** 대시보드가 표시 대상으로 삼는 상수 그룹. 새 그룹을 policy.ts 에 추가하면 여기도 추가할 것. */
const TRACKED = [
  'REFUND_POLICY',
  'COMMISSION_DEFAULTS',
  'HOSTING_DEFAULTS',
  'WITHDRAWAL_DEFAULTS',
  'SHIPPING_DEFAULTS',
  'CURATOR_DEFAULTS',
  'TAX_POLICY',
  'TIME_CONSTANTS',
] as const

/** TAX_POLICY 는 화면에서 WITHHOLDING_RATES 이름으로 풀어 쓰므로 키 이름이 다르다 — 그 매핑만 예외. */
const KEY_ALIAS: Record<string, string> = {
  BUSINESS_INCOME_RATE: 'BUSINESS_INCOME_RATE',
  OTHER_INCOME_RATE: 'OTHER_INCOME_RATE',
}

describe('정책 대시보드 ↔ policy.ts 동기화', () => {
  it('추적 대상 그룹이 실제로 존재한다 (0개면 통과가 아니라 실패)', () => {
    for (const name of TRACKED) {
      expect((POLICY as Record<string, unknown>)[name], `${name} 이 policy.ts 에 없다`).toBeDefined()
    }
    expect(POLICY_SECTIONS.length).toBe(TRACKED.length)
  })

  it('모든 그룹이 대시보드에 섹션으로 있다', () => {
    const shown = new Set(POLICY_SECTIONS.map(s => s.source))
    for (const name of TRACKED) {
      expect(shown.has(name), `${name} 섹션이 대시보드에 없다 — 화면이 낡는다`).toBe(true)
    }
  })

  it.each(TRACKED.map(t => [t]))('%s 의 모든 키가 화면에 표시된다', (group) => {
    const obj = (POLICY as Record<string, Record<string, unknown>>)[group]
    const section = POLICY_SECTIONS.find(s => s.source === group)!
    const shown = new Set(section.rows.map(r => KEY_ALIAS[r.key] ?? r.key))
    for (const key of Object.keys(obj)) {
      expect(shown.has(key), `${group}.${key} 가 대시보드에 없다 — policy.ts 에 추가하고 표를 안 고쳤다`).toBe(true)
    }
  })

  it('화면에만 있고 policy.ts 에 없는 유령 키가 없다 (지워진 상수가 계속 보이면 오정보)', () => {
    for (const section of POLICY_SECTIONS) {
      const obj = (POLICY as Record<string, Record<string, unknown>>)[section.source]
      for (const row of section.rows) {
        const key = KEY_ALIAS[row.key] ?? row.key
        expect(key in obj, `${section.source}.${row.key} 는 policy.ts 에 없다 — 삭제된 상수를 계속 보여 준다`).toBe(true)
      }
    }
  })

  it('페이지가 표를 렌더한다 (표만 고치고 배선을 잊으면 화면은 그대로다)', () => {
    const src = readFileSync('src/pages/AdminPolicyDashboardPage.tsx', 'utf8')
    expect(src).toContain('POLICY_SECTIONS')
    expect(src).toContain('POLICY_SECTIONS.map')
  })

  it('영구 중단된 기능의 상수는 화면에 그렇게 표시된다 (라이브커머스)', () => {
    const time = POLICY_SECTIONS.find(s => s.source === 'TIME_CONSTANTS')!
    for (const k of ['YOUTUBE_LIVE_POLL_SEC', 'LIVE_IMMINENT_THRESHOLD_SEC']) {
      const row = time.rows.find(r => r.key === k)!
      expect(row.retired, `${k} 은 라이브커머스 영구중단 상수 — 지금 동작하지 않음을 밝혀야 한다`).toBeTruthy()
    }
  })
})
