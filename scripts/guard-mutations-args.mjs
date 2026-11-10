/**
 * 🚫 `check-guard-mutations.mjs` 는 **모르는 인자를 받으면 아무것도 하지 않고 멈춘다** (2026-11-02)
 *
 * ## 왜 (같은 사고가 두 번)
 * 이 러너는 인자를 `process.argv.includes('--x')` 로 하나씩 *찾아보기만* 해서, 모르는 인자는
 * 조용히 무시하고 **필터 없는 전수**(5천 건 넘는 주입 · 수십 분 · 소스를 실제로 망가뜨렸다 되돌림)로 떨어졌다.
 *   - 2026-08-31: `--only=X`(등호형)를 몰라 567건 전수가 돌았다(12분 · 주입이 남의 파일에 들어간 채).
 *     그때 처방은 *등호형도 받게* 한 것이었다 — **그 인자 하나만** 고쳤다.
 *   - 2026-11-02: 형제 도구(`guard-mutations-shard.mjs`)의 `--plan` 을 이 러너에 주니 또 전수가 돌았고,
 *     중간에 끊자 `ledger-commission-policy.ts` 에 주입이 남았다(커밋 전 `--verify-clean` 이 잡을 자리였다).
 * ⇒ 인자 하나씩 고치는 것으로는 다음 오타를 못 막는다. **아는 인자 목록 밖이면 시작하지 않는다.**
 *    "명령 실패와 판정 결과를 섞지 말 것"(CLAUDE.md 3-1) — 잘못 부른 것은 실행이 아니라 오류다.
 *
 * 새 인자를 러너에 더하면 여기 `FLAGS`(또는 값을 받으면 `VALUE_FLAGS`)에도 더한다 —
 * 안 더하면 그 인자를 쓰는 순간 이 검사가 멈춰서 바로 알게 된다(조용히 빠지는 쪽이 아니다).
 */

/** 값 없이 쓰는 인자 */
export const FLAGS = ['-s', '--strict', '--verify-clean', '--map-only', '--dump-manifest', '--changed', '--count', '--scope-json', '--near-edits']
/** 다음 칸(또는 `=` 뒤)에 값을 받는 인자 */
export const VALUE_FLAGS = ['--only', '--shard', '--budget-sec']

/**
 * 순수 — 러너가 모르는 인자를 돌려준다(빈 배열 = 정상).
 * @param {string[]} args `process.argv.slice(2)`
 * @returns {string[]}
 */
export function unknownArgs(args) {
  const out = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (FLAGS.includes(a)) continue
    const eq = VALUE_FLAGS.find((f) => a.startsWith(`${f}=`))
    if (eq) {
      if (a.length === eq.length + 1) out.push(`${a}(값이 비었다)`)
      continue
    }
    if (VALUE_FLAGS.includes(a)) {
      const v = args[i + 1]
      if (v == null || v.startsWith('-')) out.push(`${a}(값이 없다)`)
      else i++
      continue
    }
    out.push(a)
  }
  return out
}
