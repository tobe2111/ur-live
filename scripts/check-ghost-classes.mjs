#!/usr/bin/env node
/**
 * 👻 **유령 클래스** — 소스에 썼는데 CSS 에 없는 클래스 (2026-09-16)
 *
 * ■ 무엇을 막나
 *   Tailwind 는 **스케일 밖 값이면 클래스를 만들지 않는다.** 빌드도 타입체크도 테스트도 초록인데
 *   화면에서만 그 효과가 사라진다 — 이 레포가 반복해 당한 **"실패가 아니라 조용한 부재"**.
 *
 *   시작은 대표 신고 *"유어쇼츠 왜이래?"* 였다: 구매 바가 `bg-white/97` 이라 **흰 카드가 없었다**
 *   (불투명도 스케일에 97 이 없다). 그래서 `check-tailwind-opacity-scale` 을 먼저 만들었는데,
 *   그건 불투명도 **한 축**만 본다. 실제로 **빌드된 CSS 와 소스를 통째로 대조**해 보니 같은 병이
 *   다른 축으로도 퍼져 있었다(실측 2026-09-16):
 *     · `bg-white-xl` ×6 — 셀러·공급자 **모달 여섯 개에 배경이 없었다**(오타. `shadow-xl` 의 흔적)
 *     · `text-brand-text/70` 류 ×8 — 색이 `var(--x)` 라 **알파를 못 붙인다** → 글자 색 미적용
 *     · `bg-surface/95` — 유어파트너스 모바일 하단 CTA 바가 투명
 *     · `bg-brand-tint/50` — 지역 선택 모달에서 **고른 항목이 안 골라 보였다**
 *     · `bg-wash` — 딜 잔액 스켈레톤이 투명(색이 index.css 엔 있는데 표에 없었다)
 *     · `h-13` `w-4.5` `py-4.5` — 크기·여백 미적용 · `ring-dashed` — 존재하지 않는 유틸
 *     · `animate-fade-in` `animate-slide-up` `animate-overlay-in` — keyframes 가 아예 없었다
 *
 * ■ 판정
 *   빌드 산출물(`dist/client/assets/*.css`)에서 **실제로 생성된 클래스 집합**을 뽑고,
 *   소스의 `className="…"` 토큰과 대조한다. 추측이 아니라 **번들러가 낸 결과**가 기준이다.
 *   오탐을 줄이는 두 장치: ① 루트(첫 하이픈 앞)가 생성된 집합에 없으면 Tailwind 유틸이 아니므로 제외
 *   ② 하이픈이 없는 단일 낱말은 커스텀 클래스일 확률이 높아 제외.
 *
 * ⚠️ 이 검사가 **못 잡는 것**
 *   · 런타임에 조립되는 클래스(`` `bg-${c}-500` ``) — 문자열이 아니라 값이다.
 *   · className 밖에서 문자열로 쓰는 클래스(`classList.add`, 지도 오버레이 HTML 등).
 *   · 생성은 됐지만 **의도와 다른** 값(`/5` 를 쓸 자리에 `/50`) — 그건 눈이 볼 일이다.
 *   · 루트(`w-`·`h-` 등)가 생성 집합에 **하나도** 없는 유틸리티 — 그 루트를 아무도 안 쓰면
 *     커스텀 클래스와 구분할 수 없어 통째로 건너뛴다(실제 레포에선 일어나지 않지만 원리상 그렇다).
 *
 * 예외: `scripts/ghost-classes-allow.json` 에 **이유와 함께** 등록.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { generatedClasses, sourceTokens, utilityRoots, findGhosts } from './ghost-classes-core.mjs'

const CSS_DIR = 'dist/client/assets'
const ALLOW_FILE = 'scripts/ghost-classes-allow.json'
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict') || process.env.STRICT_GHOST_CLASSES === '1'

// 🛡️ 산출물이 없으면 **통과가 아니라 실패**다 — 없는 채로 돌면 모든 클래스가 유령으로 보이거나
//    (집합이 비어) 판정이 통째로 무의미해진다. 반드시 build 뒤에 둘 것.
if (!existsSync(CSS_DIR)) {
  console.error(`❌ ghost-classes: ${CSS_DIR} 가 없다 — 이 검사는 \`npm run build\` 뒤에만 의미가 있다.`)
  process.exit(1)
}

let css = ''
for (const f of readdirSync(CSS_DIR)) if (f.endsWith('.css')) css += readFileSync(`${CSS_DIR}/${f}`, 'utf8')
const generated = generatedClasses(css)

// ⚠️ 측정 대상 0건은 통과가 아니라 실패 — 셀렉터 파싱이 낡으면 조용히 비고 검사가 무의미해진다.
if (generated.size < 1000) {
  console.error(`❌ ghost-classes: 생성된 클래스를 ${generated.size}개밖에 못 읽었다 — CSS 파싱이 낡았다.`)
  process.exit(1)
}

const roots = utilityRoots(generated)

const allow = existsSync(ALLOW_FILE) ? JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) : {}
const allowed = new Set(Object.keys(allow))

const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts'", { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean)
  .filter((f) => !f.startsWith('src/tests/'))   // 테스트는 위반 문자열 자체를 설명으로 들고 있다

const tokens = []
for (const f of files) for (const t of sourceTokens(readFileSync(f, 'utf8'))) tokens.push({ ...t, file: f })
const scanned = tokens.length
const hits = findGhosts({ generated, roots, tokens, allow: allowed })

if (scanned < 5000) {
  console.error(`❌ ghost-classes: 소스 토큰을 ${scanned}개밖에 못 찾았다 — className 추출이 낡았다.`)
  process.exit(1)
}

if (hits.size) {
  console.error(`⚠️  유령 클래스 ${hits.size}종 — 소스에 있는데 **CSS 에 없다**(화면에서 효과가 사라진다).`)
  for (const [tok, where] of [...hits].sort()) {
    console.error(`   - ${tok}   ← ${where.slice(0, 4).join(' , ')}${where.length > 4 ? ` … +${where.length - 4}` : ''}`)
  }
  console.error('\n   고치는 법: 스케일 안 값으로 바꾸거나(h-13 → h-[52px]), 임의값 대괄호로,')
  console.error('              색·애니메이션이면 tailwind.config 에 정의한다.')
  console.error(`   진짜 커스텀 클래스라면 ${ALLOW_FILE} 에 **이유와 함께** 등록할 것.`)
  if (STRICT) { console.error('\n❌ STRICT_GHOST_CLASSES — 차단.'); process.exit(1) }
  process.exit(0)
}
console.log(`✅ ghost-classes: 유령 0종 · 생성 ${generated.size}개 ↔ 소스 토큰 ${scanned}개 대조(${files.length}파일).`)
