/**
 * 🛡️ 2026-05-21: 사용자/셀러/에이전시 공통 — 추천 commission 조회 + 출금 신청.
 *   - GET /api/referral-tree/my-commissions: 내 commission 리스트 + 요약
 *   - POST /api/referral-tree/withdrawals: granted 잔액 출금 신청
 *   - GET /api/referral-tree/withdrawals: 내 출금 신청 이력
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet, CheckCircle, Clock, XCircle, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SEO from '@/components/SEO'
import { formatWon } from '@/utils/format'

interface Summary {
  total_pending: number
  total_granted: number
  total_withdrawn: number
}

interface Commission {
  id: number
  order_id: number
  tier: number
  commission_amount: number
  status: string
  created_at: string
}

interface Withdrawal {
  id: number
  total_amount: number
  commission_count: number
  status: 'pending' | 'approved' | 'rejected'
  bank_name: string
  account_number: string
  account_holder: string
  requested_at: string
  processed_at: string | null
  rejection_reason: string | null
}

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: typeof CheckCircle }> = {
  pending: { label: '심사 대기', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: '송금 완료', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function MyCommissionsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Summary>({ total_pending: 0, total_granted: 0, total_withdrawn: 0 })
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [showForm, setShowForm] = useState(false)
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setLoading(true)
      const [comRes, wdRes] = await Promise.all([
        api.get('/api/referral-tree/my-commissions?page_size=20').catch(() => null),
        api.get('/api/referral-tree/withdrawals').catch(() => null),
      ])
      if (comRes?.data?.success) {
        setSummary(comRes.data.data.summary)
        setCommissions(comRes.data.data.commissions || [])
      }
      if (wdRes?.data?.success) setWithdrawals(wdRes.data.data || [])
    } finally {
      setLoading(false)
    }
  }

  async function submit() {
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      toast.error('은행명/계좌번호/예금주를 모두 입력하세요.')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post('/api/referral-tree/withdrawals', {
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_holder: accountHolder.trim(),
      })
      if (res.data.success) {
        toast.success(`출금 신청 완료 — ${formatWon(res.data.data.total_amount)} (${res.data.data.commission_count}건)`)
        setShowForm(false)
        setBankName(''); setAccountNumber(''); setAccountHolder('')
        load()
      } else {
        toast.error(res.data.error || '출금 신청 실패')
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '출금 신청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
      <SEO title="추천 Commission - 유어딜" description="3단계 추천 commission 잔액 및 출금" url="/my-commissions" />

      <header className="sticky top-0 md:top-14 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로가기">
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">추천 Commission</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 pb-20 pt-4">
        {/* 잔액 카드 */}
        <div className="rounded-3xl p-6 bg-gradient-to-br from-blue-600 to-indigo-700 text-white mb-4">
          <p className="text-[12px] opacity-80">출금 가능 commission</p>
          <p className="text-[36px] font-extrabold leading-tight mt-1">{formatWon(summary.total_granted)}</p>
          <div className="flex items-center gap-4 mt-3 text-[11px] opacity-80">
            <span>대기 {formatWon(summary.total_pending)}</span>
            <span>·</span>
            <span>누적 출금 {formatWon(summary.total_withdrawn)}</span>
          </div>
          <button
            onClick={() => setShowForm(true)}
            disabled={summary.total_granted < 10000}
            className="mt-4 w-full py-3 bg-white text-blue-700 rounded-2xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            {summary.total_granted < 10000 ? '10,000원 이상부터 출금 가능' : '출금 신청하기'}
            {summary.total_granted >= 10000 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        {/* 출금 폼 */}
        {showForm && (
          <div className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] p-4 mb-4 bg-gray-50 dark:bg-[#121212]">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">계좌 정보 입력</h3>
            <div className="space-y-2">
              <input
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="은행명 (예: 신한은행)"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white"
              />
              <input
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                placeholder="계좌번호 (- 포함 가능)"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white"
              />
              <input
                value={accountHolder}
                onChange={e => setAccountHolder(e.target.value)}
                placeholder="예금주명"
                className="w-full px-3 py-2.5 border border-gray-200 dark:border-[#2A2A2A] rounded-lg text-sm bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300">취소</button>
              <button onClick={submit} disabled={submitting} className="flex-[2] py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">
                {submitting ? '신청 중...' : `${formatWon(summary.total_granted)} 출금 신청`}
              </button>
            </div>
          </div>
        )}

        {/* 출금 이력 */}
        {withdrawals.length > 0 && (
          <section className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">출금 이력</h3>
            <div className="space-y-2">
              {withdrawals.map(w => {
                const meta = STATUS_BADGE[w.status]
                const Icon = meta.icon
                return (
                  <div key={w.id} className="rounded-xl border border-gray-200 dark:border-[#2A2A2A] p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatWon(w.total_amount)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.cls}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(w.requested_at).toLocaleString('ko-KR')} · {w.bank_name} {w.account_number}
                    </p>
                    {w.rejection_reason && (
                      <p className="text-[11px] text-red-500 mt-1">거절 사유: {w.rejection_reason}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* commission 리스트 */}
        <section>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">최근 commission</h3>
          {loading ? (
            <p className="text-xs text-gray-400 py-8 text-center">불러오는 중...</p>
          ) : commissions.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">아직 commission 이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-[#1A1A1A] border border-gray-100 dark:border-[#1A1A1A] rounded-xl overflow-hidden">
              {commissions.map(c => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5 text-[12px]">
                  <div>
                    <p className="text-gray-900 dark:text-white">주문 #{c.order_id} · {c.tier}단계</p>
                    <p className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString('ko-KR')} · {c.status}</p>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{formatWon(c.commission_amount)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
