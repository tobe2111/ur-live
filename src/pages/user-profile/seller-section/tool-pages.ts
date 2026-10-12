/**
 * 🗺️ **마이 시트로 여는 셀러 화면 — 무엇을 빼는지만 적는다** (2026-09-26)
 *   대표: *"드물게 하는 일도 일단 마이로 하고, 대시보드는 쓸 필요없게끔 하자"*
 *
 * ## 🔴 이 파일에서 **지도를 지웠다**
 * 처음엔 여기에 `주소 → 화면 모듈` 36줄을 손으로 적었다. 그 판은 두 가지를 못 했다:
 *   ① **파라미터 화면**(`/seller/products/:id/edit`)은 주소를 미리 못 적는다 — 목록에서 이어지는 것이라
 *      id 를 아는 건 그 목록뿐이다.
 *   ② 목록 화면이 `navigate()` 하면 **마이가 통째로 그 주소로 떠났다**(시트만 닫히는 게 아니다).
 * 그래서 `ToolPageSheet` 가 **실제 라우트 표(`SellerRoutes()`)를 시트 안에서 렌더**하게 바꿨다.
 * ⇒ 지도가 필요 없어졌다. **라우트 표가 지도다.** 손으로 적은 목록이 없으니 낡을 수도 없다.
 *
 * ## 남은 것: 일부러 시트로 **안** 여는 것
 * 빠뜨린 게 아니라 이유가 있다. 이유를 값으로 적어 두는 건 다음 세션이 코드에서 바로
 * 판단하게 하기 위해서다. 이 둘은 종전처럼 전체화면으로 열리고 맨 위에 "마이로 돌아가기" 띠가 붙는다.
 */

/**
 * 시트로 **안** 여는 주소와 그 이유. 값(이유)은 사람이 읽으라고 있고, 테스트는 키와 이유 길이를 본다.
 * ⚠️ 여기 늘리기 전에 물을 것: *정말 시트에서 못 하는가*, 아니면 *아직 안 예쁜가*.
 *   후자는 UI 정리의 일이고, 이 목록에 들어올 이유가 아니다.
 */
export const FULL_SCREEN_ONLY: Record<string, string> = {
  '/seller/scan':
    '카메라다. 그리고 마이엔 이미 이 일을 위한 **큰 브랜드 버튼**이 따로 있다(/store/scan). ' +
    '여기 또 넣으면 같은 일을 하는 길이 둘이 되고, 둘은 반드시 갈린다 — 한쪽만 고쳐지는 날이 온다.',
  '/seller/meal-voucher/new':
    '전용 시트(VoucherNewSheet)가 이미 있다. 위와 같은 이유로 길을 둘로 만들지 않는다 ' +
    '(등록 후 목록 새로고침 같은 마무리가 한쪽에만 붙는 식으로 갈린다).',
}

/**
 * 이 주소를 마이 시트로 열 수 있나.
 * **기본이 "열 수 있다" 로 뒤집혔다** — 라우트 표를 그대로 렌더하므로, 명시적으로 뺀 것만 못 연다.
 */
export function canOpenInSheet(path: string): boolean {
  return !Object.prototype.hasOwnProperty.call(FULL_SCREEN_ONLY, path)
}

/**
 * 🚪 **위 둘이 실제로 가는 곳** (2026-10-12, 대표 *"이제 셀러 대시보드, 에이전시 대시보드로 굳이 안가서 해도 돼?"*)
 *
 * 위 표는 "시트로 **안** 연다" 만 말했고, 그럼 어디로 가는지는 호출부가 정했다 — 그런데 호출부 둘(마이 ·
 * 에이전시 콘솔)이 **둘 다 대시보드 주소(`/seller/scan` · `/seller/meal-voucher/new`)로 보내고 있었다.**
 * 이유에 *"마이엔 이미 전용 길이 있다"* 고 적어 놓고 정작 그 길로 안 보낸 것이다(`VoucherNewSheet` 는
 * 2026-09-26 에 만들어 놓고 **아무도 렌더하지 않았다**). 그래서 전체 도구에서 이 둘을 고르면
 * 사장님도 에이전시 직원도 얇아진 대시보드 틀로 떨어졌다.
 *
 * ⇒ 판정을 **여기 한 곳**에 둔다. 시트(`AllToolsSheet`)가 읽어 `onPick` 으로 넘기고, 호출부는 받은 값대로만 연다
 *   (호출부가 이 파일을 정적 import 하면 시트 청크가 마이에 붙는다 — 위 `AllToolsSheet` 머리말의 함정).
 *   - `scan`       → `/store/scan`(매장 계산대 — 대시보드 밖 전체화면, 좌석 토큰으로 매장을 고른다)
 *   - `voucherNew` → `VoucherNewSheet`(같은 등록 위저드를 시트 안에서)
 */
export type OwnPath = 'scan' | 'voucherNew'

export const OWN_PATH: Record<string, OwnPath> = {
  '/seller/scan': 'scan',
  '/seller/meal-voucher/new': 'voucherNew',
}

/** 계산대 — 마이와 에이전시 콘솔이 **같은 화면**으로 간다(대시보드 `/seller/scan` 아님). */
export const STORE_SCAN_PATH = '/store/scan'

export function ownPathFor(path: string): OwnPath | null {
  return Object.prototype.hasOwnProperty.call(OWN_PATH, path) ? OWN_PATH[path] : null
}
