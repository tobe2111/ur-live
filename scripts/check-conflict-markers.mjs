#!/usr/bin/env node
/**
 * 🩹 **머지 충돌 마커가 커밋되는 것을 막는다.**
 *
 * ## 왜 (이 레포에서 두 번 났다)
 * - 2026-07-11: `CLAUDE.md` 에 충돌 마커 3줄이 커밋된 채 남아 있었다(다음 세션이 하이진으로 제거).
 * - 2026-08-02: 세션이 `git merge` 충돌 중 `git add -A && git commit` 을 이어 붙여
 *   `<<<<<<<` 마커째 푸시했다(`576525a`).
 *
 * **git 은 이걸 안 막는다.** `git add -A` 는 충돌 파일도 "해결됨"으로 표시하므로,
 * 사람이 눈으로 확인하지 않으면 그대로 나간다. 그리고 이 레포는 여러 세션이 같은 파일을
 * 동시에 파므로 **머지 충돌이 상시**다 — 즉 재발 확률이 낮지 않다.
 *
 * ## 무엇을 보는가
 * 추적 중인 텍스트 파일에서 **줄 시작**의 `<<<<<<< ` · `>>>>>>> ` · 단독 `=======` 를 찾는다.
 *
 * ⚠️ **오탐을 만들 수 있는 것**: 마크다운 구분선(`=======`)은 실제로 문서에 쓰인다.
 *   그래서 `=======` 는 **혼자서는 위반이 아니고**, 같은 파일에 `<<<<<<< ` 또는 `>>>>>>> ` 가
 *   있을 때만 센다. (`<<<<<<< ` / `>>>>>>> ` 는 뒤에 공백+식별자가 붙는 형태라 자연 텍스트와 겹치지 않는다.)
 *
 * ⚠️ **못 막는 것**: 마커 없이 한쪽만 남긴 잘못된 해소(내용 손실)는 문자열로 판정 불가다.
 *   그건 사람이 diff 를 봐야 한다 — 이 가드는 *기계적으로 확실한 절반*만 맡는다.
 *
 * 예외: 이 파일 자신 · 가드 유닛 픽스처(`conflict-marker-ok` 주석).
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')
const OPEN = /^<<<<<<< /
const CLOSE = /^>>>>>>> /
const MID = /^=======\s*$/

/** 텍스트로 볼 확장자. 바이너리를 열어 봐야 소용없다. */
const TEXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|html|yml|yaml|sh|sql|toml|txt)$/i

function tracked() {
  try {
    return execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').map(s => s.trim()).filter(Boolean)
  } catch { return [] }
}

const files = tracked().filter(f => TEXT.test(f) && !f.endsWith('scripts/check-conflict-markers.mjs'))
if (files.length === 0) {
  // 🔒 측정 대상 0 = 통과가 아니라 실패. (이 레포가 여러 번 만난 "가드가 헛도는" 클래스 —
  //    경로가 낡아 조용히 비면 영원히 초록불이 된다.)
  console.error('❌ conflict-markers: 검사 대상 파일이 0개다 — git ls-files 가 비었거나 경로가 낡았다.')
  process.exit(1)
}

const hits = []
for (const f of files) {
  let src
  try { src = fs.readFileSync(f, 'utf8') } catch { continue }
  if (!src.includes('<<<<<<<') && !src.includes('>>>>>>>')) continue // 빠른 탈출(대다수)
  if (src.includes('conflict-marker-ok')) continue
  const lines = src.split('\n')
  const open = [], close = [], mid = []
  lines.forEach((l, i) => {
    if (OPEN.test(l)) open.push(i + 1)
    else if (CLOSE.test(l)) close.push(i + 1)
    else if (MID.test(l)) mid.push(i + 1)
  })
  if (!open.length && !close.length) continue
  // `=======` 는 open/close 가 있을 때만 센다(마크다운 구분선 오탐 방지 — 위 주석 참조).
  hits.push({ f, lines: [...open, ...close, ...mid].sort((a, b) => a - b) })
}

if (hits.length) {
  console.error(`\n❌ 머지 충돌 마커가 ${hits.length}개 파일에 남아 있다 — 커밋하면 안 된다:\n`)
  for (const h of hits) console.error(`   ${h.f}  (줄 ${h.lines.slice(0, 8).join(', ')}${h.lines.length > 8 ? ' …' : ''})`)
  console.error(`
   조치: 해당 파일을 열어 양쪽 내용을 **직접 보고** 합친 뒤 마커를 지워라.
        \`git checkout --ours/--theirs\` 로 한쪽을 통째로 버리면 다른 세션의 작업이 사라진다
        (이 레포는 여러 세션이 동시에 같은 파일을 판다 — handoff 는 보통 **양쪽 보존**이 맞다).
   ⚠️ \`git add -A\` 는 충돌 파일도 '해결됨'으로 표시한다. git 은 막아 주지 않는다.
`)
  process.exit(STRICT ? 1 : 0)
}

console.log(`✅ conflict-markers: 충돌 마커 0 (${files.length}개 파일 검사)`)
