import { useCountUp } from '../useCountUp'
import { formatNumber } from '@/utils/format'

/**
 * 🎬 오늘 매출 숫자 올라가기 — **이 숫자 하나만** 다시 그린다 (2026-11-04 대표 *"버벅임이 심하네 특히 마이페이지"*).
 * 종전엔 `useCountUp` 을 `SellerSection` 본체에서 불러서, 0.8초 동안 **매 프레임(약 50번)** 판매 구역 전체
 * (부품 37개)가 다시 그려졌다 — 마이 첫 화면의 React 작업 대부분이 이것이었다(실측 커밋 60회 vs 홈 9회).
 * 숫자만 따로 떼면 움직임은 그대로이고 다시 그리는 것은 글자 한 칸이다. ⚠️ 본체로 되돌리지 말 것.
 */
export default function TodayRevenueCount({ value, resetKey }: { value: number | undefined; resetKey: number | null }) {
  const shown = useCountUp(value, { durationMs: 800, resetKey })
  return <>{formatNumber(shown)}</>
}
