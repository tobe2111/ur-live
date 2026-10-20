/**
 * 🚨 **매장 제보(신고)** 엔드포인트 — 소비자·사장님이 "이 매장 이상합니다" 를 알리는 창구.
 *
 * 설계 배경과 "안 하는 것" 은 `@/worker/utils/store-reports` 머리말에 있다. 요약:
 * 되찾기(`/store/find`)는 **사장님이 스스로 등록을 시도할 때만** 만나지고, 소비자 상세엔
 * 신고 입구가 **0개**였다. 그 구멍만 막는다 — **판매 중지도 환불도 여기서 하지 않는다**
 * (환불은 머니 경로 등급 C, 자동 판매중지는 악성 제보 한 건에 매장이 마비된다).
 *
 * ## 🔓 로그인을 요구하지 않는다
 * 사장님은 대개 유어딜 계정이 없다. 계정을 요구하면 이 창구는 있으나 마나다.
 * 대신 **연락처 필수** + 레이트리밋 + 같은 사람의 열린 제보 1장(부분 UNIQUE)으로 도배를 막는다.
 *
 * ## 🛣️ 경로를 `/stores/:id/...` 밑에 두지 않은 이유
 * `seller-store-claims` 와 같다 — `/stores/reports` 가 `/stores/:id/...` 에 **id='reports'** 로
 * 먹혀 조용히 가려진다. 그래서 별도 네임스페이스(`/store-reports`).
 */
import type { Context, Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { submitStoreReport, STORE_REPORT_REASONS } from '@/worker/utils/store-reports'

type Ctx = Context<{ Bindings: Env }>

export function registerStoreReportRoutes(
  app: Hono<{ Bindings: Env }>,
  resolveActorUserId: (c: Ctx) => Promise<number | null>,
) {
  /**
   * POST /store-reports — 제보 접수.
   *
   * 로그인했으면 그 신원으로, 아니면 연락처로 사람을 가른다(`reporter_key`).
   * 사유가 "내 가게인데 내가 안 올림" 이면 응답에 되찾기 경로를 실어 보낸다 —
   * 제보만 하고 끝내면 사장님이 주인 자리를 되찾는 길을 모른 채 기다리게 된다.
   */
  app.post('/store-reports', rateLimit({ action: 'store_report_submit', max: 5, windowSec: 600 }), async (c: Ctx) => {
    try {
      const body = await c.req.json().catch(() => ({})) as {
        seller_id?: number; product_id?: number; contact?: string; reason?: string; detail?: string
      }
      // 로그인은 선택 — 실패해도 익명으로 받는다.
      const userId = await resolveActorUserId(c).catch(() => null)

      const r = await submitStoreReport(c.env.DB, {
        sellerId: Number(body.seller_id),
        productId: body.product_id != null ? Number(body.product_id) : null,
        userId,
        contact: String(body.contact || ''),
        reason: String(body.reason || ''),
        detail: String(body.detail || ''),
      })

      if (!r.ok) return c.json({ success: false, error: r.error, code: r.code }, 400)
      return c.json({
        success: true,
        data: { report_id: r.reportId ?? null, claim_path: r.claimPath ?? null, duplicate: r.code === 'DUPLICATE' },
      })
    } catch (err) {
      return safeError(c, err, '제보 접수 중 오류가 발생했습니다', '[store-reports]')
    }
  })

  /** GET /store-reports/reasons — 화면이 사유 목록을 서버와 같은 곳에서 읽는다(두 벌이 갈리지 않게). */
  app.get('/store-reports/reasons', (c: Ctx) =>
    c.json({ success: true, data: { reasons: STORE_REPORT_REASONS } }))
}
