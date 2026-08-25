/**
 * 🎛️ **게이트를 만들었으면 끄고 켤 화면도 있어야 한다.**
 *
 * ## 왜 있는가 — 같은 사고가 세 번 났다
 *
 * | 언제 | 무엇 | 결과 |
 * |---|---|---|
 * | 2026-08-03 | 미수령 정책 **비율**(냉장/실온) | 대표가 확정했는데 넣을 화면이 없어 `platform_settings` 가 **비어 있었다** |
 * | 2026-08-12 | `pickup_unclaimed_policy_enabled` · `partial_refund_enabled` | 설정 화면엔 *"시스템 모니터링에서 켜라"* 안내문만 있고 그 화면은 **조회 전용**. `partial_refund_enabled` 는 **어디에도 없었다** |
 * | 2026-08-12 | `gb_pricing_enabled` | 🔴 **과소청구 긴급 킬스위치인데 당길 손잡이가 없었다** — 돈이 새는 중에 멈출 방법이 없다 |
 *
 * ⇒ **"게이트가 OFF 다"를 "안 켰다"로 읽으면 안 된다. "못 켰다"일 수 있다.**
 * 게이트 6개가 한 달 넘게 잠들어 있던 이유의 일부가 이것이었다.
 *
 * ## 무엇을 강제하나
 * `OPS_GATES`(어드민 게이트 현황판의 SSOT) 중 `kind: 'setting'`(= DB `platform_settings`,
 * 어드민이 바꿀 수 있어야 하는 것)은 **어드민 화면의 편집 배열에 실재**해야 한다.
 *
 * ## 예외 — "켜지 않기로 한 게이트"
 * `turn_on_when` 에 **"켜지 않는다"** 가 적힌 게이트는 화면이 없는 게 정상이다
 * (예: `wholesale_auto_grade_enabled` — 도매몰 철거 대상). 그 문구가 곧 면제 사유다.
 *
 * ## ⚠️ 이 테스트가 못 막는 것
 * - `kind: 'env'` 게이트(Cloudflare 대시보드 소관) — 레포가 볼 수 없다.
 * - 화면에 **있긴 한데 동작하지 않는** 경우(저장 검증에 걸려 거부되는 등).
 *   실제로 이 세션이 `flip_pilot_seller_ids` 를 숫자 검증 배열에 넣어 `Number('5,12')=NaN` 으로
 *   **저장이 막히는** 코드를 쓸 뻔했다 — 문자열 존재만으로는 그걸 못 잡는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const GATES_FILE = 'src/features/admin/api/admin-system-monitoring.routes.ts'

/** 주석 줄을 걷어낸 코드만 — 안내문에 키 이름이 있다고 "편집 가능"으로 치면 안 된다. */
function codeOnly(src: string): string {
  return src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

function readGates(): Array<{ key: string; kind: string; turnOnWhen: string; stagingRef: string | null }> {
  const src = readFileSync(GATES_FILE, 'utf8')
  const arr = src.match(/OPS_GATES[^=]*=\s*\[([\s\S]*?)\n\]/)
  expect(arr, `${GATES_FILE} 에서 OPS_GATES 배열을 못 찾았다 — 구조가 바뀌었다`).toBeTruthy()
  const out: Array<{ key: string; kind: string; turnOnWhen: string; stagingRef: string | null }> = []
  for (const e of arr![1].match(/\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? []) {
    const key = e.match(/key:\s*'([^']+)'/)?.[1]
    if (!key) continue
    out.push({
      key,
      kind: e.match(/kind:\s*'([^']+)'/)?.[1] ?? '',
      turnOnWhen: e.match(/turn_on_when:\s*'([^']*)'/)?.[1] ?? '',
      stagingRef: /staging_ref:\s*null/.test(e) ? null : (e.match(/staging_ref:\s*'([^']*)'/)?.[1] ?? null),
    })
  }
  return out
}

/** 어드민 화면 전체를 코드만 이어붙인다(편집 배열이 어느 Admin 화면에 있든 인정). */
function adminScreensCode(): string {
  const dir = 'src/pages'
  const files = readdirSync(dir).filter((f) => f.startsWith('Admin') && f.endsWith('.tsx'))
  expect(files.length, '어드민 화면 파일을 하나도 못 찾았다 — 경로 규약이 바뀌었다').toBeGreaterThan(5)
  return files.map((f) => codeOnly(readFileSync(join(dir, f), 'utf8'))).join('\n')
}

describe('OPS_GATES: setting 게이트는 켤 화면이 있어야 한다', () => {
  it('게이트 목록을 읽는다 (측정 0 = 실패)', () => {
    const gates = readGates()
    // 🔑 대상이 비면 위반도 0이라 초록이 뜬다 — 이 레포가 반복해 당한 "헛도는 가드".
    expect(gates.length, '게이트를 하나도 못 읽었다 — 파싱이 깨졌다(통과 아님)').toBeGreaterThan(5)
    expect(gates.filter((g) => g.kind === 'setting').length).toBeGreaterThan(0)
  })

  it('🎛️ kind=setting 게이트가 전부 어드민 화면에서 편집 가능하다', () => {
    const code = adminScreensCode()
    const missing = readGates()
      .filter((g) => g.kind === 'setting')
      // "켜지 않는다"고 명시된 게이트는 화면이 없는 게 정상(예: 도매몰 철거 대상)
      .filter((g) => !g.turnOnWhen.includes('켜지 않는다'))
      .filter((g) => !code.includes(`'${g.key}'`))
      .map((g) => g.key)

    expect(
      missing,
      `이 게이트들은 어드민 화면에서 켜고 끌 수 없다 — 코드에만 존재하고 영영 OFF 로 남는다:\n` +
        missing.map((k) => `  - ${k}`).join('\n') +
        `\n\n→ AdminPlatformSettingsPage 의 편집 배열에 추가할 것.` +
        `\n   값이 숫자가 아니면(예: '5,12') 반드시 OPS_POLICY_FIELDS 에 \`text: true\` 로 넣어야 한다` +
        `\n   — 숫자 검증 배열에 두면 Number()=NaN 으로 저장이 거부된다.` +
        `\n   의도적으로 안 켤 게이트라면 turn_on_when 에 "켜지 않는다"를 명시하면 면제된다.`,
    ).toEqual([])
  })
})

/**
 * 🧾 **`staging_ref` 는 실재하는 항목을 가리켜야 한다** (2026-08-25 신설)
 *
 * CLAUDE.md 는 게이트를 만들 때 `docs/STAGING_CHECKLIST.md` 에 항목(S#/P#)을 함께 추가하라고
 * 규정한다. 그런데 **그 참조가 맞는지는 아무도 안 봤다** — 실측: `fee_channel_rates_enabled` 를
 * 등록하며 내가 `S1` 을 붙였는데, S1 은 `commission_budget_enabled`(커미션 예산 캡)의 절차다.
 * 즉 게이트를 켜려는 사람이 **엉뚱한 검증 절차를 읽게** 된다.
 *
 * 게이트가 없어서 나는 사고보다, 게이트를 **잘못된 절차로 켜서** 나는 사고가 더 비싸다.
 *
 * ⚠️ 못 보는 것: 항목이 실재해도 **내용이 그 게이트에 맞는지**는 사람이 봐야 한다.
 *   여기서 보는 것은 "가리키는 곳이 있는가"까지다.
 */
describe('🧾 staging_ref 가 실재하는 체크리스트 항목을 가리킨다', () => {
  const md = readFileSync('docs/STAGING_CHECKLIST.md', 'utf8')

  it('체크리스트를 읽었다 (0바이트면 통과가 아니라 실패)', () => {
    expect(md.length).toBeGreaterThan(500)
  })

  it('🔴 모든 staging_ref 가 문서에 실재한다', () => {
    const gates = readGates()
    const refs = gates.map((g) => g.stagingRef).filter((r): r is string => Boolean(r))
    expect(refs.length, 'staging_ref 를 가진 게이트가 하나도 없다 — 파싱이 깨졌다').toBeGreaterThan(0)
    // ⚠️ `**S7**` 로만 찾으면 **오탐이 난다** — 실측: `P10` 은 문서에 `**P10 — 결제까지만.**` 으로
    //   정의돼 있어 닫는 `**` 가 이름 바로 뒤에 없다. 첫 판이 그래서 멀쩡한 참조를 빨갛게 냈고,
    //   하마터면 **가드가 아니라 문서를 고칠 뻔했다.** 굵게 시작 + 단어경계까지만 본다.
    const missing = refs.filter((r) => !new RegExp(`\\*\\*${r}\\b`).test(md))
    expect(missing, `체크리스트에 없는 참조: ${missing.join(', ')} — 켜려는 사람이 읽을 절차가 없다`).toEqual([])
  })
})
