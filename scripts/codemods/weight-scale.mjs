#!/usr/bin/env node
/**
 * 🏋️ **글자 굵기 체계 — 세 단계 + 디스플레이** (2026-10-25 대표 *"굵기, 크기 등의 전반적인 것들이 투박함이
 *   남아있는 것 같아"* → 다른 서비스 화면 넷(에이블리·여기어때·NOL·오늘의집) 비교 → *"체계적으로 하자"*).
 *
 * ## 무엇이 잘못됐었나 (라이브 첫 화면 실측 · 390px)
 *   굵은 글자(600+) 비율  교환권 73% · 유어샵 80% · 홈 62% · 이용권 상세 45%
 *   500(중간)은 네 화면 어디에도 0 — 강조하려면 곧바로 700~900 으로 뛰었다.
 *   12px 글자가 교환권의 절반이고, 그중 상당수가 굵다(작은 글자를 굵게 하면 뭉친다).
 * 참고 화면들은 굵게를 **섹션 제목과 가격 숫자에만** 쓰고, 이름·설명은 보통/중간이다.
 *
 * ## 정본 (CLAUDE.md 🎫 ⑨)
 *   400 `font-normal`    설명 · 가게명 · 보조 정보 (12·13px 는 이 둘 중 하나)
 *   500 `font-medium`    상품명 · 목록 제목 · 탭 · 칩 · 작은 강조
 *   700 `font-bold`      섹션 제목 · 가격 숫자 · 주 버튼 — **15px 이상에서만**
 *   800 `font-extrabold` 디스플레이(28px 이상)에서만
 *   ❌ `font-semibold`(600) · `font-black`(900) · 12·13px 의 700+ (배지·칩도 예외 없다 — 첫 판에
 *   "칠한 면 위 배지" 예외를 뒀더니 흰 알약 카테고리 칩 20개가 전부 예외로 빠져 굵은 채 남았다.
 *   예외가 판정을 못 하면 규칙이 아니다)
 *   인라인 `style={{ fontWeight }}` 도 같은 규칙이다(이용권 상세 부품 다수가 인라인이다).
 *
 * ## 매핑 (같은 문자열 안의 크기를 보고 정한다)
 *   semibold           크기 ≥17 → bold · 그 외 → medium
 *   extrabold · black  크기 ≥28 → extrabold · 13 이하 → medium · 그 외 → bold
 *   bold               13 이하 → medium
 *   크기를 모르는 자리(상속): semibold → medium · extrabold/black → bold · bold 는 그대로
 *
 * ## ⚠️ 못 하는 것
 * - 크기가 다른 문자열(부모)에서 상속되는 자리 — 크기를 모르니 보수적으로만 바꾼다.
 * - 굵기가 *맞는 자리*인지(설명을 bold 로 둬도 15px 면 통과) — 그건 그려서 봐야 한다.
 *
 * 사용: node scripts/codemods/weight-scale.mjs [--dry] <파일...>
 */
import fs from 'node:fs'

const W = ['font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold', 'font-black']
const TOKEN = /(^|[\s"'`{(])((?:[a-z0-9-]+:)*)(font-(?:semibold|bold|extrabold|black))(?![\w-])/g
const SIZE = /(?:^|[\s"'`{(])((?:[a-z0-9-]+:)*)text-\[([0-9.]+)px\]/g

/** 문자열 안 변형 접두사별 글자 크기 — `''` 가 기본. */
function sizesOf(s) {
  const out = new Map()
  for (const m of s.matchAll(SIZE)) out.set(m[1], parseFloat(m[2]))
  return out
}

/** 한 클래스 문자열을 정본으로 — 바꿀 게 없으면 같은 문자열. */
export function fixWeights(s) {
  if (!/font-(semibold|bold|extrabold|black)/.test(s)) return s
  const sizes = sizesOf(s)
  return s.replace(TOKEN, (all, pre, v, tok) => {
    const n = sizes.has(v) ? sizes.get(v) : sizes.get('')
    let to = tok
    if (tok === 'font-semibold') to = n != null && n >= 17 ? 'font-bold' : 'font-medium'
    else if (tok === 'font-extrabold' || tok === 'font-black') {
      to = n == null ? 'font-bold' : n >= 28 ? 'font-extrabold' : n <= 13 ? 'font-medium' : 'font-bold'
    } else if (tok === 'font-bold') to = n != null && n <= 13 ? 'font-medium' : 'font-bold'
    return to === tok ? all : `${pre}${v}${to}`
  })
}

/** 정본 밖 토큰 목록 — 가드가 쓴다. */
export function weightViolations(s) {
  const out = []
  const sizes = sizesOf(s)
  for (const m of s.matchAll(TOKEN)) {
    const [, , v, tok] = m
    const n = sizes.has(v) ? sizes.get(v) : sizes.get('')
    if (tok === 'font-semibold' || tok === 'font-black') out.push(`${v}${tok}`)
    else if (tok === 'font-extrabold' && !(n != null && n >= 28)) out.push(`${v}${tok}@${n ?? '?'}`)
    else if (tok === 'font-bold' && n != null && n <= 13) out.push(`${v}${tok}@${n}`)
  }
  return out
}

/** 숫자 굵기 → 정본 (같은 규칙의 숫자판). 크기를 모르면 null. */
export function fixWeightNum(w, n) {
  if (w === 600) return n != null && n >= 17 ? 700 : 500
  if (w >= 800) return n == null ? 700 : n >= 28 ? 800 : n <= 13 ? 500 : 700
  if (w === 700 && n != null && n <= 13) return 500
  return w
}
/**
 * 문자열 리터럴 — 따옴표는 한 줄, 백틱은 **여러 줄**. 첫 판은 셋 다 한 줄로 잡아서, 여러 줄 템플릿으로 쓴
 * 교환권 카테고리 칩(`text-[13px] font-bold` + 다음 줄의 조건부 색)이 통째로 빠졌다 — 굵게가 그대로 남았는데
 * 변환은 "0건" 으로 조용했다.
 */
const LIT = /(["'])((?:(?!\1)[^\\\n]|\\.)*)\1|(`)((?:[^`\\]|\\.)*)`/g
const STYLE_OBJ = /\{[^{}]*\bfontWeight\s*:\s*\d{3}[^{}]*\}/g
function fixStyleObj(o) {
  const m = o.match(/\bfontSize\s*:\s*([0-9.]+)/)
  const n = m ? parseFloat(m[1]) : null
  return o.replace(/\bfontWeight(\s*:\s*)(\d{3})/, (a, sep, w) => `fontWeight${sep}${fixWeightNum(+w, n)}`)
}

/** 소스 안의 문자열 리터럴(따옴표·백틱)마다, 그리고 인라인 style 객체마다 적용. */
export function fixSource(src) {
  src = src.replace(STYLE_OBJ, fixStyleObj)
  return src.replace(LIT, (lit, q1, b1, q3, b3) => {
    const q = q1 ?? q3, body = b1 ?? b3
    if (!/font-/.test(body)) return lit
    const next = fixWeights(body)
    return next === body ? lit : q + next + q
  })
}
export function sourceViolations(src) {
  const out = []
  for (const o of src.match(STYLE_OBJ) || []) if (fixStyleObj(o) !== o) out.push(`style:${o.match(/fontWeight\s*:\s*\d+/)[0]}`)
  for (const m of src.matchAll(LIT)) {
    const body = m[2] ?? m[4]
    if (/font-/.test(body)) out.push(...weightViolations(body))
  }
  return out
}
export const WEIGHT_TOKENS = W

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry')
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  let total = 0
  for (const f of files) {
    const before = fs.readFileSync(f, 'utf8')
    const after = fixSource(before)
    const n = sourceViolations(before).length
    if (after !== before) { total += n; if (!dry) fs.writeFileSync(f, after); console.log(`${dry ? '[dry] ' : ''}${f}: ${n}`) }
    const left = sourceViolations(after)
    if (left.length) console.log(`  ⚠️ 남음 ${f}: ${left.join(' ')}`)
  }
  console.log(`합계 ${total}건`)
}
