/**
 * 🎟️ 2026-08-31 (대표 "교환권은 교환권 페이지에서 보게"): 카탈로그(/vouchers)에서 **내 교환권 보관함**
 *   (/my-gifticons)으로 가는 진입점. 산 자리에서 바로 확인하러 갈 수 있어야 한다 — 그게 이 분리의 요점이다.
 *   모바일은 헤더 우측 텍스트 버튼('보관함', 카카오 선물하기의 선물함 자리), PC 는 좌측 레일의 행.
 *   VouchersPage 에서 분리한 이유는 파일 크기 래칫(god 파일 성장 금지) — 동작은 인라인이던 때와 동일.
 */
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wallet, ChevronRight, Search } from 'lucide-react'

/**
 * 모바일 헤더 우측 액션 — [보관함] [검색].
 * 👆 2026-07-29 (UX 실측): 타깃이 28×28 이었다(iOS HIG 44pt 미만) → 아이콘 크기는 그대로 두고 패딩으로 44pt.
 */
export function VoucherHeaderActions() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
      <button onClick={() => navigate('/my-gifticons')}
        className="px-2.5 min-h-[44px] flex items-center text-[13px] font-bold text-gray-900 dark:text-white active:opacity-60">
        {t('voucher.myBox', { defaultValue: '보관함' })}
      </button>
      <button onClick={() => navigate('/search?scope=exchange')} aria-label="검색"
        className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center">
        <Search className="w-5 h-5 text-gray-900 dark:text-white" />
      </button>
    </div>
  )
}

/** PC 좌측 레일 — 딜 잔액 카드 아래 '내 교환권 ›' 행. */
export function GifticonBoxRailRow() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <button type="button" onClick={() => navigate('/my-gifticons')}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#2C2F35] text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
      <Wallet className="w-[18px] h-[18px] shrink-0 text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
      <span className="flex-1 text-[13px] font-bold text-gray-900 dark:text-white">{t('voucher.myGifticons', { defaultValue: '내 교환권' })}</span>
      <ChevronRight className="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" />
    </button>
  )
}
