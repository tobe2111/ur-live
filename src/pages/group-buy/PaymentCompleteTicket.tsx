/**
 * 🎫 이용권 결제 완료 — 티켓 한 장 (2026-09-02, 대표 시안: 코레일톡 "결제가 완료되었어요")
 *
 * ■ 왜 생겼나
 *   이용권 결제는 승인 확인 뒤 **1.5초 만에 지갑으로 자동 이동**했다. 사용자는 "완료되었어요"를 본 적이 없다.
 *   시안이 정확히 그 자리다: 제목 한 줄 → 티켓(밴드 + 본문 + outline 버튼) → 안내 3줄 → 크로스셀 → 서비스 줄.
 *
 * ■ 시안 → 우리 매핑 (docs/design/ticket-completion-reference-2026-09.md §3)
 *   밴드 `2026.09.21 (월)` · `19일 전`  →  `사용 기한까지` · `D-N`
 *   `기차 승차권 · 1매`                →  `{카테고리} 이용권 · N매`
 *   `동탄 16:09 → 부산 18:31`          →  매장명 + 상품명 + **가격 한 숫자**(시간 개념이 없으니 가격이 주인공)
 *   `승차권 확인`                       →  `이용권 확인` → /my-vouchers
 *   `오는 열차도 찾아볼까요?`           →  같은 매장 다른 이용권(SameStoreDeals — 상세 otherDeals 와 같은 데이터)
 *   `이용가능한 서비스`                 →  식사·미용·숙소·교환권·레저 타일(채색 flat 아이콘, category-icons)
 *
 * ■ 지키는 것
 *   체크 원 0 · 그라디언트 0 · 색깔 정보상자 0 · 카드 테두리 0(화이트만 shadow-lift). 로즈/블루는 밴드·outline 글자·강조 단어 셋에만.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import api from '@/lib/api'
import { useMyVouchers } from '@/hooks/queries'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'
import { TicketCard, TicketRow, TicketOutlineButton, TicketNotes } from '@/components/ticket/TicketCard'
import { CategoryTile, MealIcon, BeautyIcon, StayIcon, GiftIcon, LeisureIcon } from '@/components/icons/category-icons'
import SameStoreDeals from '@/pages/my-vouchers/SameStoreDeals'

type ProductLite = {
  id: number
  name: string
  restaurant_name?: string | null
  restaurant_address?: string | null
  category?: string | null
  price?: number | null
  current_price?: number | null
  original_price?: number | null
  current_discount_pct?: number | null
}

/** 밴드 왼쪽 문구 "2026.09.21 (월)까지". 기한 없으면 "사용 기한 없음"(2026-08-22 대표: 미설정 = 무기한). KST 규약은 utils/date SSOT. */
export function bandLeft(expiresRaw: string | null | undefined): string {
  const d = safeDate(expiresRaw)
  if (!d) return '사용 기한 없음'
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  )
  return `${parts.year}.${parts.month}.${parts.day} (${String(parts.weekday).replace('요일', '')})까지`
}

export default function PaymentCompleteTicket({ productId, qty, amount }: { productId: number; qty: number; amount: number }) {
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductLite | null>(null)
  // 방금 발급된 이용권 — 지갑 쿼리는 confirm 직후 invalidate 됐으므로 여기서 다시 읽으면 새 행이 있다.
  const { data: vouchersRaw } = useMyVouchers()
  const issued = useMemo(() => {
    const list = (vouchersRaw ?? []) as Array<{ product_id?: number; status: string; expires_at?: string; created_at?: string; restaurant_name?: string; product_name?: string }>
    return list
      .filter((v) => Number(v.product_id) === productId && v.status === 'unused')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0] ?? null
  }, [vouchersRaw, productId])

  useEffect(() => {
    let alive = true
    api.get(`/api/group-buy/products/${productId}`)
      .then((r) => { if (alive) setProduct((r.data?.data ?? r.data?.product ?? null) as ProductLite | null) })
      .catch(() => { /* 상품 조회 실패 — 지갑 행과 결제 파라미터만으로 그린다 */ })
    return () => { alive = false }
  }, [productId])

  const expiresAt = safeDate(issued?.expires_at)
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null
  const storeName = product?.restaurant_name || issued?.restaurant_name || ''
  const itemName = product?.name || issued?.product_name || '이용권'
  const unit = qty > 0 ? Math.round(amount / qty) : amount
  const original = product?.original_price ?? product?.price ?? null
  const pct = product?.current_discount_pct ?? (original && original > unit ? Math.round((1 - unit / original) * 100) : null)
  const kindLabel = getVoucherShortLabel(product?.category)

  return (
    <div className="min-h-[100dvh] bg-[#F8F7FC] dark:bg-[#11141C] text-gray-900 dark:text-white">
      <div className="ur-content-narrow px-4 lg:px-8 pt-3 pb-10">
        <div className="flex justify-end">
          <button type="button" onClick={() => navigate('/')} aria-label="닫기" className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-700 dark:text-gray-200 active:opacity-60">
            <X className="w-6 h-6" strokeWidth={1.6} />
          </button>
        </div>
        <h1 className="text-center text-[24px] font-extrabold tracking-[-0.02em] mt-3 mb-6">결제가 완료되었어요</h1>

        <TicketCard bandLeft={bandLeft(issued?.expires_at)} bandRight={daysLeft !== null ? (daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`) : undefined}>
          <TicketRow left={`${kindLabel}`} right={`${qty}매`} />
          <div className="px-4 pt-4 pb-4">
            {storeName && <p className="text-[13px] text-gray-500 dark:text-gray-400">{storeName}</p>}
            <p className="text-[17px] font-bold tracking-[-0.01em] mt-0.5">{itemName}</p>
            <div className="flex items-baseline gap-2.5 mt-3 mb-4 tabular-nums">
              {pct !== null && pct > 0 && <span className="text-[17px] font-extrabold text-brand-text">{pct}%</span>}
              <span className="text-[30px] font-extrabold tracking-[-0.03em] leading-none">{formatNumber(amount)}원</span>
              {original !== null && original * qty > amount && <span className="text-[13px] text-gray-400 dark:text-gray-500 line-through">{formatNumber(original * qty)}원</span>}
            </div>
            <TicketOutlineButton onClick={() => navigate('/my-vouchers')}>이용권 확인</TicketOutlineButton>
          </div>
        </TicketCard>

        <div className="mt-5 mb-6">
          <TicketNotes items={[
            '매장에서 QR 또는 코드로 사용해요.',
            '사용하지 않으면 기한이 지난 뒤 100% 자동 환불돼요.',
            '매장 사정으로 사용이 어려우면 즉시 환불해 드려요.',
          ]} />
        </div>

        {/* 크로스셀 — 시안 "오는 열차도 찾아볼까요?" 자리. 같은 매장 다른 이용권(없으면 컴포넌트가 null). */}
        <div className="rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift px-4 pt-4 pb-4">
          <h2 className="text-center text-[16px] font-bold pb-3 border-b border-rule">{storeName ? `${storeName} 다른 이용권도 볼까요?` : '이런 이용권도 볼까요?'}</h2>
          <SameStoreDeals productId={productId} hideTitle />
          <div className="text-center mt-3">
            <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-1 h-10 px-5 rounded-full border border-rule-strong text-[14px] font-semibold active:opacity-70">
              <span className="text-brand-text font-bold">이용권</span> 찾아보기 <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>

        {/* 서비스 줄 — 시안 "이용가능한 서비스". 채색 flat 아이콘 원 타일(대표 아이콘 컨셉). */}
        <h2 className="text-[17px] font-bold mt-8 mb-4">이런 서비스도 있어요</h2>
        <div className="grid grid-cols-5 gap-2">
          <CategoryTile icon={<MealIcon size={30} />} label="식사" onClick={() => navigate('/?category=meal_voucher')} />
          <CategoryTile icon={<BeautyIcon size={30} />} label="미용" onClick={() => navigate('/?category=beauty_voucher')} />
          <CategoryTile icon={<StayIcon size={30} />} label="숙소" onClick={() => navigate('/?category=stay_voucher')} />
          <CategoryTile icon={<GiftIcon size={30} />} label="교환권" onClick={() => navigate('/vouchers')} />
          <CategoryTile icon={<LeisureIcon size={30} />} label={'레저\n이용권'} onClick={() => navigate('/experience')} />
        </div>
      </div>
    </div>
  )
}
