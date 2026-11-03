#!/usr/bin/env node
/**
 * 🔤 **안 C — 큰 글자 한 단계 가볍게** (2026-11-03 대표 *"각 페이지들에 큰 글자들 … 굵기나 크기를 줄여볼까?
 *   왜 이리 서비스 페이지들이 투박해 보이지?"* → 시안 지금/A/B/C → *"안 C, 레포 규칙 허용도 할게. 모든 페이지들에 적용해줘"*).
 *   참고: 토스 화면(`docs/design/toss-reference-2026-11-03.md`).
 *
 * ## 무엇을 바꾸나 (같은 클래스 문자열 안의 크기·굵기·`tabular-nums` 를 보고 정한다)
 *   24px 구역 제목            → 20px · 600   (숫자면 24px · 700 그대로 — 가격·잔액·개수)
 *   17px 제목(숫자 아님)      → 16px · 600
 *   17px 숫자(`tabular-nums`) → 16px · 700 (가격은 굵게 남긴다)
 *   28px 숫자(`tabular-nums`) → 28px · 700 (큰 숫자는 크기 유지, 굵기만)
 *   28px 글자(숫자 아님)      → 24px · 700 (페이지 제목)
 *   34px 이상 800·900         → 700
 *   ⚠️ 원래 값으로만 판정한다(한 번에 치환) — 24→20 다음에 28→24 가 다시 20 으로 미끄러지지 않는다.
 *
 * ## 못 하는 것
 * - 인라인 `style={{ fontSize }}` · CSS 파일 · 변수로 조립한 클래스.
 * - "숫자인데 `tabular-nums` 가 없는" 가격 — 제목으로 보고 600 이 된다(그려서 확인할 것).
 *
 * 사용: node scripts/codemods/type-scale-c.mjs [--dry] <파일...>
 */
import fs from 'node:fs'

const LIT = /(["'])((?:(?!\1)[^\\\n]|\\.)*)\1|(`)((?:[^`\\]|\\.)*)`/g
const SIZE_TOK = /(^|[\s"'`{(])((?:[a-z0-9-]+:)*)text-\[([0-9.]+)px\](?![\w-])/g
const W_TOK = /(^|[\s"'`{(])((?:[a-z0-9-]+:)*)(font-(?:semibold|bold|extrabold|black))(?![\w-])/g

function newSize(n, num) {
  if (n === 24) return num ? 24 : 20
  if (n === 17) return 16
  if (n === 28) return num ? 28 : 24
  return n
}
function newWeight(tok, n, num) {
  if (tok === 'font-extrabold' || tok === 'font-black') return n != null && n <= 13 ? 'font-medium' : 'font-bold'
  if (n === 24 && (tok === 'font-bold' || tok === 'font-semibold')) return num ? 'font-bold' : 'font-semibold'
  if (n === 17 && tok === 'font-bold') return num ? 'font-bold' : 'font-semibold'
  return tok
}

/** 한 클래스 문자열. 바꿀 게 없으면 같은 문자열. */
export function fixTypeC(s, ctxNum = false) {
  if (!/text-\[(17|24|28|3\d|4\d|[5-9]\d)px\]|font-(extrabold|black)/.test(s)) return s
  const num = ctxNum || /\btabular-nums\b/.test(s)
  const sizes = new Map()
  for (const m of s.matchAll(SIZE_TOK)) sizes.set(m[2], parseFloat(m[3]))
  let out = s.replace(W_TOK, (all, pre, v, tok) => {
    const n = sizes.has(v) ? sizes.get(v) : sizes.get('')
    const to = newWeight(tok, n, num)
    return to === tok ? all : `${pre}${v}${to}`
  })
  out = out.replace(SIZE_TOK, (all, pre, v, n) => {
    const to = newSize(parseFloat(n), num)
    return to === parseFloat(n) ? all : `${pre}${v}text-[${to}px]`
  })
  return out
}

/**
 * 숫자 자리 판별 — `tabular-nums` 가 없어도 **그 요소가 그리는 내용**이 가격·금액·개수면 숫자로 본다.
 * 🩸 첫 판은 클래스만 봐서 가격(`{formatWon(price)}`)·할인율(`{pct}%`)·잔액이 24→20·600 으로 주저앉았다
 *   (시험 넷이 잡았다 — 숙소 바 가격 · 마이 숫자 줄 · SNS 팔로워 · 유어샵 판매 수).
 */
const NUM_HINT = /formatNumber|formatWon|\bwon\(|toLocaleString|[Pp]rice|price\b|%|원|딜|\bcount|[Cc]ount\b|total|sold|used|amount|\bfmt\(|\{big\}|\{code\}|stats|balance|[Pp]ct\b|follower/
function looksNumeric(after) {
  const end = after.indexOf('</')
  const seg = after.slice(0, end < 0 ? 240 : Math.min(end, 240))
  return NUM_HINT.test(seg)
}

export function fixSource(src) {
  return src.replace(LIT, (lit, q1, b1, q3, b3, off, whole) => {
    const q = q1 ?? q3, body = b1 ?? b3
    if (!/text-\[|font-/.test(body)) return lit
    const ctxNum = looksNumeric(whole.slice(off + lit.length))
    const next = fixTypeC(body, ctxNum)
    return next === body ? lit : q + next + q
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry')
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  let changed = 0
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8')
    const after = fixSource(before)
    if (after !== before) { changed++; if (!dry) fs.writeFileSync(f, after) }
  }
  console.log(`${dry ? '[dry] ' : ''}바뀐 파일 ${changed}개`)
}
