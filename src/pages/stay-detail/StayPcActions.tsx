/**
 * 🏨 숙소 상세 PC — 찜 · 담기 · 공유 한 줄 (2026-11-03 숙소 통일 A)
 *
 * 대표: *"일반 이용권이 아닌 숙소이용권 상세페이지는 왜 다르지? … 지금 전체적으로 통합됐지 않아?"*
 * 폰은 떠 있는 머리(`DetailFloatingHeader`)가 이 셋을 이미 준다. 그런데 그 머리는 `lg:hidden` 이라
 * **PC 숙소 상세에서는 셋 다 없었다**(이용권 상세는 PC 구역 탭 줄 오른쪽에 같은 셋을 둔다).
 * ⇒ PC 우측 예약 패널 바로 위에 같은 부품 셋을 그대로 둔다(새 버튼을 만들지 않는다 — 폰과 같은 부품).
 */
import WishlistButton from '@/components/WishlistButton'
import PinButton from '@/components/curator/PinButton'
import KakaoShareButton from '@/components/KakaoShareButton'

export default function StayPcActions({ productId, title, description, imageUrl, link, myUserId }: {
  productId: number; title: string; description: string; imageUrl: string; link: string; myUserId: string
}) {
  const chip = '!w-9 !h-9 shrink-0'
  return (
    <div className="flex items-center justify-end gap-1 mb-2" data-stay-pc-actions>
      <WishlistButton productId={productId} userId={Number(myUserId) || null} size="sm" className={chip} />
      <PinButton productId={productId} variant="detail-floating" className={chip} />
      <KakaoShareButton title={title} description={description} imageUrl={imageUrl} link={link} buttonText="예약하기" compact className={chip} />
    </div>
  )
}
