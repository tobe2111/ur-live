/**
 * 🧊 옛 소개서 자동 참조를 커밋마다 다시 만들지 않는다 — 2026-11-02
 *   (대표 *"제안서는 계속 자동 업데이트가 안돼. 3번은 더 이상적인 방법 알려줘"* → *"응 진행해줘. 가장 이상적으로."*)
 *
 * `docs/proposals/*.md` 의 자동 블록(라우트 목록 · 상수)은 어떤 화면도 띄우지 않는 옛 문서인데,
 * pre-commit 이 매 커밋 재생성해 stage 했다 → 라우트를 더한 모든 브랜치가 같은 블록을 고쳐
 * 최근 머지 200건 중 8건에서 다퉜다(휘발성 생성물 추적 — 인계 목차가 2026-10-06 에 고친 것과 같은 병).
 *
 * 고정하는 것:
 *   ① pre-commit 이 그 생성기를 부르지 않고, docs/proposals 를 stage 하지 않는다(주석은 제외하고 본다)
 *   ② 문서 다섯 개 모두 맨 위에 "동결" 표시가 있다(다음 세션이 자동 갱신되는 줄 알고 믿지 않게)
 * ⚠️ 못 보는 것: 진짜 대외 소개서(docs/business/proposals) 의 최신성 — 그건 덱 생성 파이프라인의 몫.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

const hook = readFileSync('scripts/install-git-hooks.sh', 'utf8')
  .split('\n')
  .filter((l) => !/^\s*#/.test(l))
  .join('\n')

describe('옛 소개서 자동 참조 — 커밋마다 재생성 금지', () => {
  it('① pre-commit 이 생성기를 부르지 않고 docs/proposals 를 stage 하지 않는다', () => {
    expect(hook).not.toMatch(/generate-proposal-refs/)
    expect(hook).not.toMatch(/git add[^\n]*docs\/proposals/)
    expect(hook.length, '훅 본문을 못 읽었다').toBeGreaterThan(1000)
  })

  it('② 문서마다 맨 위에 동결 표시가 있다', () => {
    const files = readdirSync('docs/proposals').filter((f) => f.endsWith('.md'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      expect(readFileSync(`docs/proposals/${f}`, 'utf8').startsWith('> 🧊 **2026-11-02 동결'), f).toBe(true)
    }
  })
})
