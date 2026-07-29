#!/usr/bin/env node
/**
 * 🧬 접힌 리드(중복 병합 패자)가 다른 레인으로 새는 것 차단 — 2026-07-28 실사고 기반.
 *
 *   `company-dedupe.ts` 는 **삭제하지 않는다** — 패자를 `active=0 + merged_into=<승자>` 로 표시만 한다
 *   (되돌릴 수 있게). 그래서 **리드를 고르는 모든 쿼리가 `merged_into IS NULL` 을 봐야 한다.**
 *
 *   실제로 벌어진 일(첫 실행 1,523행 병합 직후 실측):
 *     ① 정비 스윕 `UPDATE … SET active=1 WHERE active=0 AND (전화 OR 이메일 있음)` 이 **접힌 행을 전원 부활**
 *        시킬 뻔했다 — 병합의 패자는 전화가 있어서 보류된 게 아니라 *같은 업체라서* 접힌 것인데, 이 스윕은
 *        전화 유무만 본다. 다음 정비 틱에 병합이 통째로 무효화된다.
 *     ② 보강 레인의 대상 조건이 `active=0 OR email IS NULL` 이라 접힌 행이 **크롤 대기열로 되돌아왔다**
 *        (무료 플랜 서브리퀘스트가 귀한데 중복에 쓰인다).
 *     ③ 상태줄 `held_no_contact` 가 접힌 수만큼 부풀어, 대표가 읽는 KPI 가 거짓말을 했다.
 *
 *   ⇒ `SELECT … FROM ad_company_leads … WHERE …` 인 쿼리는 `merged_into` 를 언급해야 한다.
 *   의도적 예외(전체 집계·병합 모듈 자신 등)는 같은 쿼리 근처에 `merged-filter-ok` 주석.
 *
 *   우회: commit 메시지 `[SKIP_MERGED_FILTER]` · 차단: STRICT_MERGED_FILTER=1
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src/features/marketing/api', 'src/worker-ads']
const strict = process.env.STRICT_MERGED_FILTER === '1'

function walk(dir, out = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.ts')) out.push(p)
  }
  return out
}

/** `prepare(` 뒤에 오는 문자열 리터럴 하나를 통째로 떼어낸다(백틱 다중행 포함). */
function extractSqlLiterals(src) {
  const out = []
  const re = /\.prepare\s*\(\s*(`|'|")/g
  let m
  while ((m = re.exec(src))) {
    const quote = m[1]
    const start = re.lastIndex
    let i = start
    while (i < src.length) {
      if (src[i] === '\\') { i += 2; continue }
      if (src[i] === quote) break
      i++
    }
    out.push({ sql: src.slice(start, i), index: m.index })
  }
  return out
}

const problems = []
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = readFileSync(file, 'utf8')
    if (/merged-filter-ok/.test(src) && /file-wide/.test(src)) continue
    for (const { sql, index } of extractSqlLiterals(src)) {
      if (!/\bFROM\s+ad_company_leads\b/i.test(sql)) continue
      if (!/^\s*SELECT\b/i.test(sql.trim()) && !/\bSELECT\b[\s\S]*\bFROM\s+ad_company_leads\b/i.test(sql)) continue
      if (!/\bWHERE\b/i.test(sql)) continue          // 전체 집계/롤업은 대상 아님
      if (/merged_into/i.test(sql)) continue         // 이미 본다
      // 같은 쿼리 앞 400자 안의 면제 주석
      if (/merged-filter-ok/.test(src.slice(Math.max(0, index - 400), index))) continue
      const line = src.slice(0, index).split('\n').length
      problems.push(`${file}:${line} — ad_company_leads 선택 쿼리에 merged_into 필터 없음\n      ${sql.replace(/\s+/g, ' ').trim().slice(0, 140)}`)
    }
  }
}

if (!problems.length) {
  console.log('✅ 접힌 리드 누수 없음 — ad_company_leads 선택 쿼리 전부 merged_into 확인.')
  process.exit(0)
}
console.log(`${strict ? '❌' : '⚠️'}  접힌 리드(merged_into) 필터 누락 ${problems.length}건:`)
for (const p of problems) console.log('   - ' + p)
console.log('\n   고치는 법: WHERE 에 `merged_into IS NULL` 추가(중복 병합 패자는 어느 레인에도 안 들어간다).')
console.log('   의도적이면 쿼리 위에 `merged-filter-ok` 주석.')
process.exit(strict ? 1 : 0)
