/**
 * 🔇 2026-11-10 — 돈 관련 파일 5곳은 오류를 **소리 없이** 삼키지 않는다(대표 "다 해줘" · 품질 3번).
 *
 * `.catch(() => {})` 는 적립·알림·원장 기록이 실패해도 로그 한 줄 안 남긴다 — 커미션이 안 들어갔는데
 * 원인을 찾을 단서가 없다. 동작은 그대로 두고(여전히 다음 줄로 넘어간다) `swallow('<파일>')` 로 바꿔
 * 실패가 `[swallow:<파일>]` 로 워커 로그에 남게 했다.
 *
 * ## ⚠️ 못 보는 것
 * - 나머지 파일은 범위 밖(대부분 스키마 보정용 무시).
 * - `catch { }` 블록 형태와, 일부러 무시하는 사유 주석이 든 catch(ALTER 중복 무시)는 세지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILES = [
  'src/worker/utils/order-commissions.ts',
  'src/worker/utils/invite-reward.ts',
  'src/worker/utils/affiliate-credit.ts',
  'src/worker/utils/visit-reward.ts',
  'src/features/admin/api/admin-payout-center.routes.ts',
  // 2차(2026-11-10) — 주문·공구·추첨·분쟁·체험단·찜 알림
  'src/worker/routes/order.routes.ts',
  'src/features/group-buy/api/group-buy.routes.ts',
  'src/features/group-buy/api/fcfs.routes.ts',
  'src/worker/routes/disputes.routes.ts',
  'src/features/group-buy/api/experience-campaign.routes.ts',
  'src/worker/cron/wishlist-notify.ts',
  // 3차(2026-11-10 대표 허가 — docs/locks/toss/2026-11-10-silent-catch-to-log.md) — 결제 잠금 파일
  'src/worker/routes/payment.routes.ts',
  'src/worker/routes/webhook.routes.ts',
]

describe('돈 관련 파일 — 빈 catch 0', () => {
  for (const f of FILES) {
    it(f, () => {
      const src = readFileSync(f, 'utf8')
      expect(src.match(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/g) ?? [], '빈 catch — swallow(\'<라벨>\') 로 바꿀 것').toEqual([])
      expect(src).toMatch(/import \{[^}]*\bswallow\b[^}]*\} from /)
    })
  }
})
