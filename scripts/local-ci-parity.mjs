/**
 * 🛡️ 2026-09-14 — 로컬↔CI 차단 동등성 SSOT
 *
 * 배경(실측): 가드 121개 중 **91개가 "CI 는 차단 · 로컬은 안 막음"** 이었다.
 *   - pre-commit 에 아예 없음 63개
 *   - 있지만 `|| true`(경고만) 28개
 * 그래서 가드가 제대로 잡아도 개발자는 **CI 한 바퀴(실측 57분) 뒤에야** 안다.
 * 2026-09-14 하루에 그 57분 루프를 두 번 돌았다(주석 제거기 · 파일크기 래칫).
 * 둘 다 로컬에서 1초면 알 수 있었다 — 실제로 그 91개 **전부 합쳐 14.5초**다.
 *
 * ⇒ 처방: 푸시 직전에 그 집합을 전부 돌린다(`pre-push-gate.mjs`).
 *   커밋은 계속 가볍게 두고, 57분 루프만 끊는다.
 *
 * 🔑 **목록을 손으로 관리하지 않는다.** `verify.yml` 에서 매번 뽑는다 —
 *   손목록은 반드시 낡고(이 레포가 여러 번 당한 "낡은 지도"), 새 가드가 조용히 샌다.
 *
 * ⚠️ 이 파일이 **못 하는 것**: verify.yml 밖에서 도는 가드(`guard-mutations-full.yml`,
 *   `dark-contrast.yml`, `live-contracts.yml`)는 보지 않는다. 그건 의도다 — 전부
 *   PR 게이트가 아니거나 브라우저·네트워크가 필요해 로컬 푸시 게이트에 맞지 않는다.
 */
import { readFileSync } from 'node:fs'

/** CI 가 strict 로 돌리지만 **로컬 푸시 게이트에서는 뺀다** — 이유를 반드시 적는다. */
export const EXCLUDE = {
  'check-guard-mutations.mjs':
    '전수 주입은 실측 45분. PR 은 --changed, 전수는 guard-mutations-full.yml(main push + 야간).',
  'check-built-css.mjs':
    'dist/ 빌드 산출물이 있어야 판정한다. 로컬에서 빌드 없이 돌리면 항상 빨간불.',
  'check-surface-role-leak.mjs':
    'route-chunk-map 이 이번 빌드의 것이어야 한다. 빌드 없이는 스스로 판정을 거부한다.',
}

/** verify.yml 에서 "실패하면 CI 가 막는" 가드 스크립트 이름을 뽑는다. */
export function ciStrictGuards(ymlPath = '.github/workflows/verify.yml') {
  const lines = readFileSync(ymlPath, 'utf8').split('\n')
  const found = new Set()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().startsWith('#')) continue
    const m = line.match(/scripts\/(check-[a-z0-9-]+\.(?:mjs|sh))/)
    if (!m) continue
    // continue-on-error: true 가 근처에 붙어 있으면 경고용이라 제외
    const near = lines.slice(i, i + 3).join('\n')
    if (near.includes('continue-on-error: true')) continue
    found.add(m[1])
  }
  return [...found].sort()
}

/** 로컬 푸시 게이트가 실제로 돌릴 목록. */
export function localGateGuards(ymlPath) {
  return ciStrictGuards(ymlPath).filter((g) => !(g in EXCLUDE))
}
