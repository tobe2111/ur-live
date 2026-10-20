#!/usr/bin/env node
/**
 * 🔀 file-size-baseline.json 전용 git merge driver (2026-07-29)
 *
 * 왜 필요한가: 이 파일은 "파일경로 → 동결된 줄 수" 맵이다. 브랜치가 여럿 동시에 돌면
 *   서로 다른 파일의 baseline 을 올리기 때문에 **거의 모든 병합에서 충돌**한다.
 *   내용은 충돌이 아닌데(서로 다른 키를 건드림) git 은 같은 줄 근처라 충돌로 본다.
 *   2026-07-29 하루에만 손으로 10번 병합했다. 규칙이 결정론적이면 사람이 할 일이 아니다.
 *
 * 병합 규칙: **키별 최대값**.
 *   baseline 은 "이 값을 넘기지 마라"는 래칫 상한이다. 두 브랜치가 같은 파일을 각각
 *   키웠다면 병합 결과는 둘 다 담으므로 **큰 쪽**이 맞다. 작은 쪽을 고르면 병합 직후
 *   CI 가 곧바로 빨간불이 된다(오늘 실제로 그랬다).
 *   한쪽에만 있는 키는 그대로 살린다(새로 동결된 파일).
 *
 * ⚠️ 이 드라이버는 "상한을 올리는" 쪽으로만 자동 결정한다. 그래서 **파일을 줄여서
 *   baseline 을 낮춘 작업**은 병합에서 되돌아갈 수 있다(높은 쪽이 이긴다).
 *   그건 안전한 방향의 손실이다 — 가드가 느슨해질 뿐 깨지지 않는다.
 *   줄인 값을 확정하려면 병합 후 `node scripts/check-file-size.mjs --rebaseline` 을 다시 돌려라.
 *
 * 등록: .gitattributes 의 `merge=filesize-baseline` + 아래 config (install-git-hooks.sh 가 자동 설정)
 *   git config merge.filesize-baseline.driver "node scripts/merge-file-size-baseline.mjs %A %O %B %P"
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [ours, , theirs] = process.argv.slice(2)   // %A(ours, 결과를 여기 씀) %O(base) %B(theirs)

function load(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

const a = load(ours)
const b = load(theirs)

// 어느 한쪽이라도 JSON 이 아니면 자동 병합을 포기한다(exit 1 → git 이 평소대로 충돌 표시).
// 조용히 한쪽을 고르는 것보다 사람에게 넘기는 게 낫다.
if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
  console.error('[filesize-baseline] JSON 파싱 실패 — 수동 병합으로 넘긴다.')
  process.exit(1)
}

const merged = {}
let raised = 0
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
  const av = a[k]
  const bv = b[k]
  if (typeof av === 'number' && typeof bv === 'number') {
    merged[k] = Math.max(av, bv)
    if (av !== bv) raised++
  } else {
    merged[k] = av ?? bv          // 한쪽에만 있는 키
  }
}

// 키 정렬 — 결정론적 출력이라야 다음 병합에서 또 흔들리지 않는다.
const sorted = {}
for (const k of Object.keys(merged).sort()) sorted[k] = merged[k]

writeFileSync(ours, JSON.stringify(sorted, null, 2) + '\n')
console.error(`[filesize-baseline] 자동 병합: ${Object.keys(sorted).length}개 키(값 상이 ${raised}개는 큰 쪽 채택).`)
process.exit(0)
