/**
 * 🗑️ 2026-11-18 셀러 등급제 철거 — 대표 "셀러 등급제는 아예 없애줘".
 *
 * 왜: 등급 자동 평가(cron)가 매주 활성 셀러 `sellers.commission_rate` 를 등급표 값(5%)으로 덮어써서, 어드민이 셀러별로
 *   바꾼 수수료가 다음 월요일에 되돌아갔다. 어드민 "전체 셀러 등급 재계산"(`POST /api/seller-tiers/recalculate`)은
 *   옛 표(12/10/8%)로 다시 덮어썼다. 등급은 숙소 등록 한도·소개 할인 제한·배지 말고는 하는 일이 없었다.
 *
 * 지키는 것:
 *  1. 등급 코드(cron · 한도 유틸 · 공개 라우트 · 화면 · 배지)가 다시 생기지 않는다.
 *  2. 예약 작업이 더는 등급을 평가하지 않는다.
 *  3. **`sellers.commission_rate` 를 쓰는 코드는 어드민 셀러 수수료 설정 한 곳뿐이다**(새 덮어쓰기 경로가 생기면 빨강).
 *  4. 옛 링크 `/seller/tier` 는 셀러 홈 문으로 간다(404 아님).
 *  5. 호출자 0 인 `/api/home/bundle` 은 예열하지 않는다(같은 날 [UNLOCK_LOADING]).
 * 못 막는 것: DB 의 옛 표·칸(`seller_tiers` · `seller_tier_history` · `sellers.tier`) — 회계 이력이라 지우지 않았다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { execSync } from 'node:child_process'

const R = (p: string) => fs.readFileSync(p, 'utf8')

describe('셀러 등급제 철거', () => {
  it('등급 코드 파일이 없다', () => {
    for (const f of ['src/worker/cron/seller-tier-eval.ts', 'src/worker/utils/seller-tier-limits.ts',
      'src/features/seller-tiers/api/seller-tiers.routes.ts', 'src/pages/SellerTierPage.tsx', 'src/components/seller/TierBadge.tsx']) {
      expect(fs.existsSync(f), f).toBe(false)
    }
    expect(R('src/worker/index.ts')).not.toMatch(/sellerTiersRoutes|'\/api\/seller-tiers'/)
    expect(R('src/features/seller/api/seller-management.routes.ts')).not.toMatch(/sellerManagementRoutes\.get\('\/tier'/)
  })

  it('예약 작업이 등급을 평가하지 않는다', () => {
    expect(R('src/worker/scheduled.ts')).not.toMatch(/handleSellerTierEval|seller-tier-eval'/)
  })

  it('sellers.commission_rate 를 쓰는 곳은 어드민 수수료 설정 한 곳뿐', () => {
    const out = execSync(
      `grep -rnE "UPDATE sellers[^;]*\\bcommission_rate\\s*=" src --include=*.ts --exclude-dir=tests || true`,
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean).filter((l) => !/donation_commission_rate/.test(l))
    expect(out.map((l) => l.split(':')[0])).toEqual(['src/features/admin/api/admin-sellers.routes.ts'])
  })

  it('옛 링크 /seller/tier 는 셀러 홈 문으로', () => {
    expect(R('src/routes/seller.routes.tsx')).toMatch(/<Route path="\/seller\/tier" element=\{<SellerHomeGone \/>\} \/>/)
  })

  it('/api/home/bundle 은 예열하지 않는다(화면 호출자 0)', () => {
    const src = R('src/worker/cron/cache-prewarm.ts')
    const list = /const HOT_PATHS: readonly string\[\] = \[([\s\S]*?)\n\]/.exec(src)![1]
    expect(list.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')).not.toMatch(/'\/api\/home\/bundle'/)
  })
})
