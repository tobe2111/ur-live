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
 *   남은 원시 주 버튼 수를 baseline 으로 동결한다. **줄이는 건 OK, 늘리는 건 차단.**
 *   2026-08-31 2차: 남은 5건을 체계로 옮기고 판정을 '누를 수 있는 요소'로 좁혀 **baseline 0** 이 됐다.
 *   즉 지금부터 셀러 표면의 새 원시 주 버튼은 **한 개도 못 들어온다.**
 *
 * ■ baseline 0 의 함정 — 그래서 합성 대조를 둔다
 *   0 을 기대하는 검사는 **매칭이 깨져도 0 이라 초록불**이다(이 레포가 반복해 당한
 *   "검사가 실패할 수 없음" 클래스 — check-bundle-size 의 죽은 gzip 값과 같다).
 *   그래서 매 실행마다 **일부러 위반인 조각**(FIXTURE_BAD)과 **정상 조각**(FIXTURE_OK)을
 *   같은 판정에 통과시켜, 잡아야 할 걸 잡고 잡지 말아야 할 걸 안 잡는지 확인한다.
 *   대상 파일 수(≥20)까지 셋 중 하나라도 무너지면 통과가 아니라 실패다.
 *
 * ⚠️ 이 검사가 **못 잡는 것**
 *   · 템플릿 리터럴(`${}`) 안에서 조건부로 조립되는 className — 문자열 리터럴만 본다.
 *   · 버튼이 아닌 것(배지·칩·패널)의 생김새 — 일부러 안 센다. 2026-08-31 실측상 옛 13건 중
 *     8건이 그것이었고, 그걸 세는 동안 이 래칫은 "버튼 체계"가 아니라 "어두운 무언가"를 세고 있었다.
 *   · `ur-btn` 을 붙였지만 그 위에 `!h-14` 같은 유틸로 체계를 덮어쓰는 경우.
 *   · 배치(어디에 두는가) — 그건 `DashboardActions` 의 primary 단수 prop 이 구조로 막는다.
 *
 * 예외: 그 줄에 `dashboard-button-ok` 주석.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { enclosingTagName, BUTTONISH } from './lib/jsx-enclosing-tag.mjs'

const BASELINE_FILE = 'scripts/dashboard-button-baseline.json'
const REBASE = process.argv.includes('--rebaseline')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

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

/**
 * 🔘 한 파일에서 **원시 주 버튼**을 찾는다.
 *   '어두운 배경 + 흰 글자' 는 버튼만의 특징이 아니다 — 배지·칩·아이콘 원·패널도 그렇다.
 *   2026-08-31 실측: 남아 있던 13건 중 **8건이 버튼이 아니었다**(단계 번호 배지 · 사진 위
 *   오버레이 배지 · 개수 칩 · bg-gray-800 카드 패널 …). 그걸 세는 동안 이 래칫은
 *   "버튼 체계"가 아니라 "어두운 무언가"를 세고 있었다. 코드모드와 **같은 판정**을 쓴다.
 */
function rawPrimaryButtons(src) {
  const out = []
  const lines = src.split('\n')
  for (const m of src.matchAll(/className="([^{}"]*)"/g)) {
    const cls = m[1]
    if (cls.includes('ur-btn')) continue
    if (!PRIMARY_BG.test(cls) || !/\btext-white\b/.test(cls)) continue
    const line = src.slice(0, m.index).split('\n').length
    if (lines[line - 1].includes('dashboard-button-ok')) continue
    if (!BUTTONISH.test(enclosingTagName(src, m.index))) continue
    out.push(line)
  }
  return out
}

/**
 * 🧪 **양성 대조 — 이게 이 가드의 목숨이다.**
 *   baseline 이 0 이므로 `hits.length > baseline` 은 **매칭이 죽어도 초록불**이다
 *   (이 레포가 반복해 당한 "검사가 실패할 수 없음" 클래스 — check-bundle-size 의 죽은 gzip 값).
 *   그래서 **일부러 위반인 합성 조각**을 매 실행마다 통과시켜 본다. 못 잡으면 그 자리에서 실패.
 *   ⚠️ 조각의 `disabled={n < 2}` 는 장식이 아니다 — 2026-08-31 에 실제로 이 비교 연산자가
 *      `lastIndexOf('<')` 를 속여 래칫이 통째로 헛돌았다. 그 함정을 대조에 박아 둔다.
 */
const FIXTURE_BAD = `
  <button onClick={go} disabled={n < 2}
    className="w-full py-3 bg-gray-900 text-white rounded-xl">보내기</button>
`
const FIXTURE_OK = `
  <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded">NEW</span>
  <button className="ur-btn ur-btn-md ur-btn-primary">보내기</button>
`
if (rawPrimaryButtons(FIXTURE_BAD).length !== 1) {
  console.error('❌ dashboard-button: 양성 대조 실패 — 명백한 원시 주 버튼을 못 찾는다(매칭이 죽었다).')
  process.exit(1)
}
if (rawPrimaryButtons(FIXTURE_OK).length !== 0) {
  console.error('❌ dashboard-button: 음성 대조 실패 — 배지/체계 버튼을 위반으로 센다(오탐).')
  process.exit(1)
}

const hits = []
for (const f of files) {
  const src = readFileSync(f, 'utf-8')
  for (const line of rawPrimaryButtons(src)) hits.push(`${f}:${line}`)
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
  // `-s` 는 check-guard-mutations 하네스의 호출 규약(runTest)이다 — 이걸 안 받으면
  //    주입해도 exit 0 이라 '가드가 안 잡았다' 로 오판된다.
  if (process.env.STRICT_DASHBOARD_BUTTON === '1' || STRICT) { console.error('\n❌ STRICT_DASHBOARD_BUTTON — 차단.'); process.exit(1) }
  process.exit(0)
}
console.log(`✅ dashboard-button: 원시 주 버튼 ${hits.length}개 (≤${baseline}) · 체계 밖 증가 없음 (파일 ${files.length}개 검사).`)
