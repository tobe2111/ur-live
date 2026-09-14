/**
 * 🧾 1인당 구매 상한 — 실효값 한 곳 (2026-09-14 대표 *"셀러가 이용권 한 계정 당 구매 갯수 제한이
 * 걸리게끔 해야할 것 같아"*)
 *
 * ## 실측이 말한 것 (라이브 2026-09-14)
 * 기능은 **이미 전부 있었다** — 서버 검증 두 겹(`/join` 사전 + 과금 전 재검증) · 셀러 등록/수정
 * 입력칸 · 어드민 수기 폼 · 상세의 "1인당 최대 N개" 표시. 그런데 값이 박힌 상품이 **0개**다:
 *
 * | | |
 * |---|---|
 * | `product_supply_meta.max_per_person` 행 | 23 (전부 `"0"` = 무제한) |
 * | 값 > 0 인 상품 | **0** |
 * | 활성 이용권 | 339 (그중 실 셀러 소유 **1**) |
 *
 * 즉 셀러가 안 거는 게 아니라 **아직 셀러가 한 명**이고, 폼의 기본값 0(무제한)이 그대로 저장된 것이다.
 *
 * ## 그 옆에서 나온 진짜 구멍
 * **화면은 10개에서 막는데 서버는 100까지 받았다** — 상세의 수량 스테퍼가 `max_per_person` 미설정 시
 * 10 을 자기 상수로 들고 있었고(`GroupBuyDetailPage`·`VoucherDetailPage`), 서버 `/join` 은
 * `qty > 100` 만 봤다. 화면을 안 거치고 API 를 치면 한 계정이 100장을 산다.
 *
 * ⇒ 상한의 진실을 **한 곳**으로 모은다. 상품별 값이 있으면 그것, 없으면 플랫폼 기본값
 * (`platform_settings.voucher_max_per_person_default`, 초기 10). 초기값을 10 으로 둔 이유는
 * **지금 화면이 이미 10 에서 막고 있어서** 사용자 행동 변화가 0 인 자리에서 출발하기 위함이다.
 * 숫자는 수치일 뿐이라 어드민에서 조정한다(구조가 아니므로 문서 갱신 대상 아님).
 *
 * ⚠️ 이 값은 **소프트 룰**이다 — 조회가 실패하면 막지 않고 하드 상한(100)으로 통과시킨다
 * (`fail-open`). 한도 조회 한 번 삐끗에 정당한 구매가 막히면 그게 더 큰 사고다.
 */

/** 어떤 경우에도 넘을 수 없는 하드 상한 — `/join` 의 `qty > 100` 과 같은 값. */
export const HARD_QTY_CAP = 100

/** 플랫폼 기본 한도가 설정돼 있지 않을 때 쓰는 값 — 화면 폴백과 **같은 수**(`shared/purchase-cap-default.ts`). */
export { DEFAULT_QTY_CAP } from '../../shared/purchase-cap-default'
import { DEFAULT_QTY_CAP } from '../../shared/purchase-cap-default'

const SETTING_KEY = 'voucher_max_per_person_default'

/**
 * 플랫폼 기본 한도. 미설정·조회 실패면 `DEFAULT_QTY_CAP`.
 * 0 이하나 비숫자는 무시한다 — "무제한" 을 여기서 표현하려면 `HARD_QTY_CAP` 을 넣어야 한다
 * (0 을 무제한으로 읽으면 설정 실수 하나가 상한을 통째로 없앤다).
 */
export async function getPlatformQtyCap(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(SETTING_KEY).first<{ value: string }>()
    const n = Number(row?.value)
    if (Number.isFinite(n) && n > 0) return Math.min(HARD_QTY_CAP, Math.floor(n))
  } catch { /* fail-open — 아래 기본값 */ }
  return DEFAULT_QTY_CAP
}

/**
 * 이 상품에 실제로 적용되는 1인당 상한.
 * 셀러가 정한 값이 있으면 그것(플랫폼 기본보다 커도 셀러 뜻을 따른다 — 하드 상한 안에서),
 * 없으면 플랫폼 기본.
 */
export function resolveQtyCap(perProduct: unknown, platformCap: number): number {
  const n = Number(perProduct)
  if (Number.isFinite(n) && n > 0) return Math.min(HARD_QTY_CAP, Math.floor(n))
  return Math.min(HARD_QTY_CAP, platformCap)
}

/**
 * 이 유저가 이 상품을 `qty` 만큼 더 살 수 있나. 못 사면 소비자에게 보일 문구를 함께 준다.
 *
 * 🔑 **`/join` 사전검증과 과금 전 재검증이 이 함수 하나를 부른다.** 종전엔 같은 로직이 두 벌이라
 * 한쪽만 고치면 그 틈으로 초과 구매가 통과했다(레이스 차단이 목적인 재검증이 오히려 구멍이 된다).
 *
 * 보유 기준은 **미환불 이용권**(`unused`/`used`) — 환불된 것은 다시 살 수 있어야 한다.
 * 조회가 실패하면 0 보유로 보고 통과시킨다(fail-open, 소프트 룰).
 */
export async function checkPerPersonLimit(
  DB: D1Database, productId: number | string, userId: number | string, qty: number, perProduct: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cap = resolveQtyCap(perProduct, await getPlatformQtyCap(DB))
  if (cap <= 0) return { ok: true }
  if (qty > cap) return { ok: false, error: `1인당 최대 ${cap}개까지 구매할 수 있습니다` }
  const row = await DB.prepare(
    "SELECT COUNT(*) AS n FROM vouchers WHERE product_id = ? AND user_id = ? AND status IN ('unused','used')",
  ).bind(productId, userId).first<{ n: number }>().catch(() => ({ n: 0 }))
  const owned = Number(row?.n ?? 0)
  if (owned + qty > cap) return { ok: false, error: `1인당 최대 ${cap}개 구매 가능 — 이미 ${owned}개 보유 중입니다` }
  return { ok: true }
}
