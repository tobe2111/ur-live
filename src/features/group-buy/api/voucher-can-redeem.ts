/**
 * 🏪 이 화면을 연 사람이 **이 매장에서 이용권을 사용 처리할 수 있는가** (2026-10-08 대표 시안 확정).
 *
 * `/v/:code` 인증 화면이 다른 매장 사장님에게 처리 버튼을 보여 줬다가 누르면 403 이 나던 것을,
 * 처음부터 "다른 매장의 이용권" 안내로 바꾸려는 신호다.
 *
 * ⚠️ **표시용 판정일 뿐 권한이 아니다** — 실제 처리는 use-by-seller 가 똑같은 조건으로 다시 검사한다.
 *   그래서 판정도 use-by-seller 와 **같은 미들웨어**(scanOrSellerAuth)로 한다. 둘이 갈리면 화면이 거짓말을 한다.
 *   인증이 없거나 실패하면 false(공개 엔드포인트에서 부른다).
 */
import type { Context } from 'hono'
import { getCurrentUser } from '@/worker/middleware/auth'
import { scanOrSellerAuth } from '../../seller/api/seller-scan-devices.routes'

export async function voucherCanRedeem(c: Context, productSellerId: number | null | undefined): Promise<boolean> {
  if (!c.req.header('Authorization') && !c.req.header('X-Scan-Device-Key')) return false
  try {
    await scanOrSellerAuth()(c as never, async () => {})
    const u = getCurrentUser(c)
    return !!u && (u.type === 'admin' || (u.type === 'seller' && productSellerId != null && Number(productSellerId) === Number(u.id)))
  } catch { return false }
}
