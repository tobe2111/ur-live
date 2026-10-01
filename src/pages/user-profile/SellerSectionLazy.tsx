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
 * ---
 * ## 🔄 2026-10-01 — 그 처방으로는 **재방문만** 고쳐졌다
 *
 * 위 "못 하는 것" 에 *"처음 오는 셀러는 한 번 밀린다"* 고 적어 두고 넘어갔는데, 전수 측정에서
 * 그 한 번이 **보이는 곳 15줄 +404px** 이라는 것이 드러났다 — 대표가 찍은 그 그림 자체다.
 * 그리고 *"마크업을 복제하면 두 벌이 갈린다"* 는 걱정은 **복제하지 않으면 성립하지 않는다**:
 * 껍데기를 따로 만들 게 아니라 **같은 컴포넌트를 숫자만 비워서** 그리면 된다
 * (2026-09-16 `DealBalanceCard` 가 잔액에 이미 쓴 처방인데 여기에 안 쓰고 있었다).
 *
 * ⇒ 지금은 로딩 중에도 `SellerSection` 을 렌더한다(`store == null` → `awaiting`).
 *   `Reserve`(빈 칸)는 **청크가 도착하기 전 그 짧은 구간**만 맡는다.
 *
 * ⚠️ **여전히 못 하는 것**
 * - 상태 안내문(승인 대기·반려)은 상태를 알아야 그려서, 그런 매장은 도착 순간 그 줄만큼 밀린다.
 * - **조회가 실패하면**(`failed`) 접히면서 위로 당겨진다. 실패를 성공처럼 보이게 만들지 않는다는
 *   원칙이 먼저다.
 * - 첫 방문의 **청크 도착 전 구간**(수십~백 ms)은 예약값이 0 이라 비어 있다. 하네스 첫 스냅은
 *   750ms 라 **그 구간을 못 본다** — "0 밀림" 측정값을 그 구간까지의 증명으로 쓰지 말 것.
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
    if (!isSeller) return null
    /**
     * ⏳ 2026-10-01 — 빈 칸이 아니라 **껍데기**를 그린다 (대표 *"근본적인 원인을 모두 없애줘"*).
     *   09-30 의 예약(빈 칸)은 **재방문만** 고쳤다. 첫 방문은 잰 값이 없어 0 이라 그대로 밀렸고,
     *   10-01 전수 측정에서 소비자 19개 화면 중 **보이는 곳이 밀리는 건 여기 하나**로 남아 있었다
     *   (`이동 29(보이는 곳 15) · +404px`).
     *   이제 로딩 중에도 `SellerSection` 을 그대로 렌더하고, 그 안이 숫자만 비운다(`awaiting`).
     *   ⇒ 높이가 처음부터 맞아 **첫 방문도 안 밀린다**. 마크업이 한 벌이라 디자인이 바뀌어도 따라온다.
     *   예약(`Reserve`)은 **청크가 오기 전 그 짧은 구간**의 몫으로 남는다.
     */
    return (
      <Suspense fallback={<Reserve />}>
        <SellerSection state={state} />
      </Suspense>
    )
  }
  if (state.failed || state.stores.length === 0) return null
  // 청크가 아직 안 왔으면 같은 높이를 계속 붙들고 있는다(여기서 비우면 다시 밀린다).
  return (
    <Suspense fallback={<Reserve />}>
      <SellerSection state={state} />
    </Suspense>
  )
}
