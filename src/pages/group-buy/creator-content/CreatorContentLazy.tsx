import { lazy, Suspense } from 'react'
import DeferUntilVisible from '../DeferUntilVisible'
import type { BuyInfo } from './ContentViewer'

/**
 * 🎬 '다녀온 사람들' 칸을 **첫 화면 코드 밖**에 둔다(2026-11-04). 화면 근처(300px)에 와야 청크와 요청이 출발한다.
 * 상세 파일은 잠금 계약상 lazy 지문 개수가 고정이라, lazy 경계를 이 파일이 갖는다(`StoreShortsPillLazy` 와 같은 처방).
 */
const CreatorContentRow = lazy(() => import('./CreatorContentRow'))

export default function CreatorContentLazy(props: { productId: number; buy: BuyInfo; onBuy: () => void }) {
  return <DeferUntilVisible minHeight={1}><Suspense fallback={null}><CreatorContentRow {...props} /></Suspense></DeferUntilVisible>
}
