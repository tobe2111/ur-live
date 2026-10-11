/**
 * 🔁 예열 주소 = 화면이 실제로 부르는 주소 (2026-10-11 — 대표 "다 해줘")
 *
 * 캐시 키가 곧 주소다. 예열이 화면과 **글자 하나만** 달라도 데운 것을 아무도 못 쓴다 — 그리고 에러가 없다.
 * 실제로 2026-09-03 에 홈 피드가 정렬을 서버로 넘기면서(`&sort=popular`) 칩 4종 예열(정렬 없는 주소)이
 * 그날부터 헛돌았다. 홈 피드 기본 요청(`category=all&sort=popular`)은 아예 예열 밖이었다.
 *
 * 이 시험이 **못 보는 것**: 다른 화면(지도·유어샵)의 요청 주소 · 위치를 켠 사람의 near 요청(사람마다 달라 예열 불가).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEAL_CAT_LABELS } from '@/shared/deal-cats'
import { stripComments } from '../helpers/source-text'

const prewarm = readFileSync('src/worker/cron/cache-prewarm.ts', 'utf-8')
const hot = prewarm.slice(prewarm.indexOf('const HOT_PATHS'), prewarm.indexOf('] as const;'))
const feed = stripComments(readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf-8'))

describe('홈 피드 예열', () => {
  it('피드의 기본 정렬이 인기순이고, 그 정렬을 주소에 싣는다 (예열 주소의 전제)', () => {
    expect(feed).toMatch(/useState<SortKey>\('popular'\)/)
    expect(feed).toMatch(/\/api\/group-buy\/products\?status=active&category=\$\{category\}\$\{feedParams\}/)
    expect(feed).toMatch(/serverSort \? `&sort=\$\{serverSort\}` : ''/)
  })

  it('🔴 칩마다 화면이 부르는 첫 주소가 예열 목록에 그대로 있다 (전체 포함)', () => {
    expect(DEAL_CAT_LABELS.length).toBeGreaterThanOrEqual(5)
    for (const { key } of DEAL_CAT_LABELS) {
      const url = `/api/group-buy/products?status=active&category=${key}&sort=popular`
      expect(hot, `${url} 가 예열 밖이다 — 그 칩을 누른 첫 사람이 콜드 D1 을 기다린다`).toContain(`'${url}'`)
    }
  })

  it('아무도 안 부르는 옛 주소를 다시 데우지 않는다', () => {
    for (const k of ['meal_voucher', 'stay_voucher', 'beauty_voucher', 'etc_voucher']) {
      expect(hot).not.toContain(`'/api/group-buy/products?status=active&category=${k}',`)
    }
    expect(hot).not.toContain("'/api/home/categories'")
  })
})
