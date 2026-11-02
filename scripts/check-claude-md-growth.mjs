#!/usr/bin/env node
/**
 * 🧱 CLAUDE.md 에 기록을 쌓지 못하게 — PR 단위 증가 상한 + 판정 기록 차단 (2026-11-02)
 *
 * 대표 *"이러니까 계속 충돌이 되었지. 또 다른 개선 뭐 있어?"* → *"모두 개선해줘"*.
 *
 * ## 왜 (실측)
 * 최근 머지 200건 중 **20건이 CLAUDE.md 를 고쳤다** — 다른 어떤 파일보다 많다. 대부분은 규칙이 아니라
 * **기록**이었다(잠금 변경 기록 한 줄 5천 자 · "E4 판정 통과" 실측 12줄 · 가드 표 64줄). 기록은
 * 2026-11-01 에 `docs/locks/`·`docs/GUARD_RAILS.md`·`docs/handoff/` 로 옮겼지만, 옮긴 뒤에도 세션들이
 * 판정 결과를 CLAUDE.md 에 다시 적었다(#2067).
 *
 * 이 파일은 **모든 세션이 매 요청마다 읽는다.** 그래서 한 줄이 바뀌면
 *   ① 같은 줄을 고친 다른 세션과 머지 충돌이 나고
 *   ② 모든 세션의 프롬프트 캐시가 깨져 토큰을 처음부터 다시 낸다.
 * ⇒ 규칙은 **짧게 한 줄 + 포인터**로, 기록은 각자의 파일로.
 *
 * ## 판정 (base = merge-base(HEAD, origin/main) 와의 차이)
 *   - CLAUDE.md 가 **4,000자 넘게** 늘었다                  → ❌ (상세를 다른 문서로, 여기엔 한 줄)
 *   - 더한 줄에 **판정 기록**이 있다(E3~E5 판정 · 판정 통과) → ❌ (판정 결과는 인계 파일로)
 *   - base 를 못 구했다                                     → ❌ 못 잰 것은 통과가 아니다
 *   - 우회: 범위 안 커밋 메시지에 `[CLAUDE_MD_GROWTH]`(대표가 긴 규칙을 직접 지시했을 때만)
 *
 * ## 못 보는 것
 *   - 4,000자 안의 기록성 문장(패턴 밖 표현) — 리뷰가 본다
 *   - 규칙이 *맞는지* — 이 검사는 크기와 기록 모양만 본다
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const GROWTH_LIMIT_CHARS = 4000
export const BYPASS = '[CLAUDE_MD_GROWTH]'
/** 판정 기록의 모양 — 결과를 적는 문장. 규칙("E4 이상에서만 완료라고 쓴다")은 이 모양이 아니다. */
export const RECORD_PATTERNS = [/E[345]\s*판정/, /판정\s*통과/]

/**
 * 순수 판정.
 * @param {{ baseText: string, headText: string, addedLines: string[], commitMessages: string }} x
 * @returns {string[]} 위반 메시지(빈 배열 = 통과)
 */
export function judgeClaudeMd({ baseText, headText, addedLines, commitMessages }) {
  if (commitMessages.includes(BYPASS)) return []
  const errors = []
  const growth = headText.length - baseText.length
  if (growth > GROWTH_LIMIT_CHARS) {
    errors.push(
      `CLAUDE.md 가 이 브랜치에서 ${growth.toLocaleString()}자 늘었다(상한 ${GROWTH_LIMIT_CHARS.toLocaleString()}). ` +
        '상세는 docs/design·docs/handoff·docs/GUARD_RAILS.md 로 옮기고 여기엔 규칙 한 줄 + 포인터만.',
    )
  }
  const records = addedLines.filter((l) => RECORD_PATTERNS.some((re) => re.test(l)))
  if (records.length) {
    errors.push(
      `CLAUDE.md 에 판정 기록 ${records.length}줄을 더했다 — 판정 결과는 자기 인계 파일(docs/handoff/<날짜>-<슬러그>.md)에 적는다:\n` +
        records.slice(0, 3).map((l) => `      + ${l.slice(0, 120)}`).join('\n'),
    )
  }
  return errors
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function main() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  process.chdir(ROOT)
  const ref = process.env.CLAUDE_MD_BASE || 'origin/main'
  let base
  try {
    base = git(['merge-base', 'HEAD', ref]).trim()
  } catch {
    console.error(`❌ claude-md-growth: ${ref} 와의 merge-base 를 못 구했다 — 못 잰 것은 통과가 아니다(git fetch origin main).`)
    process.exit(1)
  }
  let baseText = ''
  try {
    baseText = git(['show', `${base}:CLAUDE.md`])
  } catch {
    baseText = ''
  }
  const headText = fs.readFileSync('CLAUDE.md', 'utf8')
  const addedLines = git(['diff', '-U0', base, '--', 'CLAUDE.md'])
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1))
  const commitMessages = git(['log', '--format=%B', `${base}..HEAD`])
  const errors = judgeClaudeMd({ baseText, headText, addedLines, commitMessages })
  if (errors.length) {
    console.error(`❌ claude-md-growth: ${errors.length}건`)
    for (const e of errors) console.error(`   · ${e}`)
    console.error(`   (대표가 긴 규칙을 직접 지시했으면 커밋 메시지에 ${BYPASS})`)
    process.exit(1)
  }
  const growth = headText.length - baseText.length
  console.log(`✅ claude-md-growth: CLAUDE.md ${growth >= 0 ? '+' : ''}${growth.toLocaleString()}자 · 판정 기록 0줄`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()
