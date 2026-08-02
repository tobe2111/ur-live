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
 *
 * 🔀 `watch` (2026-08-02) — 상수와 규칙이 **다른 파일**일 때 감시 대상을 따로 지정한다.
 *   `REEXTRACT_RULES_VERSION` 이 그 경우다: 규칙이 세 파일(`influencer-discovery`·`-email-rules`·`-parse`)에
 *   흩어져 있어 어느 하나에 상수를 둘 수 없고, 상수가 사는 `influencer-maintenance.ts` 를 감시하면
 *   배정표 한 줄만 옮겨도 bump 를 요구하는 소음이 된다.
 *   ⚠️ **못 잡는 것**: 상수가 merge-base 에 없으면(=이 브랜치에서 새로 만든 상수) 그 항목은 통째로 건너뛴다.
 *     즉 상수를 신설하는 그 PR 자체는 검사되지 않고, **다음 브랜치부터** 걸린다. 의도된 동작이지만
 *     "가드를 넣었으니 이제 안전하다"고 읽으면 한 판이 비어 있다.
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
  {
    file: 'src/features/marketing/api/influencer-region.ts',
    name: 'REGION_RULES_VERSION',
    severity: 'high',
    why: "미매칭이 ''(지역 없음 확정)로 저장돼 재검사를 막는다 — 안 올리면 기존 행은 영구히 옛 판정에 갇힌다."
      + " 2026-07-29 실사고: '방배동 맛집'(누적 241명)이 '동' 접미 미지원으로 전부 지역 없음이었다.",
  },
  {
    // 🔀 상수는 여기 있지만 **규칙은 다른 파일에 있다** — `watch` 가 그 간극을 잇는다.
    //   상수 파일(influencer-maintenance.ts)엔 배정표·예산 같은 무관한 코드가 많아, 그걸 감시하면
    //   슬롯 하나만 옮겨도 bump 를 요구하는 소음이 된다. 반대로 규칙 파일에 상수를 두려 해도
    //   규칙이 **세 파일에 흩어져 있어** 어느 하나를 고를 수 없다.
    file: 'src/features/marketing/api/influencer-maintenance.ts',
    name: 'REEXTRACT_RULES_VERSION',
    watch: [
      'src/features/marketing/api/influencer-discovery.ts',   // extractContacts
      'src/features/marketing/api/influencer-email-rules.ts', // reextractEmail
      'src/features/marketing/api/influencer-parse.ts',       // stripVideoTitles
    ],
    severity: 'high',
    why: '재추출 커서는 전수를 다 훑으면 **그 자리에 주차**한다(2026-08-02) — 안 올리면 개선된 추출기가'
      + ' 기존 36,880행에 영원히 안 닿는다. 시간 폴백이 없다.',
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

/** `git show <ref>:<path>` — 그 ref 에 없으면 null. */
const showAt = (ref, path) => {
  try {
    return execSync(`git show ${ref}:${path}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return null }
}

const problems = []
for (const { file, name, watch, severity, why } of TARGETS) {
  if (!existsSync(file)) continue
  const now = readFileSync(file, 'utf8')
  const cur = versionOf(now, name)
  if (!cur || cur.line.includes(ALLOW)) continue

  if (showAt(base, file) === null) continue   // merge-base 에 없던 새 파일 — 검사 대상 아님
  const prev = versionOf(showAt(base, file) || '', name)
  if (!prev) continue                         // 상수 자체가 새로 생김
  if (prev.value !== cur.value) continue      // 올렸다 — 통과

  // 🔀 **규칙이 사는 파일**을 본다. `watch` 가 없으면 상수와 같은 파일(기존 동작).
  //    ⚠️ 하나도 못 읽으면 '변경 없음'으로 흘러가 검사가 조용히 무의미해진다 — 그래서 읽힌 파일 수를 센다.
  const ruleFiles = (watch && watch.length ? watch : [file]).filter(existsSync)
  let changed = false, seen = 0
  for (const rf of ruleFiles) {
    const oldSrc = showAt(base, rf)
    if (oldSrc === null) continue             // merge-base 에 없던 새 파일
    seen++
    if (meaningful(oldSrc, name) === meaningful(readFileSync(rf, 'utf8'), name)) continue
    // main 과 내용이 같으면 **이 브랜치가 쓴 게 아니다** — main 을 병합해 물려받았을 뿐이다.
    // 이 조건이 없으면, 규칙이 main 에 들어가기 *전에* 갈라진 브랜치가 나중에 main 을 병합하는
    // 순간 전부 걸린다(자기 잘못이 아닌데). 소음이 되면 아무도 안 본다 — 시드 가드와 같은 교훈.
    const mainSrc = showAt('origin/main', rf) ?? showAt('main', rf)
    if (mainSrc !== null && meaningful(mainSrc, name) === meaningful(readFileSync(rf, 'utf8'), name)) continue
    changed = true
  }
  if (!seen || !changed) continue

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
