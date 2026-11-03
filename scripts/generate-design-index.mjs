#!/usr/bin/env node
/**
 * 🗂️ 디자인 시안 목차 — 한 줄 = 파일 하나, 목차는 생성물 (2026-11-03)
 *
 * 대표 *"어쨌거나 계속 충돌은 하는 것 같아 세션마다 … 낭비 없이 빨리"* → *"가장 이상적으로 해줘"*.
 *
 * 왜(실측): `docs/design/README.md` 의 "미구현 시안" 표에 **모든 세션이 맨 위에** 한 줄씩 끼워 넣었다.
 * 최근 3일 main 머지 109건 중 **13건**이 이 파일을 고쳤고, 무관한 PR 끼리 같은 줄을 다퉜다
 * (인계 `CURRENT_WORK.md` 가 2026-07-29 에 앓던 바로 그 병이다 — 처방도 같다: `generate-handoff-index.mjs`).
 *
 * 구조:
 *   - `docs/design/index/<날짜>-<슬러그>.md` — 파일 하나에 표 한 줄(`| 페이지 | 날 | 상태 | [파일](./x.md) |`)
 *   - 목차 `docs/design/INDEX.local.md` — **추적 안 함**(.gitignore). 이 스크립트가 최신순으로 만든다.
 *
 * 사용: node scripts/generate-design-index.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DESIGN_INDEX_DIR = 'docs/design/index'
export const DESIGN_INDEX_OUT = 'docs/design/INDEX.local.md'

/** 순수 — 줄 파일들({name, text}) → 목차 마크다운. 날짜(파일명 접두사) 최신순. */
export function buildDesignIndex(files) {
  const rows = files
    .filter((f) => f.name.endsWith('.md'))
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))
    .map((f) => f.text.trim())
    .filter((t) => t.startsWith('|'))
  return [
    '<!-- ⚠️ 생성물 — node scripts/generate-design-index.mjs. 추적 안 함 · 편집 금지(줄은 docs/design/index/ 에서 고친다). -->',
    '# 디자인 시안 목차 (최신순)',
    '',
    '| 페이지 | 시안 받은 날 | 상태 | 파일 |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}

function main() {
  const dir = join(ROOT, DESIGN_INDEX_DIR)
  const files = readdirSync(dir).map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }))
  // 🛡️ 측정 0 = 실패 — 줄이 하나도 없으면 목차가 비어도 "만들었다" 고 말하게 된다.
  const total = files.filter((f) => f.name.endsWith('.md')).length
  if (total === 0) {
    console.error(`❌ design-index: ${DESIGN_INDEX_DIR} 에 줄 파일이 0개다 — 경로가 낡았다(통과 아님).`)
    process.exit(1)
  }
  writeFileSync(join(ROOT, DESIGN_INDEX_OUT), buildDesignIndex(files))
  console.log(`✅ design-index: ${total}줄 → ${DESIGN_INDEX_OUT}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
