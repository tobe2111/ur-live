#!/usr/bin/env node
/**
 * 🔢 시드 버전 단조증가 가드 (2026-07-29 신설)
 *
 * 지키는 불변식 — **시드 버전은 지금까지 쓰인 적 없는 더 큰 번호여야 한다.**
 *
 * 왜: 블로그/가이드 시드는 "코드의 버전 > DB 저장 버전이면 재시드" 구조다.
 *   그래서 **이미 쓴 번호를 다시 쓰면 재시드가 아예 안 돈다** — 배포는 성공하고,
 *   에러도 안 나고, 라이브 문서만 옛날 것으로 남는다. 전형적인 무음 정지다.
 *
 * 이건 가정이 아니라 이 레포에서 **이미 두 번 일어난 일**이다:
 *   - `GUIDE_SEED_VERSION = 8` 이 2026-07-20 에 **서로 다른 두 커밋**에서 쓰였고,
 *     v11 주석이 그 수습을 기록하고 있다 — "병행 배포 양쪽(각자 v8)이 모두 재시드되도록 9 로 합침".
 *   - `= 4` 도 두 번 쓰였다.
 *   - 2026-07-29 에도 PR #451 과 #425 가 동시에 12 로 올려 충돌했다(머지 직전에 손으로 잡음).
 *
 * 세션(브랜치)이 여러 개 동시에 도는 한 이 충돌은 계속 난다. 사람이 매번 잡을 수는 없다.
 *
 * 판정: 현재 값이 **main 히스토리에서 쓰인 모든 값보다 커야** 한다.
 *   (같거나 작으면 그 배포는 재시드를 건너뛴다.)
 *
 * 한계(정직하게): 아직 머지되지 않은 *다른 브랜치*의 번호는 볼 수 없다 —
 *   git 히스토리에 없기 때문이다. 그래서 두 브랜치가 동시에 같은 새 번호를 잡는 것 자체는
 *   막지 못하고, **나중에 머지되는 쪽이 CI 에서 걸린다**(그때 +1 하면 된다).
 *   그거면 충분하다 — 오늘처럼 조용히 통과하는 일만 없으면 된다.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const TARGETS = [
  { file: 'src/features/guides/api/guide.routes.ts', name: 'GUIDE_SEED_VERSION' },
  { file: 'src/features/blog/api/blog.routes.ts', name: 'BLOG_SEED_VERSION' },
]

const STRICT = process.argv.includes('-s') || process.env.STRICT_SEED_VERSION === '1'
const ALLOW_MARK = 'seed-version-ok'

let fail = 0
const problems = []

// 병합 진행 중(MERGE_HEAD 존재)이면 검사하지 않는다.
// 그 상태의 HEAD 는 아직 병합 전 커밋이라 merge-base 가 낡았고, 작업트리에는 main 이
// 가져온 값이 들어와 있다 → "내가 바꿨다"로 오판한다. 실제 판정은 병합 커밋이 생긴
// 다음 실행(그리고 CI)에서 정확하게 이뤄진다. 병합마다 우는 가드는 결국 무시당한다.
try {
  execSync('git rev-parse -q --verify MERGE_HEAD', { stdio: 'ignore' })
  console.log('⏭️  병합 진행 중 — 시드 버전 검사 생략(병합 커밋 후 정확히 판정된다).')
  process.exit(0)
} catch { /* 병합 중 아님 — 정상 진행 */ }

/** main 히스토리에서 이 상수에 쓰인 적 있는 모든 값. main 을 못 읽으면 null(검사 생략). */
function historicalValues(file, name) {
  for (const ref of ['origin/main', 'main']) {
    try {
      execSync(`git rev-parse --verify --quiet ${ref}`, { stdio: 'ignore' })
    } catch { continue }
    try {
      const out = execSync(
        `git log -p --no-color ${ref} -- ${file}`,
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      )
      const vals = []
      const re = new RegExp(`^\\+\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*(\\d+)`, 'gm')
      let m
      while ((m = re.exec(out)) !== null) vals.push(Number(m[1]))
      return vals
    } catch { return null }
  }
  return null
}

/**
 * 이 브랜치가 그 상수를 실제로 바꿨는가 — merge-base 시점 값과 비교한다.
 * merge-base 를 못 구하면 `true`(검사 진행) — 모를 땐 검사하는 쪽이 안전하다.
 */
function changedHere(file, name, cur) {
  for (const ref of ['origin/main', 'main']) {
    try {
      const base = execSync(`git merge-base HEAD ${ref}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      const old = execSync(`git show ${base}:${file}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
      const m = new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*(\\d+)`, 'm').exec(old)
      if (!m) return true          // 그때는 없던 상수 = 이 브랜치가 만든 것
      return Number(m[1]) !== cur  // 값이 달라졌으면 이 브랜치가 바꾼 것
    } catch { continue }
  }
  return true
}

for (const { file, name } of TARGETS) {
  if (!existsSync(file)) continue
  const src = readFileSync(file, 'utf8')
  const line = src.split('\n').find(l => new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=`).test(l))
  if (!line) continue
  if (line.includes(ALLOW_MARK)) continue

  const cur = Number(/=\s*(\d+)/.exec(line)?.[1])
  if (!Number.isFinite(cur)) continue

  // 이 브랜치가 그 상수를 **건드리지 않았으면** 검사하지 않는다.
  // 안 그러면 main 을 아직 안 당겨온 브랜치가 전부 걸린다(자기 잘못이 아닌데) → 소음.
  if (!changedHere(file, name, cur)) continue

  const hist = historicalValues(file, name)
  if (hist === null) {
    console.log(`⏭️  ${name}: main 히스토리를 못 읽음 — 검사 생략(얕은 클론 등)`)
    continue
  }
  // 여기 도달했다는 건 **이 브랜치가 값을 바꿨다**는 뜻이다(안 바꿨으면 위에서 걸러졌다).
  // 그러므로 main 이 이미 쓴 번호를 골랐다면 실수다 — 자기 자신을 예외로 빼주면 검사가 무력화된다.
  const maxMain = hist.reduce((a, b) => Math.max(a, b), 0)
  if (hist.includes(cur)) {
    problems.push(`${file}: ${name} = ${cur} — main 히스토리가 이미 쓴 번호다(최대 ${maxMain}). ${maxMain + 1} 이상으로 올릴 것.`)
    fail++
  } else if (cur <= maxMain) {
    problems.push(`${file}: ${name} = ${cur} — main 이 이미 ${maxMain} 까지 썼다(현재 값이 더 작거나 같다).`)
    fail++
  }
}

if (fail) {
  console.error('❌ 시드 버전이 단조증가하지 않는다 — 그 배포는 재시드를 조용히 건너뛴다:\n')
  for (const p of problems) console.error(`   ${p}`)
  console.error(`
   왜 문제인가: 시드 동기화는 "코드 버전 > DB 저장 버전"일 때만 돈다. 이미 쓴 번호면
   조건이 거짓이라 **에러 없이 아무 일도 안 일어난다** — 라이브 문서만 옛날 것으로 남는다.

   🔧 고치는 법: 그 상수를 지금까지 쓰인 최대값보다 크게 올릴 것(보통 +1).
      다른 브랜치와 동시에 같은 번호를 잡았다면, 나중에 머지하는 쪽이 하나 더 올리면 된다.
      의도적이면 그 줄에 '${ALLOW_MARK}' 주석.
`)
  if (STRICT) process.exit(1)
  console.error('(warn-only — 차단하려면 STRICT_SEED_VERSION=1)')
  process.exit(0)
}

console.log('✅ 시드 버전 단조증가 — 재시드가 조용히 건너뛰어질 번호 없음.')
