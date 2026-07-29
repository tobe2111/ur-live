import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/queryKeys'
import SEO from '@/components/SEO'
import { CheckCircle2 } from 'lucide-react'
import { WT } from './wholesale/wholesale-theme'

// 🏦 2026-06-09 유통스타트 도매 — 예치금 결제 완료 안내.
//   주문은 체크아웃의 POST /api/wholesale/orders 에서 이미 PAID 로 확정·장바구니 비움 완료.
//   Toss 미경유 → paymentKey/orderId/amount 없음. order id 만 읽어 안내(confirm 불필요).
//   credit 플래그(=0 예치금 결제)는 하위호환용으로 받되 분기 불필요(전부 결제 완료 안내).

export default function WholesaleSuccessPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const orderId = sp.get('order') || sp.get('orderId') || ''
  const qc = useQueryClient()

  // 🛡️ 2026-06-25 (전수조사 stale-UI P0): 주문 성공(예치금 즉시차감 PAID) 후 주문목록/예치금 잔액·거래내역이
  //   옛값 고착(전역 staleTime 30분·refetchOnMount/onWindowFocus 둘 다 false → 하드리로드 전까지 "돈 안 빠진 듯").
  //   두 주문경로(바로주문/장바구니결제) 모두 이 성공페이지로 오므로 여기서 1회 invalidate(DRY).
  useEffect(() => {
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('orders') })
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-me') })
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-requests') })
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('statement') })
    qc.invalidateQueries({ queryKey: queryKeys.wholesale('recent-items') })
  }, [qc])

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 결제 완료 - 유통스타트" description="도매 주문 결제 결과" url="/wholesale/success" noindex />
      <CheckCircle2 className="w-14 h-14 mb-4" style={{ color: WT.pos }} />
      <h1 className="text-xl font-bold mb-1" style={{ color: WT.ink }}>
        {t('wholesale.success.title', { defaultValue: '주문이 완료되었습니다' })}
      </h1>
      <p style={{ color: WT.ink2 }}>{t('wholesale.success.paidByDeposit', { defaultValue: '예치금으로 결제 완료' })}</p>
      {orderId && (
        <p className="mt-1 text-[13px] tabular-nums" style={{ color: WT.ink3 }}>
          {t('wholesale.success.orderNo', { defaultValue: '주문번호 #{{id}}', id: orderId })}
        </p>
      )}
      <div className="mb-6" />
      <div className="flex gap-3">
        <button onClick={() => navigate('/wholesale/orders')} className="px-5 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>
          {t('wholesale.success.orders', { defaultValue: '주문 내역' })}
        </button>
        <button onClick={() => navigate('/wholesale')} className="px-5 h-12 rounded-xl font-bold" style={{ background: WT.fill, color: WT.ink }}>
          {t('wholesale.success.keepShopping', { defaultValue: '계속 쇼핑' })}
        </button>
      </div>
    </div>
  )
}
