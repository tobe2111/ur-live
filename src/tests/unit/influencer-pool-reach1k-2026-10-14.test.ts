/**
 * 📏 인플루언서 풀 규모 필터 — `reach1k`(이웃·구독 1천+) 신설 (2026-10-14 대표 *"이웃 1000명 이상 블로거만"*).
 *
 * 종전 선택지는 1천에서 끊을 수가 없었다: 나노(1~9,999)는 1천 미만을 섞고, 마이크로(1만+)는 1천~1만을
 * 통째로 뺀다. 라이브 실측(2026-10-14) 네이버 블로그 312,159명 중 이웃 수가 채워진 219,175명,
 * 1천 이상 65,823명 — 그 집합을 고를 수단이 없었다.
 *
 * 이 시험은 **서버가 실제로 내는 WHERE 절을 소스에서 뽑아 SQLite 에 넣고** 경계값으로 판정한다
 * (문자열 존재 검사로는 `>= 1000` 을 `> 1000` 으로 바꾼 오프바이원을 못 잡는다).
 * 그리고 화면 선택지와 서버 분기가 **같은 값 집합**인지 대조한다 — 한쪽만 있으면 선택해도
 * 필터가 조용히 무시되고(서버 미지원) 에러는 0 이다.
 *
 * ⚠️ 못 보는 것: 화면에서 실제로 그 값이 요청에 실리는지(브라우저 밖) · 이웃 수 측정 자체의 정확도.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'module'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const ROUTE = 'src/features/marketing/api/admin-ads-influencers.routes.ts'
const UI = 'src/pages/admin/influencer-pool/PoolFilters.tsx'

/** 서버의 `tier === 'X'` → `where.push('...')` 쌍을 전부 뽑는다. */
function serverTiers(): Map<string, string> {
  const src = stripComments(readFileSync(ROUTE, 'utf8'))
  const out = new Map<string, string>()
  const re = /tier === '([a-z0-9]+)'\)\s*where\.push\((['"])(.+?)\2\)/g
  for (let m = re.exec(src); m; m = re.exec(src)) out.set(m[1]!, m[3]!)
  return out
}

/** 규모 select 의 option 값(빈 값 제외). */
function uiTiers(): string[] {
  const src = readFileSync(UI, 'utf8')
  const start = src.indexOf('value={p.tier}')
  const end = src.indexOf('</select>', start)
  expect(start).toBeGreaterThan(0)
  const block = src.slice(start, end)
  return [...block.matchAll(/<option value="([a-z0-9]+)"/g)].map(m => m[1]!)
}

function matching(where: string, counts: number[]): number[] {
  const db = new DatabaseSync(':memory:')
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, platform TEXT, subscriber_count INTEGER)")
  const ins = db.prepare('INSERT INTO t (platform, subscriber_count) VALUES (?, ?)')
  for (const n of counts) ins.run('naver_blog', n)
  const rows = db.prepare(`SELECT subscriber_count n FROM t WHERE ${where} ORDER BY n`).all() as Array<{ n: number }>
  return rows.map(r => r.n)
}

describe('인플루언서 풀 — 이웃·구독 1천+ 필터', () => {
  const tiers = serverTiers()

  it('서버 분기를 뽑았다 (0건이면 헛도는 시험)', () => {
    expect(tiers.size).toBeGreaterThanOrEqual(6)
  })

  it('reach1k 는 1,000 을 포함하고 999 는 뺀다', () => {
    const where = tiers.get('reach1k')
    expect(where).toBeDefined()
    expect(matching(where!, [0, 999, 1000, 1001, 9999, 10000, 733824])).toEqual([1000, 1001, 9999, 10000, 733824])
  })

  it('reach1k 는 1천~1만을 살린다 — 나노·마이크로가 못 하던 일', () => {
    const band = [1500, 5000, 9999]
    expect(matching(tiers.get('reach1k')!, band)).toEqual(band)
    expect(matching(tiers.get('micro')!, band)).toEqual([])
    expect(matching(tiers.get('nano')!, [500, ...band])).toContain(500)
  })

  it('화면 선택지와 서버 분기가 같은 값 집합이다', () => {
    const ui = uiTiers().sort()
    expect(ui).toContain('reach1k')
    expect(ui).toEqual([...tiers.keys()].sort())
  })
})
