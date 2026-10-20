#!/usr/bin/env node
/**
 * 🛡️ 2026-07-28: 연락처 크롤 레인의 **재시도 쿨다운 누락** 방지.
 *
 * 배경(같은 사고가 두 번 났다):
 *   ① 보강 레인(enrich-lane) — `enrich_checked_at` 이 없던 시절 같은 상위 200행을 매시간 재크롤했다.
 *      실패해도 `email IS NULL` 이라 다음 회차에도 또 선두 → 예산이 앞줄에서 공회전하고 **뒷줄은 영영
 *      미도달**. 2026-07-27 에 시도 도장 + 7일 쿨다운으로 수리.
 *   ② 수집 레인(company-collect)의 이메일 보충 블록 — ①과 **완전히 같은 모양인데 쿨다운만 빠져 있었다**.
 *      매시간 같은 15건을 재크롤(회당 ~45 서브리퀘스트 낭비)하고 백로그는 도달 불가. 2026-07-28 수리.
 *
 *   ③ 카카오 전화 스윕(company-collect) — 2026-07-28 에 `id` 커서에서 **tier 우선순위** 정렬로 바꾸면서
 *      커서가 성립하지 않게 됐다(정렬이 id 순일 때만 커서가 맞다). 도장 없이 우선순위로만 훑으면
 *      **tier1 앞줄 몇백 건을 영원히 재조회**한다 — ①②와 같은 사고의 세 번째 얼굴.
 *
 * 규칙: `ad_company_leads` 에서 **외부 조회 대상을 고르는 SELECT** 는 반드시 시도 도장 쿨다운을 가져야 한다.
 *   ⓐ 크롤 대상(website 보유 + 이메일 없음) → `enrich_checked_at`
 *   ⓑ 전화 조회 대상(전화 없음 + 주소 보유) → `kakao_checked_at`
 *   안 그러면 조용히 앞줄만 반복한다(에러도 로그도 안 남는다 — 그래서 세 번 다 오래 방치됐다).
 *
 * 예외: `crawl-cooldown-ok` 주석(같은 줄 또는 SELECT 시작 줄).
 *
 * 사용: node scripts/check-crawl-cooldown.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

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

/** 주석 제거(설명문 속 SQL 예시는 실행되지 않는다) — 길이 보존이라 줄번호가 어긋나지 않는다. */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))

/**
 * SQL 은 **문자열 리터럴 통째로** 봐야 한다. 예전 버전은 `FROM ad_company_leads` 뒤를 정규식으로 잘라
 * 읽었는데, 바로 다음에 오는 `IN ('local','webkr')` 의 첫 따옴표에서 끊겨 정작 검사할 조건
 * (website/email)을 한 번도 못 봤다 → **버그가 있어도 항상 ✅**(음성 테스트로 발각).
 * ⇒ 백틱/쌍따옴표/홑따옴표 리터럴을 통째로 뽑아 그 안에서 판정한다.
 */
const LITERAL_RE = /`([^`]*)`|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g

const violations = []
const scannedFiles = walk(path.join(ROOT, 'src'))

// 🛡️ 2026-07-29: **측정 0 = 통과가 아니라 실패.** 스캔 대상이 비면 위반도 0이라 초록이 뜨는데,
//   그 초록은 아무것도 보장하지 않는다(같은 날 실측 3건이 그 상태로 몇 주~몇 달 방치됐다).
if (scannedFiles.length === 0) {
  console.error('❌ 검사 대상 파일이 0개다 — 스캔 경로가 낡았을 가능성이 크다(통과 아님).')
  process.exit(1)
}
for (const file of scannedFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  if (rel.includes('/tests/') || rel.includes('.test.')) continue
  const raw = fs.readFileSync(file, 'utf8')
  if (!raw.includes('ad_company_leads')) continue
  const src = stripComments(raw)
  for (const m of src.matchAll(LITERAL_RE)) {
    const sql = m[1] ?? m[2] ?? m[3] ?? ''
    if (!/FROM\s+ad_company_leads/i.test(sql) || !/\bSELECT\b/i.test(sql)) continue
    // ⓐ 크롤 대상 = 홈페이지 보유 + 이메일 미보유를 **동시에** 거는 SELECT.
    const picksCrawlTargets = /website\s+IS\s+NOT\s+NULL/i.test(sql) && /email\s+IS\s+NULL/i.test(sql)
    // ⓑ 전화 조회 대상 = 전화 미보유 + 주소 보유(카카오 로컬은 상호+주소로 조회한다).
    const picksPhoneTargets = /phone\s+IS\s+NULL/i.test(sql) && /address\s+IS\s+NOT\s+NULL/i.test(sql)
    if (!picksCrawlTargets && !picksPhoneTargets) continue
    if (picksCrawlTargets && /enrich_checked_at/i.test(sql)) continue // 쿨다운 보유 — OK
    if (!picksCrawlTargets && picksPhoneTargets && /kakao_checked_at/i.test(sql)) continue
    const line = src.slice(0, m.index).split('\n').length
    const lines = raw.split('\n')
    const window = lines.slice(Math.max(0, line - 3), line + 2).join('\n')
    if (window.includes('crawl-cooldown-ok')) continue
    violations.push({ file: rel, line, kind: picksCrawlTargets ? 'crawl' : 'phone' })
  }
}

if (!violations.length) {
  console.log('✅ 외부 조회 대상 SELECT 전부 재시도 쿨다운 보유(크롤=enrich_checked_at · 전화=kakao_checked_at).')
  process.exit(0)
}
console.log(`\n${STRICT ? '❌' : '⚠️ '} 재시도 쿨다운 없는 외부 조회 대상 SELECT ${violations.length}건:`)
for (const v of violations) {
  console.log(`   ${v.file}:${v.line}`)
  if (v.kind === 'crawl') {
    console.log('      website 보유 + 이메일 미보유로 **크롤** 대상을 고르는데 enrich_checked_at 쿨다운이 없습니다.')
    console.log("      → `AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now','-7 days')")
    console.log('           OR COALESCE(enrich_v, 0) < ${CRAWL_RULES_VERSION})` 추가 + 시도 즉시 도장.')
  } else {
    console.log('      전화 미보유 + 주소 보유로 **전화 조회**(카카오) 대상을 고르는데 kakao_checked_at 쿨다운이 없습니다.')
    console.log("      → `AND (kakao_checked_at IS NULL OR kakao_checked_at < datetime('now','-30 days'))` 추가 + 시도 즉시 도장.")
  }
}
console.log('\n   쿨다운이 없으면 실패한 리드가 계속 선두에 남아 앞줄만 반복하고 백로그는 영영 미도달합니다.')
console.log('   (의도적 예외는 `crawl-cooldown-ok` 주석)')
process.exit(STRICT ? 1 : 0)
