#!/usr/bin/env node
/**
 * 🛡️ 2026-05-19: 영구 방어 — input/textarea text 색상 누락 검사.
 *
 *   재발 패턴: 다크 페이지에서 흰색 input 텍스트가 화이트 페이지로 옮겨질 때
 *   투명하게 보임. index.css 의 글로벌 색상 강제로 1차 방어 + 본 lint 로 2차 방어.
 *
 *   감지: 같은 element 의 **base(변형 prefix 없는) 토큰**에 `text-white` 와 `bg-white` 가
 *   동시에 있으면 라이트 모드에서 글자가 안 보인다.
 *
 * ⚠️ 2026-07-29 수리 — 이 가드는 **켤 수 없는 상태로 방치돼 있었다**(audit-gate·verify·훅 어디에도
 *   미등록). 이유가 코드에 있었다: `\btext-white\b` 가 **`dark:text-white` 안에서도 매치**돼,
 *   CLAUDE.md 가 오히려 *요구하는* 정상 패턴(`bg-white … text-gray-900 dark:text-white`)을
 *   위반으로 신고했다. 실측 6건이 전부 그 오탐이었다(confirm-dialog · PartnershipInquiry ·
 *   ServiceMarketplacePanel×4). 켜면 정상 코드가 빨간불이 되니 아무도 못 켰고, 그래서
 *   **보호받는 것처럼 보이지만 실제로는 한 번도 돌지 않은 가드**로 남았다.
 *   → `check-theme-consistency.mjs` 와 같은 방식으로 **variant-aware** 하게 고쳤다:
 *     `:` 가 포함된 토큰(dark:/hover:/focus:/md: …)은 base 가 아니므로 판정에서 제외.
 *   수리 후 실측 위반 0 → audit-gate/verify 에 등록.
 *
 *   사용: node scripts/check-input-text-color.mjs
 *   기본 warn-only(exit 0). 차단: STRICT_INPUT_TEXT=1 또는 `-s`.
 *   의도적 예외: 해당 파일에 `input-text-color-ok` 주석.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const SRC = 'src'
const STRICT = process.env.STRICT_INPUT_TEXT === '1' || process.argv.includes('-s')
const violations = []
let scanned = 0
let elements = 0

/**
 * Tailwind className 문자열에서 **base 토큰만** 남긴다.
 * `dark:text-white` 는 다크 모드에서만 적용되므로 라이트 가시성 판정의 근거가 될 수 없다.
 */
const baseTokens = (className) => className.split(/\s+/).filter((t) => t && !t.includes(':'))

function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) scan(p)
    else if (['.tsx', '.jsx'].includes(extname(p))) check(p)
  }
}

function check(file) {
  const src = readFileSync(file, 'utf-8')
  scanned++
  if (src.includes('input-text-color-ok')) return // 의도적 예외
  // className="..." (리터럴) 과 className={`...`} (템플릿 리터럴의 고정 부분) 둘 다.
  //   템플릿은 `${...}` 보간 내용을 볼 수 없지만, 판정은 *리터럴에 둘 다 있을 때*만 하므로
  //   보간 때문에 오탐이 늘지는 않는다(놓칠 수는 있다 — 그건 아래 한계에 적음).
  const re = /<(input|textarea)\b[^>]*?\bclassName=(?:["']([^"']+)["']|\{`([^`]+)`\})[^>]*>/g
  let m
  while ((m = re.exec(src)) !== null) {
    elements++
    const tokens = baseTokens(m[2] ?? m[3] ?? '')
    if (tokens.includes('text-white') && tokens.includes('bg-white')) {
      violations.push({
        file,
        msg: 'base 토큰에 text-white + bg-white 동시 존재 — 라이트 모드에서 글자가 안 보인다',
        line: src.slice(0, m.index).split('\n').length,
      })
    }
  }
}

scan(SRC)

// 🛡️ "못 쟀다" 를 "통과" 로 읽지 않는다 — 스캔 대상이 0이면 그건 통과가 아니라 가드가 죽은 것이다.
//   (같은 날 번들 gzip 예산이 정확히 이 방식으로 죽어 있었다: 측정값이 항상 0 → 영원히 통과.)
if (scanned === 0 || elements === 0) {
  console.error(`❌ [input-text-color] 검사 대상 0건 (파일 ${scanned} · input/textarea ${elements}) — 스캔 경로나 매칭이 깨졌다. 통과로 처리하지 않는다.`)
  process.exit(1)
}

if (violations.length > 0) {
  console.error(`❌ ${violations.length} input text-color violations:`)
  for (const v of violations) console.error(`  ${v.file}:${v.line} — ${v.msg}`)
  console.error(`\n라이트 모드 input 은 text-gray-900(+dark:text-white) 형태로 두세요.`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`✅ input text color audit 통과 — ${elements}개 input/textarea (파일 ${scanned}).`)
