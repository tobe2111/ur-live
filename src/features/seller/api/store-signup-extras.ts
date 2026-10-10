/**
 * 🏪 `/store/new` 가입의 **두 빈칸** — 2026-10-10 대표 *"1,2,5번은 해주고"* (가입 흐름 정리).
 *
 * `POST /api/seller/stores` 가 이제 **유일한 가입 문**이다(옛 `/seller/register/supplier` 는 이리로
 * 리다이렉트). 그 문이 옛 문이 하던 일 둘을 안 하고 있었다 — 여기서 메운다(`seller-stores.routes.ts`
 * 는 600줄 래칫에 닿아 있어 이 파일로 뺐다. 형제 `seller-store-claims.routes.ts` 와 같은 방식).
 *
 * ① **판매자 이용약관 동의**(법적 공백). 옛 문은 동의 없으면 400 이었고(`seller-registration.routes.ts`),
 *    새 문은 약관 코드가 0건이었다. 같은 검증·같은 기록 함수(`terms-consent.ts`)를 쓴다 — 두 벌이면 갈린다.
 * ② **영입자 사전등록(prospect) 귀속**. 옛 문은 가입 순간 담당자 전화·이메일로 `seller_prospects` 를
 *    찾아 영입자에게 귀속했다(`matchProspectOnSignup`). 문을 하나로 합치면서 이걸 빠뜨리면 영입자가
 *    데려온 매장이 **조용히 귀속을 잃는다**(에러 없음). 귀속 규칙은 옛 문과 **byte-동일**하게 옮긴다 —
 *    새 규칙을 만드는 게 아니다(커미션 규칙 변경은 결재 사안).
 *    ⚠️ 초대 링크(`?ref=`) 귀속이 이미 적혔으면 **덮지 않는다**(`introduced_by_influencer_id IS NULL`).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { isValidTermsVersion, recordTermsConsent } from '@/worker/utils/terms-consent'
import { matchProspectOnSignup } from '@/features/seller-prospects/api/seller-prospects.routes'

/** 동의가 없으면 사람이 읽을 거절 문구, 있으면 null. 행이 생기기 **전에** 부른다. */
export function storeTermsError(version: unknown): string | null {
  return isValidTermsVersion(version) ? null : '판매자 이용약관에 동의해주세요. 화면을 새로고침한 뒤 다시 시도해주세요.'
}

/** 매장 행과 권한이 만들어진 **뒤**. 전부 fail-soft — 매장은 이미 존재한다. */
export async function afterStoreCreated(DB: D1Database, p: {
  sellerId: number; userId: number; termsVersion: string; managerPhone: string; ip: string | null
}): Promise<void> {
  await recordTermsConsent(DB, {
    subjectType: 'seller', subjectId: p.sellerId, userId: p.userId,
    slug: 'seller', version: p.termsVersion, ip: p.ip,
  })
  try {
    const u = await DB.prepare('SELECT email FROM users WHERE id = ? LIMIT 1').bind(p.userId)
      .first<{ email: string | null }>().catch(() => null)
    const matched = await matchProspectOnSignup(DB, p.sellerId, p.managerPhone, u?.email ?? null)
    // 🌇 에이전시 타입은 건너뛴다 — 옛 문과 같은 판단(그 값을 읽어 돈을 주던 코드가 삭제됐다).
    if (matched && matched.introducerType !== 'agency') {
      await DB.prepare(
        `UPDATE sellers SET introduced_by_influencer_id = ?, introduced_at = datetime('now'),
                referral_bonus_until = datetime('now', '+6 months')
          WHERE id = ? AND introduced_by_influencer_id IS NULL`,
      ).bind(matched.introducerId, p.sellerId).run().catch(() => null)
    }
  } catch { /* 귀속 실패가 등록을 막지 않는다 */ }
}
