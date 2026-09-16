import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { DashboardCard } from '@/components/dashboard'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import VoucherRedeemModal from './VoucherRedeemModal'

// 🛡️ 2026-06-10: SellerSettlementsPage 분해 — 순수 이동 (동작 변화 0).
// 🛡️ 2026-05-18: 딜 잔액 + 환급 + 원천징수 카드 (셀러 본인용)
export default function DealBalanceCard() {
  const [balance, setBalance] = useState<{
    gated_deal_amount: number
    redeemable_deal_amount: number
    total: number
    business_verified: boolean
    withdrawable: number
    notice: string
  } | null>(null)
  const [tax, setTax] = useState<{
    year: number; total_gross: number; total_withheld: number; total_net: number
    payouts_count: number; reportable: boolean; threshold: number
  } | null>(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) return
    api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setBalance(r.data.data) }).catch(() => { /* noop */ })
    api.get('/api/seller/tax-summary', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setTax(r.data.data) }).catch(() => { /* noop */ })
  }, [])

  async function withdraw() {
    const amount = Number(withdrawAmount) || 0
    if (amount < 10_000) { toast.error('최소 환급 금액은 10,000 딜입니다'); return }
    if (balance && amount > balance.withdrawable) {
      toast.error(`환급 가능 잔액 부족 (보유: ${balance.withdrawable.toLocaleString()})`); return
    }
    // 🛡️ 2026-06-11 (감사 — CLAUDE.md 원천징수 hardcode 금지 룰 위반이었음): 세율은 서버가
    //   sellers.tax_type 별 계산(기본 3.3% 사업소득 / 8.8% 기타소득) — 클라 고정 8.8% 는 대부분
    //   셀러에게 잘못된 예상액이었음. 정확한 금액은 신청 응답(gross/net)으로 안내.
    if (!(await confirmDialog(`${amount.toLocaleString()}딜 환급 신청? (사업자 유형에 따른 원천징수 3.3%/8.8% 차감 후 입금 — 정확한 금액은 신청 직후 표시됩니다)`))) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('seller_token')
      const sellerBankName = localStorage.getItem('seller_bank_name') || ''
      const sellerAccountNumber = localStorage.getItem('seller_account_number') || ''
      const sellerAccountHolder = localStorage.getItem('seller_account_holder') || localStorage.getItem('seller_name') || ''
      const r = await api.post('/api/seller/deal-withdraw', {
        amount,
        bank_name: sellerBankName,
        account_number: sellerAccountNumber,
        account_holder: sellerAccountHolder,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(r.data.data.message || '환급 신청 완료')
        setWithdrawOpen(false)
        setWithdrawAmount('')
        // 잔액 다시 로드.
        api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
          .then(rr => { if (rr.data?.success) setBalance(rr.data.data) })
        api.get('/api/seller/tax-summary', { headers: { Authorization: `Bearer ${token}` } })
          .then(rr => { if (rr.data?.success) setTax(rr.data.data) })
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; code?: string } } }
      if (ax.response?.data?.code === 'BUSINESS_REGISTRATION_REQUIRED') {
        toast.error('사업자등록증 검증 후 환급 가능합니다')
      } else if (ax.response?.data?.code === 'PIN_REQUIRED') {
        toast.error('PIN 인증이 필요합니다 — 프로필에서 설정해주세요')
      } else {
        toast.error(ax.response?.data?.error || '환급 실패')
      }
    } finally { setSubmitting(false) }
  }

  if (!balance) return null

  return (
    <DashboardCard>
      <div className="space-y-3">
        {/* 📱 2026-09-15 모바일 특화 + 🎫 규칙 ⑥: 잔액 큰 숫자 한 줄 → 행동 버튼은 폰에서 **한 줄 전체**(둘이면 반반), PC 는 우측.
            이모지·색깔 상자(emerald/amber) 제거 — 톤은 글자 색 한 곳으로만. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500">딜 잔액</p>
            <p className="dash-num mt-1 text-[22px] font-extrabold text-gray-900 sm:text-2xl">
              {balance.total.toLocaleString()}<span className="ml-1 text-sm font-medium">딜</span>
            </p>
          </div>
          {(balance.total > 0 || (balance.business_verified && balance.withdrawable > 0)) && (
            <div className="flex gap-2">
              {balance.business_verified && balance.withdrawable > 0 && (
                <button type="button" onClick={() => setWithdrawOpen(true)} className="ur-btn ur-btn-sm ur-btn-secondary flex-1 sm:flex-none">
                  환급 신청
                </button>
              )}
              {/* 🛡️ 2026-05-19: 모든 셀러 (검증/미검증 둘 다) 가 교환권으로 받기 가능 */}
              {balance.total > 0 && (
                <button type="button" onClick={() => setVoucherOpen(true)} className="ur-btn ur-btn-sm ur-btn-primary flex-1 sm:flex-none">
                  교환권으로 받기
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 divide-x divide-rule rounded-lg border border-rule text-xs">
          <div className="px-3 py-2">
            <p className="font-semibold text-gray-500">환급 가능</p>
            <p className="dash-num mt-0.5 text-[15px] font-extrabold text-gray-900">
              {balance.withdrawable.toLocaleString()}
            </p>
          </div>
          <div className="px-3 py-2">
            <p className="font-semibold text-gray-500">플랫폼 안에서만 사용</p>
            <p className="dash-num mt-0.5 text-[15px] font-extrabold text-gray-900">
              {(balance.total - balance.withdrawable).toLocaleString()}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-gray-500">{balance.notice}</p>

        {/* 원천징수 현황 (verified 셀러만) */}
        {balance.business_verified && tax && tax.payouts_count > 0 && (
          <div className="mt-2 border-t border-rule pt-3">
            <p className="mb-2 text-xs font-bold text-gray-500">{tax.year}년 원천징수 현황</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">총 지급</p>
                <p className="dash-num truncate font-bold text-gray-900">₩{tax.total_gross.toLocaleString()}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">원천징수 3.3%/8.8%</p>
                <p className="dash-num truncate font-bold text-tone-bad">-₩{tax.total_withheld.toLocaleString()}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500">실 수령</p>
                <p className="dash-num truncate font-bold text-tone-ok">₩{tax.total_net.toLocaleString()}</p>
              </div>
            </div>
            {tax.reportable && (
              <p className="mt-2 text-[11px] font-semibold text-tone-warn">
                연 누계 300만원 초과. 다음 해 5월 종합소득세 신고 의무 (분리과세 아님)
              </p>
            )}
          </div>
        )}
      </div>

      {/* 환급 모달 */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[10500] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => !submitting && setWithdrawOpen(false)}>
          <div className="bg-white rounded-[var(--dash-radius,16px)] w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">딜 환급 신청</h3>
            <p className="text-xs text-gray-500 mb-4">원천징수(사업자 3.3% / 비사업자 8.8%) 후 계좌 입금 — 최소 10,000 딜</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">환급 금액</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder={`최대 ${balance.withdrawable.toLocaleString()}`}
                min={10000}
                max={balance.withdrawable}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                disabled={submitting}
              />
              {withdrawAmount && Number(withdrawAmount) >= 10000 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-0.5">
                  <p className="flex justify-between"><span className="text-gray-500">총 지급 신청</span><span className="font-bold">₩{Number(withdrawAmount).toLocaleString()}</span></p>
                  {/* 🛡️ 2026-06-25: 원천징수율 hardcode 금지(CLAUDE.md) — 8.8% 고정은 사업소득(기본 3.3%) 셀러에게
                      실수령을 과소표시. 실 세율은 셀러 소득유형(business_income 3.3% / other_income 8.8%)에 따라
                      서버(withholdAndLog)가 적용하므로, 클라는 잘못된 숫자를 만들지 않고 안내만. */}
                  <p className="text-gray-500 pt-1 border-t border-gray-200 leading-relaxed">
                    실 지급액은 소득 유형에 따라 원천징수(사업소득 3.3% / 기타소득 8.8%) 후 입금됩니다.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setWithdrawOpen(false)} disabled={submitting}
                className="ur-btn ur-btn-md ur-btn-secondary flex-1">
                취소
              </button>
              <button type="button" onClick={withdraw} disabled={submitting || Number(withdrawAmount) < 10000}
                className="ur-btn ur-btn-md ur-btn-primary flex-1">
                {submitting ? '신청 중...' : '환급 신청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-19: 교환권으로 받기 모달 */}
      {voucherOpen && (
        <VoucherRedeemModal
          totalBalance={balance.total}
          onClose={() => setVoucherOpen(false)}
          onSuccess={() => {
            setVoucherOpen(false)
            // 잔액 갱신
            const token = localStorage.getItem('seller_token')
            api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
              .then(rr => { if (rr.data?.success) setBalance(rr.data.data) })
          }}
        />
      )}
    </DashboardCard>
  )
}
