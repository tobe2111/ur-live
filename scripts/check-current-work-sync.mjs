#!/usr/bin/env node
/**
 * 🔄 인계 문서(docs/CURRENT_WORK.md) 동기화 가드 — 2026-07-28 신설.
 *
 * ## 왜 필요한가 (실제 사고)
 * CLAUDE.md 는 "기능 완료 + commit 시 CURRENT_WORK.md 를 갱신하라"고 **룰로만** 적어 놓았고
 * 강제하는 장치가 없었다. 2026-07-28 세션이 보강 레인 수리 **5건을 머지하는 동안 한 번도
 * 갱신하지 않았고**, 문서는 이전 세션(4차)에 멈춰 있었다. 대표가 "새 세션 어떻게 열까"를
 * 묻지 않았다면 다음 세션이 **이미 고친 것을 옛 상태로 알고 또 팠을** 상황이었다.
 * (같은 클래스: 가이드 시드·플랫폼 모델 문서는 이미 가드가 있는데 인계 문서만 없었다.)
 *
 * ## 무엇을 검사하나
 * 브랜치(origin/main...HEAD)와 staged 변경이 **소스(`src/`)를 건드렸는데** 그 브랜치 어디에서도
 * `docs/CURRENT_WORK.md` 를 손대지 않았으면 경고한다.
 *
 * ## 왜 "같은 커밋"이 아니라 "브랜치 단위"인가
 * 커밋마다 인계 갱신을 요구하면 소음이 커지고, 소음이 커지면 우회가 습관이 된다
 * (그러면 가드가 있으나 마나다). 실제 실패 모드는 "커밋 하나가 빠뜨림"이 아니라
 * **"한 세션 분량의 작업에 인계가 통째로 없음"** 이었다. 그래서 브랜치에 인계 갱신이
 * **한 번이라도** 있으면 통과시킨다 — 세션당 한 번이면 충분하다.
 *
 * 기본 warn. 차단: STRICT_HANDOFF=1. 우회: 커밋 메시지에 [SKIP_HANDOFF].
 */
import { execSync } from 'node:child_process'

// 2026-07-29: 인계가 세션별 파일(`docs/handoff/<날짜>-<슬러그>.md`)로 분리됐다.
//   `docs/CURRENT_WORK.md` 는 이제 **자동 생성 목차**라 사람이 편집하지 않는다 → 그것만 검사하면
//   앞으로는 아무도 통과하지 못한다. 둘 중 **어느 쪽이든** 손댔으면 인계를 남긴 것으로 본다.
//   (목차는 생성기가 자동으로 stage 하므로, 새 파일을 추가하면 자연히 둘 다 바뀐다.)
const HANDOFF_DIR = 'docs/handoff/'
const HANDOFF_INDEX = 'docs/CURRENT_WORK.md'
const isHandoff = (f) => f === HANDOFF_INDEX || f.startsWith(HANDOFF_DIR)
const HANDOFF = `${HANDOFF_DIR}<날짜>-<슬러그>.md`
const sh = (cmd) => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' } }

// 비교 기준 = 기본 브랜치. 없으면(얕은 클론 등) 조용히 통과 — 가드가 CI 를 깨는 것이 목적이 아니다.
const base = ['origin/main', 'origin/master', 'main'].find(r => sh(`git rev-parse --verify --quiet ${r}`))
if (!base) { console.log('✅ 인계 문서 동기화: 기준 브랜치 없음 (skip).'); process.exit(0) }

const head = sh('git rev-parse --abbrev-ref HEAD')
// 기본 브랜치 위에서 직접 작업 중이면 '브랜치 분량' 개념이 없다 → skip(머지 커밋 소음 방지).
//   ⚠️ 커밋 SHA 가 base 와 같다는 이유로 skip 하면 **브랜치의 첫 커밋을 놓친다**(아직 커밋 전이라
//   HEAD==base 인데, 그 순간이 바로 검사해야 할 때다). 이름으로만 판단한다.
if (head === 'main' || head === 'master') {
  console.log('✅ 인계 문서 동기화: 기본 브랜치 (skip).')
  process.exit(0)
}

// 브랜치가 건드린 파일 + 지금 staged 파일(pre-commit 시점엔 아직 커밋 전이라 함께 봐야 한다)
const branchFiles = sh(`git diff --name-only ${base}...HEAD`).split('\n').filter(Boolean)
const stagedFiles = sh('git diff --cached --name-only --diff-filter=ACMR').split('\n').filter(Boolean)
const all = [...new Set([...branchFiles, ...stagedFiles])]
if (!all.length) { console.log('✅ 인계 문서 동기화: 변경 없음 (skip).'); process.exit(0) }

// 소스 변경만 대상 — 문서/테스트만 고친 브랜치는 인계 대상이 아니다(소음 억제).
const source = all.filter(f => f.startsWith('src/') && !f.includes('/tests/') && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
if (!source.length) { console.log('✅ 인계 문서 동기화: 소스 변경 없음 (skip).'); process.exit(0) }

const touched = all.filter(isHandoff)
if (touched.length) {
  console.log(`✅ 인계 문서 동기화: ${touched[0]}${touched.length > 1 ? ` 외 ${touched.length - 1}건` : ''} 갱신됨.`)
  process.exit(0)
}

const strict = process.env.STRICT_HANDOFF === '1'
console.log(`${strict ? '❌' : '⚠️'}  인계 문서 미갱신 — 다음 세션이 옛 상태로 오판한다 (CLAUDE.md "진행 중 작업 인계")`)
console.log(`   이 브랜치가 소스 ${source.length}개를 바꿨는데 ${HANDOFF} 는 그대로다.`)
console.log(`   예: ${source.slice(0, 3).join(', ')}${source.length > 3 ? ' …' : ''}`)
console.log('')
console.log(`   고치는 법: ${HANDOFF} 파일을 새로 만들고, 무엇을 왜 바꿨는지 + **다음 세션의 첫 액션**을 적는다.`)
console.log('     · 목차(docs/CURRENT_WORK.md)는 손대지 마라 — pre-commit 이 자동 생성한다.')
console.log('     · 완료분은 commit/PR 해시와 함께 (다음 세션이 "이미 된 것"을 또 파지 않게)')
console.log('     · 이번에 틀렸던 판단이 있으면 그것도 (같은 오진 반복 방지 — 이게 제일 값지다)')
console.log('     · 남은 결정/대기 항목 (대표 판단이 필요한 것)')
console.log('')
console.log('   세션당 한 번이면 된다. 문서/테스트만 바꾼 브랜치는 이 검사에 안 걸린다.')
console.log('   의도적이면 커밋 메시지에 [SKIP_HANDOFF].')
process.exit(strict ? 1 : 0)
