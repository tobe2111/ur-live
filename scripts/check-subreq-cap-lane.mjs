#!/usr/bin/env node
/**
 * 🛡️ 2026-07-28: 서브리퀘스트 학습 상한 키의 **레인 공유** 방지.
 *
 * 배경(파트너풀 보강 "무증거 종료" 진단): 유어애즈 3개 레인이 `ads_subreq_cap` **한 키를 같이 읽고 썼다**.
 *   건당 비용이 전혀 다른데(전화 스윕·인플루언서 = fetch 1 / 보강 = fetch 4~6 + D1 다수) 학습값을 공유하면
 *   서로의 관측을 덮어써 **어느 레인도 자기 진짜 한도를 학습하지 못한다**. 실제로 전화 스윕이 ×1.25 로 올리고
 *   인플루언서 레인이 ×0.8 로 내리며 공유값이 29~55 대역에서 맴돌았고, 보강 레인은 그 값을 읽기만 하는
 *   피해자였다(자기 env 예산 300 인데 실제 37 로 굶음 → 라운드당 크롤 한 자릿수).
 *
 * 규칙: 학습 상한 키는 **레인마다 다른 문자열**이어야 한다.
 *   ① 유어애즈 레인은 `subreqCapKey(lane)`(collect-budget.ts) 경유 — 키 리터럴 직접 사용 금지.
 *   ② 다른 워커/서비스(도매 `maker-enrich.ts` 등)가 자기 상수를 쓰는 건 OK — 단 **값이 겹치면 위반**.
 *
 * 예외: 정의부(collect-budget.ts), 테스트, `subreq-cap-lane-ok` 주석.
 *
 * 사용: node scripts/check-subreq-cap-lane.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const DEF_FILE = 'src/features/marketing/api/collect-budget.ts'

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
  }
  return acc
}

// 학습 상한 키로 보이는 문자열 리터럴: *subreq_cap* 을 포함하는 따옴표/백틱 리터럴.
const CAP_LITERAL = /['"`]([A-Za-z0-9_:.-]*subreq_cap[A-Za-z0-9_:.${}-]*)['"`]/g

/** 주석 제거(설명문 속 키 언급은 사용이 아니다) — 길이 보존 치환이라 줄번호가 어긋나지 않는다. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))

const violations = []   // 정의부 밖에서 키 리터럴 직접 사용
const keyOwners = new Map() // 키 값 → [파일…]  (같은 값을 2개 파일이 쓰면 공유 = 위반)

for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  if (/\.test\.|(^|\/)tests\//.test(rel)) continue
  const raw = fs.readFileSync(f, 'utf8')
  if (!/subreq_?cap/i.test(raw)) continue
  if (raw.includes('subreq-cap-lane-ok')) continue
  const src = stripComments(raw)
  if (!/subreq_?cap/i.test(src)) continue // 주석에서만 언급 — 사용 아님

  // 헬퍼가 만들어내는 레인 키도 소유자로 등록 — 다른 워커가 그 값을 리터럴로 재사용하면 충돌로 잡힌다.
  for (const c of src.matchAll(/subreqCapKey\(\s*['"]([a-z_]+)['"]\s*\)/g)) {
    const key = `ads_subreq_cap_${c[1]}`
    if (!keyOwners.has(key)) keyOwners.set(key, [])
    if (!keyOwners.get(key).includes(rel)) keyOwners.get(key).push(rel)
  }

  // 🚨 새 레인이 자기 레인을 선언 안 하고 남의 키를 쓰는 경우 — 2026-07-28 실제 발생(influencer-maintenance).
  //   예산 API(resolveSubreqBudget/nextSubreqCap)를 쓰면서 subreqCapKey(lane) 호출이 하나도 없으면,
  //   그 파일은 상한을 어딘가에서 빌려오고 있다는 뜻 = 레인 격리 위반.
  if (rel.startsWith('src/features/marketing/') && rel !== DEF_FILE
      && /\b(resolveSubreqBudget|nextSubreqCap)\s*\(/.test(src) && !/subreqCapKey\s*\(/.test(src)) {
    const line = src.slice(0, src.search(/\b(resolveSubreqBudget|nextSubreqCap)\s*\(/)).split('\n').length
    violations.push({ file: rel, line, key: '(레인 미선언)', why: '예산 API 를 쓰면서 subreqCapKey(lane) 선언이 없습니다 — 이 레인의 키를 SubreqLane 에 추가하세요' })
  }

  CAP_LITERAL.lastIndex = 0
  let m
  while ((m = CAP_LITERAL.exec(src))) {
    const key = m[1]
    const line = src.slice(0, m.index).split('\n').length
    if (rel === DEF_FILE) continue // 정의부 — 레인별 키를 만드는 곳
    // 유어애즈 레인(features/marketing)은 헬퍼 경유가 규칙 — 리터럴 직접 사용 금지.
    if (rel.startsWith('src/features/marketing/')) {
      violations.push({ file: rel, line, key, why: 'subreqCapKey(lane) 헬퍼를 쓰세요 (키 리터럴 직접 사용 금지)' })
      continue
    }
    // 그 밖(다른 워커/서비스)은 자기 상수 OK — 값 중복만 검사. 템플릿 보간은 레인별로 갈리므로 제외.
    if (key.includes('${')) continue
    if (!keyOwners.has(key)) keyOwners.set(key, [])
    if (!keyOwners.get(key).includes(rel)) keyOwners.get(key).push(rel)
  }
}

for (const [key, files] of keyOwners) {
  if (files.length > 1) {
    violations.push({ file: files.join(' , '), line: 0, key, why: `같은 학습 상한 키를 ${files.length}개 파일이 공유 — 레인별로 분리하세요` })
  }
}

/* ── ② 소비량 인자 검사 (2026-07-28 신설) ─────────────────────────────────────────
 * `nextSubreqCap(spent, …)` 의 첫 인자는 **이번 라운드가 실제로 쓴 양**이어야 한다.
 * 실사고: kakao_sweep 레인이 예산을 `resolveSubreqBudget(cap, learnedCap)`(=63)에서 시작해놓고
 *   소비량은 `cap - budget.left`(=600-left) 로 재, 실제의 ~10배를 보고했다. 그 결과 한도 오류 시
 *   백오프가 `floor(590*0.8)=472` 로 **상한을 되내리는 대신 폭등**시켜 안전판이 거꾸로 작동했다.
 *   조용한 산술 오류라 테스트도 로그도 못 잡았다(값이 그럴듯해서 눈으로도 안 보인다).
 * 규칙: 첫 인자는 `<시작값> - budget.left` 또는 `budget.used` 형태. 시작값 식별자는
 *   `resolveSubreqBudget(...)` 을 담은 변수여야 한다(env 천장 변수를 그대로 빼면 위반).
 */
const CALL_RE = /nextSubreqCap\(\s*([^,]+),/g
for (const file of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (rel === DEF_FILE || rel.includes('/tests/') || rel.includes('.test.')) continue
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('nextSubreqCap(')) continue
  const src = stripComments(raw)
  // 이 파일에서 resolveSubreqBudget 결과를 담은 변수명들(= 정당한 시작값).
  //   ⚠️ 2026-07-29: 이것만 보면 **대리 지표**다. 진짜 불변식은 "budget.left 를 초기화한 그 값"이고,
  //   `resolveSubreqBudget` 직접 대입은 그 중 한 가지 형태일 뿐이다. 실제로 마감 기록용 예산을 떼면서
  //   `const budgetTotal = Math.max(5, resolveSubreqBudget(...) - RESERVE)` 로 바꾸자, 산술이 **정확한데도**
  //   이 가드가 위반으로 신고했다(false positive). ⇒ `{ left: X }` 초기화 값도 정당한 시작값으로 인정한다.
  //   원래 잡으려던 사고(kakao_sweep: left 는 resolveSubreqBudget(...) 으로 시작해놓고 소비량은 `cap - left`)
  //   는 여전히 잡힌다 — 그 `cap` 은 left 초기화에 쓰인 식별자가 아니기 때문이다.
  const totals = [
    ...[...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*resolveSubreqBudget\(/g)].map(m => m[1]),
    ...[...src.matchAll(/FetchBudget\s*=\s*\{\s*left:\s*([A-Za-z_$][\w$]*)\s*[,}]/g)].map(m => m[1]),
  ]
  for (const m of src.matchAll(CALL_RE)) {
    const arg = m[1].trim()
    const line = src.slice(0, m.index).split('\n').length
    if (raw.split('\n')[line - 1]?.includes('subreq-cap-lane-ok')) continue
    const okUsed = /^budget\.used$/.test(arg)
    const okDiff = totals.some(t => new RegExp(`^${t}\\s*-\\s*budget\\.left$`).test(arg))
    if (okUsed || okDiff) continue
    violations.push({
      file: rel, line, key: 'spent',
      why: `nextSubreqCap 의 소비량 인자가 '${arg}' — 실제 시작값 기준이 아니면 백오프가 거꾸로 작동합니다. `
        + `\`${totals[0] || 'budgetTotal'} - budget.left\` 또는 \`budget.used\` 를 쓰세요`,
    })
  }
}

if (!violations.length) {
  console.log('✅ 서브리퀘스트 학습 상한 키 레인별 분리 OK (공유 없음).')
  process.exit(0)
}
console.log(`\n${STRICT ? '❌' : '⚠️ '} 학습 상한 키 공유/직접사용 ${violations.length}건 — 레인마다 다른 키여야 합니다:`)
for (const v of violations) console.log(`   ${v.file}${v.line ? `:${v.line}` : ''} [${v.key}]\n      ${v.why}`)
console.log('\n   (정의부 collect-budget.ts·테스트·`subreq-cap-lane-ok` 주석은 예외)')
process.exit(STRICT ? 1 : 0)
