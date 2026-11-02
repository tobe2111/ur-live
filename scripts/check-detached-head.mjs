#!/usr/bin/env node
/**
 * 🧭 **브랜치 밖(detached HEAD)에서 커밋하지 않는다** (2026-11-02)
 *
 * 대표 *"단발적으로 문제 해결하지 말고 교훈삼아서 근본적으로 해결할 수 있는게 있으면 해결해줘."*
 *
 * ## 왜 (실측 — 이 세션이 밟았다)
 * `git checkout origin/main -- ` 를 치면서 경로를 빠뜨려 HEAD 가 **브랜치 밖으로** 옮겨졌다(경고가 한 줄이고
 * `-q` 를 붙이면 그마저 없다). 그 상태로 고침을 커밋하고 `git push -u origin <브랜치>` 를 하자
 * **"Everything up-to-date"** — 브랜치는 옛 커밋 그대로였고 고침은 어디에도 안 올라갔다.
 * 실패 메시지가 아니라 **성공 메시지**가 나와서, GitHub 에서 head sha 를 대조하고서야 알았다.
 * ⇒ 커밋할 때 막는 것이 가장 싸다(그 뒤로는 모든 단계가 초록이다).
 *
 * 이 레포의 세션은 언제나 브랜치 위에서 일한다(지정 브랜치에 푸시 → PR). 브랜치 밖 커밋이 정당한 경우는
 * rebase·cherry-pick·revert·bisect 진행 중뿐이고, 그때는 git 이 표시 파일을 남기므로 통과시킨다.
 * 우회: `ALLOW_DETACHED_COMMIT=1 git commit …`
 *
 * zero-scan-ok — 판정 대상이 "지금 HEAD 하나" 라 셀 개수가 없다(git 을 못 읽으면 아래에서 실패한다).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** git 이 "작업 진행 중" 에 남기는 표시(있으면 브랜치 밖 커밋이 정상이다) */
export const IN_PROGRESS_MARKERS = ['rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG', 'sequencer']

/**
 * 순수 판정.
 * @param {{ branch: string | null, inProgress: string[], allow: boolean }} x
 *   branch = `git symbolic-ref --short -q HEAD` 결과(브랜치 밖이면 null)
 * @returns {string[]}
 */
export function judgeDetached({ branch, inProgress, allow }) {
  if (allow || branch || inProgress.length) return []
  return [
    '지금 HEAD 가 **브랜치 밖**이다(detached HEAD) — 이대로 커밋하면 `git push origin <브랜치>` 가 ' +
      '"Everything up-to-date" 를 내고 이 커밋은 아무 데도 안 올라간다.\n' +
      '   고치는 법: git switch <브랜치> 로 돌아가 다시 커밋(이미 만든 커밋이면 git cherry-pick <sha>).\n' +
      '   흔한 원인: `git checkout <ref> --` 처럼 경로를 빠뜨린 명령. 우회: ALLOW_DETACHED_COMMIT=1',
  ]
}

function main() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  let branch = null
  try {
    branch = execFileSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() || null
  } catch {
    branch = null
  }
  let gitDir
  try {
    gitDir = execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, encoding: 'utf8' }).trim()
  } catch {
    console.error('❌ detached-head: git 디렉터리를 못 찾았다 — 못 잰 것은 통과가 아니다.')
    process.exit(1)
  }
  const abs = path.resolve(ROOT, gitDir)
  const inProgress = IN_PROGRESS_MARKERS.filter((m) => fs.existsSync(path.join(abs, m)))
  const errors = judgeDetached({ branch, inProgress, allow: process.env.ALLOW_DETACHED_COMMIT === '1' })
  if (errors.length) {
    for (const e of errors) console.error(`❌ ${e}`)
    process.exit(1)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
