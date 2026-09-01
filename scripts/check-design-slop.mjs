#!/usr/bin/env node
/**
 * 🎨 "AI 가 만든 티" 회귀 가드 (2026-08-30 신설 — 대표 "AI로 디자인을 한 티가 절대 없어야 해")
 *
 * ■ 막으려는 두 가지 (둘 다 **에러를 내지 않는다**)
 *   ① **평면 그라디언트** — `bg-gradient-to-r from-gray-800 to-gray-800` 처럼 from/to 가 같은 색.
 *      마크업은 그라디언트라고 선언하는데 실제로는 단색이 렌더된다. 2026-06-19 흑백
 *      리매핑(모든 장식 색계열 → INK)에서 `from-pink-500 to-purple-500` 같은 것이 통째로
 *      붕괴한 잔재이고, 발견 당시 **85곳 / 48파일**이었다. 브라우저는 그라디언트 계산을
 *      계속 하고, 코드는 "여긴 그라디언트" 라고 거짓말한다.
 *   ② **이모지를 아이콘 자리에 쓰기** — 메뉴 아이콘·칩·제목·버튼. 이모지는 OS 마다 다른
 *      그림이 나오고(애플 컬러 / 노토 / Segoe), 같은 줄의 lucide 선 아이콘과 언어가 갈린다.
 *      무엇보다 "임시로 채워 둔 것" 으로 읽힌다 — 실제로는 완성된 화면인데도.
 *
 * ■ 이 가드가 **안** 막는 것 (일부러)
 *   - 사람에게 보내는 메시지 본문(카톡 공유문·토스트·알림) 안의 이모지 — 한국어 메신저
 *     문화에서 자연스럽고, 아이콘으로 대체할 자리가 아니다.
 *   - 소스 주석 안의 이모지 — 이 레포의 문서 관습이다.
 *   - 진짜 그라디언트(from/to 가 다른 색) — 히어로 오버레이 등은 정당하다.
 *   - **감정적 판단**("이 화면이 세련됐나")은 기계가 못 한다. 이건 바닥선일 뿐이다.
 *
 * 래칫: 신규 위반만 막는다(scripts/design-slop-baseline.json). 줄이면 --rebaseline.
 * 예외: 해당 줄에 `design-slop-ok` 주석.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BASELINE = path.join(ROOT, 'scripts/design-slop-baseline.json')
const MONO = new Set(['pink','rose','fuchsia','orange','amber','yellow','lime','green','emerald','teal','cyan','sky','blue','indigo','violet','purple','gray'])
const norm = (t) => { const i = t.lastIndexOf('-'); if (i < 0) return t; const fam = t.slice(0, i); return MONO.has(fam) ? 'ink' + t.slice(i) : t }

/**
 * 🕳️ 2026-09-01 — **이 가드의 두 번째 구멍.** 예전 정규식은
 *   `from-… (via-…) to-…` 가 **연속으로 붙어 있을 때만** 잡았다. 그런데 이 레포는 변형(variant)을
 *   섞어 쓴다: `from-gray-50 dark:from-[#0D0F12] to-white dark:to-[#0D0F12]`.
 *   그러면 `from-` 다음 토큰이 `to-` 가 아니라 `dark:from-` 이라 **매치 자체가 실패**하고,
 *   가드는 조용히 0건을 낸다. 실제로 `CouponClaimPage` 가 다크에서 `#0D0F12 → #0D0F12`
 *   (완전 평면)를 **세 줄** 갖고 있었는데 몇 달간 초록불이었다.
 *   ⇒ 이제 한 줄에서 stop 을 **변형별로 묶어** 각 그룹을 따로 판정한다
 *      (`''`=기본 · `dark:` · `hover:` …). 그래야 "라이트는 멀쩡한데 다크만 평면"이 잡힌다.
 *
 * ⚠️ 투명도 접미사(`/20` → `/10`)는 **평면이 아니다** — 같은 색의 진짜 페이드라
 *   `NotFoundPage` 의 `from-[#6b7280]/20 to-[#6b7280]/10` 은 정상이다. 그래서 stop 을
 *   비교할 때 `/알파` 를 **떼지 않고 그대로** 비교한다.
 */
const GRAD_LINE = /bg-gradient-to-[a-z]{1,2}\b/
const STOP = /(?:^|[\s"'`])((?:[a-z-]+:)*)(from|via|to)-([^\s"'`]+)/g

/** 한 줄의 stop 들을 변형 접두사별로 묶는다. 같은 그룹 안의 색이 전부 같으면 평면. */
function flatVariantGroups(ln) {
  const groups = new Map()
  for (const m of ln.matchAll(STOP)) {
    const [, variant, , value] = m
    if (!groups.has(variant)) groups.set(variant, [])
    groups.get(variant).push(norm(value))
  }
  const hits = []
  for (const [variant, stops] of groups) {
    if (stops.length >= 2 && new Set(stops).size === 1) hits.push(variant || 'base')
  }
  return hits
}
/**
 * 🕳️ 2026-08-31 — **이 가드의 구멍이었다.** 위 정규식은 Tailwind `className` 만 본다.
 *   그런데 인라인 `style={{ background: 'linear-gradient(...)' }}` 로 쓴 것이 라이브에 남아 있었고
 *   (`VouchersPage` 잔액 카드: `linear-gradient(135deg, #6b7280, #6b7280)` — 같은 색 두 개짜리
 *   가짜 그라디언트, MONO 흑백 시절 잔재), 이 가드는 **0건이라고 계속 초록불**을 냈다.
 *   같은 클래스의 결함을 한쪽 표기법으로만 찾고 있었던 셈이다.
 *   ⇒ CSS 함수 표기도 같이 본다. 색 토큰을 뽑아 전부 같으면 평면.
 */
const FLAT_CSS = /linear-gradient\(([^)]*)\)/g
// 그림 이모지만. 화살표(→ ←)·문장부호는 타이포그래피라 대상 아님.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F0FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
// UI 껍데기로 판정하는 자리: 아이콘 필드 · 칩/탭 라벨 · JSX 제목 텍스트
const UI_SLOT = /(^|[^a-zA-Z])(icon|emoji)\s*:\s*['"`]|label:\s*['"`][^'"`]*$|<(h[1-6]|button)[^>]*>[^<]*$/

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) { if (!/node_modules|\.git|dist|tests/.test(p)) walk(p, out) }
    else if (/\.tsx$/.test(e.name)) out.push(p)
  }
  return out
}

const found = { flat: [], emoji: [] }
for (const f of walk(path.join(ROOT, 'src'))) {
  const rel = path.relative(ROOT, f)
  const lines = fs.readFileSync(f, 'utf-8').split('\n')
  let inBlock = false
  lines.forEach((ln, i) => {
    if (ln.includes('design-slop-ok')) return
    const t = ln.trim()
    if (t.startsWith('/*')) { inBlock = !t.includes('*/'); return }
    if (inBlock) { if (t.includes('*/')) inBlock = false; return }
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('{/*')) return

    if (GRAD_LINE.test(ln)) {
      for (const v of flatVariantGroups(ln)) found.flat.push(`${rel}:${i + 1} (${v})`)
    }
    for (const m of ln.matchAll(FLAT_CSS)) {
      // 각도(135deg)·위치(0%)를 뺀 **색 토큰**만 남긴다. hex·rgb·색이름 모두.
      const stops = (m[1].match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|\b[a-z]{3,}\b/g) || [])
        .filter((x) => !/^(deg|to|top|bottom|left|right|at|circle|ellipse|closest|farthest|side|corner)$/i.test(x))
        .map((x) => x.toLowerCase())
      if (stops.length >= 2 && new Set(stops).size === 1) found.flat.push(`${rel}:${i + 1}`)
    }
    if (EMOJI.test(ln) && UI_SLOT.test(ln)) found.emoji.push(`${rel}:${i + 1}`)
  })
}

// ⚠️ 측정 대상이 0이면 통과가 아니라 실패다 — 경로가 낡아 조용히 비는 것을 막는다.
//    (이 레포가 반복해 당한 "검사가 실패할 수 없음" 클래스.)
const scanned = walk(path.join(ROOT, 'src')).length
if (scanned < 300) {
  console.error(`❌ design-slop: .tsx 를 ${scanned}개밖에 못 찾았다 — 스캔 경로가 낡았다(검사가 무의미해진다).`)
  process.exit(1)
}

const cur = { flat: found.flat.length, emoji: found.emoji.length }
if (process.argv.includes('--rebaseline')) {
  fs.writeFileSync(BASELINE, JSON.stringify({
    _comment: '평면 그라디언트 / UI 자리 이모지 허용 상한(래칫). 줄이면 --rebaseline 으로 갱신.',
    _measured: new Date().toISOString().slice(0, 10), ...cur,
  }, null, 2) + '\n')
  console.log(`✅ design-slop: 기준 갱신 — 평면 그라디언트 ${cur.flat} · UI 이모지 ${cur.emoji}`)
  process.exit(0)
}

const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf-8')) : { flat: 0, emoji: 0 }
let bad = false
for (const [k, ko] of [['flat', '평면 그라디언트(단색인데 그라디언트인 척)'], ['emoji', 'UI 자리 이모지(아이콘·칩·제목)']]) {
  if (cur[k] > base[k]) {
    bad = true
    console.error(`❌ design-slop: ${ko} ${base[k]} → ${cur[k]} (신규 ${cur[k] - base[k]}건)`)
    found[k].slice(0, 12).forEach((h) => console.error('   ' + h))
  }
}
if (bad) {
  console.error('\n   고치는 법: 평면 그라디언트는 `bg-<색>` 으로, UI 이모지는 lucide 선 아이콘으로.')
  console.error('   의도적이면 그 줄에 `design-slop-ok` 주석.')
  process.exit(1)
}
console.log(`✅ design-slop: 평면 그라디언트 ${cur.flat}(≤${base.flat}) · UI 이모지 ${cur.emoji}(≤${base.emoji})`)
