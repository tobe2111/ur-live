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
 * 그래서 좌석이 **한 곳이라도 있을 때만** 렌더한다. 이 조건은 `SellerSection` 자신의
 * 조기 반환(`loading || failed || !store`)과 **같은 뜻**이라 화면 동작은 종전과 같다.
 *
 * ## 폴백이 `null` 인 이유
 * 판매 섹션은 마이의 **맨 위**다. 여기에 스피너를 띄우면 아래 내용이 한 번 밀린다
 * (이 레포가 반복해 고쳐 온 그 밀림). 좌석 조회 자체가 이미 비동기라 종전에도 이 자리는
 * 잠깐 비어 있었다 — 그 사이에 청크가 온다.
 */
import { Suspense, lazy } from 'react'
import type { MyStoresState } from './useMyStores'

const SellerSection = lazy(() => import('./SellerSection'))

export default function SellerSectionLazy({ state }: { state: MyStoresState }) {
  // 🔴 이 줄이 다이어트의 전부다 — 지우면 비셀러가 다시 판매 코드를 받는다(테스트가 고정).
  if (state.loading || state.failed || state.stores.length === 0) return null
  return (
    <Suspense fallback={null}>
      <SellerSection state={state} />
    </Suspense>
  )
}
