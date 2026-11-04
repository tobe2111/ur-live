/**
 * ⑤ 첫 이용권 올림 완료 — 2026-11-03 대표 확정 시안.
 * 도장 찍는 유달이 + **손님에게 보일 카드 미리보기** + 판매 시작까지 남은 일(사업자등록증 · 정산 계좌).
 * 미리보기는 방금 입력한 값만 쓴다(요청 0) — 서버가 승인 전이라 아직 손님 화면에 없기 때문이다.
 */
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Udal from '@/components/mascot/Udal'
import DealRow from '@/components/deal/DealRow'
import { MY_PATH } from '@/lib/seller-return'
import { STORE_BIZ_CERT_PATH, STORE_BANK_PATH } from './first-voucher-path'

interface Props {
  createdId: number
  storeName: string
  region: string
  name: string
  price: number
  originalPrice: number
  pct: number
  photo: string
}

export default function FirstVoucherDone({ storeName, region, name, price, originalPrice, pct, photo }: Props) {
  const navigate = useNavigate()
  const todos = [
    { n: 1, title: '사업자등록증 올리기', desc: '승인에 필요해요', to: STORE_BIZ_CERT_PATH, first: true },
    { n: 2, title: '정산 받을 계좌', desc: '판매 금액이 들어갈 곳이에요', to: STORE_BANK_PATH, first: false },
  ]
  return (
    <div className="ur-rise flex-1 min-h-0 flex flex-col px-5 pb-[calc(16px+env(safe-area-inset-bottom,0px))]" data-testid="first-voucher-done">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1">
        <div className="flex flex-col items-center text-center">
          <Udal mood="done" size={112} motion priority />
          <h1 className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">첫 이용권을 올렸어요</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">승인되면 손님에게 보이고 판매가 시작돼요.</p>
        </div>

        <p className="mt-8 mb-2 text-[13px] text-ink-soft">손님에게 이렇게 보여요</p>
        {/* 🃏 손님 화면과 같은 카드 부품(`DealRow`) — 손으로 그린 흉내가 아니라 실제 모양이다(딜 카드 한 벌 규칙). */}
        <div data-testid="first-voucher-preview">
          <DealRow surface="plain" imageUrl={photo || null} eyebrow={[storeName, region].filter(Boolean).join(', ')}
            title={name} price={price} originalPrice={originalPrice > price ? originalPrice : null} discountPct={pct > 0 ? pct : undefined} />
        </div>

        <div className="mt-8 pt-5 border-t border-rule">
          <p className="text-[16px] font-semibold">판매 시작까지 남은 일</p>
          <ul className="mt-2">
            {todos.map((t, i) => (
              <li key={t.n} className="ur-rise" style={{ animationDelay: `${200 + i * 90}ms` }}>
                <Link to={t.to} className={`flex items-center gap-3 py-3 ${i < todos.length - 1 ? 'border-b border-rule' : ''}`}>
                  <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[12px] font-medium ${t.first ? 'bg-brand text-white' : 'bg-brand-tint text-brand-text'}`}>{t.n}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-medium">{t.title}</span>
                    <span className="block mt-1 text-[13px] text-ink-soft">{t.desc}</span>
                  </span>
                  {t.first ? <span className="text-[13px] font-medium text-brand-text">지금</span> : <ChevronRight size={18} strokeWidth={1.6} className="text-ink-soft" aria-hidden="true" />}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="shrink-0 pt-3 flex flex-col gap-1">
        <Link to={STORE_BIZ_CERT_PATH} className="ur-btn ur-btn-lg ur-btn-primary w-full">사업자등록증 올리기</Link>
        <button type="button" onClick={() => navigate(MY_PATH, { replace: true })} className="h-11 text-[15px] text-ink-soft">나중에 할게요 · 마이로</button>
      </div>
    </div>
  )
}
