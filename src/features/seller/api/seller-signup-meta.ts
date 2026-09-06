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
 * ## 🌇 2026-09-05 — 판정 근거가 바뀌었다(에이전시 일몰)
 * 원래 이 판정은 **에이전시 초대 코드**(`?agency=AG-XXXXXXXX`) 유무로 갈랐다. 그런데 대표 지시로
 * 에이전시가 통째로 일몰되면서(`docs/design/store-operator-model.md §7`) **그 코드를 발급할 수 있는
 * 주체도, 받아 줄 대시보드도 없어졌다.** 남겨 두면 아무도 켤 수 없는 스위치가 요금을 가르게 된다.
 *
 * ⇒ **이 문은 이제 언제나 `direct` 다.** 추측이 아니라 이 문의 정의다:
 *    `/register-from-user` 는 **카카오 user 세션 전용**이고(로그인한 본인이 자기 가게를 올린다)
 *    가입 즉시 `linked_user_id` 로 그 사람에게 묶인다. 중개사가 대신 낸 매장이 아니다.
 *
 * ⚠️ **그래서 `brokered` 를 만들 수 있는 문은 이제 하나뿐이다** — `/store/new` 의
 *    `StoreRegisterModal`("누가 운영하나요?" 필수 선택). 그 강제가 풀리면 채널 미지정 매장이
 *    다시 생기고 조용히 5% 로 떨어진다(가드: `signup-store-channel-2026-09-04.test.ts`).
 *
 * ⚠️ 이 함수는 **비어 있을 때만 쓴다**(`setSellerMeta` 는 덮어쓰므로 호출부가 신규 매장에서만 부른다).
 *    운영 중 매장의 채널 변경은 어드민(`/admin/merchant-commissions`)의 일이다 — 정산이 즉시 바뀐다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type StoreChannel = 'direct' | 'brokered'

/**
 * 사장님이 **본인 세션으로 자기 가게를 올리는 문**(`/register-from-user`)의 채널.
 * 중개사가 낸 매장은 이 문으로 오지 않는다 — `/store/new` 에서 채널을 명시해 만든다.
 */
export function channelFromSelfSignup(): StoreChannel {
  return 'direct'
}

/**
 * 신규 셀러의 `store_channel` 을 기록한다. **fail-soft** — 실패해도 가입은 성공해야 한다
 * (채널이 없으면 종전대로 5% 폴백이고, 어드민이 나중에 지정할 수 있다).
 */
export async function stampSignupStoreChannel(
  db: D1Database, sellerId: number | null | undefined,
): Promise<void> {
  if (!sellerId) return
  try {
    const { setSellerMeta } = await import('../../../worker/utils/seller-meta')
    await setSellerMeta(db, Number(sellerId), { store_channel: channelFromSelfSignup() })
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
