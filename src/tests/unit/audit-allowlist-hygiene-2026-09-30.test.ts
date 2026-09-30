/**
 * 🧹 npm audit 면제 목록 위생 (2026-09-30)
 *
 * ## 무엇이 잘못돼 있었나
 *
 * 대표 *"모두 고쳐줘 완벽해질 때까지"* 로 CI 빨간불을 파다 드러났다. 면제 목록 9건 중 **6건이
 * 이미 해소된 취약점**이었다(의존성이 올라가 `npm audit` 에 더는 안 뜨는데 면제만 남아 있었다):
 * `websocket-driver`·`js-yaml`·`brace-expansion`×2·`sharp`, 그리고 `axios` GHSA-gcfj.
 *
 * **낡은 면제는 아무것도 안 지키는 게 아니라 위험하다** — 같은 취약점이 다시 들어와도(의존성 되돌림,
 * advisory 범위 확대) 게이트가 **조용히 통과**시킨다. 이 레포가 반복해 당한 '조용한 부재' 클래스다.
 *
 * ⚠️ 그리고 그날 막고 있던 것은 **dev 취약점이 아니라 런타임 axios 5건**이었다(1.19.0 → 1.20.0).
 * `toFormData` 프로토타입 오염은 브라우저에서도 닿으므로 면제가 아니라 **상향**이 답이었다.
 * ⇒ 면제는 "지금 도달 불가"일 때만이고, **런타임 의존성은 올린다.**
 *
 * ## 이 시험이 지키는 것
 *
 * 1. 면제 항목은 판단 근거를 전부 갖는다(ghsa·pkg·reason·accepted_by·date·review) — 근거 없는
 *    면제는 다음 세션이 왜 면제인지 몰라 판단을 못 한다.
 * 2. GHSA 형식·중복 없음.
 * 3. **게이트가 낡은 면제를 스스로 경고한다** — 사람이 주기적으로 대조하는 규율은 결국 안 지켜진다.
 *
 * ## 이 시험이 **못 막는 것**
 *
 * - "그 면제 사유가 사실인가"는 안 본다(도달 불가 판단은 사람이 한다).
 * - 실제로 낡았는지는 `npm audit`(네트워크)만 안다 — 여기서는 **배선**만 고정하고, 판정은
 *   `scripts/check-npm-audit.sh` 가 매 실행에서 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ALLOWLIST = resolve(process.cwd(), '.audit-allowlist.json')
const GATE = resolve(process.cwd(), 'scripts/check-npm-audit.sh')

type Entry = {
  ghsa?: string; pkg?: string; reason?: string
  accepted_by?: string; date?: string; review?: string
}

const raw = JSON.parse(readFileSync(ALLOWLIST, 'utf8')) as { _doc?: string; allow?: Entry[] }
const gate = readFileSync(GATE, 'utf8')

describe('면제 목록 형식', () => {
  it('파일이 실재하고 allow 배열을 갖는다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(Array.isArray(raw.allow), '.audit-allowlist.json 의 allow 가 배열이 아니다').toBe(true)
    expect(gate.length, '게이트 스크립트를 못 읽었다').toBeGreaterThan(500)
  })

  it('모든 항목이 판단 근거 6필드를 갖는다', () => {
    const bad: string[] = []
    for (const e of raw.allow ?? []) {
      for (const k of ['ghsa', 'pkg', 'reason', 'accepted_by', 'date', 'review'] as const) {
        if (!e[k] || String(e[k]).trim() === '') bad.push(`${e.ghsa ?? '(ghsa 없음)'}: ${k} 비어 있음`)
      }
    }
    expect(bad, '근거 없는 면제는 다음 세션이 판단할 수 없다').toEqual([])
  })

  it('GHSA 형식이 맞고 중복이 없다', () => {
    const ids = (raw.allow ?? []).map((e) => (e.ghsa ?? '').trim())
    for (const id of ids) expect(id, `GHSA 형식이 아니다: ${id}`).toMatch(/^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/)
    expect(new Set(ids).size, `중복 GHSA: ${ids.join(', ')}`).toBe(ids.length)
  })

  it('날짜가 YYYY-MM-DD 이고 미래가 아니다', () => {
    const today = new Date().toISOString().slice(0, 10)
    for (const e of raw.allow ?? []) {
      expect(e.date, `${e.ghsa} 날짜 형식`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(String(e.date) <= today, `${e.ghsa} 날짜가 미래다: ${e.date}`).toBe(true)
    }
  })
})

describe('게이트가 낡은 면제를 경고한다', () => {
  it('낡은-면제 판정 블록이 게이트에 배선돼 있다', () => {
    // 🩸 "문자열이 있는가" 로는 부족하다 — 변수를 만들어 놓고 안 쓰면 아무 일도 안 일어난다.
    //   ① 판정값 생성 ② 그 값으로 분기 ③ 사람이 읽을 안내, 셋을 모두 요구한다.
    expect(gate, '낡은 면제 판정을 만들지 않는다').toMatch(/STALE=\$\(echo "\$AUDIT_JSON"/)
    expect(gate, '판정값으로 분기하지 않는다 — 계산만 하고 버리면 경고가 안 뜬다').toMatch(/if \[ -n "\$STALE" \]; then/)
    expect(gate, '낡은 면제 안내 문구가 없다').toMatch(/낡은 면제/)
  })

  it('audit 이 비었을 때는 판정하지 않는다 (전부 낡음으로 보이는 오판 차단)', () => {
    expect(gate, 'present 가 비었을 때 빠져나가는 가드가 없다').toMatch(/if not present:\s*\n\s*sys\.exit\(0\)/)
  })

  it('낡은 면제는 **경고**이고 차단이 아니다', () => {
    // 네트워크/레지스트리 실패로 audit 이 흔들릴 때 멀쩡한 PR 을 막지 않는다.
    const block = gate.slice(gate.indexOf('if [ -n "$STALE" ]; then'), gate.indexOf('if [ -n "$BLOCKING" ]; then'))
    expect(block.length, '낡은-면제 블록을 찾지 못했다').toBeGreaterThan(50)
    expect(block, '낡은 면제로 차단하고 있다 — 경고여야 한다').not.toMatch(/exit 1/)
  })
})

describe('런타임 의존성은 면제하지 않는다', () => {
  it('axios 면제가 남아 있지 않다 (브라우저에서 닿는다 — 상향이 답이다)', () => {
    const axiosEntries = (raw.allow ?? []).filter((e) => e.pkg === 'axios')
    expect(
      axiosEntries.map((e) => e.ghsa),
      'axios 는 런타임 의존성이다. 면제하지 말고 버전을 올릴 것(2026-09-30: 1.19.0 → 1.20.0 으로 5건 해소)',
    ).toEqual([])
  })
})
