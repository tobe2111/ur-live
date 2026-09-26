/**
 * 🎟️ 이용권 — 마이 안에서 운영한다 (2026-09-26, 설계 §21 이용권 묶음)
 *   대표: *"일단 마이에서 대부분 끝내야 해"*
 *
 * ## 무엇이 달라지나
 * 마이에는 **중지·재개만** 있었다(`SellingList`). 그런데 사장님이 제일 자주 하는 일은
 * **가격과 남은 수량을 고치는 것**이고, 그 버튼은 `/seller/group-buy` 안에만 있었다.
 * 이제 목록·중지/재개·수정이 한 시트에서 끝난다.
 *
 * ## 목록을 다시 안 부른다
 * `useSellerWork` 가 이미 들고 있는 것을 쓴다(마이 카드와 같은 목록). 여기서 또 부르면
 * 같은 화면에 **두 개의 진실**이 생기고, 하나만 새로고침되는 날이 온다.
 *
 * ## 🎟️ 등록도 여기서 한다 (2026-09-26 — 대표 *"이용권 등록, 숙소까지 해줘"*)
 * 어제는 전체화면으로 내보냈다. 지금은 **같은 페이지를 시트 안에서 연다**(`VoucherNewSheet`) —
 * 폼을 복제하는 게 아니라 `SellerMealVoucherNewPage` 를 `embedded` 로 그대로 띄운다.
 * ⚠️ 그래서 이 파일에도, 그 시트에도 **직접 만든 등록 폼이 없다.** 복제하는 순간 두 화면이
 *   서로 다른 상품을 만들기 시작한다.
 *
 * ## 🏨 숙소는 옆에 둔다
 * 숙소도 이용권의 한 종류지만 객실·날짜별 재고라 모델이 다르다 — 목록은 여기서 열고
 * 달력·객실 편집은 전체화면이다(달력은 가로 폭을 요구한다).
 */
import { useState } from 'react'
import { Building2, ChevronRight, Loader2, Plus } from 'lucide-react'
// ⏳ 좌석에 막 앉았으면 목록이 아직 비어 있다 — 그 순간을 "없음" 으로 그리면 거짓말이 된다.
import { formatNumber } from '@/utils/format'
import Sheet from './Sheet'
import VoucherEditSheet from './VoucherEditSheet'
import VoucherNewSheet from './VoucherNewSheet'
import StaysSheet from './StaysSheet'
import type { SellerWorkState, WorkProduct } from './useSellerWork'

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-gray-300 dark:bg-white/20'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </span>
  )
}

export default function VoucherSheet({ sellerId, work, onClose, onOpenPath }: {
  sellerId: number
  work: SellerWorkState
  onClose: () => void
  /** 전체화면이 필요한 것(숙소 달력·객실)만 밖으로 — 호출부가 좌석과 귀환 표시를 붙인다. */
  onOpenPath: (path: string) => void
}) {
  const { products, busyProduct, toggleProduct } = work
  const [editing, setEditing] = useState<WorkProduct | null>(null)
  const [adding, setAdding] = useState(false)
  const [staysOpen, setStaysOpen] = useState(false)
  const onCount = products.filter((p) => p.isActive).length

  return (
    <>
      <Sheet
        title="이용권"
        onClose={onClose}
        footer={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full h-12 rounded-xl bg-brand text-white text-[15px] font-bold active:opacity-80 inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            새 이용권 등록
          </button>
        }
      >
        <div className="px-4 py-3">
          <p className="px-1 pb-2 text-[12px] text-gray-500 dark:text-gray-400 tabular-nums">
            판매 중 {formatNumber(onCount)}개 · 전체 {formatNumber(products.length)}개
          </p>

          {products.length === 0 && work.loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
            </div>
          )}
          {products.length === 0 && !work.loading && (
            <p className="py-10 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
              {work.failed ? '지금은 불러올 수 없어요. 잠시 후 다시 열어 주세요.' : '아직 등록한 이용권이 없어요.'}
            </p>
          )}

          <div className="rounded-xl bg-surface shadow-lift overflow-hidden">
            {products.map((p) => (
              <div
                key={p.id}
                className={`flex items-center border-b border-rule last:border-b-0 ${p.isActive ? '' : 'opacity-55'}`}
              >
                {/* 이름 쪽을 누르면 고치기 — 스위치와 자리를 나눈다(같은 자리면 끄려다 편집이 열린다). */}
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="flex-1 min-w-0 flex items-center gap-2 px-3.5 py-3 text-left active:opacity-70"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-gray-900 dark:text-white truncate">{p.name}</span>
                    <span className="block text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                      {formatNumber(p.price)}원{p.sold > 0 ? ` · ${formatNumber(p.sold)}개 팔림` : ''}{p.isActive ? '' : ' · 중지됨'}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.isActive}
                  aria-label={`${p.name} ${p.isActive ? '판매 중지' : '판매 재개'}`}
                  disabled={busyProduct !== null}
                  onClick={() => toggleProduct(p)}
                  className="shrink-0 pl-1 pr-3.5 py-3 active:opacity-70 disabled:opacity-60"
                >
                  {busyProduct === p.id
                    ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
                    : <Switch on={p.isActive} />}
                </button>
              </div>
            ))}
          </div>

          {/* 🏨 숙소 — 이용권의 한 종류지만 객실·날짜 모델이라 따로 연다. */}
          <button
            type="button"
            onClick={() => setStaysOpen(true)}
            className="w-full flex items-center gap-2.5 mt-3 px-3.5 h-12 rounded-xl bg-surface shadow-lift text-left active:opacity-70"
          >
            <Building2 className="w-[18px] h-[18px] shrink-0 text-gray-400" aria-hidden="true" />
            <span className="flex-1 text-[14px] font-semibold text-gray-900 dark:text-white">숙소</span>
            <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
          </button>

          <p className="mt-3 px-1 text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400">
            사진·옵션·매장 정보를 바꾸려면 목록에서 고른 뒤 전체 화면에서 열어요.
          </p>
        </div>
      </Sheet>

      {editing && (
        <VoucherEditSheet
          sellerId={sellerId}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); work.refetch() }}
        />
      )}

      {/* 🎟️ 등록 — 대시보드 위저드를 **그대로** 띄운다(복제 0). 끝나면 목록을 새로 고친다. */}
      {adding && (
        <VoucherNewSheet
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); work.refetch() }}
        />
      )}

      {staysOpen && (
        <StaysSheet
          sellerId={sellerId}
          onClose={() => setStaysOpen(false)}
          onOpen={(path) => { setStaysOpen(false); onOpenPath(path) }}
        />
      )}
    </>
  )
}
