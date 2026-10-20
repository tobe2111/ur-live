#!/usr/bin/env node
/**
 * check-github-side-merge.mjs — "로컬에선 clean 인데 GitHub 에선 충돌" 을 푸시 전에 잡는다.
 *
 * 🩸 2026-10-06 실사고. PR 셋이 멎어 있었고, 제가 `git merge-tree` 로 확인해 **clean 이라고
 *    대표에게 보고했는데 틀렸다.** 진짜 충돌이었고 제 도구가 가려 주고 있었다:
 *
 *      .gitattributes:  docs/CURRENT_WORK.md merge=union
 *      로컬 git         → union 드라이버가 자동 해소 → "clean"     ← 내가 본 것
 *      GitHub 서버측    → 그 드라이버를 안 쓴다      → CONFLICT   ← 실제
 *
 *    CLAUDE.md 가 이미 경고하는 사실이다(*"merge=union 은 로컬에서만 통하고 GitHub 서버측
 *    머지는 그 드라이버를 안 쓴다"*). 새로 드러난 것은 **그 결과가 '머지 못 함' 보다 나쁘다**는 것:
 *
 *    🔴 GitHub 이 머지 커밋을 못 만들면 **`pull_request` 워크플로가 아예 디스패치되지 않는다.**
 *       그래서 PR 에 `Verify` 체크가 **실패도 아니고 부재**로 남는다. 화면만 보면 빨간 게
 *       하나도 없어 통과처럼 보이고, auto-merge 는 조용히 멎는다 — 이 레포가 반복해 당한
 *       '조용한 부재'. 실측: #1621 `c46a124` · #1625 `064ac07` 에 Verify 가 0개였다.
 *
 * 판정: base(기본 origin/main)와의 머지를 **커스텀 머지 드라이버를 끈 상태**로 다시 돌려
 *       충돌이 나는지 본다. 그게 GitHub 이 보는 것이다.
 *
 * ⚠️ 이 검사가 못 보는 것:
 *   - GitHub 의 다른 머지 거부 사유(룰셋·서명 요구 등) — 이건 드라이버 문제만 본다.
 *   - base 가 움직이면 결과가 바뀐다(이 레포는 세션이 여러 개 돌아 상시 움직인다) ⇒
 *     푸시 직전에 fetch 한 base 로 판정한다. 통과했어도 그 뒤 main 이 움직이면 또 난다.
 *   - 드라이버가 로컬 git config 에 **등록돼 있지 않은** 환경에서는 로컬도 그냥 충돌하므로
 *     애초에 이 함정이 없다(그 경우 이 검사는 조용히 통과한다 — 거짓 경보 0).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

if (process.env.GSM_SKIP === '1') {
  console.log('⚠️  GitHub 머지 사전검사 건너뜀 (GSM_SKIP=1)')
  process.exit(0)
}

const BASE = process.env.GSM_BASE || 'origin/main'
const HEAD = process.env.GSM_HEAD || 'HEAD'

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
}
function tryGit(args) {
  try { return { ok: true, out: git(args) } } catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` } }
}

// ── 1. .gitattributes 에 커스텀 머지 드라이버가 있는가 (없으면 이 함정 자체가 없다)
const ATTR = '.gitattributes'
if (!existsSync(ATTR)) { console.log('✅ GitHub 머지 사전검사: .gitattributes 없음 — 해당 없음'); process.exit(0) }
const drivers = readFileSync(ATTR, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => {
    const m = l.match(/^(\S+)\s+.*\bmerge=([A-Za-z0-9_.-]+)/)
    return m ? { path: m[1], driver: m[2] } : null
  })
  .filter(Boolean)
  // `merge=binary`/`merge=text` 는 git 내장이라 서버측도 같게 동작한다.
  .filter((d) => !['binary', 'text', 'union-builtin'].includes(d.driver))

if (drivers.length === 0) { console.log('✅ GitHub 머지 사전검사: 커스텀 머지 드라이버 없음 — 해당 없음'); process.exit(0) }

// ⚠️ `merge=union` 은 git 내장이지만 **GitHub 서버측은 .gitattributes 를 적용하지 않는다**(실측).
//    그래서 내장 여부와 무관하게 전부 대상으로 둔다.

// ── 2. base 가 있는가 (없으면 판정 불가 — 조용히 통과하지 말고 말한다)
const baseRev = tryGit(['rev-parse', '--verify', `${BASE}^{commit}`])
if (!baseRev.ok) {
  console.log(`⚠️  GitHub 머지 사전검사 건너뜀 — base '${BASE}' 를 못 찾았다 (git fetch 먼저)`)
  process.exit(0)
}

// ── 3. 드라이버를 끈 상태로 머지 시도 = GitHub 이 보는 것
//    `--attr-source` 로 빈 트리의 attributes 를 쓰게 해 .gitattributes 를 무력화한다.
// 🩸 `--attr-source` 는 **최상위 git 옵션**이다 — `merge-tree` 의 하위 옵션으로 주면
//    `error: unknown option` + exit 129 가 된다. 2026-10-06 에 그걸 모르고
//    `merge-tree --write-tree --attr-source=…` 로 써서 **129 를 '충돌' 로 읽었다** —
//    그 결과 기제를 맞게 짚었는데도 **근거가 가짜**였다. 아래 순서가 유일하게 맞다.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const withDrivers = tryGit(['merge-tree', '--write-tree', BASE, HEAD])
const noDrivers = tryGit([`--attr-source=${EMPTY_TREE}`, 'merge-tree', '--write-tree', BASE, HEAD])

// 그 혼동이 다시 일어나지 않게: 명령 자체가 실패(usage 오류 등)했는지와 '충돌' 을 구분한다.
if (!noDrivers.ok && /unknown option|usage: git/.test(noDrivers.out)) {
  console.error('❌ GitHub 머지 사전검사: git 이 --attr-source 를 모른다 — 이 검사는 판정할 수 없다')
  console.error('   (충돌이 아니라 **명령 실패**다. 둘을 섞으면 가짜 근거가 된다 — 2026-10-06 교훈.)')
  console.error(noDrivers.out.split('\n').slice(0, 3).map((l) => '   ' + l).join('\n'))
  process.exit(1)
}

if (noDrivers.ok) {
  console.log('✅ GitHub 머지 사전검사: 드라이버 없이도 충돌 없음')
  process.exit(0)
}

// 충돌 파일 추출
const conflicted = [...new Set((noDrivers.out.match(/^CONFLICT \([^)]+\): Merge conflict in (.+)$/gm) || [])
  .map((l) => l.replace(/^CONFLICT \([^)]+\): Merge conflict in /, '').trim()))]

const driverPaths = new Set(drivers.map((d) => d.path))
const maskedByDriver = conflicted.filter((f) => driverPaths.has(f))

if (withDrivers.ok && maskedByDriver.length > 0) {
  // 이게 바로 그 함정: 로컬은 통과, GitHub 은 충돌.
  console.error('')
  console.error('❌ GitHub 머지 사전검사: **로컬은 clean 인데 GitHub 은 충돌한다**')
  console.error('')
  for (const f of maskedByDriver) {
    const d = drivers.find((x) => x.path === f)
    console.error(`   ${f}   (.gitattributes: merge=${d.driver} — 로컬에서만 자동 해소)`)
  }
  console.error('')
  console.error('   🔴 GitHub 이 머지 커밋을 못 만들면 `pull_request` 워크플로가 **아예 안 돈다** —')
  console.error('      PR 에 Verify 가 실패도 아니고 **부재**로 남고 auto-merge 는 조용히 멎는다.')
  console.error('')
  console.error(`   해결: git fetch origin && git merge ${BASE}  → 커밋 → 푸시`)
  console.error('        (로컬 드라이버가 해소해 주므로 손으로 고칠 것은 없다. 커밋해서')
  console.error('         브랜치가 base 의 tip 을 담으면 GitHub 쪽에 머지할 것이 남지 않는다.)')
  console.error('')
  console.error('   우회: GSM_SKIP=1')
  process.exit(1)
}

// 드라이버와 무관한 진짜 충돌 — 그건 평소 충돌이라 이 검사의 일이 아니다(경고만).
console.log(`⚠️  GitHub 머지 사전검사: base 와 충돌이 있다(드라이버와 무관) — ${conflicted.join(', ') || '파일 불명'}`)
console.log('    평소대로 머지해서 해소할 것. (이 검사는 "로컬만 clean" 함정만 차단한다.)')
process.exit(0)
