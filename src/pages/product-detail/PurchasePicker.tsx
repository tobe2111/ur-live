/**
 * 🛒 **옵션 · 수량** — 상품 상세의 구매 결정 블록 〔시안 A-2-1/2/3〕
 *
 * `ProductDetailPage` 안에 인라인으로 있던 것을 **그대로 들어냈다**(로직 불변).
 * 옮긴 이유가 두 개다:
 *
 * 1. 그 파일이 `file-size-baseline.json` 에 **978줄로 동결**돼 있다 — 한 줄도 못 늘린다.
 * 2. 시안 A-2 가 이 블록을 **두 벌**로 그렸다(본진 / 픽업). 인라인이면 그 분기가
 *    978줄짜리 파일 한복판에서 두 배로 자란다.
 *
 * ## 🔴 `variant` 는 몰이 아니라 **픽업**이 정한다
 *
 * `ReceiveMethodNotice.tsx` 와 **같은 원칙**이다 — 판정 기준은 몰이 아니라 픽업 데이터.
 * 본진에서 열린 픽업 상품도 같은 화면을 받아야 한다(몰 결합을 만들지 않는다).
 * ⇒ 호출부가 `hasPickupInfo(product.pickup)` 으로 고른다.
 *
 * ## ⚠️ `default` 는 **byte-동등**이어야 한다
 *
 * 이 화면은 유어딜 **본진 쇼핑 전체**가 쓴다. 시안은 몰 파일럿의 것이고,
 * 본진 재디자인은 **의뢰 범위가 아니다.** `default` 분기가 조금이라도 달라지면
 * 파일럿 작업이 전 상품 페이지를 바꾼 것이 된다.
 *
 * ⚠️ `text-gray-*` 대신 hex — `tailwind.config.js` 가 `gray-*` 를 INK(딥네이비)로 리맵한다.
 *   같은 이유로 시안의 로즈 톤도 **쓰지 않는다**(`rose: MONO` → 화면엔 네이비로 나온다).
 */
import { useTranslation } from 'react-i18next'
import { Minus, Plus, Info } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import type { ProductOption } from '@/hooks/useProduct'

interface Props {
  options: ProductOption[]
  /** 선택된 옵션 id(숫자). 미선택이면 undefined. */
  selectedOptionId?: number
  onSelectOption: (id: number) => void
  quantity: number
  onQuantity: (next: number) => void
  /** 재고 상한(호출부가 stock/stock_quantity 규약을 알고 계산해 넘긴다). */
  maxQuantity: number
  /** 적립 표시에 쓰는 기준가(옵션 가감 전 — 기존 동작 그대로). */
  displayPrice: number
  variant: 'default' | 'pickup'
  /** 옵션과 수량 사이에 끼는 안내(픽업/배송). 자리를 여기서 고정한다. */
  notice?: React.ReactNode
}

/**
 * 🛡️ 2026-07-02 (쇼핑 전수조사) 판정 그대로: `stock === 0` 만 품절.
 * `undefined`(재고 미설정)를 품절로 보면 재고를 안 쓰는 셀러의 옵션이 통째로 잠긴다.
 */
const isSoldOut = (opt: ProductOption) => opt.stock === 0

export default function PurchasePicker({
  options, selectedOptionId, onSelectOption,
  quantity, onQuantity, maxQuantity, displayPrice, variant, notice,
}: Props) {
  const { t } = useTranslation()
  const reward = Math.round(displayPrice * 0.03)

  const dec = () => onQuantity(Math.max(1, quantity - 1))
  const inc = () => onQuantity(Math.min(Math.max(maxQuantity, 1), 99, quantity + 1))

  if (variant === 'pickup') {
    return (
      <section className="px-5 pt-6">
        <p className="text-[13px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1] mb-2.5">옵션</p>

        {options.length > 0 ? (
          <div className="flex flex-col gap-2">
            {options.map((opt) => {
              const soldOut = isSoldOut(opt)
              const selected = selectedOptionId === Number(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={selected}
                  onClick={() => onSelectOption(Number(opt.id))}
                  className={`w-full h-[52px] px-[15px] rounded-xl flex items-center justify-between text-left transition-colors ${
                    soldOut
                      ? 'bg-[#F7F5F6] text-[#A9A2A6] dark:bg-[#161D28] dark:text-[#6E666B] cursor-not-allowed'
                      : selected
                        ? 'bg-[#1A1719] text-white dark:bg-[#F3EFF1] dark:text-[#1A1719]'
                        : 'bg-[#F1EDEF] text-[#3F383C] dark:bg-[#1A1C21] dark:text-[#DAD4D7]'
                  }`}
                >
                  <span className={`text-[14.5px] tracking-[-0.025em] truncate ${selected ? 'font-bold' : 'font-semibold'}`}>
                    {opt.option_value}
                  </span>
                  {soldOut ? (
                    <span className="shrink-0 ml-2 text-[12.5px] font-bold tracking-[-0.02em]">품절</span>
                  ) : (
                    <span className="shrink-0 ml-2 text-[13.5px] font-bold tracking-[-0.02em]">
                      {(opt.price_adjustment || 0) >= 0 ? '+' : '−'}{formatNumber(Math.abs(opt.price_adjustment || 0))}원
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          // 🔴 옵션이 없을 때 **빈 자리로 두지 않는다.** 시안이 회색 안내줄 하나를 그린 이유가 있다 —
          //   기존 화면은 여기에 '옵션을 선택해주세요' 가 적힌 **누를 수 없는 버튼**을 뒀고,
          //   그건 고를 게 없다는 뜻이 아니라 **고르라는 지시**로 읽힌다.
          <div className="flex items-center gap-2 h-12 px-[15px] rounded-xl bg-[#F5F2F3] dark:bg-[#1A1C21]">
            <Info className="w-3.5 h-3.5 shrink-0 text-[#9A9298]" />
            <span className="text-[13px] font-semibold tracking-[-0.025em] text-[#776F74] dark:text-[#A29A9F]">
              선택할 옵션이 없는 상품이에요
            </span>
          </div>
        )}

        {notice}

        <div className="flex items-center justify-between pt-[22px]">
          <span className="text-[13px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">수량</span>
          <div className="flex items-center gap-0.5 p-[3px] rounded-xl bg-[#F1EDEF] dark:bg-[#1A1C21]">
            <button type="button" aria-label="수량 감소" onClick={dec} disabled={quantity <= 1}
              className="w-11 h-11 rounded-[10px] flex items-center justify-center disabled:opacity-40">
              <Minus className="w-4 h-4 text-[#6B6469] dark:text-[#7C7479]" strokeWidth={2.4} />
            </button>
            <span className="min-w-[40px] text-center text-[16px] font-extrabold tracking-[-0.03em] text-[#1A1719] dark:text-[#F3EFF1]">
              {quantity}
            </span>
            <button type="button" aria-label="수량 증가" onClick={inc}
              className="w-11 h-11 rounded-[10px] flex items-center justify-center">
              <Plus className="w-4 h-4 text-[#1A1719] dark:text-[#F3EFF1]" strokeWidth={2.4} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3.5">
          {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시(한국 부가세 포함 공시) — 문구만 시안 톤. */}
          <span className="text-[12px] tracking-[-0.02em] text-[#9A9298] dark:text-[#7C7479]">부가세 포함</span>
          {/* ⚠️ 시안은 `210원 적립` 이지만 유어딜 적립 단위는 **딜**이다. 시안 문장 모양은 지키고
              단위는 사실대로 쓴다 — 화면이 원을 준다고 말하면 그건 그냥 거짓말이 된다. */}
          <span className="text-[12px] tracking-[-0.02em] text-[#9A9298] dark:text-[#7C7479]">
            구매 확정 시 {formatNumber(reward)}딜 적립
          </span>
        </div>
      </section>
    )
  }

  // ── 본진(기본) — 이동 전과 동일 ──────────────────────────────────────────
  return (
    <section className="px-5 py-5">
      <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{t('productDetail.optionSelect')}</p>
      {options.length > 0 ? (
        <div className="space-y-2">
          {options.map((opt) => {
            const soldOut = isSoldOut(opt)
            const selected = selectedOptionId === Number(opt.id)
            return (
              <button key={opt.id} disabled={soldOut} onClick={() => !soldOut && onSelectOption(Number(opt.id))}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                  soldOut ? 'border-gray-200 dark:border-[#2C2F35] opacity-40 cursor-not-allowed'
                  : selected ? 'border-gray-900 bg-gray-50 dark:bg-[#1A1C21]' : 'border-gray-200 dark:border-[#2C2F35]'
                }`}>
                <span className={`text-[12px] ${soldOut ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-white'}`}>{opt.option_value}</span>
                <span className="flex items-center gap-2">
                  {soldOut && <span className="text-[11px] text-red-500 font-medium">{t('product.optionSoldOut', { defaultValue: '품절' })}</span>}
                  {!soldOut && opt.price_adjustment !== 0 && (
                    <span className="text-[11px] text-red-500 font-bold">
                      {(opt.price_adjustment || 0) > 0 ? '+' : ''}{t('productDetail.priceWon', { defaultValue: '{{value}}원', value: formatNumber(opt.price_adjustment || 0) })}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-[#2C2F35]">
          <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('productDetail.optionPlaceholder')}</span>
          <svg className="w-3.5 h-3.5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      )}
      {notice}

      {/* 🚑 2026-07-02 (상세 리뷰): 수량 스텝퍼 부재 — setQuantity 미배선이라 2개 이상 즉시구매 불가하던 것 */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-[12px] font-bold text-gray-900 dark:text-white">{t('productDetail.quantity', { defaultValue: '수량' })}</span>
        <div className="flex items-center gap-3 border border-gray-200 dark:border-[#2C2F35] rounded-xl px-2 py-1">
          <button type="button" aria-label="수량 감소" onClick={dec}
            className="w-8 h-8 flex items-center justify-center text-gray-900 dark:text-white font-bold disabled:opacity-30" disabled={quantity <= 1}>−</button>
          <span className="min-w-[2ch] text-center text-[14px] font-bold text-gray-900 dark:text-white">{quantity}</span>
          <button type="button" aria-label="수량 증가" onClick={inc}
            className="w-8 h-8 flex items-center justify-center text-gray-900 dark:text-white font-bold">＋</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{t('productDetail.pointReward')}</span>
        <span className="text-[11px] font-bold text-gray-900 dark:text-white">{t('productDetail.maxPointReward', { defaultValue: '최대 {{value}}딜', value: formatNumber(reward) })}</span>
      </div>
      {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 (한국 부가세 포함 공시) */}
      <div className="mt-1 text-[10.5px] text-gray-400 dark:text-gray-500">{t('productDetail.vatIncluded')}</div>
    </section>
  )
}
