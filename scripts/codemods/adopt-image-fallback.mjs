#!/usr/bin/env node
/**
 * 🖼️ 이미지 폴백 SSOT 배선 코드모드 (2026-08-31 — 대표 "유어샵 나머지" 의 체계판)
 *
 * ■ 무엇을 고치나
 *   `cfImage()` 로 감싼 <img> 는 두 번 실패할 수 있다: ① Cloudflare 리사이저가 원본을 못 가져옴
 *   ② 원본 자체가 404/삭제/핫링크차단. SSOT 헬퍼 `cfImageOnError(el, 원본URL)` 가 그 둘을
 *   [원본 1회 재시도 → 그래도 죽으면 이미지 숨김(부모 배경 노출)] 로 처리한다.
 *   실측(2026-08-31): cfImage 를 쓰는 <img> 92개 중 **47개가 onError 없음** — 그 자리는
 *   깨진 이미지 아이콘이 그대로 보인다. 절반이 빠진 건 취향이 아니라 배선 누락이다.
 *
 * ■ 무엇을 안 하나 (일부러)
 *   · onError 가 이미 있으면 건드리지 않는다(사이트별 커스텀 폴백이 있을 수 있다).
 *   · src 에서 원본 URL 표현식을 **안전하게** 못 뽑으면 원본 인자 없이 배선한다
 *     (그래도 2단계 '숨김' 은 동작 — 깨진 아이콘은 사라진다).
 *   · 서비스 분리: 도매/어드민/몰은 기본 제외(--all 로 포함).
 *
 * 사용: node scripts/codemods/adopt-image-fallback.mjs [--dry] [--all]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const DRY = process.argv.includes('--dry')
const ALL = process.argv.includes('--all')
const OUT_OF_SCOPE = /wholesale|supplier|Wholesale|Supplier|\/admin|Admin|Mall|agency|Agency/

const files = execSync("git ls-files 'src/**/*.tsx'", { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)

/** `{` 로 시작하는 JSX 표현식을 균형 잡힌 `}` 까지 잘라 낸다. 문자열/템플릿 리터럴 안의 괄호는 무시. */
function readBraced(src, open) {
  let depth = 0, q = null
  for (let i = open; i < src.length; i++) {
    const c = src[i], prev = src[i - 1]
    if (q) { if (c === q && prev !== '\\') q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return src.slice(open + 1, i) }
  }
  return null
}

/** `cfImage(X, {...})` 의 X(원본 URL 표현식)를 깊이 0 의 첫 콤마까지 뽑는다. */
function originalArg(expr) {
  const i = expr.indexOf('cfImage(')
  if (i < 0) return null
  let depth = 0, q = null
  const start = i + 'cfImage('.length
  for (let j = start; j < expr.length; j++) {
    const c = expr[j], prev = expr[j - 1]
    if (q) { if (c === q && prev !== '\\') q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') { if (depth === 0) return expr.slice(start, j).trim(); depth-- }
    else if (c === ',' && depth === 0) return expr.slice(start, j).trim()
  }
  return null
}

let touched = 0, wired = 0, withOriginal = 0
for (const f of files) {
  if (!ALL && OUT_OF_SCOPE.test(f)) continue
  let src = readFileSync(f, 'utf-8')
  const before = src
  let changedHere = 0

  // 뒤에서부터 치환해야 앞쪽 인덱스가 안 밀린다.
  const tags = [...src.matchAll(/<img\b[\s\S]*?\/>/g)].reverse()
  for (const m of tags) {
    const tag = m[0]
    if (!/cfImage\(|cfSrcSet\(/.test(tag)) continue
    if (/onError/.test(tag)) continue
    if (/image-fallback-ok/.test(tag)) continue

    const si = tag.indexOf('src={')
    const expr = si >= 0 ? readBraced(tag, si + 'src='.length) : null
    const orig = expr ? originalArg(expr) : null

    // 태그 안의 속성 들여쓰기를 그대로 따라간다(한 줄 태그면 공백 하나).
    const indentMatch = tag.match(/\n(\s+)\S/)
    const nl = indentMatch ? `\n${indentMatch[1]}` : ' '
    const call = orig ? `cfImageOnError(e.currentTarget, ${orig})` : 'cfImageOnError(e.currentTarget)'
    const attr = `${nl}onError={(e) => ${call}}`

    const closeAt = tag.lastIndexOf('/>')
    const next = tag.slice(0, closeAt) + attr.replace(/^\n\s+/, (s) => s) + (tag[closeAt - 1] === '\n' || /\s$/.test(tag.slice(0, closeAt)) ? '' : '') + tag.slice(closeAt)
    // 위 조립은 공백을 건드리지 않는다: 닫기 직전에 속성 한 개만 끼워 넣는다.
    const inserted = tag.slice(0, closeAt).replace(/\s*$/, '') + attr + (nl === ' ' ? ' ' : `\n${indentMatch ? indentMatch[1].slice(0, -2) : ''}`) + tag.slice(closeAt)
    void next

    src = src.slice(0, m.index) + inserted + src.slice(m.index + tag.length)
    changedHere++; wired++
    if (orig) withOriginal++
  }

  if (!changedHere) continue
  // import 보강 — 같은 모듈에서 이미 cfImage 를 가져오고 있으니 거기에 붙인다.
  if (!/\bcfImageOnError\b/.test(src.split('\n').filter((l) => l.startsWith('import')).join('\n'))) {
    src = src.replace(/import\s*\{([^}]*?)\}\s*from\s*'@\/utils\/cf-image'/, (mm, inner) => `import {${inner.replace(/\s*$/, '')}, cfImageOnError } from '@/utils/cf-image'`)
  }
  if (src !== before) {
    touched++
    if (!DRY) writeFileSync(f, src)
  }
}

console.log(`${DRY ? '[dry] ' : ''}이미지 폴백 배선: ${wired}곳 / ${touched}파일 (원본 재시도 인자 확보 ${withOriginal}곳)`)
