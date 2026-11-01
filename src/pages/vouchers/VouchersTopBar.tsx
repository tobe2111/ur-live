/**
 * 🎟️ 교환권 ↔ 쇼핑 스크롤스파이 탭 바 — **쇼핑 탭이 살아 있을 때만** 쓴다.
 *
 * 2026-10-14 대표 확정 안 C 로 쇼핑 탭이 숨겨진 동안의 머리는 배너다(`./VouchersHero`). 그 전에는 탭이 하나뿐이라
 *   좌측 제목 "교환권"을 그렸는데(2026-08-31), 대표 *"교환권이라고 적혀있는거 별로"* — 하단 탭과 같은 말이었다.
 *   그 제목 분기는 지웠다. 쇼핑 탭을 되살리면(`SHOPPING_TAB_HIDDEN=false`) 이 바가 다시 맨 위에 선다.
 */
import { VoucherHeaderActions } from './GifticonBoxEntry'

export default function VouchersTopBar({ activeTab, onVouchers, onShopping }: {
  activeTab: 'vouchers' | 'shopping'
  onVouchers: () => void
  onShopping: () => void
}) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
      <div className="relative flex items-center px-2 py-2 justify-center">
        <div className="flex items-center gap-1">
          {([['vouchers', '교환권'], ['shopping', '쇼핑']] as const).map(([key, label]) => {
            const active = activeTab === key
            return (
              <button key={key} type="button"
                onClick={() => (key === 'shopping' ? onShopping() : onVouchers())}
                className={`relative px-4 py-2 text-[15px] font-bold transition-colors ${active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}
              >
                {label}
                {active && <span className="absolute left-4 right-4 bottom-0 h-[2.5px] rounded-full bg-gray-900 dark:bg-white" />}
              </button>
            )
          })}
        </div>
        <VoucherHeaderActions />
      </div>
    </div>
  )
}
