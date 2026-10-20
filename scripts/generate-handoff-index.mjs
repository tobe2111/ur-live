#!/usr/bin/env node
/**
 * 🗂️ 인계 목차 자동 생성 — 2026-07-29 신설 (대표 승인 "세션별 파일로 분리").
 *
 * ## 왜 필요한가 (실제 사고 — 추측 아님)
 * `docs/CURRENT_WORK.md` 는 **모든 세션이 맨 위에 새 항목을 append** 하는 구조였다.
 * 세션이 여러 개 동시에 도는 레포라, 두 브랜치가 *내용상 무관한데도* 같은 줄(3번째 줄)을 다퉈
 * **거의 모든 PR 에서 충돌**했다. 2026-07-29 하루에만 손으로 10번 넘게 병합했다.
 *
 * `.gitattributes` 의 `merge=union`(#836)이 로컬 병합은 해결했지만 **GitHub 서버측 머지는
 * gitattributes 드라이버를 적용하지 않는다** — 그래서 정작 머지 버튼이 막히는 지점의 마찰은
 * 그대로였다. 2026-07-29 에 #835 를 머지하려다 이걸 실측으로 확인했다(로컬 clean, GitHub `dirty`).
 * 두 번 연속으로 main 이 먼저 전진해 두 번 재병합했다.
 *
 * ## 처방
 * **아무도 공유 파일에 손을 대지 않게 만든다.**
 *   · 세션은 `docs/handoff/<날짜>-<슬러그>.md` 라는 **자기 파일만** 새로 만든다 → 다툴 줄이 없다.
 *   · `docs/CURRENT_WORK.md` 의 목차는 이 스크립트가 **생성**한다 → 사람이 편집하지 않는다.
 * 같은 철학의 선례: `generate-guide-references.mjs`(가이드 자동 참조 섹션).
 *
 * ## 사용
 *   node scripts/generate-handoff-index.mjs         # 목차 재생성(변경 있을 때만 파일 쓰기)
 *   node scripts/generate-handoff-index.mjs --check  # 목차가 최신인지 검사만(비-0 이면 낡음)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const HANDOFF_DIR = 'docs/handoff'
// 🔀 2026-10-06 (대표 "남은 것도 다 해줘") — 산출물 경로를 **추적하지 않는 사이드카**로 옮겼다.
//   왜: 종전엔 이 목차를 `docs/CURRENT_WORK.md` 안에 쓰고 pre-commit 이 **stage** 했다.
//   그러면 handoff 파일을 만든 **모든 브랜치가 같은 생성 블록을 고치므로** 내용상 무관한데도
//   머지마다 충돌했다(2026-07-29 하루 10번+, 2026-10-06 하루 3번). `.gitattributes` 의
//   `merge=union` 은 **로컬 머지에만** 먹고 GitHub 서버측 머지는 그 드라이버를 안 쓴다 —
//   2026-10-06 에 PR 셋이 그 때문에 멎었고 `Verify` 가 실패도 아니고 **부재**였다(디스패치 안 됨).
//   ⇒ 휘발성 생성물을 추적하는 것이 원인이다. 이제 `.gitignore` 된 사이드카에 쓰고,
//      `docs/CURRENT_WORK.md` 는 **안 바뀌는 문서**로 남는다(= 다툴 줄이 없다).
const INDEX_FILE = 'docs/handoff/INDEX.local.md'
const BEGIN = '<!-- HANDOFF-INDEX:BEGIN -- 자동 생성 · 직접 편집 금지 (scripts/generate-handoff-index.mjs) -->'
const END = '<!-- HANDOFF-INDEX:END -->'

/** 파일의 첫 제목 줄을 그대로 쓴다(내용 변형 없음). 없으면 파일명으로 대체. */
function titleOf(path, fallback) {
  const lines = readFileSync(path, 'utf8').split('\n')
  for (const l of lines) {
    if (l.startsWith('## ')) return l.slice(3).trim()
    if (l.startsWith('# ')) return l.slice(2).trim()
  }
  return fallback
}

function collect() {
  if (!existsSync(HANDOFF_DIR)) return []
  return readdirSync(HANDOFF_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const path = join(HANDOFF_DIR, f)
      const m = f.match(/^(\d{4}-\d{2}-\d{2})/)
      return { file: f, path, date: m ? m[1] : '', title: titleOf(path, f) }
    })
    // 최신 우선. 같은 날짜는 파일명 역순(같은 날 여러 세션이 있어도 결정론적).
    .sort((a, b) => (b.date.localeCompare(a.date)) || b.file.localeCompare(a.file))
}

function render(entries) {
  const out = [BEGIN, '']
  if (!entries.length) {
    out.push('_(아직 세션 인계 파일이 없다 — `docs/handoff/<날짜>-<슬러그>.md` 로 추가하면 여기에 자동 등록된다.)_')
  } else {
    out.push(`_총 ${entries.length}건 · 최신순 · 이 목록은 자동 생성된다._`, '')
    let curDate = null
    for (const e of entries) {
      if (e.date !== curDate) { curDate = e.date; out.push(`**${curDate || '(날짜 미상)'}**`) }
      out.push(`- [${e.title}](${e.file})`)
    }
  }
  out.push('', `📦 그 이전 기록: [\`archive/\`](archive/)`, END)
  return out.join('\n')
}

const entries = collect()
const block = render(entries)

// 🔀 사이드카는 **전체가 생성물**이다(추적 안 함) — 마커 splicing 이 필요 없고,
//   첫 실행이나 새 클론에서 파일이 없으면 그냥 만든다(종전엔 마커가 없다고 exit 1 했다).
const HEADER = [
  '# 📚 세션 인계 목차 (자동 생성 · 추적 안 함)',
  '',
  '이 파일은 `scripts/generate-handoff-index.mjs` 가 만든다. **`.gitignore` 되어 있다** —',
  '모든 브랜치가 고치는 생성물을 추적하면 머지마다 충돌하기 때문이다(2026-10-06 근본 해소).',
  '규칙은 `CLAUDE.md` 의 "🔄 진행 중 작업 인계" 절에 있다.',
  '',
].join('\n')
const next = HEADER + block + '\n'
const cur = existsSync(INDEX_FILE) ? readFileSync(INDEX_FILE, 'utf8') : ''

if (process.argv.includes('--check')) {
  if (next !== cur) {
    console.error('❌ 인계 목차가 낡았다 — `node scripts/generate-handoff-index.mjs` 로 재생성할 것.')
    process.exit(1)
  }
  console.log(`✅ 인계 목차 최신 (${entries.length}건).`)
  process.exit(0)
}

// anti-churn: 실제로 달라질 때만 쓴다(무의미한 diff 로 또 충돌을 만들지 않게).
if (next !== cur) {
  writeFileSync(INDEX_FILE, next)
  console.log(`✅ 인계 목차 재생성 (${entries.length}건).`)
} else {
  console.log(`✅ 인계 목차 변경 없음 (${entries.length}건).`)
}
