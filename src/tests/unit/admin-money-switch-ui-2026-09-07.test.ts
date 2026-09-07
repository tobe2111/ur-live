/**
 * 🎛️ **머니 스위치는 어드민에서 켤 수 있어야 하고, 비워도 0% 가 되면 안 된다.**
 *
 * ## 왜 있는가 — 기존 가드가 이 구멍을 못 봤다
 * `ops-gate-reachable` 는 *"게이트를 만들었으면 켤 화면도 있어야 한다"* 를 강제하는데,
 * **`OPS_GATES` 에 등재된 것만** 본다. `affiliate_program_enabled` 는 등재를 안 했으므로
 * 검사 대상이 아니었고, 그래서 담기 적립의 **주 스위치**가 한 달 넘게 손잡이 없이 남았다
 * (읽는 곳 둘 · 쓰는 화면 0 — 켜려면 D1 을 직접 고쳐야 했다).
 * ⇒ 등재가 곧 검사 범위다. 이 파일은 그 등재 자체를 고정한다.
 *
 * ## 무엇을 고정하나
 * ① 세 키가 어드민 편집 배열에 실재한다(불리언은 select, 요율은 숫자 입력).
 * ② 불리언 옵션 값이 read-site 의 `=== 'true'` 와 **문자 그대로** 맞는다.
 *    ('True'/'1'/'on' 이면 켠 줄 알지만 조용히 꺼진 채로 돈다.)
 * ③ 서버 검증 레지스트리에 등재돼 오타값이 400 으로 막힌다.
 * ④ 🔴 **요율 칸을 비워도 0% 가 되지 않는다** — 이 변경이 처음으로 "비울 수 있는 입구"를
 *    만들었으므로, read-site 의 폴백(유한성 검사 + 기본값)이 살아 있어야 한다.
 *    이게 깨지면 매장 수수료가 0 으로 걷힌다.
 *
 * ## ⚠️ 이 테스트가 못 막는 것
 * - 브라우저에서 실제로 저장되는지(네트워크·권한) — 소스 존재만 본다.
 * - `kind: 'env'` 게이트(Cloudflare 대시보드 소관).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PAGE = 'src/pages/AdminPlatformSettingsPage.tsx'
const GATES = 'src/features/admin/api/admin-system-monitoring.routes.ts'
const VALID = 'src/worker/utils/platform-settings-validation.ts'
const POLICY = 'src/worker/utils/ledger-commission-policy.ts'
const CREDIT = 'src/worker/utils/affiliate-credit.ts'
const DISPLAY = 'src/worker/utils/affiliate-program.ts'

/** 주석 줄을 걷어낸 코드만 — 설명문에 키 이름이 있다고 "편집 가능"으로 치면 안 된다. */
function codeOnly(file: string): string {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

/**
 * 편집 배열에서 한 필드 항목({ ... })만 잘라낸다.
 * ⚠️ 첫 `},` 로 자르면 **options 배열 안의 첫 원소에서 끊긴다** — 처음 이렇게 짰다가
 *    옵션이 하나만 보여 가짜 빨간불이 났다. 중괄호를 세어 바깥 객체를 닫아야 한다.
 */
function fieldEntry(pageCode: string, key: string): string | null {
  const at = pageCode.indexOf(`key: '${key}'`)
  if (at < 0) return null
  const open = pageCode.lastIndexOf('{', at)
  if (open < 0) return null
  let depth = 0
  for (let i = open; i < pageCode.length; i++) {
    if (pageCode[i] === '{') depth++
    else if (pageCode[i] === '}' && --depth === 0) return pageCode.slice(open, i + 1)
  }
  return null
}

describe('머니 스위치 어드민 손잡이 (2026-09-07)', () => {
  it('소스를 읽는다 (측정 0 = 실패)', () => {
    for (const f of [PAGE, GATES, VALID, POLICY, CREDIT, DISPLAY]) {
      expect(readFileSync(f, 'utf8').length, `${f} 가 비었다 — 경로가 바뀌었다`).toBeGreaterThan(500)
    }
  })

  it('① 담기 적립 스위치가 어드민 편집 배열에 있다 (주석 아님)', () => {
    const entry = fieldEntry(codeOnly(PAGE), 'affiliate_program_enabled')
    expect(entry, 'affiliate_program_enabled 를 켤 화면이 없다 — D1 을 직접 고쳐야 한다').toBeTruthy()
    expect(entry, '불리언 스위치는 select 여야 한다(자유 입력이면 오타값이 저장된다)').toContain('options:')
  })

  it('② 옵션 값이 read-site 의 === \'true\' 와 문자 그대로 맞는다', () => {
    const entry = fieldEntry(codeOnly(PAGE), 'affiliate_program_enabled')!
    const values = [...entry.matchAll(/value:\s*'([^']*)'/g)].map((m) => m[1])
    expect(values.sort(), `옵션 값이 ${JSON.stringify(values)} — read-site 는 'true'/'false' 만 읽는다`)
      .toEqual(['false', 'true'])
    // 지급·표시 두 곳이 같은 키를 같은 방식으로 읽는지 확인 — 한쪽만 바뀌면 배지와 지급이 갈린다.
    for (const f of [CREDIT, DISPLAY]) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} 가 affiliate_program_enabled 를 안 읽는다`).toContain('affiliate_program_enabled')
      expect(src, `${f} 의 판정이 === 'true' 가 아니다`).toMatch(/===\s*'true'/)
    }
  })

  it('③ 서버 검증 레지스트리에 등재돼 오타값이 거부된다', () => {
    expect(codeOnly(VALID), 'affiliate_program_enabled 가 미등재 — \'True\'/\'1\' 이 그대로 저장된다')
      .toMatch(/affiliate_program_enabled:\s*boolStr/)
  })

  it('③-b OPS_GATES 에 등재돼 앞으로 reachability 검사를 받는다', () => {
    const code = codeOnly(GATES)
    const at = code.indexOf("key: 'affiliate_program_enabled'")
    expect(at, 'OPS_GATES 미등재 — ops-gate-reachable 의 검사 범위 밖으로 남는다').toBeGreaterThan(-1)
    const entry = code.slice(code.lastIndexOf('{', at), code.indexOf('},', at) + 1)
    expect(entry, "kind 가 'setting' 이 아니다").toContain("kind: 'setting'")
  })

  it('④ 채널 요율 두 개가 편집 가능하다 (표시 전용이 아니라)', () => {
    const code = codeOnly(PAGE)
    for (const key of ['platform_fee_pct_direct', 'platform_fee_pct_brokered']) {
      const entry = fieldEntry(code, key)
      expect(entry, `${key} 를 고칠 자리가 없다 — 매장 카드는 표시 전용이다`).toBeTruthy()
      expect(entry, `${key} 는 숫자 입력이어야 한다(select 아님)`).not.toContain('options:')
    }
  })

  it('④-b 🔴 요율 칸을 비워도 0% 가 되지 않는다 (폴백이 살아 있다)', () => {
    const src = readFileSync(POLICY, 'utf8')
    const at = src.indexOf('export async function channelPlatformRate')
    expect(at, 'channelPlatformRate 를 못 찾았다 — 코드가 옮겨갔다').toBeGreaterThan(-1)
    const body = src.slice(at, src.indexOf('\n}', at))
    // 빈 문자열은 parseFloat 에서 NaN 이라야 폴백으로 간다. Number('') 는 0 이라 0% 로 걷힌다.
    expect(body, "Number.parseFloat 가 아니면 빈 값이 0% 로 읽힌다").toContain('Number.parseFloat')
    expect(body, '유한성 검사가 없으면 NaN 이 그대로 흘러간다').toContain('Number.isFinite')
    expect(body, '폴백(DEFAULT_FEE_RATES)이 없다').toContain('fallback')
  })
})
