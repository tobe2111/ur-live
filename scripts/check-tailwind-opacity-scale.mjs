#!/usr/bin/env node
/**
 * 🫥 **투명해진 요소** — 스케일 밖 불투명도 수식어 차단 (2026-09-16 대표 신고 "유어쇼츠 왜이래?")
 *
 * ■ 무엇을 막나
 *   Tailwind 의 `bg-white/97` 처럼 슬래시 뒤 숫자가 **불투명도 스케일에 없는 값**이면
 *   그 클래스는 **아예 생성되지 않는다.** 빌드는 성공하고 타입도 테스트도 초록인데
 *   화면에서는 배경이 통째로 사라진다 — 이 레포가 반복해 당한 **"조용한 부재"** 다.
 *
 *   실사고(2026-09-16): 유어쇼츠 구매 바가 `bg-white/97` 이라 **흰 카드가 없었다.**
 *   대표 화면에서 상품명·가격이 영상 위에 맨살로 떠 있었고 유튜브 Shorts 워터마크와
 *   겹쳤다. 브라우저 실측 `getComputedStyle(bar).backgroundColor === 'rgba(0, 0, 0, 0)'`.
 *   같은 전수조사에서 배너 스크림(`from-black/62 to-black/38`)·상세 플로팅 헤더
 *   (`bg-white/92`)·다크 칩 틴트(`/12`)·구분선(`/8`) 까지 **9곳이 같은 상태**였다.
 *
 * ■ 판정
 *   스케일은 하드코딩하지 않고 **tailwind 기본 테마 + 우리 config 의 extend** 에서 읽는다.
 *   (스케일을 확장하면 이 가드가 자동으로 따라간다 — 두 곳에 같은 목록을 두지 않는다.)
 *   대괄호 임의값(`bg-white/[.97]`)과 CSS 변수(`/[var(--x)]`)는 **정상이라 통과**한다.
 *
 * ⚠️ 이 검사가 **못 잡는 것**
 *   · 런타임에 조립되는 클래스(`` `bg-white/${n}` ``) — 문자열이 아니라 값이다.
 *   · 스케일 안이지만 **의도보다 흐린** 값(`/50` 을 쓸 자리에 `/5`) — 그건 눈이 볼 일이다.
 *   · 불투명도 말고 다른 스케일 밖 값(`p-7.5` 등). 여기는 "투명해지는" 한 클래스만 본다.
 *
 * 예외: 같은 줄에 `opacity-scale-ok` 주석.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const STRICT = process.argv.includes('-s') || process.argv.includes('--strict') || process.env.STRICT_OPACITY_SCALE === '1'

/** 스케일은 **실제 설정**에서 읽는다 — 목록을 두 곳에 두면 언젠가 갈린다. */
async function opacityScale() {
  const mod = await import('tailwindcss/defaultTheme.js')
  const base = (mod.default ?? mod).opacity ?? {}
  let extra = {}
  try {
    // ⚠️ config 를 **늘** import 하면 Node 가 매 실행마다 MODULE_TYPELESS 경고를 뱉어
    //    가드 출력이 에러처럼 보인다. 확장이 실제로 있을 때만 읽는다(보통은 없다).
    if (/\bopacity\s*:/.test(readFileSync('tailwind.config.js', 'utf-8'))) {
      const cfg = await import('../tailwind.config.js')
      extra = (cfg.default ?? cfg)?.theme?.extend?.opacity ?? {}
    }
  } catch { /* config 를 못 읽으면 기본 스케일만으로 판정한다(느슨한 쪽) */ }
  return new Set([...Object.keys(base), ...Object.keys(extra)])
}

/**
 * 한 파일에서 [수식어 총수, 스케일 밖 히트] 를 낸다.
 * 슬래시 앞이 **색처럼 생겼을 때만** 센다 — 안 그러면 `/api/v1/50` 같은 경로가 걸린다.
 */
function scanOpacity(src, scale) {
  const COLORISH = String.raw`(?:white|black|current|transparent|inherit|[a-z]+-\d{2,3}|\[[^\]\s]+\])`
  const re = new RegExp(String.raw`\b[a-z][a-z-]*-${COLORISH}/(\d+)\b`, 'g')
  let total = 0
  const bad = []
  for (const m of src.matchAll(re)) {
    total++
    if (scale.has(m[1])) continue
    const line = src.slice(0, m.index).split('\n').length
    if (/opacity-scale-ok/.test(src.split('\n')[line - 1] ?? '')) continue
    bad.push({ line, token: m[0] })
  }
  return [total, bad]
}

const scale = await opacityScale()

/**
 * 🧪 **합성 대조 — 0 을 기대하는 검사의 목숨.**
 *   매칭이 낡아 죽어도 결과는 0(초록)이다. 매 실행마다 일부러 위반인 조각과 정상 조각을
 *   같은 판정에 통과시켜, 잡아야 할 걸 잡고 잡지 말아야 할 걸 안 잡는지 확인한다.
 */
{
  const [t1, b1] = scanOpacity('className="bg-white/97 text-black/62"', scale)
  if (t1 !== 2 || b1.length !== 2) {
    console.error('❌ opacity-scale: 양성 대조 실패 — 명백한 스케일 밖 값을 못 찾는다(매칭이 죽었다).')
    process.exit(1)
  }
  const OK = 'className="bg-white/95 dark:bg-[#11141C]/85 border-[#16181C]/10 bg-white/[.97]" src="/api/image/resize/100"'
  const [t2, b2] = scanOpacity(OK, scale)
  if (t2 < 3 || b2.length !== 0) {
    console.error(`❌ opacity-scale: 음성 대조 실패 — 정상 값을 위반으로 센다(오탐 ${b2.length}건, 검출 ${t2}).`)
    process.exit(1)
  }
}

const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts' 'src/**/*.css'", { encoding: 'utf-8' })
  .trim().split('\n').filter(Boolean)
  // 테스트는 위반 문자열 자체를 설명으로 들고 있다(가드를 설명하는 글이 가드에 걸리면 안 된다).
  .filter((f) => !f.startsWith('src/tests/'))

let total = 0
const hits = []
for (const f of files) {
  const [t, bad] = scanOpacity(readFileSync(f, 'utf-8'), scale)
  total += t
  for (const b of bad) hits.push(`${f}:${b.line}  ${b.token}`)
}

// ⚠️ 측정 대상 0건은 통과가 아니라 실패다 — 정규식이 낡아 조용히 비면 이 검사는 무의미해진다.
if (total < 400) {
  console.error(`❌ opacity-scale: 불투명도 수식어를 ${total}개밖에 못 찾았다 — 매칭이 낡았다(검사가 무의미해진다).`)
  process.exit(1)
}

if (hits.length) {
  console.error(`⚠️  스케일 밖 불투명도 ${hits.length}건 — 이 클래스들은 **생성되지 않아 요소가 투명해진다.**`)
  hits.forEach((h) => console.error(`   - ${h}`))
  console.error(`\n   스케일: ${[...scale].join(' ')}`)
  console.error('   고치는 법: 가까운 스케일 값으로(97 → 95) 또는 임의값 대괄호로(bg-white/[.97]).')
  if (STRICT) { console.error('\n❌ STRICT_OPACITY_SCALE — 차단.'); process.exit(1) }
  process.exit(0)
}
console.log(`✅ opacity-scale: 스케일 밖 0건 · 불투명도 수식어 ${total}개 검사(${files.length}파일).`)
