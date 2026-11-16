#!/usr/bin/env node
/**
 * 🤫 **커밋할 때 경고만 하는 검사의 출력을 "이번 커밋에 걸린 것" 으로 줄인다** (2026-11-16)
 *
 * 대표 *"계속 개선해줘"* (토큰 낭비).
 *
 * ## 왜 (실측 2026-11-16)
 * 파일 하나(`src/utils/format.ts` 한 줄)를 고쳐 커밋하면 pre-commit 이 **357줄 · 약 7,500 토큰**을 찍었다 — 전부 통과인데도.
 * 대부분은 경고만 하는 검사(`|| true`)가 **레포 전체의 기존 잔여**를 매번 통째로 다시 찍은 것이다:
 * 변경성 엔드포인트 커버리지(인증 누락 202건 목록) 7.8천 자 · 다크 보더(350건) 6.6천 자 · NaN 패턴 1.4천 자 …
 * 이번 커밋과 무관하고, 세션은 그걸 커밋할 때마다 대화에 받아 읽는다(세션당 커밋 수 × 7.5천 토큰).
 *
 * ## 무엇을 하나 (경고만 하는 검사에만 — 막는 검사(strict)는 손대지 않는다)
 *   - 파일 경로가 든 줄은 **이번 커밋에 올린(staged) 파일**일 때만 남긴다(그 아래 들여쓴 이어지는 줄 포함).
 *   - 이번 커밋 파일에 걸린 것이 있으면 설명 줄도 같이 남긴다(무엇이 왜 문제인지).
 *   - 없으면 경고 표시(⚠️·❌·🔴·🚧)가 붙은 요약 줄 최대 3줄 + "숨김" 안내 한 줄만 남긴다.
 *   - `HOOK_VERBOSE=1` 이면 손대지 않고 그대로 보여 준다.
 * 판정을 바꾸지 않는다 — 이 검사들은 원래 커밋을 막지 않는다(`|| true`). 바뀌는 것은 보이는 양뿐이다.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ANSI = /\x1b\[[0-9;]*m/g
const PATH_RE = /(?:^|[\s(`'"[])((?:src|scripts|docs|public|migrations|functions|deploy|\.github|\.claude)\/[^\s:'"`)\],]+\.[A-Za-z0-9]+)/g
const MARKER = /[⚠❌🔴🚧]/u // 🩸 u 없으면 이모지가 반쪽 문자로 쪼개져 🔍 같은 다른 이모지도 걸린다
export const MAX_SUMMARY = 3
export const HIDDEN_NOTE = '   (이번 커밋 파일과 무관한 기존 경고는 숨겼다 — 전부 보기: HOOK_VERBOSE=1 git commit …)'

/**
 * 순수 — 경고 검사 출력 줄이기.
 * @param {string} text 검사 출력
 * @param {string[]} staged 이번 커밋에 올린 파일
 * @param {{ verbose?: boolean }} [o]
 * @returns {string}
 */
export function quietFilter(text, staged, { verbose = false } = {}) {
  if (verbose) return text
  const set = new Set(staged.filter(Boolean))
  const lines = text.split('\n')
  const hitLines = []
  const otherLines = []
  const summary = []
  let dropped = 0
  let prev = 'none' // 'kept-path' | 'dropped-path' | 'none'
  for (const line of lines) {
    const plain = line.replace(ANSI, '')
    const paths = [...plain.matchAll(PATH_RE)].map((m) => m[1])
    if (paths.length) {
      if (paths.some((p) => set.has(p))) { hitLines.push(line); prev = 'kept-path' } else { dropped++; prev = 'dropped-path' }
      continue
    }
    if (prev !== 'none' && /^\s{3,}\S/.test(plain) && !MARKER.test(plain)) {
      if (prev === 'kept-path') hitLines.push(line)
      continue
    }
    prev = 'none'
    if (/^\s*\.\.\.\s*(and|외)\s*\d+/.test(plain) || /^\s*…\s*외/.test(plain)) { dropped++; continue }
    if (!plain.trim()) continue
    if (MARKER.test(plain)) summary.push(line)
    else otherLines.push(line)
  }
  if (hitLines.length) return [...otherLines, ...summary, ...hitLines].join('\n')
  if (!summary.length) return ''
  const out = summary.slice(0, MAX_SUMMARY)
  if (dropped || summary.length > MAX_SUMMARY) out.push(HIDDEN_NOTE)
  return out.join('\n')
}

function main() {
  const staged = (process.argv[2] || '').split('\n')
  const text = fs.readFileSync(0, 'utf8')
  const out = quietFilter(text, staged, { verbose: process.env.HOOK_VERBOSE === '1' })
  if (out) process.stdout.write(out.endsWith('\n') ? out : `${out}\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
