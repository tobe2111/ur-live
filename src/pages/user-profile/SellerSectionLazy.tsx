/**
 * 🏪⏳ **판매 섹션은 셀러에게만 내려간다** (2026-09-26 — 대표 *"로딩 속도를 줄이고"*)
 *
 * ## 무엇이 문제였나 (실측)
 * 마이는 **소비자 화면**이다. 그런데 `UserProfilePage` 가 `SellerSection` 을 정적으로 import 해서,
 * 판매를 안 하는 사람도 판매 코드를 통째로 받고 있었다:
 *
 * | | |
 * |---|---|
 * | `UserProfilePage` 청크 221KB 중 셀러 전용 | **129KB (58%)** |
 * | 거기에 딸려 온 `app-seller-components` | **83.8KB** (SellerLayout·StoreRegisterModal·BulkUploadModal — 마이가 안 쓴다) |
 * | 라이브 승인 셀러 | **9곳** |
 *
 * 즉 거의 모든 방문자가 자기가 절대 안 여는 화면의 코드를 받고 있었다. 에러가 없어서
 * 아무도 신고하지 않는 종류다.
 *
 * ## 🔑 게이트가 **`lazy` 바깥**이어야 한다
 * `React.lazy` 는 **렌더될 때** 받는다. `<Suspense><SellerSection/></Suspense>` 를 조건 없이 두면
 * 셀러가 아닌 사람도 그 청크를 받는다 — 안에서 `null` 을 돌려줘도 이미 받은 뒤다.
 * 그래서 좌석이 **한 곳이라도 있을 때만** 렌더한다.
 *
 * ---
 * ## 📐 2026-09-30 — **자리를 비워 두지 않고 *예약*한다** (대표 신고)
 *
 * 대표: *"지금 2번째 이미지가 로딩에 나오다가 첫번째 이미지로 바뀌더라?"*
 *
 * 종전 이 파일의 주석은 폴백이 `null` 인 이유를 *"여기에 스피너를 띄우면 아래 내용이 한 번
 * 밀린다"* 고 적어 뒀다. **그 논리가 틀렸다** — 비워 두면 밀림이 없어지는 게 아니라, 스피너
 * 높이가 아니라 **구역 전체 높이만큼** 밀린다. 하네스 실측(`--slow=1500 --shift`):
 *
 * ```
 * 내가 산 것 286→622 (+336)   … 그 아래 12줄 전부 +336
 * 사라짐: ["매장 계산대", …]   생김: ["내 가게","오늘","이용권 사용처리", …]
 * 문서높이 1588→1924px
 * ```
 *
 * 즉 손님이 **읽고 있던 줄**이 통째로 아래로 밀려났다. 대표가 본 것이 이것이다.
 *
 * ## 처방: 지난 렌더에서 **실제로 잰** 높이를 예약한다
 * 손으로 적은 숫자가 아니다(2026-09-16 `TopChromeReserve` 의 교훈 — 마법의 숫자는 디자인이
 * 바뀌면 조용히 어긋난다). 이 구역이 그려질 때마다 자기 높이를 적어 두고, 다음 방문의 첫
 * 프레임에서 그만큼을 비워 둔다. 내용이 바뀌면 **다음 방문에 저절로 맞는다.**
 *
 * ⚠️ **못 하는 것**
 * - **처음 오는 셀러는 한 번 밀린다**(잰 값이 없다). 그 한 번을 없애려면 가게 이름·숫자를 캐시해
 *   진짜 내용을 그려야 하는데, 그건 *옛 매출을 잠깐 보여 주는 것*이라 머니 표면에서 하지 않는다.
 * - **조회가 실패하면**(`failed`) 예약이 접히면서 위로 당겨진다. 실패는 드물고, 실패를 성공처럼
 *   보이게 만들지 않는다는 원칙이 먼저다.
 * - 예약은 **빈 칸**이다. 스켈레톤을 그리지 않는 이유: 이 구역의 마크업을 여기에 복제하면 두 벌이
 *   되고 반드시 갈린다(이 레포가 반복해 당한 클래스).
 */
import { Suspense, lazy } from 'react'
import type { MyStoresState } from './useMyStores'
import { readReservedHeight } from './seller-reserve'

const SellerSection = lazy(() => import('./SellerSection'))

function Reserve() {
  const h = readReservedHeight()
  if (h <= 0) return null
  return <div aria-hidden="true" style={{ height: h }} />
}

export default function SellerSectionLazy({ state }: { state: MyStoresState }) {
  // 🔴 이 줄이 다이어트의 전부다 — 지우면 비셀러가 다시 판매 코드를 받는다(테스트가 고정).
  //   ⏳ 로딩 중에는 **셀러 토큰이 있을 때만** 자리를 예약한다. 토큰은 동기로 읽히므로 첫 프레임에
  //      판정된다 — 판매를 안 하는 사람의 화면은 한 픽셀도 안 바뀐다.
  if (state.loading) {
    let isSeller = false
    try { isSeller = !!localStorage.getItem('seller_token') } catch { isSeller = false }
    return isSeller ? <Reserve /> : null
  }
  if (state.failed || state.stores.length === 0) return null
  // 청크가 아직 안 왔으면 같은 높이를 계속 붙들고 있는다(여기서 비우면 다시 밀린다).
  return (
    <Suspense fallback={<Reserve />}>
      <SellerSection state={state} />
    </Suspense>
  )
}
