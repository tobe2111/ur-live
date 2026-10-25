/**
 * 🔒 2026-09-03 (대표 — *"우리는 QR 아니면 매장 확인코드 4자리~6자리야"*) — **손님 셀프 사용** 게이트 SSOT.
 *
 * 라이브는 구멍이 세 겹이었다. 집에서도 이용권을 소각할 수 있었다:
 *   ① 기본값이 `self_free` — 사장님이 설정을 안 한 매장 전부
 *   ② 호출부 조건 `pre.seller_id != null` 탓에 **판매자 없는 상품은 게이트 자체를 건너뜀**(활성 데모 100개 전량)
 *   ③ 설정 조회 실패 시 fail-open
 *
 * 🔑 **두 방식은 양자택일이 아니다.** 직원 QR 스캔(`/:code/use-by-seller`)은 **이 게이트 밖**이라
 *   모드와 무관하게 항상 열려 있다. 여기서 가르는 것은 *손님이 혼자 누르는* 경로뿐이다.
 *
 * ⚠️ 이 파일이 못 막는 것: 호출부가 이 함수를 아예 안 부르는 경우(=②의 재발).
 *   그건 `voucher-redeem-and-photos.test.ts` 의 배선 검사 + 주입 매니페스트가 본다.
 */
import { getRedemptionSettings, type RedemptionMode } from './redemption-settings'
import { findBrandBranchByStoreCode } from './brand-wide-redeem'
import { STAY_VOUCHER_SELF_USE_BLOCKED, stayLinkForVoucher } from '../../features/group-buy/api/stay-voucher-unify'

export type SelfRedeemGate =
  | { ok: true; mode: RedemptionMode; /** 판 지점이 아닌 브랜드 지점 코드로 열렸으면 그 지점 — 호출부가 사용 직후 기록한다. */ branchSellerId?: number }
  | { ok: false; status: 403; code: string; error: string }

/**
 * 셀프 사용을 허용할지 판정한다. 미사용(`unused`) 이용권에 대해서만 부르면 된다.
 *
 * @param sellerId 상품의 매장. `null` 이면 확인코드를 발급해 줄 주체도, 갈 매장도 없다 → 거절.
 * @param storeCodeInput 손님이 입력한 매장 확인코드(공백 허용 — 여기서 trim).
 * @param productId 이용권의 상품(선택). 주면 **판 지점의 확인코드가 아닐 때** 같은 주인의 브랜드 지점
 *   확인코드도 받는다(2026-10-18 브랜드 전 지점 사용 — 이용권이 켜져 있을 때만, `scan_only` 지점 제외).
 *   이 함수는 문만 연다 — 원장은 안 건드린다. 열린 지점을 `branchSellerId` 로 돌려주면 호출부가 사용 직후
 *   `recordVoucherRedeemStore` 로 적고, 다른 점주 지점이면(3단계 게이트 ON) 정산이 그 지점으로 간다.
 * @param voucherId 이용권 id(선택). 주어야 **다른 점주** 지점이 판정 대상이 된다(소개비 붙은 이용권 제외 — 결재 ②-1).
 *   안 주면 같은 주인 지점만 받는다(종전).
 */
export async function checkSelfRedeemGate(
  DB: D1Database,
  sellerId: number | null | undefined,
  storeCodeInput: string,
  productId?: number | null,
  voucherId?: number | null,
): Promise<SelfRedeemGate> {
  // 🏡 2026-10-25 숙소=이용권 통일 — 숙소 이용권은 체크인 때 직원 스캔으로만 쓴다(사람이 투숙을 본다).
  if (voucherId != null && (await stayLinkForVoucher(DB, { id: Number(voucherId) }))) {
    return { ok: false, status: 403, code: 'STAY_SCAN_ONLY', error: STAY_VOUCHER_SELF_USE_BLOCKED }
  }
  if (sellerId == null) {
    return { ok: false, status: 403, code: 'NO_STORE', error: '이 이용권은 현장에서 직원 확인으로만 사용할 수 있어요.' }
  }
  let s: { mode: RedemptionMode; store_code: string | null }
  try {
    s = await getRedemptionSettings(DB, Number(sellerId))
  } catch {
    // fail-**closed**: 설정을 못 읽었다고 아무나 소각시키지 않는다(직원 QR 은 살아 있다).
    return { ok: false, status: 403, code: 'STORE_CODE_REQUIRED', error: '매장에 비치된 확인코드를 입력해주세요.' }
  }
  const input = String(storeCodeInput || '').trim()
  // 🏷️ 판 지점의 코드가 아니면 같은 주인의 브랜드 지점 코드인지 본다(이용권이 켜져 있을 때만 · fail-closed).
  //   판 지점이 scan_only 여도 손님이 서 있는 지점이 코드 방식이면 그 지점의 규칙을 따른다.
  if (productId != null && input && input !== s.store_code) {
    const branch = await findBrandBranchByStoreCode(DB, Number(productId), Number(sellerId), input, { allowScanOnly: false, voucherId })
      .catch(() => null)
    if (branch != null) return { ok: true, mode: 'store_code', branchSellerId: branch }
  }
  if (s.mode === 'scan_only') {
    return { ok: false, status: 403, code: 'SCAN_ONLY_MODE', error: '이 매장은 직원 확인 방식이에요. 직원에게 QR 화면을 보여주세요.' }
  }
  if (!input || !s.store_code || input !== s.store_code) {
    // 🛡️ 자릿수 하드코딩 제거(신규 6자리·기존 4자리 병존) — 이 403 도 rate limit 카운트에 잡힘(브루트포스 소진).
    return { ok: false, status: 403, code: 'STORE_CODE_REQUIRED', error: '매장에 비치된 확인코드를 입력해주세요.' }
  }
  return { ok: true, mode: s.mode }
}
