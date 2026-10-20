#!/usr/bin/env node
/**
 * 🪙 **소비자 응답에 `referral_enabled` 를 실으려면 프로그램 게이트를 거쳐야 한다.**
 *
 * ## 왜 (2026-09-06 실사고)
 * 담기 적립(어필리에이트)은 2026-08-22 에 꺼졌다. 그런데 유어샵 화면 두 곳이 계속
 * *"담아서 팔면 2% 적립"* 을 약속하고 있었다 — 꺼진 프로그램이라 팔려도 한 푼도 안 나간다.
 * 지급 경로는 스위치를 보는데 **보는 곳이 거기 하나뿐이라 화면은 몰랐다.**
 *
 * 수리(#1372)는 서버가 `gateAffiliateRows` 로 `referral_enabled` 를 눕히는 것이었다.
 * 그런데 그건 **그때 있던 두 곳**만 고친 것이다. 새 목록 API 가 이 필드를 싣기 시작하면
 * 같은 사고가 그대로 재현된다 — 에러가 없어 아무도 모른다.
 *
 * ⇒ 이 가드가 그 클래스를 닫는다: **소비자 네임스페이스에서 이 필드를 응답으로 나르는 파일은
 *   게이트를 거치거나, 기준선에 사유와 함께 등재돼 있어야 한다.**
 *
 * ## 무엇을 carrier 로 보나
 *   · `SELECT` 를 포함한 문자열 안의 `referral_enabled` (WHERE 비교는 제외 — 나가지 않는다)
 *   · 컬럼 목록을 배열/`push` 로 조립하는 형태(`ProductRepository` 가 그렇다)
 *
 * ## ⚠️ 이 가드가 못 막는 것
 *   · 소비자 네임스페이스 **밖**(어드민·셀러). 그쪽은 약속의 대상이 다르다.
 *   · 필드를 안 싣고 **서버에서 직접 계산해** 할인·커미션을 주는 경로.
 *     실제로 `stays-public` 이 그 형태다(기준선 참조) — 표시가 아니라 **동작**이라
 *     고치려면 머니 경로 변경이고 별도 세션이다.
 *   · 클라이언트가 다른 필드로 적립을 유추하는 경우.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(ROOT, 'scripts/affiliate-display-gate-baseline.json')

/** 소비자에게 약속이 되는 표면. 어드민·셀러·도매·유어애즈는 대상 아님. */
const CONSUMER = [
  /^src\/features\/products\//,
  /^src\/features\/group-buy\//,
  /^src\/features\/curator\//,
  /^src\/features\/affiliate\//,
  /^src\/features\/returns\//,
  /^src\/worker\/routes\/curator/,
]

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'tests', 'generated'].includes(e.name)) continue
      walk(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

export function countCarriers(src) {
  let n = 0
  for (const m of src.matchAll(/`[^`]*`|'[^']*'|"[^"]*"/g)) {
    const lit = m[0]
    if (!/\bSELECT\b/i.test(lit) || !lit.includes('referral_enabled')) continue
    for (const o of lit.matchAll(/referral_enabled/g)) {
      const after = lit.slice(o.index + 'referral_enabled'.length).trimStart()
      const before = lit.slice(0, o.index)
      if (/^[=<>!]/.test(after)) continue                        // WHERE 비교 — 응답에 안 나간다
      if (/\b(AND|WHERE|OR)\s+[\w.]*$/i.test(before)) continue
      n++
    }
  }
  for (const m of src.matchAll(/'referral_enabled'/g)) {
    const s = src.lastIndexOf('\n', m.index) + 1
    const e = src.indexOf('\n', m.index)
    const line = src.slice(s, e < 0 ? undefined : e)
    if (/^\s*(\/\/|\*)/.test(line)) continue
    if (/push\(|\[|,\s*$|cols|COLS|columns|FIELDS/.test(line)) n++
  }
  return n
}

export function auditAffiliateDisplayGate(root = ROOT) {
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
  const carriers = []
  const violations = []
  for (const file of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, file).replace(/\\/g, '/')
    if (!CONSUMER.some((r) => r.test(rel))) continue
    const src = readFileSync(file, 'utf8')
    if (!src.includes('referral_enabled')) continue
    const n = countCarriers(src)
    if (n === 0) continue
    /**
     * 🩸 처음엔 `src.includes('gateAffiliateRows')` 였다. 그러면 **이름만 남겨도 통과**한다 —
     *   되돌려-검증에서 `gateAffiliateRows_UNUSED` 로 바꿔 감싸기를 없앴는데 초록불이 떴다.
     *   ⇒ 실제 **호출 형태**를 요구한다(import 만 남고 호출이 사라진 경우도 잡힌다).
     */
    const gated = /\bgateAffiliateRows\s*\(/.test(src)
    carriers.push({ file: rel, n, gated })
    if (gated) continue
    const base = baseline[rel]
    if (!base) violations.push({ file: rel, n, why: '게이트를 안 거치는 새 경로' })
    else if (n > base.carriers) violations.push({ file: rel, n, why: `기준선 ${base.carriers} → ${n} 로 늘었다` })
  }
  return { carriers, violations, baseline }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('-s') || process.env.STRICT_AFFILIATE_GATE === '1'
  const r = auditAffiliateDisplayGate()

  /**
   * 🛡️ 측정 0 = 통과가 아니라 실패.
   * ⚠️ 하한은 **carrier 총수**로 잰다. 처음엔 '게이트가 걸린 파일 수' 로 쟀는데, 그러면
   *   게이트를 떼는 되돌려-검증에서 "스캐너가 눈이 멀었다" 는 **엉뚱한 이유**로 빨간불이 떴다.
   *   하한은 스캐너의 시력만 재야 하고, 위반 판정은 위반으로 말해야 한다.
   */
  if (r.carriers.length < 2) {
    console.error(`❌ affiliate-display-gate: carrier 를 ${r.carriers.length}개만 찾았다 — 스캐너가 눈이 멀었다(경로/패턴 변경 의심)`)
    process.exit(1)
  }
  const gated = r.carriers.filter((c) => c.gated).length
  if (r.violations.length === 0) {
    console.log(`✅ affiliate-display-gate: 소비자 carrier ${r.carriers.length}개 (게이트 ${gated} · 기준선 ${r.carriers.length - gated})`)
    process.exit(0)
  }
  console.log(`${strict ? '❌' : '⚠️'} affiliate-display-gate: 게이트 없는 경로 ${r.violations.length}개`)
  for (const v of r.violations) console.log(`   · ${v.file}  (carrier ${v.n}) — ${v.why}`)
  console.log('   → 응답을 gateAffiliateRows(rows, await isAffiliateProgramEnabled(DB)) 로 감쌀 것.')
  console.log('     정말 예외면 scripts/affiliate-display-gate-baseline.json 에 사유와 함께 등재.')
  process.exit(strict ? 1 : 0)
}
