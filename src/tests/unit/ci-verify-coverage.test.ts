/**
 * 🧪 **머지되는 코드는 반드시 한 번은 검증됐다** — PR 검증이 조용히 건너뛰어지는 걸 막는다.
 *
 * ## 무슨 일이 있었나 (2026-08-03 실사고)
 * PR #976 에서 코드 커밋(`b326fc7`)을 밀어 Verify 가 돌던 중, **문서 전용 커밋(`5de7b35`)을 뒤에 밀었다.**
 * ```
 *   concurrency: cancel-in-progress  →  앞 run(코드 커밋)을 취소
 *   paths-ignore: ['docs/**']        →  뒤 커밋은 자기 run 을 만들지 않음
 *   ────────────────────────────────────────────────────────────────
 *   결과: PR 에 **실패한 체크가 하나도 없는데 그 코드는 한 번도 검증되지 않았다.**
 * ```
 * 초록불도 아니고 빨간불도 아닌 **무(無)** 였다 — 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 의
 * CI 판. 머지 직전에 알아채 커밋을 하나 더 밀어 되살렸지만, 못 알아챘으면 미검증 코드가 머지됐다.
 *
 * ## 왜 `pull_request` 에서만 걷어내나
 * `push` 이벤트는 **그 푸시의 파일만** 본다 — 문서 커밋 하나는 문서 커밋일 뿐이라 skip 이 옳다.
 * 반면 `pull_request` 는 **머지될 전체**를 검증하는 자리다. 여기서 건너뛰면 위 구멍이 생긴다.
 *
 * ⚠️ **이 테스트가 못 보는 것**: 필수 상태체크(branch protection)가 없다는 사실 자체. 즉 Verify 가
 *   빨강이어도 GitHub 이 머지를 막지는 않는다 — 그건 레포 설정이라 코드가 강제할 수 없다.
 *   여기서 보장하는 건 *"검증이 돌기는 한다"* 까지다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const WF = '.github/workflows/verify.yml'
const src = readFileSync(WF, 'utf8')

/** `on:` 블록만 잘라낸다 — 잡 본문의 `paths-ignore` 스러운 문자열에 오탐하지 않게. */
const onBlock = (() => {
  const i = src.indexOf('\non:')
  const j = src.indexOf('\nconcurrency:')
  return i >= 0 && j > i ? src.slice(i, j) : src
})()

describe('PR 검증이 조용히 건너뛰어지지 않는다', () => {
  it('파일을 실제로 읽었다 — 경로가 낡으면 통과가 아니라 실패', () => {
    expect(src.length, `${WF} 가 비었거나 옮겨갔다`).toBeGreaterThan(500)
    expect(onBlock).toContain('pull_request:')
    expect(onBlock).toContain('push:')
  })

  /**
   * 🔴 이 검사가 이 파일의 요점이다. `pull_request` 에 `paths-ignore` 가 있으면
   *   문서 커밋 하나가 앞 코드 커밋의 run 을 취소시키고 자기 run 은 안 만든다.
   */
  it('🔴 pull_request 에는 paths-ignore 가 없다', () => {
    const pr = onBlock.slice(onBlock.indexOf('pull_request:'), onBlock.indexOf('push:'))
    expect(pr, 'PR 검증을 건너뛰면 미검증 코드가 머지될 수 있다(2026-08-03 실사고)')
      .not.toMatch(/paths-ignore/)
  })

  /** push 쪽 skip 은 **유지**한다 — 없애면 문서 푸시마다 10분씩 도는 순수 낭비다. */
  it('push 쪽 skip 은 그대로 둔다 (문서 푸시까지 돌릴 이유는 없다)', () => {
    const push = onBlock.slice(onBlock.indexOf('push:'))
    expect(push).toMatch(/paths-ignore/)
  })

  /**
   * ⚠️ 이 조합이 사고의 절반이었다. `cancel-in-progress` 자체는 옳다(연속 푸시에 최신만 남긴다) —
   *   위험한 건 **취소만 하고 대체 run 이 안 생기는** 경우다. 위 검사가 그쪽을 막으므로
   *   여기서는 취소 설정이 여전히 존재한다는 사실만 고정한다(둘은 짝으로 읽어야 한다).
   */
  it('concurrency 취소는 유지 — 다만 대체 run 이 반드시 생기는 전제 위에서다', () => {
    expect(src).toMatch(/cancel-in-progress: true/)
    expect(src, 'group 키가 이벤트별로 갈리면 dedup 이 안 된다').toMatch(/group: verify-\$\{\{ github\.head_ref \|\| github\.ref_name \}\}/)
  })
})
