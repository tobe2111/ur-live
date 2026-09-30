/**
 * 🕸️ pre-push 그물이 **시험 뿌리를 전부** 본다 〔2026-09-30〕
 *
 * 이 레포엔 시험 뿌리가 둘이다 — `vitest.config` 의 `include: ['tests/**', 'src/tests/**']`.
 * 그런데 `pre-push-tests.mjs` 는 `src/tests` 만 grep 해서, 나머지 뿌리의 시험이 **로컬에서
 * 한 번도 안 돌았다.** 2026-09-30 에 `tests/unit/components/search/SearchHeader.test.tsx` 가
 * 깨진 채 푸시됐고(로컬 초록) CI 가 알려 줬다.
 *
 * ⚠️ 뿌리를 늘리는 건 **설정과 그물 둘 다**의 일이다 — 한쪽만 고치면 또 반쪽만 본다.
 *   그래서 이 시험은 vitest 설정에서 뿌리를 **읽어** 그물과 대조한다(목록을 손으로 안 적는다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const net = readFileSync('scripts/pre-push-tests.mjs', 'utf8')
const cfg = readFileSync('vitest.config.ts', 'utf8')

/** `include: ['tests/**\/*.test.{ts,tsx}', 'src/tests/**\/...']` → ['tests', 'src/tests'] */
function rootsFromConfig(): string[] {
  const m = cfg.match(/include:\s*\[([^\]]*\.test\.[^\]]*)\]/)
  if (!m) return []
  return [...new Set([...m[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((x) => x[1].split('/**')[0])
    .filter(Boolean))]
}

describe('pre-push 그물 ↔ vitest 뿌리', () => {
  it('🔴 설정에서 뿌리를 실제로 읽어 온다 (0개면 이 시험이 헛돈다)', () => {
    expect(rootsFromConfig().length).toBeGreaterThan(1)
  })

  it('🔴 그물이 모든 뿌리를 grep 한다', () => {
    for (const root of rootsFromConfig()) {
      expect(net, `그물이 '${root}' 뿌리를 안 본다 — 그 아래 시험은 로컬에서 안 돈다`)
        .toContain(`'${root}'`)
    }
  })
})
