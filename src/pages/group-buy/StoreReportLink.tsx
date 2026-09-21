/**
 * 🚨 **"이 매장 제보하기"** — 이용권 상세 매장 정보 아래의 작은 입구.
 *
 * ## 왜 여기인가
 * 2026-09-21 실측: 소비자 이용권 상세에 신고 입구가 **0개**였다. 남이 내 가게 이름으로 이용권을
 * 팔아도 **진짜 사장님은 알릴 곳이 없었다**(되찾기 레일 `/store/find` 는 사장님이 스스로 매장을
 * 등록하려 할 때만 만나진다).
 *
 * 매장 정보 바로 아래가 제자리다 — 사장님이 자기 가게를 찾아 들어왔을 때 보는 자리이고,
 * 손님이 "정보가 틀렸다" 고 느끼는 자리도 같다.
 *
 * ## 눈에 띄게 만들지 않는다
 * 신고는 드물게 쓰는 기능이고, 크게 그리면 멀쩡한 매장을 의심하게 만든다.
 * 회색 작은 글씨 한 줄 — **찾으면 있고, 안 찾으면 안 보인다.**
 *
 * ## 상태를 여기서 갖는 이유
 * `StoreLocation` 은 "상태도 데이터 조회도 없는 순수 표시" 라는 계약을 가진 부품이다(그 파일 머리말).
 * 시트 열림 상태를 거기 두면 그 계약이 깨지므로, 이 작은 부품이 대신 갖는다.
 * 시트 본체는 열 때만 받아 온다 — 신고는 드문 행동이라 상세 첫 화면에 실릴 이유가 없다.
 */
import { lazy, Suspense, useState } from 'react'

const StoreReportSheet = lazy(() => import('@/components/store/StoreReportSheet'))

export default function StoreReportLink({
  sellerId, productId, storeName,
}: {
  sellerId?: number | null
  productId?: number | null
  storeName?: string | null
}) {
  const [open, setOpen] = useState(false)
  // 매장이 특정되지 않으면 제보할 대상이 없다 — 플랫폼 상품(교환권 등)은 seller_id 가 없다.
  if (!sellerId) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-gray-400 dark:text-gray-500 underline underline-offset-2"
      >
        이 매장 제보하기
      </button>
      {open && (
        <Suspense fallback={null}>
          <StoreReportSheet
            sellerId={sellerId}
            productId={productId ?? undefined}
            storeName={storeName ?? undefined}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  )
}
