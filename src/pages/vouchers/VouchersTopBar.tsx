/**
 * 🎟️ 2026-08-31 (대표 "페이지 윗 부분이 밋밋하고 투박하다"): 교환권 카탈로그 상단 바.
 *
 * 무엇이 투박했나: **탭이 하나뿐인 탭바**였다 — 가운데 "교환권" 하나에 밑줄까지 그어 놓아
 *   "다른 탭이 있어야 하는데 비어 있는" 화면처럼 보였다(쇼핑 탭은 SHOPPING_TAB_HIDDEN 으로 숨김 중).
 *   탭은 고를 것이 둘 이상일 때만 탭이다. 하나뿐이면 그건 **제목**이다.
 *
 * 그래서: 쇼핑 탭이 숨겨져 있으면 좌측 정렬 페이지 제목으로, 살아나면 예전 중앙 스크롤스파이 탭으로
 *   자동 복귀한다(플래그 하나로 되돌아간다 — 구조를 지우지 않았다).
 */
import { SHOPPING_TAB_HIDDEN } from '@/shared/feature-flags'
import { VoucherHeaderActions } from './GifticonBoxEntry'

export default function VouchersTopBar({ activeTab, onVouchers, onShopping }: {
  activeTab: 'vouchers' | 'shopping'
  onVouchers: () => void
  onShopping: () => void
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#0D0F12]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
      <div className={`relative flex items-center px-2 py-1.5 ${SHOPPING_TAB_HIDDEN ? '' : 'justify-center'}`}>
        {SHOPPING_TAB_HIDDEN ? (
          /* 단일 표면 — 탭이 아니라 제목. (문서용 h1 은 페이지 상단에 sr-only 로 따로 있다.) */
          <span className="pl-2.5 py-1.5 text-[19px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">교환권</span>
        ) : (
          <div className="flex items-center gap-1">
            {([['vouchers', '교환권'], ['shopping', '쇼핑']] as const).map(([key, label]) => {
              const active = activeTab === key
              return (
                <button key={key} type="button"
                  onClick={() => (key === 'shopping' ? onShopping() : onVouchers())}
                  className={`relative px-4 py-2 text-[15px] font-extrabold transition-colors ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
                >
                  {label}
                  {active && <span className="absolute left-4 right-4 bottom-0 h-[2.5px] rounded-full bg-gray-900 dark:bg-white" />}
                </button>
              )
            })}
          </div>
        )}
        <VoucherHeaderActions />
      </div>
    </div>
  )
}
