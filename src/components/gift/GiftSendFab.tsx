/**
 * 🎁 상품 상세의 떠 있는 [선물] 버튼 (2026-11-24 `ProductDetailPage` 에서 옮김 — 모양·자리 무변경).
 *
 * 🙈 `GIFT_SEND_HIDDEN` 이면 아무것도 그리지 않는다. 선물하기는 결제·알림톡 연결이 없는 미완성 기능이고
 *   라이브에 `gifts` 표도 없어, 이 버튼을 누르면 항상 오류였다(대표 결정 "숨기기").
 *
 * 자리: 하단 구매 바와 겹치지 않게 safe-area + 바 높이(~104px) 위에 띄운다(2026-06-04 배치 정리).
 *   '담기' 는 본문의 정규 CTA 가 맡는다(2026-06-22) — 여기는 보조 액션(선물)만.
 */
import { useTranslation } from '@/lib/i18n-lite'
import { GiftBoxIcon } from '@/components/icons/urdeal-icons'
import { GIFT_SEND_HIDDEN } from '@/shared/feature-flags'

export default function GiftSendFab({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation()
  if (GIFT_SEND_HIDDEN) return null
  return (
    <div
      className="fixed left-0 right-0 z-30 px-4 pr-5 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
    >
      <div className="ur-content-wide mx-auto flex flex-col items-end gap-2">
        <button
          onClick={onOpen}
          className="pointer-events-auto inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full bg-surface border border-line shadow-lg active:scale-95 transition-transform"
          aria-label={t('productDetailPage.ariaGift')}
        >
          <GiftBoxIcon className="w-4 h-4 text-gray-900 dark:text-white" />
          <span className="text-[12px] font-medium text-gray-900 dark:text-white">선물</span>
        </button>
      </div>
    </div>
  )
}
