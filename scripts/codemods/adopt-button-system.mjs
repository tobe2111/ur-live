#!/usr/bin/env node
/**
 * 🔧 셀러/대시보드 표면의 버튼을 `.ur-btn` 체계로 이행 (2026-08-31, 1회성 코드모드)
 *
 * ■ 왜 손으로 안 하나
 *   주 버튼 92개 · 77파일 · **모양 조합 48가지**(최다 패턴도 5번뿐).
 *   손으로 48가지를 판단하며 고치면 판단이 48번 갈린다 — 지금 상태가 정확히 그렇게 생겼다.
 *
 * ■ 무엇을 바꾸나 (보수적으로)
 *   className 안에서 **버튼의 시각 결정 토큰만** 걷어내고 체계 클래스로 대체한다:
 *     걷어냄  bg-{gray-900|black|brand} · text-white · rounded-* · text-{xs|sm|base}
 *             · font-{medium|semibold|bold|extrabold} · h-* · px-* · py-*
 *             + 그 hover/active/disabled 변형
 *     넣음    ur-btn ur-btn-{sm|md|lg} ur-btn-primary
 *   ⚠️ **레이아웃 토큰은 손대지 않는다** (w-full·flex·gap·mt/mb·absolute·shrink 등).
 *      버튼의 *생김새*만 체계가 갖고, *배치*는 페이지가 계속 갖는다.
 *
 * ■ 크기 판정 — 기존 세로 패딩/높이에서 유추한다(눈으로 본 크기를 보존)
 *     py-1 / py-1.5 / h-8  → sm      py-3 이상 / h-12 → lg      나머지 → md
 *
 * ■ 안 건드리는 것
 *   · 소비자 표면(여기는 셀러/대시보드 전용 — 소비자는 이미 정리됨)
 *   · `bg-brand` 를 **소비자 CTA 로 쓰는 곳**(이 스크립트는 셀러 경로만 읽는다)
 *   · 이미 `ur-btn` 을 쓰는 className
 *   · 조건부 클래스(템플릿 리터럴 안의 삼항) — 문자열 리터럴 className 만
 *
 * 실행: node scripts/codemods/adopt-button-system.mjs [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { enclosingTagName, BUTTONISH } from '../lib/jsx-enclosing-tag.mjs'

const WRITE = process.argv.includes('--write')

const files = execSync(
  "git ls-files 'src/pages/Seller*.tsx' 'src/components/seller/**/*.tsx' 'src/pages/seller-*/**/*.tsx'",
  { encoding: 'utf-8' },
).trim().split('\n').filter(Boolean)

/** 걷어낼 토큰 — 버튼의 *생김새* 결정분. 변형(hover: 등) 포함. */
const STRIP = /^(?:[a-z-]+:)*(?:bg-(?:gray-900|gray-800|black|brand|brand-dark)|text-white|rounded-(?:sm|md|lg|xl|2xl|3xl|full)|text-(?:xs|sm|base)|font-(?:medium|semibold|bold|extrabold|black)|h-(?:8|9|10|11|12)|px-[\d.]+|py-[\d.]+)$/

const isPrimaryBg = (t) => /^(?:[a-z-]+:)*bg-(?:gray-900|gray-800|black|brand|brand-dark)$/.test(t)

function sizeOf(tokens) {
  const has = (re) => tokens.some((t) => re.test(t))
  if (has(/^py-(?:1|1\.5)$/) || has(/^h-8$/)) return 'sm'
  if (has(/^py-(?:3|3\.5|4)$/) || has(/^h-12$/)) return 'lg'
  return 'md'
}

let changed = 0, touched = 0
for (const f of files) {
  const src = readFileSync(f, 'utf-8')
  let hit = 0
  const out = src.replace(/className="([^"{}]*)"/g, (whole, cls, offset) => {
    /* 🩸 오탐을 실제로 잡았다: `<span className="… bg-gray-900 text-white … rounded-full">{count}</span>`
       (카운트 배지)까지 버튼으로 바꿔 40px 높이가 될 뻔했다. 잉크 배경 + 흰 글자는
       **버튼만의 특징이 아니다** — 배지·태그·칩도 그렇다.
       ⇒ 감싸는 여는 태그가 실제로 누를 수 있는 요소일 때만 바꾼다.
       ⚠️ 2026-08-31: 여기 있던 `lastIndexOf('<')` 는 `disabled={… < 2}` 의 **비교 연산자**를
          태그 시작으로 오인해 진짜 버튼을 건너뛰었다(래칫 되돌려-검증에서 발각). 판정을
          scripts/lib/jsx-enclosing-tag.mjs 로 옮겨 래칫과 한 벌로 쓴다. */
    if (!BUTTONISH.test(enclosingTagName(src, offset))) return whole
    const tokens = cls.split(/\s+/).filter(Boolean)
    if (tokens.includes('ur-btn')) return whole            // 이미 체계
    if (!tokens.some(isPrimaryBg)) return whole            // 주 버튼 아님
    if (!tokens.some((t) => /^(?:[a-z-]+:)*text-white$/.test(t))) return whole // 흰 글자 아님 → 버튼 아닐 수 있음
    const size = sizeOf(tokens)
    const kept = tokens.filter((t) => !STRIP.test(t))
    hit++
    return `className="${['ur-btn', `ur-btn-${size}`, 'ur-btn-primary', ...kept].join(' ')}"`
  })
  if (hit) {
    touched++; changed += hit
    if (WRITE) writeFileSync(f, out)
    console.log(`  ${hit.toString().padStart(2)}  ${f}`)
  }
}
console.log(`\n${WRITE ? '✅ 적용' : '🔎 미리보기'}: 버튼 ${changed}개 · 파일 ${touched}개`)
if (!WRITE) console.log('   실제로 바꾸려면 --write')
