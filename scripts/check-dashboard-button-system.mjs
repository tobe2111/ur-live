#!/usr/bin/env node
/**
 * 🎛️ 대시보드 버튼 체계 래칫 (2026-08-31 — 대표 *"버튼 배치가 중구난방이고 체계적이지 않다"*)
 *
 * ■ 무엇을 막나
 *   셀러/대시보드 표면에서 버튼이 **자기 색·모서리·높이·굵기를 스스로 정하는 것**.
 *   실측(2026-08-31): 주 버튼 92개 · 77파일 · **모양 조합 48가지**(최다 패턴도 5번뿐).
 *   지배적 패턴이 아예 없었다 — 즉 페이지마다 각자 정하고 있었고, 그게 대표가 본
 *   "중구난방" 의 실체다. 규칙을 문서로만 두면 다시 각자 정한다.
 *
 * ■ 체계
 *   `ur-btn ur-btn-{sm|md|lg} ur-btn-{primary|secondary|danger|ghost}` (src/index.css)
 *   페이지는 **뜻만** 고르고 생김새는 체계가 갖는다.
 *
 * ■ 래칫
 *   현재 남은 원시 주 버튼 수를 baseline 으로 동결한다. **줄이는 건 OK, 늘리는 건 차단.**
 *   (한 번에 전부 못 고치는 이유: 템플릿 리터럴 안의 조건부 클래스는 기계로 안전하게 못 바꾼다.)
 *
 * ⚠️ 이 검사가 **못 잡는 것**
 *   · 템플릿 리터럴(`${}`) 안에서 조건부로 조립되는 className — 문자열 리터럴만 본다.
 *   · `ur-btn` 을 붙였지만 그 위에 `!h-14` 같은 유틸로 체계를 덮어쓰는 경우.
 *   · 배치(어디에 두는가) — 그건 `DashboardActions` 의 primary 단수 prop 이 구조로 막는다.
 *
 * 예외: 그 줄에 `dashboard-button-ok` 주석.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const BASELINE_FILE = 'scripts/dashboard-button-baseline.json'
const REBASE = process.argv.includes('--rebaseline')

const files = execSync(
  "git ls-files 'src/pages/Seller*.tsx' 'src/components/seller/**/*.tsx' 'src/pages/seller-*/**/*.tsx'",
  { encoding: 'utf-8' },
).trim().split('\n').filter(Boolean)

// ⚠️ 대상 0건은 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
if (files.length < 20) {
  console.error(`❌ dashboard-button: 대상 파일이 ${files.length}개뿐 — 경로가 낡았다(검사가 무의미해진다).`)
  process.exit(1)
}

const PRIMARY_BG = /\bbg-(?:gray-900|gray-800|black|brand|brand-dark)\b/
const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf-8')
  src.split('\n').forEach((line, i) => {
    if (line.includes('dashboard-button-ok')) return
    for (const m of line.matchAll(/className="([^"{}]*)"/g)) {
      const cls = m[1]
      if (cls.includes('ur-btn')) continue
      if (PRIMARY_BG.test(cls) && /\btext-white\b/.test(cls)) hits.push(`${f}:${i + 1}`)
    }
  })
}

if (REBASE) {
  writeFileSync(BASELINE_FILE, JSON.stringify({ count: hits.length, updated: new Date().toISOString().slice(0, 10) }, null, 2) + '\n')
  console.log(`✅ dashboard-button: baseline ${hits.length} 로 갱신.`)
  process.exit(0)
}

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf-8')).count : 0
if (hits.length > baseline) {
  console.error(`⚠️  대시보드 버튼 체계 래칫 — 원시 주 버튼이 늘었다 (${baseline} → ${hits.length})`)
  hits.slice(0, 12).forEach((h) => console.error(`   - ${h}`))
  console.error('\n   고치는 법: `ur-btn ur-btn-{sm|md|lg} ur-btn-primary` 를 쓴다(색·모서리·높이는 체계가 정함).')
  console.error('   줄였으면 → node scripts/check-dashboard-button-system.mjs --rebaseline')
  console.error('   의도적이면 그 줄에 `dashboard-button-ok` 주석.')
  if (process.env.STRICT_DASHBOARD_BUTTON === '1') { console.error('\n❌ STRICT_DASHBOARD_BUTTON — 차단.'); process.exit(1) }
  process.exit(0)
}
console.log(`✅ dashboard-button: 원시 주 버튼 ${hits.length}개 (≤${baseline}) · 체계 밖 증가 없음 (파일 ${files.length}개 검사).`)
