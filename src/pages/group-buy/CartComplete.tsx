/**
 * 🧺 장바구니 결제 완료 — 여러 매장의 이용권을 한 번에 샀을 때 (2026-09-15)
 *
 * ## 왜 `PaymentCompleteTicket` 을 그대로 못 쓰나
 * 그 화면은 **한 상품의 티켓 한 장**이다 — 매장명·사용기한·할인율·"이 매장 다른 이용권" 이 전부
 * 상품 하나에 매여 있다. 장바구니는 매장이 여럿일 수 있어서 그 자리에 무엇을 쓸지 정해지지 않는다.
 * 억지로 첫 상품으로 채우면 **나머지를 안 산 것처럼 보인다.**
 *
 * ⇒ 한 상품만 샀으면 호출부가 기존 티켓을 쓰고(같은 화면을 두 벌로 만들지 않는다),
 *   여럿일 때만 이 화면이 뜬다. 여기서는 **몇 장 · 얼마 · 어디서 보나** 셋만 말한다.
 *
 * ⚠️ 낱장 티켓을 여기 늘어놓지 않는다 — 지갑이 그 일을 이미 하고, 여기서 또 그리면 두 화면이 갈린다.
 */
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { TicketCard, TicketRow, TicketOutlineButton, TicketNotes } from '@/components/ticket/TicketCard'
import { CategoryTile, MealIcon, BeautyIcon, StayIcon, GiftIcon, LeisureIcon } from '@/components/icons/category-icons'

export default function CartComplete({ qty, kinds, amount }: { qty: number; kinds: number; amount: number }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-warm text-gray-900 dark:text-white">
      <div className="ur-content-narrow px-4 lg:px-8 pt-3 pb-10">
        <div className="flex justify-end">
          <button type="button" onClick={() => navigate('/')} aria-label="닫기" className="w-10 h-10 -mr-2 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <X className="w-6 h-6" strokeWidth={1.6} />
          </button>
        </div>
        <h1 className="text-center text-[24px] font-extrabold tracking-[-0.02em] mt-3 mb-6">결제가 완료되었어요</h1>

        {/* 밴드 오른쪽에 D-N 을 못 쓴다 — 이용권마다 기한이 달라서 하나를 고르면 나머지가 거짓이 된다. */}
        <TicketCard bandLeft="이용권 발급 완료" bandRight={`${kinds}종`}>
          <TicketRow left="이용권" right={`${qty}매`} />
          <div className="px-4 pt-4 pb-4">
            <p className="text-[13px] text-gray-500 dark:text-gray-400">사용 기한은 이용권마다 달라요</p>
            <div className="flex items-baseline gap-2.5 mt-3 mb-4 tabular-nums">
              <span className="text-[30px] font-extrabold tracking-[-0.03em] leading-none">{formatNumber(amount)}원</span>
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
