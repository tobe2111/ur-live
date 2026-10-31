import { lazy, Suspense } from 'react'

/**
 * 🎬 매장 영상 버튼을 **첫 화면 코드 밖**에 둔다(2026-10-26 — 화면별 무게 예산이 상세에서 +2KB 를 잡았다).
 * 버튼은 첫 화면이 다 뜬 뒤에야 목록을 받으므로(`runAfterLoad`) 코드도 그때 받아도 늦지 않다.
 * 사진 위에 떠 있어(absolute) 늦게 나타나도 아래를 밀지 않는다.
 */
const StoreShortsPill = lazy(() => import('./StoreShortsPill'))

export default function StoreShortsPillLazy({ productId }: { productId: number | null | undefined }) {
  return <Suspense fallback={null}><StoreShortsPill productId={productId} /></Suspense>
}
