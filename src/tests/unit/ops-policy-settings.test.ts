import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

import { OPS_POLICY_FIELDS } from '../../pages/AdminPlatformSettingsPage'
import { parseUnclaimedPolicy, DEFAULT_UNCLAIMED_POLICY } from '../../shared/pickup-refund'
import { validatePlatformSettings } from '../../worker/utils/platform-settings-validation'

/**
 * 🥡 **결정은 있는데 넣을 화면이 없던 값들** 〔2026-08-03 실측〕
 *
 * 대표가 2026-08-02 에 미수령 정책을 확정(냉장 0% · 실온 유예 3일)했는데 `platform_settings` 를
 * 직접 조회하니 **두 값 다 없었다.** 결정 누락이 아니라 **입력 화면이 없었다.**
 * `operator_support_contact` 도 같은 상태여서 셀러 문의 카드가 아예 렌더되지 않았다.
 *
 * 여기서 고정하는 것은 두 가지다:
 *   1. **입력칸이 쓰는 키 = 코드가 읽는 키** (한쪽만 바뀌면 입력이 죽은 키로 들어간다)
 *   2. **빈 값은 0 이 아니라 "소비자에게 유리한 기본값"** — 숫자를 미리 채워 두면 저장 한 번에
 *      머니 정책이 조용히 바뀐다(0% = 환불 없음).
 *
 * ⚠️ 이 테스트가 **못** 잡는 것: 실제 렌더 결과(JSX)와 저장 페이로드. 값이 화면에 그려지는지는
 *    보지 않고 **필드 정의와 파서의 계약**만 본다.
 */
describe('운영 정책 입력칸', () => {
  it('필드가 비어 있지 않다 (측정 0 이면 통과가 아니라 실패)', () => {
    expect(OPS_POLICY_FIELDS.length).toBeGreaterThanOrEqual(4)
  })

  it('숫자 필드에 기본값을 미리 채우지 않는다 (저장 한 번에 정책이 바뀌면 안 된다)', () => {
    for (const f of OPS_POLICY_FIELDS) {
      expect(f, `${f.key}: default 를 두면 안 된다 — 빈 값이 곧 "미설정"이다`).not.toHaveProperty('default')
    }
  })

  it('입력칸의 키를 코드가 실제로 읽는다 (죽은 키로 저장되면 아무 일도 안 일어난다)', () => {
    // 🕳️ 2026-08-12: 원래 여기 **소비 파일 3개가 하드코딩**돼 있었다. 그래서 소비처가 그 셋 밖에
    //   있는 키를 추가하면 실제로는 읽고 있는데도 "죽은 키"로 **오탐**한다 — `flip_pilot_seller_ids`
    //   (`worker/utils/flip-pilot.ts` 가 읽는다)를 넣자마자 그렇게 됐다. 목록에 한 줄 더 적는 대신
    //   **소비처를 전체에서 찾는다** — 그래야 새 소비 지점이 생겨도 이 테스트를 안 고쳐도 된다.
    //
    //   ⚠️ 단, **쓰는 쪽을 반드시 제외**해야 한다. 설정 화면(이 필드를 정의하는 파일)과 테스트가
    //   포함되면 어떤 키든 자기 자신에 매칭돼 **항상 초록** — 가드가 통째로 헛돈다.
    const consumers = execSync(
      `git ls-files 'src/**/*.ts' 'src/**/*.tsx'` +
        ` | grep -viE 'AdminPlatformSettingsPage|src/tests/'`,
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean)
    // 측정 0 = 통과가 아니라 실패 (경로 규약이 바뀌면 조용히 초록이 뜬다)
    expect(consumers.length, '소비처 스캔 대상이 0개다 — 경로 규약이 바뀌었다').toBeGreaterThan(100)

    const readers = consumers.map((f) => readFileSync(f, 'utf8')).join('\n')
    const dead = OPS_POLICY_FIELDS.filter((f) => !readers.includes(f.key))
    expect(dead.map((f) => f.key), '읽는 코드가 없는 키').toEqual([])
  })

  it('"없으면 무슨 일이 벌어지나"가 힌트에 적혀 있다', () => {
    // 이 문장이 없으면 대표는 빈 칸이 0 인지 100 인지 알 수 없다 — 머니 정책에서 그 차이가 전부다.
    for (const f of OPS_POLICY_FIELDS) expect(f.hint.length).toBeGreaterThan(10)
  })
})

describe('빈 값은 0 이 아니라 소비자에게 유리한 기본값', () => {
  it('전부 미설정이면 전액 환불(100%)이다', () => {
    const p = parseUnclaimedPolicy({})
    expect(p.coldPct).toBe(100)
    expect(p.roomPct).toBe(100)
    expect(p).toEqual(DEFAULT_UNCLAIMED_POLICY)
  })

  it('빈 문자열도 미설정으로 본다 (입력칸을 비워 저장해도 안전)', () => {
    const p = parseUnclaimedPolicy({
      pickup_unclaimed_cold_pct: '',
      pickup_unclaimed_room_pct: '   ',
    })
    expect(p.coldPct, '빈 값이 0% 가 되면 환불이 사라진다').toBe(100)
    expect(p.roomPct).toBe(100)
  })

  it('대표 확정값(냉장 0 · 유예 3)이 그대로 해석된다', () => {
    const p = parseUnclaimedPolicy({
      pickup_unclaimed_policy_enabled: 'true',
      pickup_unclaimed_cold_pct: '0',
      pickup_unclaimed_room_grace_days: '3',
    })
    expect(p.enabled).toBe(true)
    expect(p.coldPct).toBe(0)
    expect(p.roomGraceDays).toBe(3)
    expect(p.roomPct, '실온 비율을 안 넣으면 전액이다').toBe(100)
  })
})

/**
 * 🛂 저장 게이트 — **빈 값은 통과, 오타는 거부.**
 *
 * 두 방향 다 중요하다. 빈 값을 거부하면 어드민이 칸을 비우는 순간 **저장 전체가 막히고**,
 * 오타를 통과시키면 `=== 'true'` 가 조용히 OFF 로 읽어 **대표가 켰다고 믿는 정책이 안 돈다**.
 */
describe('미수령 정책 값 검증', () => {
  it('빈 값은 통과한다 (미설정 = 소비자 유리 기본값)', () => {
    expect(validatePlatformSettings({
      pickup_unclaimed_cold_pct: '',
      pickup_unclaimed_room_pct: '   ',
      pickup_unclaimed_room_grace_days: '',
      operator_support_contact: '',
    })).toBeNull()
  })

  it('대표 확정값이 통과한다', () => {
    expect(validatePlatformSettings({
      pickup_unclaimed_policy_enabled: 'true',
      pickup_unclaimed_cold_pct: '0',
      pickup_unclaimed_room_grace_days: '3',
      operator_support_contact: '010-0000-0000',
    })).toBeNull()
  })

  it('게이트 오타를 거부한다 (조용한 OFF 방지)', () => {
    // 'True'/'1' 은 read-site 의 === 'true' 에 걸리지 않는다 — 저장 시점에 막아야 한다.
    expect(validatePlatformSettings({ pickup_unclaimed_policy_enabled: 'True' })).toContain('pickup_unclaimed_policy_enabled')
    expect(validatePlatformSettings({ pickup_unclaimed_policy_enabled: '1' })).toBeTruthy()
  })

  it('범위 밖 값을 거부한다', () => {
    expect(validatePlatformSettings({ pickup_unclaimed_cold_pct: '150' })).toBeTruthy()
    expect(validatePlatformSettings({ pickup_unclaimed_cold_pct: '영' })).toBeTruthy()
    expect(validatePlatformSettings({ pickup_unclaimed_room_grace_days: '3.5' })).toBeTruthy()
    expect(validatePlatformSettings({ pickup_unclaimed_room_grace_days: '400' })).toBeTruthy()
  })
})
