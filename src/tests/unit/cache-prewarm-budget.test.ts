/**
 * 🧮 예열 cron 서브리퀘스트 예산 (2026-08-23 — 라이브 실측)
 *
 * 무료 플랜의 서브리퀘스트 상한은 **인보케이션당 50** 이고 `fetch` 뿐 아니라 **KV·D1 도 센다**.
 * `cache-prewarm` 은 오래전부터 그 상한을 넘고 있었는데, 초과분은 `catch { dynFailed++ }` 가
 * 삼켜서 **에러 없이 조용히** 실패했다 — 그래서 몇 달간 아무도 몰랐다.
 *
 * 관측된 결과(라이브):
 *   · `CACHE_KV`(ur-cashe) 의 `ssr:` 키 **0개** — 2026-07-12 전역 워밍이 한 번도 기록된 적 없다.
 *   · 그런데 읽기 쪽은 살아 있어 `/vouchers` `kv;dur=128ms` · `/browse` `kv;dur=145ms` 를
 *     **100% miss 로 지불**한다(대체하려던 self-fetch 는 25~30ms 다).
 *
 * 이 테스트가 **못 막는 것**: 실제 런타임 서브리퀘스트 수. Workers 런타임 밖이라 셀 수 없다.
 *   여기서 고정하는 것은 "우리가 계획한 요청 수"뿐이다. 상한 자체가 바뀌면(유료 전환) 여기 수정.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { rotateForBudget, DYNAMIC_PREWARM_BUDGET } from '@/worker/cron/cache-prewarm'

const SRC = 'src/worker/cron/cache-prewarm.ts'
const src = readFileSync(SRC, 'utf-8')

/** 배열 리터럴에서 문자열 항목만 뽑는다(주석 줄은 `'` 로 시작하지 않아 자연히 빠진다). */
function items(name: string): string[] {
  // ⚠️ 종결 패턴을 `];` 로만 잡으면 **다음 배열까지 삼킨다** — HOT_PATHS 는 `] as const;` 로 끝나서
  //    실제로 SSR_KV_PATHS 4개가 딸려 들어왔다(개수 22 → 26). 둘 다 받아 준다.
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\s*\\](?: as const)?;`))
  if (!m) throw new Error(`${name} 배열을 못 찾았다 — 이름이 바뀌었으면 이 테스트도 고쳐라`)
  return [...m[1].matchAll(/^\s*'([^']+)',/gm)].map((x) => x[1])
}

describe('예열 cron 이 서브리퀘스트 예산 안에 있다', () => {
  it('HOT_PATHS 에 중복 URL 이 없다 (같은 URL 두 번 = 예산만 낭비)', () => {
    const hot = items('HOT_PATHS')
    const dup = hot.filter((v, i) => hot.indexOf(v) !== i)
    expect(dup, `중복 예열 URL: ${dup.join(', ')}`).toEqual([])
  })

  it('한 회차 계획 요청 수가 무료 상한(50)을 넘지 않는다', () => {
    const hot = items('HOT_PATHS').length
    const kvKeys = items('SSR_KV_PATHS').length      // KV put — 이것도 서브리퀘스트다
    const ws = items('WS_PREWARM_PATHS').length
    const normalizeD1 = 3                             // supply-visibility UPDATE 2 + pragma 1
    const dynamicD1 = 3                               // 셀러/큐레이터/상품 조회
    const total = normalizeD1 + hot + kvKeys + ws + dynamicD1 + DYNAMIC_PREWARM_BUDGET
    expect(total, `계획 ${total}건 — 상한 50 을 넘으면 뒤쪽이 조용히 실패한다`).toBeLessThanOrEqual(50)
  })

  it('SSR 전역 워밍 키는 전부 HOT_PATHS 안에 있다 (byte 일치 — 아니면 영영 안 써진다)', () => {
    const hot = new Set(items('HOT_PATHS'))
    for (const k of items('SSR_KV_PATHS')) {
      expect(hot.has(k), `SSR_KV_PATHS 의 "${k}" 가 HOT_PATHS 에 없다 → put 자체가 실행되지 않는다`).toBe(true)
    }
  })
})

describe('회전 창 — 잘라내지 않고 돌린다', () => {
  const paths = Array.from({ length: 40 }, (_, i) => `/p${i}`)

  it('예산보다 많으면 예산만큼만 준다', () => {
    expect(rotateForBudget(paths, 0)).toHaveLength(DYNAMIC_PREWARM_BUDGET)
  })

  it('예산 이하면 그대로 준다', () => {
    const few = paths.slice(0, 5)
    expect(rotateForBudget(few, 37)).toEqual(few)
  })

  it('회차마다 다른 구간을 준다 — 뒷부분이 영영 안 데워지면 안 된다', () => {
    const a = rotateForBudget(paths, 0)
    const b = rotateForBudget(paths, 5)
    expect(a).not.toEqual(b)
    // 한 시간(12슬롯)이면 전체를 덮는다.
    const covered = new Set<string>()
    for (let m = 0; m < 60; m += 5) for (const p of rotateForBudget(paths, m)) covered.add(p)
    expect(covered.size, '한 시간을 돌아도 안 닿는 경로가 있다').toBe(paths.length)
  })

  it('분이 이상해도 죽지 않는다 (0..59 밖)', () => {
    expect(() => rotateForBudget(paths, -1)).not.toThrow()
    expect(rotateForBudget(paths, 999)).toHaveLength(DYNAMIC_PREWARM_BUDGET)
  })
})
