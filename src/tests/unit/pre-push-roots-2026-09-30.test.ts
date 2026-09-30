/**
 * 🕸️ pre-push 그물이 **눈먼 자리 없이** 시험을 고른다 〔2026-09-30〕
 *
 * 같은 날 그물이 **두 번** 놓쳤고, 둘 다 원인이 다르다. 둘 다 여기서 고정한다.
 *   ① **뿌리가 둘인데 하나만 봤다** (아래 첫 블록)
 *   ② **트리를 훑는 시험은 검색어로 못 고른다** (아래 둘째 블록)
 * 그리고 ②를 고치다 셋째를 밟았다 — ③ **순수 모듈의 `.d.mts` 가 낡는다** (아래 셋째 블록).
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
import { globSync } from 'node:fs'
import { scansTree } from '../../../scripts/pre-push-search-terms.mjs'

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

  /**
   * 🩸 2026-09-30 재조준: 처음엔 파일 **전체**에서 뿌리 문자열을 찾았는데, 그물에 grep 이 **둘**이
   * 되면서(검색어 + 트리) 그 판정이 헛돌게 됐다 — 한쪽 grep 만 `src/tests` 로 좁혀도 다른 쪽 줄에
   * `'tests'` 가 남아 **초록**이다. ⇒ grep **호출마다** 모든 뿌리를 보는지 따로 판정한다.
   */
  it('🔴 grep 호출 **하나하나가** 모든 뿌리를 본다', () => {
    const calls = net.split('\n').filter((l) => l.includes("sh('grep'"))
    expect(calls.length, '그물에서 grep 호출을 못 찾았다 — 이 시험이 헛돈다').toBeGreaterThan(0)
    for (const call of calls) {
      for (const root of rootsFromConfig()) {
        expect(call, `이 grep 이 '${root}' 뿌리를 안 본다 — 그 아래 시험은 로컬에서 안 돈다:\n${call.trim()}`)
          .toContain(`'${root}'`)
      }
    }
  })
})

/**
 * 🌲 ② **트리를 통째로 훑는 시험** — 검색어로는 **원리상** 못 고른다.
 *
 * 🩸 새 부품 `src/components/search/SearchSuggestPanel.tsx` 에 `py-2.5` 를 썼는데,
 * `consumer-type-scale-2026-09-29.test.ts` 가 `src/components/**` 를 글롭으로 훑어 4px 격자를
 * 강제한다. 그 시험은 본문에 **내 파일 이름을 안 들고 있다** — 새 파일이면 더더욱(아직 아무도
 * 그 이름을 모른다). 로컬 초록 → 6분 뒤 CI 가 알려 줬다.
 *
 * ⚠️ 이 블록은 **문자열이 아니라 동작**을 잰다: 레포의 진짜 시험 본문을 `scansTree` 에 먹인다.
 *   그래서 패턴이 조용히 안 맞게 되면(가장 흔한 회귀) 초록이 아니라 빨간불이 난다.
 */
describe('pre-push 그물 ↔ 트리를 훑는 시험', () => {
  const testFiles = [...globSync('src/tests/unit/**/*.test.ts'), ...globSync('tests/**/*.test.{ts,tsx}')]
  const scanners = testFiles.filter((f) => scansTree(readFileSync(f, 'utf8')))

  it('🔴 레포에서 트리를 훑는 시험을 실제로 찾아낸다 (적으면 이 검사가 헛돈다)', () => {
    expect(testFiles.length, '시험 파일을 못 읽었다 — 글롭이 낡았다').toBeGreaterThan(300)
    // 실측 47개. 하한은 "패턴이 통째로 죽었는가" 만 본다 — 개수를 고정하면 시험이 매주 낡는다.
    expect(scanners.length, `트리를 훑는 시험이 ${scanners.length}개 — 패턴이 죽었다`).toBeGreaterThan(20)
  })

  it('🔴 오늘 사고를 잡은 그 시험을 고른다 (4px 격자 가드)', () => {
    const victim = 'src/tests/unit/consumer-type-scale-2026-09-29.test.ts'
    expect(scansTree(readFileSync(victim, 'utf8')), `${victim} 를 안 고른다 — 새 부품의 격자 위반이 또 CI 까지 간다`).toBe(true)
  })

  it('🔴 파일을 이름으로 읽기만 하는 시험은 안 고른다 (과선택으로 푸시가 터지지 않게)', () => {
    expect(scansTree("const s = readFileSync('src/pages/Foo.tsx', 'utf8')")).toBe(false)
  })

  it('🔴 그물이 그 패턴을 **그대로** grep 에 넘긴다 (두 벌이면 갈린다)', () => {
    expect(net, '판정 패턴이 순수 모듈에서 안 온다').toContain('TREE_SCAN_PATTERN')
    expect(net, 'grep 에 패턴을 안 넘긴다').toMatch(/grep',\s*\[[^\]]*TREE_SCAN_PATTERN/)
  })

  it('🔴 고른 것을 검색어 결과에 **합친다** (구해 놓고 안 쓰면 조용한 회귀다)', () => {
    expect(net, 'treeFiles 가 최종 목록에 안 들어간다').toMatch(/new Set\(\[\.\.\.termFiles,\s*\.\.\.treeFiles\]\)/)
  })

  it('🔴 `src/` 가 안 바뀐 푸시에는 안 돌린다 (문서만 고쳤는데 29초를 물리지 않게)', () => {
    expect(net, 'src 변경 게이트가 없다 — 문서만 바꾼 푸시도 트리 시험 47개를 돈다')
      .toMatch(/changed\.some\(\(f\) => f\.startsWith\('src\/'\)\)/)
  })
})

/**
 * 📄 ③ **순수 모듈과 그 `.d.mts` 가 갈리지 않는다.**
 *
 * 🩸 2026-09-30 에 값을 치렀다. 이 레포의 `scripts/*.mjs` 순수 모듈은 시험이 **동작을 재도록**
 * import 하는데, `allowJs` 가 꺼져 있어 손으로 쓴 `.d.mts` 가 그 계약이다. `scansTree` 를
 * 더하면서 **구현에만** 넣었더니 tsc 가 `TS2305: has no exported member` 로 커밋을 막았다.
 *
 * 🔑 헷갈리게도 **나중에 선언된 함수는 멀쩡히 잡히고 새로 더한 것만 안 잡혀서**, 한참 동안
 *   "TS 가 파일을 중간부터 못 읽나" 로 오진했다. 실제로는 TS 가 **`.mjs` 를 아예 안 읽고**
 *   낡은 `.d.mts` 만 읽고 있었다. ⇒ 두 벌이면 갈린다, 그러니 기계가 센다.
 */
describe('순수 모듈 ↔ .d.mts 계약', () => {
  const pairs = globSync('scripts/*.d.mts').map((d) => [d, d.replace(/\.d\.mts$/, '.mjs')] as const)

  it('🔴 선언·구현 쌍을 실제로 찾는다 (0쌍이면 이 검사가 헛돈다)', () => {
    expect(pairs.length, '`scripts/*.d.mts` 를 못 찾았다 — 글롭이 낡았다').toBeGreaterThan(2)
  })

  it.each(pairs)('🔴 %s 가 구현의 export 를 하나도 빠짐없이 선언한다', (decl, impl) => {
    const names = (src: string, re: RegExp) =>
      [...src.matchAll(re)].map((m) => m[1]).filter(Boolean).sort()
    const implNames = names(readFileSync(impl, 'utf8'), /^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm)
    // ⚠️ `.d.mts` 에서 `declare` 는 **선택**이다(`export function f(): void` 만으로 이미 ambient).
    //   첫 판이 `declare` 를 필수로 봐서 멀쩡한 두 파일을 위반이라고 신고했다 — 정상 코드에
    //   빨간불을 내는 가드는 결국 꺼진다(이 레포가 `check-input-text-color` 로 두 달 겪은 길).
    const declNames = names(readFileSync(decl, 'utf8'), /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)/gm)
    expect(implNames.length, `${impl} 에서 export 를 하나도 못 읽었다 — 이 검사가 헛돈다`).toBeGreaterThan(0)
    const missing = implNames.filter((n) => !declNames.includes(n))
    expect(missing, `${decl} 에 빠진 선언: ${missing.join(', ')} — 시험이 import 하는 순간 tsc 가 막는다`).toEqual([])
  })
})
