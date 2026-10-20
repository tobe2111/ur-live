/**
 * 🧟 러너가 **없는 가드 스크립트**를 부르는 것 (2026-10-12 실측 3건)
 *
 * ## 무슨 일이 있었나
 * 2026-10-11 도매몰 철거로 가드 셋이 삭제됐는데 `install-git-hooks.sh` 가 계속 불렀다:
 * `check-wholesale-autologin-guarded` · `check-wholesale-login-spa-navigate` ·
 * `check-login-gate-by-price`. 전부 `|| true` 라 매 커밋마다 `MODULE_NOT_FOUND` **스택만 찍고
 * 조용히 넘어갔다**(= 지키는 것 없이 겁만 주는 줄). `verify.yml` 엔 없어서 **CI 는 영원히 못 본다**.
 *
 * ## 왜 R1 로는 못 잡나
 * `check-guard-registry` 의 R1 은 *가드 → 러너* 방향이다(모든 `check-*` 가 어딘가에서 돌는가).
 * 가드 파일이 **사라지면** R1 의 순회 대상에서도 빠지므로 **아무 말도 하지 않는다.**
 * *"호출은 남았는데 가드가 없다"* 는 R1·R2 **사이**의 구멍이었고, R3 가 그 자리를 막는다.
 *
 * ## 이 시험이 **못 하는 것**
 *   - 훅이 실제로 설치됐는지(`.git/hooks` 는 클론에 안 딸려 온다 — 레포가 못 본다).
 *   - 가드가 **일을 하는가**(그건 각 가드의 주입이 본다).
 */
import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const GUARD = 'scripts/check-guard-registry.mjs'

/**
 * 🩸 첫 판은 `execFileSync` 로 **stdout 만** 받았다. 이 가드는 기본(비-strict) 모드에서
 *   위반을 `console.error`(stderr)로 찍고 **exit 0** 으로 끝나므로, 결함을 심어도 받은 문자열이
 *   `''` 이라 *"통과했다"* 로 읽혔다 — 결함과 **측정 실패**가 구분되지 않았다.
 *   ⇒ 두 스트림을 합쳐 본다. (`-s` 를 주면 exit 1 이지만, 여기선 기본 모드의 출력을 봐야 한다.)
 */
function run(): { code: number; out: string } {
  const r = spawnSync('node', [GUARD], { encoding: 'utf-8' })
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

describe('🧟 R3 — 러너의 죽은 가드 호출', () => {
  it('지금은 죽은 호출이 0 이다', () => {
    const { out } = run()
    expect(out, '죽은 호출이 남아 있다 — 호출 줄을 지워라').not.toContain('파일 없음')
    expect(out).toContain('러너의 죽은 호출 0')
  })

  /**
   * 🔬 문자열 검사로 끝내지 않는다 — **없는 가드를 실제로 호출하게 만들어** 가드를 돌려 본다.
   *   훅 파일을 건드리는 대신 임시 러너를 쓸 수 없는 이유: R3 는 러너 경로를 **고정 목록**으로
   *   들고 있다(그게 그 설계의 요지다). 그래서 훅 파일을 잠깐 고치고 **반드시 되돌린다**.
   */
  it('없는 가드를 부르면 빨간불이 된다 (되돌려-검증)', () => {
    const p = 'scripts/install-git-hooks.sh'
    const orig = fs.readFileSync(p, 'utf8')
    try {
      // ASCII 와 비ASCII 를 **둘 다** 심는다 — 첫 판의 정규식이 ASCII 만 받아 비ASCII 를 놓쳤다.
      fs.writeFileSync(p, `${orig}\nnode scripts/check-no-such-guard.mjs || true\nnode scripts/check-이것은-없는-가드.mjs || true\n`)
      const { out } = run()
      expect(out, '없는 호출을 심었는데 가드가 통과했다 — R3 가 헛돈다').toContain('파일 없음')
      expect(out).toContain('check-no-such-guard.mjs')
      expect(out, '파일명 문자 집합을 좁히면 이 줄이 샌다').toContain('check-이것은-없는-가드.mjs')
    } finally {
      fs.writeFileSync(p, orig)
    }
    // 복원 확인 — 이 시험이 레포를 더럽힌 채 끝나면 안 된다.
    expect(fs.readFileSync(p, 'utf8')).toBe(orig)
    expect(run().out).toContain('러너의 죽은 호출 0')
  })

  /**
   * 🩸 첫 판은 `expect(src).toContain('.github/workflows')` 였고 **주입이 통과시켰다** —
   *   그 문자열은 내가 쓴 설명 주석에도 있어서, 워크플로를 소스 목록에서 **빼도** 남아 있었다.
   *   (이 레포가 반복해 밟은 자리: 제거를 기록하는 주석과 제거를 검사하는 단언이 같은 문자열을 공유한다.)
   *   ⇒ 워크플로 파일에 죽은 호출을 **실제로 심어** 잡히는지 본다.
   */
  it('워크플로도 러너로 본다 — 훅만 보면 CI 쪽 죽은 호출이 샌다', () => {
    const p = '.github/workflows/verify.yml'
    const orig = fs.readFileSync(p, 'utf8')
    try {
      fs.writeFileSync(p, `${orig}\n      - run: node scripts/check-ci-only-dead-guard.mjs\n`)
      const { out } = run()
      expect(out, '워크플로를 러너로 안 보면 CI 쪽 죽은 호출이 영원히 안 보인다').toContain('check-ci-only-dead-guard.mjs')
      expect(out).toContain(p)
    } finally {
      fs.writeFileSync(p, orig)
    }
    expect(fs.readFileSync(p, 'utf8'), '시험이 워크플로를 더럽힌 채 끝나면 안 된다').toBe(orig)
    expect(run().out).toContain('러너의 죽은 호출 0')
    // 훅·pre-push 도 함께 본다(목록에서 하나가 빠지면 그 러너의 죽은 호출이 샌다).
    const src = fs.readFileSync(GUARD, 'utf8')
    expect(src).toContain('pre-push-gate.mjs')
    expect(src).toContain('install-git-hooks.sh')
  })

  it('호출을 한 건도 못 찾으면 통과가 아니라 실패다', () => {
    const src = fs.readFileSync(GUARD, 'utf8')
    expect(src, '하한이 없으면 정규식이 낡는 순간 영원히 초록이다').toContain('R3 이 가드 호출을 한 건도 못 찾았다')
  })

  it('주석 속 예시 호출은 세지 않는다 — 제거 기록이 거짓 빨간불을 내면 안 된다', () => {
    const src = fs.readFileSync(GUARD, 'utf8')
    expect(src).toMatch(/filter\(\(l\) => !\/\^\\s\*#\/\.test\(l\)\)/)
    // 그리고 그 성질을 **동작으로** 확인한다 — 훅 주석에 없는 가드 호출을 적어도 초록이어야 한다.
    const p = 'scripts/install-git-hooks.sh'
    const orig = fs.readFileSync(p, 'utf8')
    try {
      fs.writeFileSync(p, `${orig}\n# node scripts/check-지워진-가드.mjs || true  (제거 기록)\n`)
      expect(run().out, '주석을 세면 "지웠다" 는 기록이 빨간불을 낸다').toContain('러너의 죽은 호출 0')
    } finally {
      fs.writeFileSync(p, orig)
    }
    expect(fs.readFileSync(p, 'utf8')).toBe(orig)
  })
})
