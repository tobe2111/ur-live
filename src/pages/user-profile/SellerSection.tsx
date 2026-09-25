/**
 * 🏪 마이 판매 섹션 — "내 가게" (2026-09-25, 설계 §14 단계 1)
 *   대표 확정: *"하는 것도 마이에서 하는걸로. 근데 필수적인 것들 선별해서"*
 *
 * ## 이 단계가 하는 것 — 보기만
 * 오늘 카드(매출·주문·확인 대기) + 가게 전환. **작업 버튼은 아직 없다**(단계 2~4).
 * 쓰기가 없으니 이 파일이 깨져도 돈은 안 움직인다 — 그게 단계 1 을 먼저 두는 이유다.
 *
 * ## 셀러가 아니면 아무것도 안 그린다
 * 좌석이 0곳이면 `null`. 진입점은 이름 옆 `SellerSwitchInline` 칩(`내 가게 등록`) 그대로다 —
 * 여기에 또 하나를 두면 **진입점이 둘**이 되고, 둘은 반드시 갈린다.
 *
 * ## 🥕 승인 전에도 보인다
 * `isSeatableStoreStatus` 가 대기·반려도 좌석을 열어 준다(당근 모델). 그래서 이 카드는
 * 상태를 **직접 말한다** — 노출·정산이 왜 아직인지 화면이 설명하지 않으면 사장님은 고장으로 읽는다.
 */
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Store } from 'lucide-react'
import { TicketCard } from '@/components/ticket/TicketCard'
import { formatNumber } from '@/utils/format'
import { currentSeatId, switchSeat } from '@/lib/seller-seat'
import { toast } from '@/hooks/useToast'
import type { MyStoresState } from './useMyStores'
import StoreSwitchSheet from './StoreSwitchSheet'

const STATUS_NOTE: Record<string, string> = {
  pending: '승인 대기 중이에요. 준비는 지금 하고, 메인 노출과 정산은 승인 뒤에 시작됩니다.',
  rejected: '서류가 반려됐어요. 사업자등록증을 다시 올리면 바로 다시 심사합니다.',
}

function todayLabelKST(): string {
  // 워커도 브라우저도 TZ 를 믿을 수 없다 — KST 로 명시해 읽는다(CLAUDE.md 시각 룰).
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short',
  })
}

/** ⚠️ 좌석은 **페이지가 한 번만** 묻고 내려 준다 — 여기서 또 부르면 같은 화면에 두 개의 진실이 생긴다. */
export default function SellerSection({ state }: { state: MyStoresState }) {
  const { stores, currentSellerId, loading, failed } = state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [entering, setEntering] = useState(false)

  /**
   * 지금 보고 있는 가게. 토큰이 앉아 있는 좌석이 목록에 있으면 그것, 아니면 첫 칸.
   * ⚠️ 여기서 토큰을 **새로 발급하지 않는다** — 마이를 여는 것만으로 남의 대시보드 세션을
   *   끊을 수 있다(`startDashboardSession`). 좌석 이동은 사람이 시트에서 고를 때만.
   */
  const store = useMemo(() => {
    if (stores.length === 0) return null
    return stores.find((s) => s.seller_id === currentSellerId) ?? stores[0]
  }, [stores, currentSellerId])

  // 좌석 0곳(= 셀러가 아님) · 첫 로드 중 · 실패 → 아무것도 그리지 않는다.
  //   실패를 0 으로 그리면 "오늘 매출 0원" 이라는 거짓말이 된다(머니 표면 룰).
  if (loading || failed || !store) return null

  const note = store.status ? STATUS_NOTE[store.status] : undefined

  return (
    <div className="ur-content-medium px-4 lg:px-8 pt-4">
      {/* 섹션 머리 — 오른쪽이 곧 가게 전환(2곳 이상일 때만 누를 수 있다) */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[13px] font-extrabold text-gray-900 dark:text-white">내 가게</h2>
        <div className="flex-1" />
        {stores.length >= 2 ? (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400 active:opacity-70"
          >
            <span className="truncate">{store.name} · {stores.length}곳</span>
            <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 max-w-[60%] text-[12px] font-semibold text-gray-500 dark:text-gray-400">
            <Store className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{store.name}</span>
          </span>
        )}
      </div>

      <TicketCard bandLeft="오늘" bandRight={todayLabelKST()}>
        <div className="px-4 pt-4 pb-4">
          <p className="text-[30px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatNumber(store.today_revenue)}
            <span className="text-[16px] font-bold text-gray-500 dark:text-gray-400 ml-1">원</span>
          </p>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-2">
            주문 {formatNumber(store.today_orders)}건
            {store.pending > 0 && <> · 확인 대기 {formatNumber(store.pending)}건</>}
          </p>
          {note && (
            <p className="text-[12.5px] leading-[1.55] text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-rule">
              {note}
            </p>
          )}
        </div>
      </TicketCard>

      {/* 🧰 전체 도구 — 깊은 작업은 셀러 대시보드가 계속 맡는다(설계 §14 "하지 않는 것").
          ⚠️ 이 줄이 **종전 '사업자 모드' 칩을 대신한다** — 없으면 마이에서 대시보드로 가는 길이 사라진다.
          좌석 토큰은 여기서 처음 발급될 수 있다(사람이 누른 순간에만 — 마이를 여는 것만으로는 안 준다). */}
      <button
        type="button"
        disabled={entering}
        onClick={async () => {
          if (entering) return
          setEntering(true)
          // 경로의 id 가 아니라 **토큰**이 권한 근거다(§15-3 규칙 ③). 좌석이 이미 맞으면 발급도 안 한다.
          const ok = currentSeatId() === store.seller_id || await switchSeat(store.seller_id, store.name).catch(() => false)
          setEntering(false)
          if (!ok) { toast.error('가게로 들어가지 못했습니다'); return }
          // 대시보드는 전역이 옛 매장 데이터를 캐싱하므로 하드 진입한다(StoreSwitcher 와 같은 판단).
          window.location.assign('/seller')
        }}
        className="w-full flex items-center gap-2 mt-2 px-1 py-3 text-left active:opacity-70 disabled:opacity-50"
      >
        <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-500 dark:text-gray-400 truncate">
          이용권 등록 · 주문 · 정산 · 매출 분석
        </span>
        {entering
          ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-gray-400" aria-hidden="true" />
          : <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />}
      </button>

      {sheetOpen && (
        <StoreSwitchSheet currentSellerId={store.seller_id} onClose={() => setSheetOpen(false)} />
      )}
    </div>
  )
}
