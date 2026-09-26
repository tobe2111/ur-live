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
 * ## ❌ 여기서 등록하지 않는다
 * 새로 만들기·사진 바꾸기는 전체화면 폼 그대로다(사진 여러 장·옵션·매장 선택 — 시트 높이에
 * 넣으면 스크롤이 두 겹이 되고, 사진을 고르는 동안 시트가 닫힌다). 같은 폼을 두 벌 만들면
 * 반드시 한쪽만 고쳐진다.
 */
import { useState } from 'react'
import { ChevronRight, Loader2, Plus } from 'lucide-react'
// ⏳ 좌석에 막 앉았으면 목록이 아직 비어 있다 — 그 순간을 "없음" 으로 그리면 거짓말이 된다.
import { formatNumber } from '@/utils/format'
import Sheet from './Sheet'
import VoucherEditSheet from './VoucherEditSheet'
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

export default function VoucherSheet({ sellerId, work, onClose, onRegister }: {
  sellerId: number
  work: SellerWorkState
  onClose: () => void
  /** 새로 등록 — 전체화면 폼으로 나간다(귀환 표시는 호출부가 붙인다). */
  onRegister: () => void
}) {
  const { products, busyProduct, toggleProduct } = work
  const [editing, setEditing] = useState<WorkProduct | null>(null)
  const onCount = products.filter((p) => p.isActive).length

  return (
    <>
      <Sheet
        title="이용권"
        onClose={onClose}
        footer={
          <button
            type="button"
            onClick={onRegister}
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

          <p className="mt-3 px-1 text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400">
            사진·옵션·매장 정보를 바꾸려면 전체 화면에서 열어야 해요. 목록에서 고른 뒤 안내가 나와요.
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
    </>
  )
}
