#!/usr/bin/env node
/**
 * 🔧 대시보드 표면의 색깔 정보상자·색 배지·색 선택 상태를 디자인 시스템 토큰으로 이행 (2026-09-15 코드모드)
 *
 * ■ 왜
 *   🎫 표면 규칙 ⑤ "나머지는 회색" · ⑥ "색깔 정보상자 0". 셀러 2차 페이지에 `bg-blue-50 border-blue-200`
 *   류가 200곳 넘게 남아 있었고(어드민은 460), 파일마다 파랑/노랑/초록/빨강이 제각각이라 같은 뜻이 다른
 *   색으로, 다른 뜻이 같은 색으로 떴다. 손으로 200번 판단하면 판단이 200번 갈린다.
 *
 * ■ 무엇을 바꾸나 — className 문자열 안의 **색 토큰만** (레이아웃·간격 무접촉)
 *   색 4군: bad = red|rose · warn = amber|yellow|orange · ok = emerald|green · info = blue|sky|indigo|purple|violet
 *   ① 선택 상태  `border-{c}-500 bg-{c}-50`            → `border-brand bg-brand-tint` (+ `text-{c}-900` → `text-brand-text`)
 *   ② 배지/알약  `bg-{c}-(50|100)` + (rounded-full | py-0.5 | py-1 + text-xs) → `bg-tone-{t}-bg text-tone-{t}`
 *   ③ 정보상자  `bg-{c}-(50|100)` (+ `border-{c}-(100|200|300)`) → `bg-white border-rule` (테두리 없던 면은 `border` 추가)
 *   ④ 글자      `text-{c}-(500~900)` → bad/warn/ok 는 `text-tone-{t}`, info 는 `text-gray-700`
 *              `text-{c}-400` → `text-gray-400` · `hover:text-{c}-*` → `hover:text-tone-{t}` (info → gray-700)
 *   ⑤ 호버 면   `hover:bg-{c}-(50|100)` → `hover:bg-gray-100`
 *   ⑥ 아이콘 자리 `bg-{c}-100` 정사각/원 → `bg-gray-100`
 *
 * ■ 안 건드리는 것
 *   `bg-{c}-(500|600|700)`(단색 버튼·막대 — 버튼은 adopt-button-system, 막대는 손으로) · `ring-*` · `focus:*`
 *   · 소비자 표면(대상 목록은 인자로 받는다).
 *
 * 실행: node scripts/codemods/adopt-dashboard-tones.mjs --scope=seller|admin [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const GLOBS = {
  seller: "':(glob)src/pages/Seller*.tsx' ':(glob)src/pages/seller-*/**/*.tsx' ':(glob)src/components/seller/**/*.tsx' ':(glob)src/components/Seller*.tsx'",
  admin: "':(glob)src/pages/Admin*.tsx' ':(glob)src/pages/admin/**/*.tsx' ':(glob)src/components/admin/**/*.tsx' 'src/components/AdminLayout.tsx'",
}
export const EXCLUDE = /SellerPublicPage|SellerLoginPage/ // 소비자 표면(유어샵) · 표지 로그인은 별도 시안
export const listFiles = (scope) => execSync(`git ls-files ${GLOBS[scope]}`, { encoding: 'utf-8' })
  .trim().split('\n').filter((f) => f && !EXCLUDE.test(f))

const TONE = { red: 'bad', rose: 'bad', amber: 'warn', yellow: 'warn', orange: 'warn', emerald: 'ok', green: 'ok',
  blue: 'info', sky: 'info', indigo: 'info', purple: 'info', violet: 'info' }
const C = '(red|rose|amber|yellow|orange|emerald|green|blue|sky|indigo|purple|violet)'

/** 한 className 문자열(따옴표 안 또는 템플릿 조각) 을 변환한다. */
export function convertClassString(cls, ctx = cls) {
  let s = cls
  const has = (re) => re.test(ctx) // 모양 판정은 **바깥 문맥까지**(템플릿의 삼항 조각은 자기 안에 rounded-full 이 없다)
  const pill = has(/\brounded-full\b/) || has(/\bpy-0\.5\b/) || (has(/\bpy-1\b/) && has(/\btext-(?:xs|\[1[01]px\])/))
  const iconBox = has(/\b(?:w|h)-(?:7|8|9|10|12|14|16)\b/) && has(/\bitems-center\b/) && !has(/\bp[xy]?-\d/)
  const bigNum = has(/\bfont-(?:bold|extrabold|black)\b/) && has(/\btext-(?:lg|xl|2xl|3xl|4xl)\b/)
  const link = has(/\bunderline\b/)

  // ① 선택 상태
  s = s.replace(new RegExp(`\\bborder-${C}-(?:500|600)\\b`, 'g'), 'border-brand')
  if (/\bborder-brand\b/.test(s) || /\bborder-brand\b/.test(ctx)) {
    s = s.replace(new RegExp(`\\bbg-${C}-(?:50|100)(?:/\\d+)?\\b`, 'g'), 'bg-brand-tint')
    s = s.replace(new RegExp(`\\btext-${C}-(?:600|700|800|900)\\b`, 'g'), 'text-brand-text')
  }
  if (link) s = s.replace(new RegExp(`\\btext-${C}-(?:500|600|700|800)\\b`, 'g'), 'text-brand-text')
  // ⑤ 호버 면 · 호버 글자
  s = s.replace(new RegExp(`\\bhover:bg-${C}-(?:50|100)\\b`, 'g'), 'hover:bg-gray-100')
  s = s.replace(new RegExp(`\\bhover:text-${C}-(\\d{3})\\b`, 'g'), (_, c) => TONE[c] === 'info' ? 'hover:text-gray-700' : `hover:text-tone-${TONE[c]}`)
  // ② 배지/알약
  if (pill) {
    s = s.replace(new RegExp(`\\bbg-${C}-(?:50|100)(?:/\\d+)?\\b`, 'g'), (_, c) => `bg-tone-${TONE[c]}-bg`)
    s = s.replace(new RegExp(`\\btext-${C}-(?:500|600|700|800|900)\\b`, 'g'), (_, c) => `text-tone-${TONE[c]}`)
    s = s.replace(new RegExp(`\\bborder-${C}-(?:100|200|300)\\b`, 'g'), 'border-transparent')
    return s
  }
  // ⑥ 아이콘 자리
  if (iconBox) {
    s = s.replace(new RegExp(`\\bbg-${C}-(?:50|100)\\b`, 'g'), 'bg-gray-100')
    s = s.replace(new RegExp(`\\btext-${C}-(?:500|600|700)\\b`, 'g'), 'text-gray-500')
  }
  // ③ 정보상자 면
  const hadColorBorder = new RegExp(`\\bborder-${C}-(?:100|200|300)\\b`).test(s)
  s = s.replace(new RegExp(`\\bborder-${C}-(?:100|200|300)\\b`, 'g'), 'border-rule')
  s = s.replace(new RegExp(`\\bbg-${C}-(?:50|100)(?:/\\d+)?\\b`, 'g'), () => {
    if (/\bborder-(?:rule|brand|gray-\d+|transparent)\b/.test(s)) return 'bg-white'
    if (hadColorBorder || /\bborder(?:-[0-9])?\b/.test(s)) return 'border-rule bg-white' // 너비만 있고 색이 없던 테두리
    return 'border border-rule bg-white'
  })
  // ④ 글자 — 정보색 큰 숫자는 잉크(숫자가 주인공), 정보색 본문은 회색
  s = s.replace(new RegExp(`\\btext-${C}-(?:500|600|700|800|900)\\b`, 'g'), (_, c) => TONE[c] === 'info' ? (bigNum ? 'text-gray-900' : 'text-gray-700') : `text-tone-${TONE[c]}`)
  s = s.replace(new RegExp(`\\btext-${C}-(?:300|400)\\b`, 'g'), 'text-gray-400')
  return s.replace(/\s{2,}/g, ' ')
}

/** 파일 안의 className 자리(문자열 리터럴 · 템플릿 조각 · 상태맵 문자열) 를 찾아 변환한다. */
export function convertSource(src, ctx) {
  const TOKEN = new RegExp(`\\b(?:hover:)?(?:bg|border|text)-${C}-\\d{2,3}\\b`)
  // 따옴표/백틱 안의 문자열 조각 단위로 — 템플릿 리터럴의 ${} 바깥 텍스트도 조각으로 잡힌다.
  return src.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, (whole, q, body) => {
    if (!TOKEN.test(body)) return whole
    if (q !== '`' && body.includes('\n')) return whole // 따옴표 문자열은 한 줄 — 줄을 넘으면 JSX 본문의 아포스트로피가 문 연 것
    if (q === '`') {
      // 템플릿: ${…} 표현식은 그대로 두고 그 사이 텍스트만 변환(표현식 안의 삼항 문자열은 재귀 처리)
      const parts = body.split(/(\$\{(?:[^{}]|\{[^{}]*\})*\})/)
      return q + parts.map((p, i) => (i % 2 ? convertSource(p, ctx ?? body) : convertClassString(p, ctx ?? body))).join('') + q
    }
    return q + convertClassString(body, ctx ?? body) + q
  })
}

// 테스트가 import 할 수 있게 — 직접 실행했을 때만 파일을 만진다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const WRITE = process.argv.includes('--write')
  const scope = (process.argv.find((a) => a.startsWith('--scope=')) || '--scope=seller').slice(8)
  let touched = 0
  for (const f of listFiles(scope)) {
    const src = readFileSync(f, 'utf-8')
    const out = convertSource(src)
    if (out !== src) {
      touched++
      if (WRITE) writeFileSync(f, out)
      else console.log(`~ ${f}`)
    }
  }
  console.log(`${WRITE ? '✍️ 적용' : '👀 미리보기'}: ${touched} 파일 (${scope})`)
}
