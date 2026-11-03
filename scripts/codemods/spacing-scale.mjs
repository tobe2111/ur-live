#!/usr/bin/env node
/**
 * 📏 **손님 화면 공백 체계 — 여섯 단계 4 · 8 · 12 · 20 · 32 · 48** (2026-11-03 대표 *"손님 화면 공백 체계 시안 그대로 해줘"*).
 *   시안: 캔버스 S0~S6 · `docs/design/spacing-system-2026-11-03.md`.
 *
 * ## 무엇을 바꾸나 (tailwind 단위 → 체계 단위. 0·1·2·3·5·8·12 = 0·4·8·12·20·32·48px 는 그대로)
 *   사이(gap · space-x/y)   16→12 · 24→20 · 28→32 · 36→32 · 40→32 · 56·64→48   (같은 묶음 안 이웃은 좁게)
 *   바깥(m · mt/mb/ml/mr/mx/my) 16→20 · 24→32 · 28→32 · 36→32 · 40→48 · 56·64→48 (구역과 구역은 넓게 — 부드럽게)
 *   화면 가장자리(px)        16·24→20 · 28→32 — **콘텐츠 폭 상자**(`mx-auto`·`max-w-`·`ur-content-` 가 같은 클래스)만
 *   판 안쪽(p)               16→20 — `rounded-2xl` 판만
 *   ⚠️ 위아래 안쪽(py·pt·pb)은 **안 바꾼다** — 줄 높이(56·64)를 만드는 값이라 바꾸면 줄이 8px 씩 커진다.
 *   ⚠️ 음수 여백(`-mx-4` 같은 광학 보정·삐져나오기)은 안 바꾼다. 64px 초과(큰 빈 자리)도 안 바꾼다(의도된 값).
 *   ⚠️ 원래 값으로만 판정한다 — 두 번 돌려도 같다(체계 값은 다시 안 바뀐다).
 *
 * ## 못 하는 것
 * - 인라인 `style`·CSS 파일·변수로 조립한 클래스. 콘텐츠 폭 상자인데 표시가 없는 것(그려서 확인).
 *
 * 사용: node scripts/codemods/spacing-scale.mjs [--dry] <파일...>
 */
import fs from 'node:fs'

const GAP = { 4: 3, 6: 5, 7: 8, 9: 8, 10: 8, 14: 12, 16: 12 }
const OUT = { 4: 5, 6: 8, 7: 8, 9: 8, 10: 12, 14: 12, 16: 12 }
const GUTTER = { 4: 5, 6: 5, 7: 8 }

const dry = process.argv.includes('--dry')
const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))

/** 클래스 문자열 하나를 바꾼다. 같은 문자열 안의 다른 클래스(폭 상자·판)를 보고 정한다. */
export function convertClassString(str) {
  const widthBox = /(?:^|\s)(?:[a-z]+:)*(?:mx-auto|max-w-[^\s]+|ur-content-[a-z]+)(?=\s|$)/.test(str)
  const plate = /(?:^|\s)rounded-2xl(?=\s|$)/.test(str)
  return str.replace(/(^|\s)((?:[a-z0-9]+:)*)(gap-x|gap-y|gap|space-x|space-y|mt|mb|ml|mr|mx|my|m|px|p)-(\d+)(?=\s|$)/g, (all, pre, variants, util, n) => {
    const v = Number(n)
    let map = null
    if (util.startsWith('gap') || util.startsWith('space')) map = GAP
    else if (/^m[tblrxy]?$/.test(util)) map = OUT
    else if (util === 'px') map = widthBox ? GUTTER : null
    else if (util === 'p') map = plate ? { 4: 5 } : null
    if (!map || !(v in map)) return all
    return `${pre}${variants}${util}-${map[v]}`
  })
}

/** 클래스 목록처럼 생긴 문자열인가 — 모든 낱말이 tailwind 모양이고, 공백 유틸이 하나는 있다. 한글·문장은 안 걸린다. */
const TOKEN = /^!?-?(?:[a-z0-9]+:)*[a-z0-9][a-z0-9\-\[\]\/.#%(),_]*$/
const SPACE_TOKEN = /(^|\s)(?:[a-z0-9]+:)*(?:gap(?:-[xy])?|space-[xy]|m[tblrxy]?|px|p)-\d+(?=\s|$)/
function looksLikeClasses(body) {
  const plain = body.replace(/\$\{[^}]*\}/g, ' ')
  const toks = plain.split(/\s+/).filter(Boolean)
  return toks.length > 0 && toks.every((t) => TOKEN.test(t)) && SPACE_TOKEN.test(plain)
}

/** 파일 안의 문자열 중 **클래스 목록인 것**만 고친다. 주석·문구·경로 문자열은 모양이 달라 안 걸린다. */
export function convertSource(src) {
  let n = 0
  // 주석은 기록이다("종전 `gap-7`" 같은 설명) — 주석 줄·JSX 주석 안의 문자열은 안 바꾼다.
  return { out: src.split('\n').map((line) => {
    const t = line.trimStart()
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return line
    const cut = line.search(/\s\/\/\s|\{\/\*/)
    const code = cut >= 0 ? line.slice(0, cut) : line
    const rest = cut >= 0 ? line.slice(cut) : ''
    return conv(code) + rest
  }).join('\n'), get n() { return n } }
  function conv(text) { return text.replace(/(["'`])((?:(?!\1)[^\\\n]|\\.)*?)\1/g, (all, q, body) => {
    if (!looksLikeClasses(body)) return all
    const next = q === '`' && body.includes('${')
      ? body.split(/(\$\{[^}]*\})/).map((p) => (p.startsWith('${') ? p : convertClassString(p))).join('')
      : convertClassString(body)
    if (next !== body) n++
    return `${q}${next}${q}`
  }) }
}

if (files.length) {
  let total = 0, changed = 0
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const { out, n } = convertSource(src)
    if (out !== src) {
      changed++; total += n
      if (!dry) fs.writeFileSync(f, out)
    }
  }
  console.log(`${dry ? '[dry] ' : ''}바뀐 파일 ${changed}개 · 클래스 문자열 ${total}곳`)
}
