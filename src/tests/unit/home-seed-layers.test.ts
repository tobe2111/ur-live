import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { timeoutFor } from '@/worker/utils/ssr-payload'

/**
 * 🏠 홈 시드는 **둘**이고, 둘 다 같은 대접을 받아야 한다 (2026-08-27 대표 신고
 * *"지금 인기 이용권, 숙소 카테고리 등이 안보이네"*).
 *
 * ## 무엇이 문제였나
 * 홈 한 화면이 시드 두 개로 그려진다 — 피드(`MAIN`)와 편성 섹션(`SECTIONS`).
 * 그런데 **SECTIONS 만 계층이 모자랐다**:
 *
 * | 계층 | MAIN | SECTIONS(전) |
 * |---|---|---|
 * | 콜로 엣지 캐시 | ✅ | ✅ |
 * | 전역 KV(`ssr:{path}`) | ✅ | ❌ **없음** |
 * | self-fetch 타임아웃 | — | **1500ms**(기본값) |
 *
 * 그래서 콜로가 cold 면 SECTIONS 는 곧장 self-fetch 로 떨어지고, 콜드 D1 이 1500ms 를 넘기면
 * **시드 없이** 내려간다 → 그 섹션만 스켈레톤 + 클라 왕복. 피드는 멀쩡한데 섹션만 늦는
 * 그 화면의 정체다. 그리고 **에러가 아니라 fail-soft** 라 로그에도 안 남는다.
 *
 * ⚠️ 2000ms 라는 값은 2026-06-30 에 상세/셀러/큐레이터가 **정확히 같은 증상**으로 받은 처방인데,
 *    SECTIONS 만 그 목록에서 빠져 있었다.
 *
 * ## 못 막는 것
 * 실제 콜로가 warm 인지, cron 이 실제로 KV 에 썼는지. 그건 라이브 `X-SSR-Status` 실측 몫이다.
 */

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const code = (p: string) =>
  read(p).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('홈 시드 두 개가 같은 계층을 받는다', () => {
  it('🔴 SECTIONS 도 2000ms — 1500ms 로는 콜드에서 끊겨 스켈레톤이 뜬다', () => {
    expect(timeoutFor('SECTIONS')).toBe(2000)
    // 같은 사고로 처방받은 슬롯들과 같은 값이어야 한다(한쪽만 되돌아가면 그 표면이 다시 깜빡인다).
    for (const s of ['DETAIL', 'SELLER', 'CURATOR']) expect(timeoutFor(s)).toBe(2000)
    // 기본값은 그대로 — 이 수정이 전 슬롯을 느리게 만든 게 아니라는 확인.
    expect(timeoutFor('WHATEVER')).toBe(1500)
  })

  it('🔴 SECTIONS 경로가 전역 KV 워밍 목록에 있다 (콜로가 cold 여도 시드가 온다)', () => {
    const prewarm = code('src/worker/cron/cache-prewarm.ts')
    const list = prewarm.slice(prewarm.indexOf('SSR_KV_PATHS'), prewarm.indexOf('SSR_KV_TTL_S'))
    expect(list).toContain("'/api/sections'")
    // 홈 피드도 함께 있어야 의미가 있다(둘 중 하나만 warm 이면 같은 화면에서 한쪽만 늦는다).
    expect(list).toContain('/api/group-buy/products?status=active&category=all')
  })

  it('🔴 워커가 요청하는 경로와 워밍 경로가 byte-일치한다 (캐시 키가 곧 경로다)', () => {
    const worker = code('src/worker/index.ts')
    // 워커의 보조 시드 타깃 — 한 글자만 달라도 warm 한 키를 못 읽는다.
    expect(worker).toMatch(/ssrExtra = \{ slot: 'SECTIONS', path: '\/api\/sections' \}/)
  })

  it('보조 시드는 fail-soft 다 (없어도 홈은 뜬다)', () => {
    const worker = code('src/worker/index.ts')
    expect(worker).toMatch(/if \(extra\?\.payload\) ssrExtraPayload = extra\.payload/)
  })
})
