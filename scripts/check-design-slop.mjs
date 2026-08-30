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

const FLAT = /bg-gradient-to-[a-z]{1,2}\s+from-(\S+?)(?:\s+via-(\S+?))?\s+to-([^\s"'`]+)/g
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

    for (const m of ln.matchAll(FLAT)) {
      const parts = [m[1], m[2], m[3]].filter(Boolean).map(norm)
      if (new Set(parts).size === 1) found.flat.push(`${rel}:${i + 1}`)
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
