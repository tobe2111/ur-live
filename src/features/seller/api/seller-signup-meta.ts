/**
 * 🏪 가입 시점에 **매장 채널을 확정한다** (2026-09-04 대표 — "가입할 때 선택을 하잖아, 그때 정해지면 되는거 아니야?")
 *
 * ## 🩸 무엇이 비어 있었나
 * 매장이 생기는 문이 둘인데 **한쪽만 채널을 남기고 있었다**:
 *   · `/store/new` → `POST /api/seller/stores` — "③ 누가 운영하나요?" 를 **반드시** 고르게 한다 ✅
 *   · `/seller/register/supplier` → `POST /register-from-user` — 그 질문이 **없다** ❌
 *
 * 채널이 없으면 `channelPlatformRate` 가 `undefined` 를 돌려주고 **중개(5%)로 떨어진다**
 * (`ledger-commission-policy.ts` — 모르면 낮은 쪽. 더 떼는 쪽은 되돌리기 비싸다).
 * 즉 초대 링크로 들어온 **직접 입점 사장님이 영원히 5%** 로 걷힌다. 에러도 경고도 없다.
 *
 * ## 🔑 추측하지 않는다 — 이미 아는 값으로 정한다
 * 이 폼은 **에이전시 초대 코드**(`?agency=AG-XXXXXXXX`)를 받아 `introduced_by_agency_id` 를 채운다.
 * 그게 붙었다는 건 **대행사가 데려온 매장**이라는 뜻이다 ⇒ 중개(5%).
 * 안 붙었으면 사장님이 자기 가게를 직접 올린 것이다 ⇒ 직접(10%).
 *
 * ⚠️ **소개자(인플루언서) 초대는 direct 다.** 소개자는 데려오기만 하고 매장을 *운영*하지 않는다 —
 *    2026-08-20 정책의 brokered 는 "중개사가 **관리**하는 매장"이다. 그리고 소개자의 영입 2% 는
 *    직접 입점 매장의 10% 안에서 나가므로, 여기서 brokered 로 찍으면 **소개자가 보상을 못 받는다.**
 *
 * ⚠️ 이 함수는 **비어 있을 때만 쓴다**(`setSellerMeta` 는 덮어쓰므로 호출부가 신규 매장에서만 부른다).
 *    운영 중 매장의 채널 변경은 어드민(`/admin/merchant-commissions`)의 일이다 — 정산이 즉시 바뀐다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type StoreChannel = 'direct' | 'brokered'

/** 대행사가 데려왔으면 중개, 아니면 직접. 가입 시점에 아는 값만 본다. */
export function channelFromSignup(introducedAgencyId: number | null | undefined): StoreChannel {
  return introducedAgencyId ? 'brokered' : 'direct'
}

/**
 * 신규 셀러의 `store_channel` 을 기록한다. **fail-soft** — 실패해도 가입은 성공해야 한다
 * (채널이 없으면 종전대로 5% 폴백이고, 어드민이 나중에 지정할 수 있다).
 */
export async function stampSignupStoreChannel(
  db: D1Database, sellerId: number | null | undefined, introducedAgencyId: number | null | undefined,
): Promise<void> {
  if (!sellerId) return
  try {
    const { setSellerMeta } = await import('../../../worker/utils/seller-meta')
    await setSellerMeta(db, Number(sellerId), { store_channel: channelFromSignup(introducedAgencyId) })
  } catch { /* 채널 미기록 — 종전 폴백(5%)으로 동작, 어드민에서 지정 가능 */ }
}

/** 큐레이터 프로필 → 신규 셀러 1회 복사(빈 값 skip). best-effort — 컬럼 없는 env 에서도 가입은 성공. */
export async function copyCuratorProfileToSeller(
  db: D1Database, sellerId: number | null | undefined, curatorProfile: Record<string, unknown> | null | undefined,
): Promise<void> {
  if (!sellerId || !curatorProfile) return
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [col, srcKey] of [
    ['profile_image', 'profile_image'], ['bio', 'bio'], ['banner_url', 'banner_url'],
    ['sns_instagram', 'instagram_url'], ['sns_youtube', 'youtube_url'],
  ] as const) {
    const v = curatorProfile[srcKey]
    if (v != null && String(v).trim() !== '') { sets.push(`${col} = ?`); vals.push(v) }
  }
  if (!sets.length) return
  await db.prepare(`UPDATE sellers SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...vals, sellerId).run().catch(() => { /* 컬럼 없는 env — skip */ })
}
