/**
 * 🗄️🔦 2026-11-02 (대표 — *"왜 망가지는거야? 안망가지게 할 수 없어?"*)
 *
 * 검색이 고칠 때마다 망가진 **공통 원인**은 둘이었다:
 *   ① 코드는 레포의 표 정의를 믿는데, 레포엔 같은 표의 정의가 여러 벌이고 라이브는 그중 하나다.
 *      컬럼 가드는 여러 벌을 **합쳐** 봤으니 틀린 쪽으로 쓴 코드도 통과했다(search_logs 0행 · 2026-09 `rating`).
 *   ② 망가져도 **조용했다** — 랭킹 검색이 죽으면 옛 검색으로 내려가며 경고 한 줄만 남겼다(4주).
 *
 * 처방과 이 시험이 지키는 것:
 *   ① 라이브 사진 `src/shared/db/live-schema.snapshot.json` 을 기준으로 —
 *      (a) 검색이 읽는 products 컬럼이 **라이브에 실제로 있다**
 *      (b) 컬럼 가드가 사진을 **실제로 쓴다**(꺼지면 search_logs 같은 사고가 다시 통과한다)
 *   ② 내려간 사실이 응답(`search_mode`)까지 **이어져 있다** — 배포 직후 점검(check-live-search)이 그걸 본다.
 *
 * ⚠️ 못 보는 것: 사진이 **낡은** 경우(라이브에 새 컬럼을 넣고 사진을 다시 안 찍으면 그 컬럼을 쓰는
 *   코드가 걸린다 — 그건 의도다: 사람이 라이브 반영을 한 번 확인하게 만든다) · 라이브 사이트의 실제 결과
 *   (그건 `scripts/check-live-search.mjs` 가 배포 직후에 본다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { SEARCH_COLUMNS } from '@/features/products/repositories/search-query'

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf-8')
const snap = JSON.parse(read('src/shared/db/live-schema.snapshot.json')) as { tables: Record<string, string> }
const live = (t: string) => new Set(String(snap.tables[t] || '').split(',').filter(Boolean))

describe('① 라이브 사진 기준', () => {
  it('사진이 비어 있지 않다 (비면 통과가 아니라 고장)', () => {
    expect(Object.keys(snap.tables).length).toBeGreaterThan(100)
    expect(live('products').size).toBeGreaterThan(60)
  })

  it('검색 대상 컬럼이 전부 라이브 products 에 있다', () => {
    const have = live('products')
    for (const col of SEARCH_COLUMNS) expect(have.has(col), `products.${col} 가 라이브에 없다`).toBe(true)
  })

  it('랭킹 검색 SQL 이 부르는 p.<컬럼> 이 전부 라이브에 있다 (2026-09 `rating` 클래스)', () => {
    const repo = read('src/features/products/repositories/ProductRepository.ts')
    const at = repo.indexOf('async searchByText(')
    const body = repo.slice(at, repo.indexOf('falling back to findAll', at))
    const cols = [...new Set([...body.matchAll(/\bp\.([a-z_][a-z_0-9]*)/g)].map(m => m[1]))]
    expect(cols.length).toBeGreaterThan(3)
    const have = live('products')
    for (const c of cols) expect(have.has(c), `p.${c} 가 라이브 products 에 없다`).toBe(true)
  })

  it('검색 기록 표는 라이브에서 query·result_count 다', () => {
    expect([...live('search_logs')]).toEqual(expect.arrayContaining(['query', 'result_count']))
  })

  it('🔴 컬럼 가드가 사진을 실제로 쓴다', () => {
    const out = execFileSync('node', ['scripts/check-sql-column-exists.mjs', '-s'], { cwd: ROOT, encoding: 'utf-8' })
    const n = Number(out.match(/live-tables=(\d+)/)?.[1] ?? 0)
    expect(n, '가드가 라이브 사진을 안 읽었다 — search_logs 같은 사고가 다시 통과한다').toBeGreaterThan(100)
  }, 60_000)
})

describe('② 옛 검색으로 내려간 사실이 응답까지 이어진다', () => {
  it('리포지토리가 성공/실패를 기록한다', () => {
    const repo = read('src/features/products/repositories/ProductRepository.ts')
    expect(repo).toContain("this.lastSearchMode = 'ranked'")
    expect(repo).toContain("this.lastSearchMode = 'fallback'")
  })
  it('서비스가 넘기고 라우트가 `search_mode` 로 싣는다', () => {
    expect(read('src/features/products/services/ProductService.ts')).toContain('searchMode: this.repository.lastSearchMode')
    expect(read('src/features/products/api/products.routes.ts')).toContain('...(result.searchMode ? { search_mode: result.searchMode } : {})')
  })
  it('배포 직후 점검이 search_mode 를 본다', () => {
    expect(read('scripts/check-live-search.mjs')).toContain("r.body?.search_mode !== 'ranked'")
    expect(read('.github/workflows/main.yml')).toContain('node scripts/check-live-search.mjs')
  })
})
