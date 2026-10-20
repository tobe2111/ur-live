#!/usr/bin/env node
/**
 * 🛡️ 2026-09-14 — 메타 가드: "CI 가 막는 것은 로컬도 막는다"가 무너지지 않게
 *
 * 배경(실측 2026-09-14): 가드 121개 중 **91개가 CI strict ↔ 로컬 무방비**였다.
 *   그래서 위반 하나가 CI 한 바퀴(**57분**)를 태웠고, 그날 그 루프를 두 번 돌았다.
 *   그 91개는 전부 합쳐 **14.5초**다 — 느려서 못 넣은 게 아니라 아무도 안 넣은 것이다.
 *
 * 이 가드가 지키는 불변식 셋:
 *   R1 verify.yml 의 strict 가드는 **pre-push 게이트가 돌리거나** EXCLUDE 에 들어 있어야 한다.
 *   R2 EXCLUDE 의 모든 항목은 **verify.yml 에 실제로 존재**해야 한다(낡은 지도 차단).
 *   R3 EXCLUDE 의 모든 항목은 **이유 문자열이 비어 있지 않아야** 한다.
 *   R4 `.github/workflows/*.yml` 이 전부 **YAML 로 파싱**돼야 한다.
 *   R5 정규식이 줍는 가드 이름을 **파서가 하나도 빠짐없이** strict/warn 으로 분류해야 한다.
 *
 * 🩸 R4·R5 는 이 가드를 만든 커밋 자신이 밟은 지뢰에서 나왔다. `verify.yml` 에 스텝을
 *   더하며 들여쓰기를 깨뜨렸는데, 결과가 **CI 실패가 아니라 "잡 0개로 즉시 종료"** 였다.
 *   PR 화면엔 Verify 가 아예 안 뜨고 `Cloudflare Pages ✅` 하나만 남아 통과처럼 보였다 —
 *   이 레포가 반복해 당한 "조용한 부재". 그리고 그때 pre-push 게이트는 통과했다:
 *   목록을 **줄 단위 정규식**으로 뽑았기 때문에 깨진 YAML 에서도 그럴듯한 94개가 나왔다.
 *
 * ⇒ 새 가드를 CI 에 strict 로 추가하면, 로컬에서도 돌거나 **왜 못 도는지 적어야** 통과한다.
 *
 * ⚠️ 이 가드가 **못 하는 것**:
 *   - pre-push 훅이 실제로 설치돼 있는지는 못 본다(`.git/hooks` 는 클론에 안 딸려 온다).
 *     원격 세션은 `bash scripts/install-git-hooks.sh` 를 세션마다 다시 돌려야 한다 — CLAUDE.md 참조.
 *   - verify.yml 밖(guard-mutations-full / dark-contrast / live-contracts)은 대상이 아니다.
 *
 * 우회: 없음. EXCLUDE 에 이유를 적는 것이 곧 우회다.
 */
import { existsSync } from 'node:fs'
import {
  ciStrictGuards,
  ciWarnGuards,
  EXCLUDE,
  guardsMentioned,
  localGateGuards,
  workflowYamlErrors,
} from './local-ci-parity.mjs'

const problems = []

// R4 — 워크플로가 GitHub 가 읽을 모양인가. **이걸 먼저 본다**: 깨져 있으면 아래 판정이
//      전부 허수다(깨진 파일에서 뽑은 목록은 그럴듯해도 CI 는 한 줄도 안 돈다).
for (const { file, message } of workflowYamlErrors()) {
  problems.push(`R4 ${file}: ${message}`)
}

const strict = ciStrictGuards()

// 🛡️ 측정 0 = 통과가 아니라 실패 (이 레포가 반복해 당한 "헛도는 가드" 차단)
if (strict.length < 30) {
  problems.push(`verify.yml 에서 strict 가드를 ${strict.length}개밖에 못 뽑았다 — 파서가 낡았다(정상은 100개 안팎).`)
}

// R1 — strict 인데 로컬 게이트에도 없고 EXCLUDE 에도 없는 것은 있을 수 없다(구성상 불가하나 방어)
const gate = new Set(localGateGuards())
for (const g of strict) {
  if (!gate.has(g) && !(g in EXCLUDE)) problems.push(`R1 ${g}: CI 는 막는데 로컬은 안 막고 EXCLUDE 에도 없다.`)
}

// R1' — 로컬 게이트가 돌릴 스크립트가 실제로 존재해야 한다
for (const g of gate) {
  if (!existsSync(`scripts/${g}`)) problems.push(`R1' ${g}: 게이트가 돌리려는 스크립트가 없다 — 이름이 바뀌었나?`)
}

// R2 — EXCLUDE 가 낡지 않았는가
const strictSet = new Set(strict)
for (const g of Object.keys(EXCLUDE)) {
  if (!strictSet.has(g)) problems.push(`R2 ${g}: EXCLUDE 에 있는데 verify.yml 의 strict 목록엔 없다(낡은 지도).`)
}

// R3 — 이유 없는 제외 금지
for (const [g, why] of Object.entries(EXCLUDE)) {
  if (!why || why.trim().length < 10) problems.push(`R3 ${g}: EXCLUDE 사유가 비었거나 너무 짧다.`)
}

// R5 — 파서가 눈먼 자리는 없는가. 멍청한 정규식이 줍는 이름을 전부 분류했어야 한다.
//      (분류 못 한 가드는 strict 인지 warn 인지 모른 채 게이트 밖으로 샌다.)
const classified = new Set([...strict, ...ciWarnGuards()])
for (const g of guardsMentioned()) {
  if (!classified.has(g)) {
    problems.push(`R5 ${g}: verify.yml 에 있는데 파서가 strict/warn 어느 쪽으로도 못 분류했다 — 워크플로 구조가 바뀌었나?`)
  }
}

if (problems.length) {
  console.error('❌ local-ci-parity: "CI 가 막는 것은 로컬도 막는다" 가 깨졌다\n')
  for (const p of problems) console.error(`   ${p}`)
  console.error('\n   고치는 법: 그 가드를 로컬에서 돌게 하거나, scripts/local-ci-parity.mjs 의')
  console.error('   EXCLUDE 에 **왜 로컬에서 못 도는지** 적을 것(빌드 산출물 필요 · 너무 느림 등).')
  process.exit(1)
}

console.log(
  `✅ local-ci-parity: 워크플로 YAML 정상 · CI strict ${strict.length}개 = ` +
    `로컬 게이트 ${gate.size}개 + 사유 있는 제외 ${Object.keys(EXCLUDE).length}개 (경고 전용 ${ciWarnGuards().length}개는 대상 아님)`,
)
