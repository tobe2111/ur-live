import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'

/**
 * 💳 유어애즈 서비스몰 토스 결제 모달 (2026-07-27) — V2 위젯(widgets) 플로우.
 *   소비자 결제 컴포넌트(TossPaymentWidget — 감사잠금)와 **별개 신규**: ads 계정 인증(/api/ads-pay/*),
 *   ad_service_orders 전용. 잠금 파일 무접촉 — 같은 V2 SDK 패턴만 따름(orderName 100자·클릭시점 검증은
 *   Toss NEED_AGREEMENT 백스톱). lazy 로드(이 모달을 열 때만 SDK 청크 다운로드).
 */
interface PayOrder { id: number; service_name: string; total_amount: number }

export default function AdsTossPayModal({ order, authHeader, onClose }: {
  order: PayOrder
  authHeader: () => Record<string, string>
  onClose: () => void
}) {
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const widgetsRef = useRef<{ requestPayment: (p: Record<string, unknown>) => Promise<void> } | null>(null)
  const initRef = useRef<{ toss_order_id: string; amount: number; order_name: string } | null>(null)

  useEffect(() => {
    let dead = false
    ;(async () => {
      try {
        const [cfg, init] = await Promise.all([
          api.get('/api/ads-pay/config', { headers: authHeader() }),
          api.post('/api/ads-pay/init', { order_id: order.id }, { headers: authHeader() }),
        ])
        if (dead) return
        if (!cfg.data?.enabled || !cfg.data?.client_key) { setErr('카드 결제가 아직 활성화되지 않았습니다'); return }
        if (!init.data?.success) { setErr(init.data?.error || '결제를 시작할 수 없습니다'); return }
        initRef.current = init.data
        const toss = await loadTossPayments(cfg.data.client_key)
        const widgets = toss.widgets({ customerKey: init.data.customer_key })
        await widgets.setAmount({ currency: 'KRW', value: init.data.amount })
        await widgets.renderPaymentMethods({ selector: '#ads-toss-methods', variantKey: 'DEFAULT' })
        widgets.renderAgreement({ selector: '#ads-toss-agreement', variantKey: 'AGREEMENT' }).catch(() => null) // 비대기 — 미동의는 Toss NEED_AGREEMENT 백스톱
        if (!dead) { widgetsRef.current = widgets as unknown as typeof widgetsRef.current; setReady(true) }
      } catch { if (!dead) setErr('결제 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해주세요') }
    })()
    return () => { dead = true }
  }, [order.id, authHeader])

  async function pay() {
    const w = widgetsRef.current, init = initRef.current
    if (!w || !init) return
    setPaying(true)
    try {
      // 성공 리다이렉트 → 현재 페이지 쿼리(adsPaySvc)로 복귀 — 패널 useEffect 가 confirm 호출.
      const base = `${window.location.origin}${window.location.pathname}`
      await w.requestPayment({
        orderId: init.toss_order_id,
        orderName: init.order_name,
        successUrl: `${base}?adsPaySvc=${order.id}`,
        failUrl: `${base}?adsPayFail=1`,
      })
    } catch (e) {
      const msg = (e as { message?: string })?.message || ''
      if (msg) toast.error(msg) // 약관 미동의(NEED_AGREEMENT)·사용자 취소 등 — Toss 가 안전 문구 제공
      setPaying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#131A24] p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[14px] font-bold text-gray-900 dark:text-white">💳 카드 결제</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-[13px]">닫기</button>
        </div>
        <div className="text-[13px] text-gray-600 dark:text-gray-300 mb-2">{order.service_name} · <b>{formatNumber(order.total_amount)}원</b></div>
        {err ? (
          <div className="py-8 text-center text-[13px] text-red-500">{err}</div>
        ) : (
          <>
            <div id="ads-toss-methods" />
            <div id="ads-toss-agreement" />
            {!ready && <div className="py-8 text-center text-[13px] text-gray-400">결제 수단을 불러오는 중…</div>}
            <button onClick={pay} disabled={!ready || paying}
              className="mt-3 w-full rounded-lg bg-gray-900 dark:bg-white py-2.5 text-[13px] font-bold text-white dark:text-[#0F151D] disabled:opacity-40">
              {paying ? '결제창 여는 중…' : `${formatNumber(order.total_amount)}원 결제하기`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
