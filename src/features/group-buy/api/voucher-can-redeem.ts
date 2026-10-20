/**
 * 🏪 이 화면을 연 사람이 **이 매장에서 이용권을 사용 처리할 수 있는가** (2026-10-08 대표 시안 확정).
 *
 * `/v/:code` 인증 화면이 다른 매장 사장님에게 처리 버튼을 보여 줬다가 누르면 403 이 나던 것을,
 * 처음부터 "다른 매장의 이용권" 안내로 바꾸려는 신호다.
 *
 * ⚠️ **표시용 판정일 뿐 권한이 아니다** — 실제 처리는 use-by-seller 가 똑같은 조건으로 다시 검사한다.
 *   그래서 판정도 use-by-seller 와 **같은 미들웨어**(scanOrSellerAuth)로 한다. 둘이 갈리면 화면이 거짓말을 한다.
 *   인증이 없거나 실패하면 false(공개 엔드포인트에서 부른다).
 *
 * 🏷️ 2026-10-18 브랜드 전 지점 사용 — 실제 처리(`voucher-seller-redeem`)가 같은 주인 형제 지점도 받으므로
 *   여기도 같은 함수(`canStoreRedeemProduct`)로 판정한다. 안 맞추면 형제 지점 사장님에게 "다른 매장의 이용권" 이
 *   떠서 처리할 수 있는데도 버튼이 사라진다. 이용권은 이 라우트의 `:code` 로 찾는다(잠금 파일 호출부 무수정).
 */
import type { Context } from 'hono'
import { getCurrentUser } from '@/worker/middleware/auth'
import { scanOrSellerAuth } from '../../seller/api/seller-scan-devices.routes'
import { canStoreRedeemProduct } from '@/worker/utils/brand-wide-redeem'

export async function voucherCanRedeem(c: Context, productSellerId: number | null | undefined): Promise<boolean> {
  if (!c.req.header('Authorization') && !c.req.header('X-Scan-Device-Key')) return false
  try {
    await scanOrSellerAuth()(c as never, async () => {})
    const u = getCurrentUser(c)
    if (!u) return false
    if (u.type === 'admin') return true
    if (u.type !== 'seller' || productSellerId == null) return false
    if (Number(productSellerId) === Number(u.id)) return true
    const code = c.req.param('code')
    const DB = (c.env as { DB?: D1Database } | undefined)?.DB
    if (!code || !DB) return false
    const v = await DB.prepare('SELECT id, product_id FROM vouchers WHERE code = ? LIMIT 1')
      .bind(code).first<{ id: number; product_id: number }>().catch(() => null)
    // 이용권 id 까지 넘긴다 — 3단계(다른 점주 지점)는 이용권마다 판매 비용을 봐야 해서, 없으면 처리 경로와 갈린다.
    return !!v && await canStoreRedeemProduct(DB, Number(v.product_id), Number(productSellerId), Number(u.id), Number(v.id))
  } catch { return false }
}
