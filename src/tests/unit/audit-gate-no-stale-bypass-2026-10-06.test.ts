/**
 * 🔓 npm audit 게이트에 **잔존하는 우회**가 없는지 (2026-10-06)
 *
 * 보안 게이트가 "실패" 하는 건 괜찮다. **꺼진 걸 아무도 모르는 것**이 나쁘다.
 * `check-npm-audit.sh` 에 정확히 그 모양이 있었다:
 *
 * ```
 *   if [ -f ".git/COMMIT_EDITMSG" ] && grep -q '[SKIP_AUDIT]' .git/COMMIT_EDITMSG; then exit 0
 * ```
 *
 * 두 가지가 동시에 틀렸다:
 * ① **의도한 대로 작동한 적이 없다** — git 은 `pre-commit` 을 *메시지 준비 전에* 돌린다
 *    (메시지는 `prepare-commit-msg` 단계에서 쓰인다). 그래서 지금 커밋의 메시지는 못 본다.
 * ② **지난 커밋의 메시지는 본다** — 한 번 `[SKIP_AUDIT]` 로 커밋하면 그 파일이 남아
 *    **그 뒤 모든 로컬 실행이 조용히 통과**한다.
 *
 * 🩸 **이게 두 번째다.** `docs/handoff/2026-09-30-refund-stolen-and-switch-labels.md` 가
 * 이미 적어 뒀다 — *"CI 블로커를 'dev 전용 4건' 이라고 대표에게 보고한 것 — 틀렸다. …
 * 로컬 audit 이 `.git/COMMIT_EDITMSG` 에 남은 `[SKIP_AUDIT]` 때문에 계속 건너뛰어져서
 * 진짜 실패를 못 보고 있었다."* 기록은 남았는데 **덫은 안 치웠다.** 그래서 2026-10-06 에
 * 같은 세션이 또 밟았고(게이트가 취약점 3건을 두고 exit 0 을 찍었다), 이번에 제거했다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 게이트의 *판정 로직*이 맞는지는 안 본다(그건 실제 `npm audit`
 *   이 필요하고 CI 가 돌린다). 여기서 재는 것은 **"조용히 꺼지는 길이 없는가"** 하나다.
 *   그리고 `.audit-allowlist.json` 의 사유가 *사실인지*도 못 본다 — 필드가 채워졌는지만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const GATE = 'scripts/check-npm-audit.sh'
const INSTALLER = 'scripts/install-git-hooks.sh'
const ALLOWLIST = '.audit-allowlist.json'

const raw = (p: string) => readFileSync(p, 'utf-8')

/**
 * 셸 스크립트의 **코드 줄만** 남긴다(첫 글자가 `#` 인 줄 제거).
 *
 * ⚠️ 여기서 주석을 걷어내는 이유는 **새 머리말이 `[SKIP_AUDIT]`·`COMMIT_EDITMSG` 를
 *   설명으로 언급**하기 때문이다. 그걸 안 걷으면 "제거했다" 는 설명 때문에 시험이
 *   영원히 빨간불이 된다(= 설명을 지워야 통과하는 거꾸로 된 가드).
 * ⚠️ 이것은 `check-comment-stripper` 가 금지하는 **JS 블록주석 자작 제거기가 아니다** —
 *   셸은 `#` 줄 주석뿐이고 문자열 안의 `#` 를 지울 위험이 없다(줄 전체만 버린다).
 */
function shellCodeLines(src: string): string {
  return src
    .split('\n')
    .filter(l => !l.trimStart().startsWith('#'))
    .join('\n')
}

describe('🔓 npm audit 게이트 — 조용히 꺼지는 길이 없다', () => {
  it('① 커밋 메시지 파일(.git/COMMIT_EDITMSG)을 읽지 않는다 — 잔존 우회의 뿌리', () => {
    const code = shellCodeLines(raw(GATE))
    expect(code).not.toContain('COMMIT_EDITMSG')
    // 머리말에는 남아 있어야 한다 — 왜 지웠는지를 다음 세션이 알아야 되살리지 않는다.
    expect(raw(GATE)).toContain('되살리지 말 것')
  })

  it('② 우회는 매 실행마다 명시해야 하는 환경변수 하나뿐이다', () => {
    const code = shellCodeLines(raw(GATE))
    expect(code).toContain('SKIP_NPM_AUDIT')
    // 🔑 조용히 통과시키는 조기 종료가 그 하나 말고 더 없는지.
    // 🩸 처음엔 상한을 2 로 뒀는데 **주입이 그걸 통과했다** — 실측하니 `exit 0` 은 딱 한 줄
    //    (SKIP_NPM_AUDIT 우회)이고, "차단 대상 없음" 정상 통과는 `exit` 없이 스크립트 끝으로
    //    떨어진다. 상한을 2 로 두면 조기 종료 한 줄을 **더 심어도 초록**이 된다.
    const earlyExits = code.split('\n').filter(l => /^\s*exit 0\s*$/.test(l))
    expect(earlyExits.length).toBe(1)
  })

  it('③ 훅 설치 안내가 안 먹는 우회를 광고하지 않는다', () => {
    // 사람이 `[SKIP_AUDIT]` 을 믿고 커밋 메시지에 적으면 막히고, 왜 막히는지 모른다.
    const code = shellCodeLines(raw(INSTALLER))
    expect(code).not.toContain('[SKIP_AUDIT]')
  })
})

describe('🔓 허용목록 — 빈 승인으로 통과하지 못한다', () => {
  const list = JSON.parse(raw(ALLOWLIST)) as {
    allow: Array<{ ghsa: string; pkg: string; reason: string; accepted_by: string; date: string; review: string }>
  }

  it('① 모든 항목이 사유·승인자·날짜·재검토를 채우고 있다', () => {
    expect(list.allow.length).toBeGreaterThan(0)   // 0건이면 통과가 아니라 파싱이 깨진 것
    for (const a of list.allow) {
      for (const f of ['ghsa', 'pkg', 'reason', 'accepted_by', 'date', 'review'] as const) {
        expect(String(a[f] ?? '').trim(), `${a.ghsa}.${f}`).not.toBe('')
      }
      expect(a.ghsa, `${a.pkg} 의 ghsa 형식`).toMatch(/^GHSA-/)
      expect(a.date, `${a.ghsa} 의 date 형식`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // 승인자는 "누가" 가 적혀 있어야 한다 — 빈 문자열이나 'TODO' 로는 통과 못 한다.
      expect(a.accepted_by.toUpperCase()).not.toContain('TODO')
    }
  })

  it('② GHSA 가 중복 등재되지 않는다 — 같은 면제가 두 줄이면 하나 지워도 안 닫힌다', () => {
    const ids = list.allow.map(a => a.ghsa)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
