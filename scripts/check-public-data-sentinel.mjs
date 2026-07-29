#!/usr/bin/env node
/**
 * 🕳️ 공공데이터 필드 추출 — '값 없음' 자리표시자 판정 강제 (2026-07-29 신설).
 *
 * ## 무엇을 막는가
 * data.go.kr 은 '값 없음'을 **문자열**로 준다: `"N/A"` · `"-"` · `"없음"`. 그게 JS 에서 **truthy** 라,
 * 별칭 폴백(`g(it,'rnAddr','lctnAddr')` / `a || b`)이 앞 필드의 `"N/A"` 를 값으로 채택하고
 * **진짜 값이 있는 뒤 필드를 건너뛴다.**
 *
 * ## 왜 가드가 필요한가 (실측)
 * 통신판매 리드 표본 1,000건 중 **31.7% 가 `address = "N/A"`** 였고 그 전부가 `region = null` 이었다.
 * 같은 행의 지번주소엔 실제 주소가 있었다 — **정보가 있는데 버린 것**이다. 게다가 카카오 전화 스윕은
 * `address != ''` 로 거르므로 `"N/A"` 가 통과해 **없는 주소로 조회**를 날렸다(47건 시도 → 0건 발견).
 *
 * 이 실패는 **에러를 내지 않는다.** 수집은 성공으로 집계되고, 상태줄엔 저장 건수가 찍히고,
 * 잃은 정보는 아무 데도 안 남는다 — 이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스.
 * 새 수집 레인은 같은 `g()` 를 복사해 시작하므로, 룰이 아니라 **가드**여야 한다.
 *
 * ## 검사 (R1)
 * `src/features/marketing/api/` 의 공공데이터 수집 모듈에서 **별칭 폴백 접근자**
 * (`for (const k of keys) { ... it[k] ... }`)를 찾고, 그 안에서 `isNoValue` 를 쓰는지 본다.
 *
 * ## 이 가드가 **못 잡는 것** (과신 금지)
 * - `a || b` 형태의 2항 폴백(구문이 너무 흔해 오탐 없이 특정 불가) — `store-info-collect.ts` 가
 *   그 형태였고 **사람이 찾았다**. 새 레인이 `||` 로 쓰면 이 가드는 침묵한다.
 * - 자리표시자 목록 자체의 누락(포털이 새 문자열을 쓰기 시작하면 아무도 모른다).
 * - 값이 '있는데 틀린' 경우(예: 좌표 0,0).
 *
 * 예외: 해당 함수 근처에 `sentinel-ok` 주석.
 * 사용: node scripts/check-public-data-sentinel.mjs [-s]   (-s = strict, 위반 시 exit 1)
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.argv.includes('-s') || process.env.STRICT_PUBLIC_DATA_SENTINEL === '1'
const DIR = 'src/features/marketing/api'

/** 공공데이터 포털에서 받아오는 수집/스캔 모듈만 — 내부 D1 전용 모듈은 대상 아님. */
const isPublicDataModule = (src) => /apis\.data\.go\.kr|openapi\.|serviceKey/i.test(src)

/** 별칭 폴백 접근자 본문(한 줄이든 여러 줄이든) — `for (const k of keys)` 로 시작해 닫히는 블록. */
function aliasAccessors(src) {
  const out = []
  const re = /for \(const k of keys\)/g
  let m
  while ((m = re.exec(src))) {
    // 접근자 본문은 길어야 두어 줄이다 — 다음 200자면 충분히 덮는다(닫는 괄호 추적보다 견고).
    out.push({ index: m.index, body: src.slice(m.index, m.index + 220) })
  }
  return out
}

const files = readdirSync(DIR).filter(f => f.endsWith('.ts'))
const violations = []
let checked = 0

for (const f of files) {
  const path = join(DIR, f)
  const src = readFileSync(path, 'utf8')
  if (!isPublicDataModule(src)) continue
  for (const a of aliasAccessors(src)) {
    checked++
    if (/sentinel-ok/.test(src.slice(Math.max(0, a.index - 400), a.index + 220))) continue
    if (/isNoValue/.test(a.body)) continue
    const line = src.slice(0, a.index).split('\n').length
    violations.push(`${path}:${line} — 별칭 폴백이 isNoValue 를 안 거친다 ("N/A" 를 값으로 채택하게 된다)`)
  }
}

// 🧪 측정 대상 0건이면 통과가 아니라 실패 — 경로/필터가 바뀌어 **가드가 헛도는** 것을 스스로 신고한다
//   (이 레포에서 실제로 몇 달간 헛돈 가드가 있었다: gzip 예산이 늘 0 을 재던 사건).
if (checked === 0) {
  console.error('❌ public-data-sentinel: 검사 대상 0건 — 경로/필터가 깨졌다(가드가 헛돌고 있다).')
  process.exit(1)
}

if (!violations.length) {
  console.log(`✅ 공공데이터 자리표시자 판정 — 별칭 폴백 ${checked}곳 모두 isNoValue 통과.`)
  process.exit(0)
}

console.error('⚠️  공공데이터 필드 추출이 \'값 없음\'("N/A")을 값으로 채택할 수 있다:')
for (const v of violations) console.error('   - ' + v)
console.error('\n   고치는 법: `if (v != null && String(v).trim())` → `if (!isNoValue(v))`  (SSOT: public-data-diag.ts)')
console.error('   의도적이면 그 함수 근처에 `sentinel-ok` 주석.')
if (STRICT) { console.error('\n❌ STRICT_PUBLIC_DATA_SENTINEL — 차단.'); process.exit(1) }
process.exit(0)
