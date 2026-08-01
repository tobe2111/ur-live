#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: **부기(簿記) 비용을 예산에서 빼지 않는 레인** 차단.
 *
 * 실사고: `ensureCompanySchema` 는 DDL **35개**, `ensureProspectSchema` 는 **9개**를 실행하는데
 *   그 비용이 **어느 레인의 예산에도 안 잡혀 있었다.** 무료 플랜 인보케이션 천장이 50~60 인데
 *   보강 레인은 예산 60 을 세면서 실제로는 60+35=95 를 썼다 → 라운드가 **잡을 예외도 없이** 중간에
 *   죽고(`partial:true` · `limit_hit:false`), `nextSubreqCap` 에 도달을 못 하니 학습 상한이 172 까지
 *   한 방향으로 드리프트했다. 인허가 레인은 40+9=49 로 매번 한도에 닿아 `total_saved: 0` 이었다.
 *
 *   ⇒ 근본은 하나다: **"우리가 세는 숫자"와 "플랫폼이 세는 숫자"가 갈라지면 그 차이만큼 조용히 죽는다.**
 *
 * 규칙: `FetchBudget` 예산을 만드는 파일이 `ensure*Schema(` / `ensure*Keywords(` 를 호출하면,
 *   그 반환값을 **예산에서 차감**해야 한다(`schemaSpent` / `seedSpent` 같은 변수로 받아 `budget.left -=`
 *   또는 예산 계산식에서 빼기). 반환값을 버리면(`await ensureXSchema(DB)` 단독 문) 위반.
 *
 * 예외: 예산이 없는 파일(라우트·어드민 핸들러)은 대상 아님. 의도적이면 `schema-cost-ok` 주석.
 *
 * 사용: node scripts/check-schema-cost-counted.mjs [-s]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const SCAN = ['src/features/marketing/api', 'src/features/supply/api']

function walk(dir, acc = []) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) return acc
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) walk(rel, acc)
    else if (/\.ts$/.test(e.name)) acc.push(rel)
  }
  return acc
}

// ⚠️ 대상은 **실비를 돌려주는** 두 함수뿐이다. 인플루언서 계열(`ensureInfluencerSchema`)은 `runDdlOnce`
//   (체크섬 1회 조회)라 따뜻한 DB 에선 비용이 1 이므로 차감 대상이 아니다 — 넣으면 오탐이 된다.
//   👉 `ensureCompanySchema`(순수 DDL 21) 도 언젠가 runDdlOnce 로 옮기면 이 가드에서 빠져도 된다.
const ENSURE = /\b(?:ensureCompanySchema|ensureProspectSchema)\s*\(/
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length
const violations = []

const scannedFiles = SCAN.flatMap(d => walk(d))

// 🛡️ 2026-07-29: **측정 0 = 통과가 아니라 실패.** 스캔 대상이 비면 위반도 0이라 초록이 뜨는데,
//   그 초록은 아무것도 보장하지 않는다(같은 날 실측 3건이 그 상태로 몇 주~몇 달 방치됐다).
if (scannedFiles.length === 0) {
  console.error('❌ 검사 대상 파일이 0개다 — 스캔 경로가 낡았을 가능성이 크다(통과 아님).')
  process.exit(1)
}
for (const rel of scannedFiles) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  if (src.includes('schema-cost-ok')) continue
  // 예산을 **만드는** 파일만 대상 — 예산이 없으면 뺄 지갑도 없다.
  if (!/:\s*FetchBudget\s*=\s*\{|resolveSubreqBudget\s*\(/.test(src)) continue
  // ⚠️ "파일 어딘가에 budget.left -= 가 있으면 통과" 로 두면 **공허해진다** — 대부분의 레인은 spendD1 로
  //   그 패턴을 이미 갖고 있어서, 스키마 실비를 안 빼도 통과한다(2026-07-29 되돌림 실험으로 확인).
  //   ⇒ ensure 호출 **그 줄에서 반환값을 받았는지**만 본다. 받았으면 어디선가 쓰는 것이고, 안 받았으면 버린 것이다.
  let m
  const re = new RegExp(ENSURE.source, 'g')
  while ((m = re.exec(src))) {
    // 반환값을 버리는 형태: 줄이 `await ensureX(` 로 시작(할당 없음)
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    const line = src.slice(lineStart, src.indexOf('\n', m.index))
    if (/^\s*await\s+ensure/.test(line)) { // 반환값 미포착 = 실비를 버림
      violations.push({ rel, line: lineOf(src, m.index), text: line.trim().slice(0, 90) })
    }
  }
}

if (!violations.length) {
  console.log('✅ 부기 비용(스키마·시드) 전부 예산에서 차감됨')
  process.exit(0)
}
console.log(`${STRICT ? '❌' : '⚠️'} 예산에서 안 빠지는 부기 비용 ${violations.length}건`)
for (const v of violations) console.log(`   ${v.rel}:${v.line} — ${v.text}`)
console.log('   → 반환값을 받아 budget 에서 차감할 것(ensureXSchema 는 DDL 실비를 돌려준다). 예외: schema-cost-ok')
process.exit(STRICT ? 1 : 0)
