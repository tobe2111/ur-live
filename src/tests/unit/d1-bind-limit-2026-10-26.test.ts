/**
 * 🔢 **D1 바인딩 한도(100) 가드** — 2026-10-26 라이브 실측 사고에서 나왔다.
 *
 * ## 무슨 일이 있었나
 *
 * PR #2013(내보낸 리드 도장)이 머지·배포됐는데 **라이브에서 도장이 한 건도 안 찍혔다**:
 * 업체 CSV 를 두 번 받으니 **상호 교집합 486/486 = 같은 500행**이 다시 나왔고
 * D1 의 `exported_at IS NOT NULL` 은 **0** 이었다. 파일 끝 안내는 `이 묶음 0건에 …` 이라
 * 정상처럼 읽혔다.
 *
 * 원인은 한 줄이었다 — `stampExported` 가 청크당 **id 100개 + 도장 1 = 바인딩 101개**를 보냈다.
 * 라이브 D1 실측:
 *
 * ```
 * 바인딩  99개 → OK      100개 → OK      101개 → ERR 7500 too many SQL variables
 * ```
 *
 * 🩸 **왜 기존 시험이 통과했나**: `pool-export-batch-2026-10-25.test.ts` 는 *진짜 SQLite*
 * (`node:sqlite`)로 돌아 "동작 판정" 을 한다. 그런데 **그쪽 한도는 32,766** 이라 101개든
 * 500개든 멀쩡히 통과한다. 즉 *진짜 DB 로 쟀는데도* D1 전용 제약이 보이지 않았다.
 * ⇒ 이 파일은 **D1 의 한도를 흉내 내는 가짜 D1** 로 같은 함수를 돌린다. 그게 유일하게
 *    이 클래스를 레포 안에서 잡는 방법이다.
 *
 * ## ⚠️ 이 가드가 못 보는 것
 * - SQL 길이 한도·행 크기 한도(바인딩 개수만 본다).
 * - `chunkForBinds` 를 **안 거치는** 새 코드. 그건 ④ 배선 검사가 *알려진 자리*만 고정한다 —
 *   전수로는 못 막는다(가변 길이 배열인지 정적으로 알 수 없다).
 * - `d1-backup.ts` 의 rowid 폴백(`rowid IN (500개)` — 바인딩 500, **항상 실패**)과
 *   `store-brands`·`seller-meta`·`reconciliation` 의 상한 없는 `IN` 목록.
 *   전부 같은 클래스지만 각자 측정이 필요해 이번 범위 밖이다(인계에 근거와 함께 적어 뒀다).
 */
import { describe, it, expect } from 'vitest'
import { D1_MAX_BINDS, chunkForBinds } from '../../shared/db/d1-binds'
import { stampExported, EXPORT_BATCH_ROWS } from '../../features/marketing/api/pool-export-batch'
import { readCode } from '../helpers/source-text'

/** 라이브 D1 과 같은 제약: 바인딩이 한도를 넘으면 **문장 전체가 실패**한다. */
function fakeD1(limit = D1_MAX_BINDS) {
  const stamped = new Set<number>()
  const seen: number[] = [] // 문장마다 보낸 바인딩 수 — 넘긴 적이 있는지 재려고 기록한다
  let rejected = 0
  const api = {
    prepare(sql: string) {
      const mk = (binds: unknown[]) => ({
        run: async () => {
          seen.push(binds.length)
          if (binds.length > limit) { rejected++; throw new Error(`too many SQL variables: ${binds.length}`) }
          if (!/^UPDATE/i.test(sql.trim())) return { meta: { changes: 0 } }
          let changes = 0
          for (const b of binds.slice(1)) { const n = Number(b); if (!stamped.has(n)) { stamped.add(n); changes++ } }
          return { meta: { changes } }
        },
        all: async () => ({ results: [] }),
        first: async () => null,
      })
      return { bind: (...b: unknown[]) => mk(b), ...mk([]) }
    },
  }
  return { DB: api as never, stamped, seen, get rejected() { return rejected } }
}

describe('🔢 D1 바인딩 한도 — 순수 규칙', () => {
  it('① 한도는 100 (라이브 실측: 100 OK · 101 ERR) — 올리면 전 묶음이 조용히 실패한다', () => {
    expect(D1_MAX_BINDS).toBe(100)
  })

  it('② extraBinds 를 뺀 크기로 쪼갠다 — 어떤 묶음도 한도를 넘지 않는다', () => {
    for (const extra of [0, 1, 2, 5, 99]) {
      const chunks = chunkForBinds(Array.from({ length: 1000 }, (_, i) => i + 1), extra)
      expect(chunks.flat()).toHaveLength(1000)                       // 한 건도 안 빠진다
      for (const c of chunks) expect(c.length + extra).toBeLessThanOrEqual(D1_MAX_BINDS)
      expect(chunks[0].length).toBe(D1_MAX_BINDS - extra)            // 꽉 채워 보낸다(왕복 낭비 0)
    }
  })

  it('③ 쪼갤 수 없는 요청은 **던진다** — 조용히 1개씩 보내면 더 나쁜 사고다', () => {
    expect(() => chunkForBinds([1, 2], D1_MAX_BINDS)).toThrow()
    expect(chunkForBinds([], 1)).toEqual([])                         // 빈 입력은 빈 결과(루프 0회)
  })
})

describe('🔢 도장 — D1 한도를 흉내 낸 가짜 DB 로 동작 판정', () => {
  it('④ 🩸 묶음 한 번(500행)이 **전부** 찍힌다 — 2026-10-26 라이브에선 0건이었다', async () => {
    const d = fakeD1()
    const ids = Array.from({ length: EXPORT_BATCH_ROWS }, (_, i) => i + 1)
    const n = await stampExported(d.DB, 'company', ids, '2026-10-26 04:00:00')
    expect(n).toBe(EXPORT_BATCH_ROWS)        // ← 101개를 보내면 여기가 0 이 된다
    expect(d.rejected).toBe(0)               // ← 한 문장도 거부당하지 않았다
    expect(Math.max(...d.seen)).toBeLessThanOrEqual(D1_MAX_BINDS)
  })

  it('⑤ 한도가 더 낮은 DB 면 **거부가 보이고 0 이 나온다** — 가짜 DB 가 헛돌지 않는다는 증거', async () => {
    // 이 단언이 없으면 ④가 "가짜 DB 가 아무것도 안 막는다" 와 구분되지 않는다.
    const d = fakeD1(10)
    const n = await stampExported(d.DB, 'company', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], '2026-10-26 04:00:00')
    expect(d.rejected).toBeGreaterThan(0)
    expect(n).toBe(0)
  })

  it('⑥ 이미 찍힌 행은 두 번 세지 않는다 (한도 수리가 멱등을 깨지 않았다)', async () => {
    const d = fakeD1()
    const ids = Array.from({ length: 250 }, (_, i) => i + 1)
    expect(await stampExported(d.DB, 'company', ids, 'a')).toBe(250)
    expect(await stampExported(d.DB, 'company', ids, 'b')).toBe(0)
  })
})

describe('🔢 배선 — 알려진 자리가 SSOT 를 거친다', () => {
  const srcs: [string, number][] = [
    ['src/features/marketing/api/pool-export-batch.ts', 1],   // SET exported_at = ?
    ['src/worker/cron/seller-daily-report.ts', 2],            // 기간 두 개(start·end)
  ]

  it('⑦ 손으로 `i += 100` 을 쓰지 않는다 — extraBinds 를 세는 자리가 한 곳이어야 한다', () => {
    for (const [f, extra] of srcs) {
      const s = readCode(f)
      expect(s, f).toMatch(new RegExp(`chunkForBinds\\([^)]*,\\s*${extra}\\)`))
      // 종전 모양이 되살아나면 바인딩이 다시 넘친다.
      expect(s, f).not.toMatch(/i \+= 100|slice\(i, i \+ 100\)/)
    }
  })

  it('⑧ 한도 숫자는 SSOT 에만 있다 — 두 벌이면 한쪽만 고쳐진다', () => {
    expect(readCode('src/shared/db/d1-binds.ts')).toMatch(/D1_MAX_BINDS = 100/)
    // 호출부는 한도를 모른 채 `extraBinds` 만 넘긴다.
    for (const [f] of srcs) expect(readCode(f), f).not.toMatch(/D1_MAX_BINDS\s*=|=\s*100\s*-/)
  })

  it('⑨ 실패를 **조용히** 삼키지 않는다 — 이 사고가 하루 동안 안 보인 진짜 이유다', () => {
    const s = readCode('src/features/marketing/api/pool-export-batch.ts')
    // `.catch(() => null)` 로 돌아가면 도장 0 이 고장인지 정상인지 구분이 영원히 불가능하다.
    expect(s).toMatch(/console\.error\([^)]*pool-export/)
    expect(s).not.toMatch(/\.run\(\)\.catch\(\(\) => null\)/)
  })

  it('⑩ 도장이 통째로 실패하면 **파일에 적는다** — 받는 사람이 반복 다운로드를 멈출 수 있게', () => {
    const s = readCode('src/features/marketing/api/pool-export-batch.ts')
    // 계산만 하고 안 쓰는 것을 막는다 — 안내 선택이 `stamped` 로 갈리는 모양까지 본다.
    expect(s).toMatch(/stamped \? \[exportBatchNote[\s\S]{0,160}exportStampFailedNote/)
    expect(readCode('src/features/marketing/api/influencer-pool-export.ts')).toMatch(/exportStampFailedNote\(rows\.length\)/)
  })
})
