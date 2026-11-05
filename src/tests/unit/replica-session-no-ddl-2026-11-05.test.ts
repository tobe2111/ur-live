/**
 * 🌏 2026-11-05 — 읽기 사본 세션 안에서 **정상 경로에 쓰기를 보내지 않는다**.
 *   라이브 표본(한국 HKG 콜로 → `primary:ENAM`)을 판정하다 찾았다: 홈 섹션이 사본 세션으로 부르는
 *   `listActiveBanners` 가 isolate 마다 `ALTER TABLE` 2번을 무조건 보냈다. 쓰기는 사본이 못 받아 미국 원본까지 가고
 *   (한국에서 왕복 ≈0.2초 × 2), 같은 세션의 뒤 읽기까지 원본으로 끌려갈 수 있다.
 *   ⇒ 칸이 있는지 **읽기(LIMIT 0)** 로 먼저 보고, 없을 때만 ALTER 한다.
 *
 * ⚠️ 못 보는 것: 실제 D1 세션이 쓰기 뒤 읽기를 어디로 보내는지(라이브 `X-D1-Served` 로만 판정).
 */
import { describe, it, expect } from 'vitest'
import { ensureBannerColumns } from '@/features/banners/api/banners.routes'

function fakeDb(probeOk: boolean) {
  const sent: string[] = []
  const db = {
    prepare(sql: string) {
      const st = {
        bind: () => st,
        all: async () => { sent.push(sql); if (/LIMIT 0/.test(sql) && !probeOk) throw new Error('no such column'); return { results: [] } },
        run: async () => { sent.push(sql); return { meta: {} } },
        first: async () => { sent.push(sql); return null },
      }
      return st
    },
  } as unknown as D1Database
  return { db, sent }
}

describe('배너 칸 보장 — 정상 경로는 읽기만', () => {
  it('칸이 이미 있으면 ALTER 를 하나도 안 보낸다', async () => {
    const { db, sent } = fakeDb(true)
    await ensureBannerColumns(db)
    expect(sent.some((q) => /ALTER\s+TABLE/i.test(q)), '쓰기는 사본이 못 받아 미국 원본까지 간다').toBe(false)
    expect(sent.length).toBe(1)
  })
  it('칸이 없으면(옛 스키마) 종전대로 ALTER 로 만든다', async () => {
    const { db, sent } = fakeDb(false)
    await ensureBannerColumns(db)
    expect(sent.filter((q) => /ALTER\s+TABLE banners ADD COLUMN/.test(q))).toHaveLength(2)
  })
  it('isolate 당 한 번만 확인한다(메모)', async () => {
    const { db, sent } = fakeDb(true)
    await ensureBannerColumns(db); await ensureBannerColumns(db)
    expect(sent.length).toBe(1)
  })
})
