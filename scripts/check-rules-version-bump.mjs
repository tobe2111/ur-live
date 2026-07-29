#!/usr/bin/env node
/**
 * 🔁 규칙 파일을 고쳤으면 규칙 버전도 올려라 (2026-07-29 신설)
 *
 * 지키는 불변식 — **규칙을 바꿨는데 버전 상수를 그대로 두면, 이미 처리된 행에는 새 규칙이 영원히 안 닿는다.**
 *
 * 유어애즈 리드 파이프라인은 행마다 "어느 버전 규칙으로 처리됐나"를 스탬프해 두고,
 * 재처리 대상을 `COALESCE(v,0) < 상수` 로 고른다. 그래서 규칙만 고치고 상수를 안 올리면
 * **에러도 안 나고 로그도 안 남고** 옛 판정이 그대로 굳는다. 오늘 시드 버전에서 잡은 것과 같은 클래스다
 * (`check-seed-version-monotonic.mjs` — 그쪽은 '이미 쓴 번호 재사용', 이쪽은 '안 올림').
 *
 * ⚠️ 두 레인의 위험도가 다르다 — 그래서 심각도를 나눈다:
 *
 *   · classify (`CLASSIFY_RULES_VERSION`) — **시간 폴백이 없다.**
 *     재검사 쿼리가 `classified_v IS NULL OR classified_v < ?` 뿐이라(company-discovery.ts),
 *     버전을 안 올리면 그 행은 **영구히** 재검사되지 않는다. 실제로 이 구멍 때문에
 *     "인천교통공사…특강" 류가 옛 규칙 스탬프를 달고 영구 제외됐던 사고가 있었고(2026-07-27),
 *     그 수습이 바로 지금의 `classified_v` 방식이다. 즉 **이 메커니즘 전체가 "상수 올리기"에 걸려 있다.**
 *
 *   · enrich (`CRAWL_RULES_VERSION` · `MAKER_CRAWL_VERSION`) — 7일 시간 폴백이 있다
 *     (`enrich_checked_at < datetime('now','-7 days') OR ...`). 잊어도 일주일 뒤 자가 치유되므로 경고만.
 *
 * 판정: merge-base 대비 규칙 파일이 (버전 줄 말고) 바뀌었는데 버전 상수가 그대로면 지적.
 * 주석/공백만 바뀐 경우는 제외한다 — 소음이 되면 아무도 안 본다.
 *
 * 예외: 그 줄에 `rules-version-ok` 주석.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

const TARGETS = [
  {
    file: 'src/features/marketing/api/company-classify.ts',
    name: 'CLASSIFY_RULES_VERSION',
    severity: 'high',
    why: '재검사에 시간 폴백이 없다 — 안 올리면 이미 분류된 행은 영구히 새 규칙을 못 받는다.',
  },
  {
    file: 'src/features/marketing/api/contact-enrich.ts',
    name: 'CRAWL_RULES_VERSION',
    severity: 'low',
    why: '7일 시간 폴백이 있어 결국 재크롤된다 — 다만 그때까지 옛 결과가 유지된다.',
  },
  {
    file: 'src/features/supply/api/maker-enrich.ts',
    name: 'MAKER_CRAWL_VERSION',
    severity: 'low',
    why: '7일 시간 폴백이 있어 결국 재크롤된다.',
  },
]

const STRICT = process.argv.includes('-s') || process.env.STRICT_RULES_VERSION === '1'
const ALLOW = 'rules-version-ok'

// 병합 중에는 검사하지 않는다 — merge-base 가 낡아 '내가 바꿨다'로 오판한다(시드 가드와 동일).
try {
  execSync('git rev-parse -q --verify MERGE_HEAD', { stdio: 'ignore' })
  console.log('⏭️  병합 진행 중 — 규칙 버전 검사 생략.')
  process.exit(0)
} catch { /* 병합 중 아님 */ }

function baseRef() {
  for (const r of ['origin/main', 'main']) {
    try {
      execSync(`git rev-parse --verify --quiet ${r}`, { stdio: 'ignore' })
      return execSync(`git merge-base HEAD ${r}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch { /* 다음 후보 */ }
  }
  return null
}

const base = baseRef()
if (!base) {
  console.log('⏭️  main 을 못 찾음 — 규칙 버전 검사 생략(얕은 클론 등).')
  process.exit(0)
}

const versionOf = (src, name) => {
  const m = new RegExp(`^\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*(\\d+)`, 'm').exec(src)
  return m ? { value: Number(m[1]), line: m[0] } : null
}

/** 의미 있는 변경인가 — 주석/빈 줄/버전 줄을 뺀 나머지가 달라졌는지. */
const meaningful = (src, name) => src
  .split('\n')
  .filter(l => {
    const t = l.trim()
    if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return false
    if (new RegExp(`const\\s+${name}\\s*=`).test(t)) return false
    return true
  })
  .join('\n')

const problems = []
for (const { file, name, severity, why } of TARGETS) {
  if (!existsSync(file)) continue
  const now = readFileSync(file, 'utf8')
  const cur = versionOf(now, name)
  if (!cur || cur.line.includes(ALLOW)) continue

  let old
  try {
    old = execSync(`git show ${base}:${file}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { continue }        // merge-base 에 없던 새 파일 — 검사 대상 아님

  const prev = versionOf(old, name)
  if (!prev) continue                              // 상수 자체가 새로 생김
  if (prev.value !== cur.value) continue           // 올렸다 — 통과
  if (meaningful(old, name) === meaningful(now, name)) continue  // 주석/공백만 — 통과

  problems.push({ file, name, value: cur.value, severity, why })
}

if (problems.length) {
  const high = problems.filter(p => p.severity === 'high')
  console.error('⚠️  규칙은 바뀌었는데 버전 상수가 그대로다 — 이미 처리된 행엔 새 규칙이 안 닿는다:\n')
  for (const p of problems) {
    console.error(`   ${p.severity === 'high' ? '🔴' : '🟡'} ${p.file}`)
    console.error(`      ${p.name} = ${p.value} (그대로) — ${p.why}`)
  }
  console.error(`
   🔧 고치는 법: 그 상수를 +1. 재처리 쿼리가 \`COALESCE(v,0) < 상수\` 라 올려야 소급 적용된다.
      규칙이 아니라 리팩토링/오타 수정이라 소급이 불필요하면 그 줄에 '${ALLOW}' 주석.
`)
  if (STRICT && high.length) process.exit(1)
  if (!STRICT) console.error('(warn-only — 차단하려면 STRICT_RULES_VERSION=1)')
  process.exit(0)
}

console.log('✅ 규칙 버전 — 규칙 변경 대비 버전 미bump 없음.')
