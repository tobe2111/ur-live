// ──────────────────────────────────────────────────────────────
// 🏦 2026-06-09 유통사 예치금(선불 충전) — Toss 대체 결제수단.
//   잔액 + 충전 신청(입금 안내) + 충전 신청 내역 + 거래 내역.
//   송금 → 관리자 확인 → 충전. WT 라이트 고정 B2B 서피스.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Wallet, LogOut, ShoppingCart, Loader2, Copy, ArrowDownCircle, ArrowUpCircle,
  RotateCcw, SlidersHorizontal, Building2,
} from 'lucide-react'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { WT, won, comma, GRADE_LABEL } from './wholesale/wholesale-theme'
import { buildWholesaleNav } from './wholesale/wholesale-nav'
import {
  useWholesaleMe, useWholesaleDeposit, useWholesaleChargeRequests,
  useWholesaleChargeRequestMutation, useWholesaleMall,
  type WholesaleDepositTxn, type WholesaleChargeStatus,
} from '@/hooks/queries/useWholesale'
import { useWholesaleCart } from './wholesale/useWholesaleCart'
import { clearAuthData } from '@/utils/auth'
import WholesaleDashboardShell from '@/components/wholesale/WholesaleDashboardShell'

const QUICK_AMOUNTS = [100000, 500000, 1000000, 3000000]

const CHARGE_STATUS: Record<WholesaleChargeStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '대기', color: WT.ink3, bg: WT.fill },
  confirmed: { label: '완료', color: WT.pos, bg: WT.posBg },
  rejected: { label: '반려', color: '#B3253B', bg: '#FDECEF' },
}

const TXN_META: Record<WholesaleDepositTxn['type'], { label: string; icon: typeof ArrowDownCircle; positive: boolean }> = {
  charge: { label: '충전', icon: ArrowDownCircle, positive: true },
  order: { label: '주문 결제', icon: ArrowUpCircle, positive: false },
  refund: { label: '환불', icon: RotateCcw, positive: true },
  adjust: { label: '조정', icon: SlidersHorizontal, positive: true },
}

export default function WholesaleDepositPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const isDistributor = typeof window !== 'undefined' && localStorage.getItem('is_distributor') === '1'

  useEffect(() => {
    if (!token) { navigate('/wholesale/login', { replace: true }); return }
    if (!isDistributor) { navigate('/wholesale', { replace: true }); return }
  }, [token, isDistributor, navigate])

  const meQ = useWholesaleMe()
  const depositQ = useWholesaleDeposit()
  const requestsQ = useWholesaleChargeRequests()
  const chargeMut = useWholesaleChargeRequestMutation()
  // 🏬 멀티-몰 브랜딩 — 셸 워드마크(기본 몰 → 유통스타트 → 동작 불변).
  const { displayName: mallName } = useWholesaleMall()
  const cart = useWholesaleCart()

  const me = (meQ.data ?? null) as { grade: string } | null
  const grade = me?.grade || 'C'
  const company = (typeof window !== 'undefined' && localStorage.getItem('seller_name')) || '유통사'

  const balance = Number(depositQ.data?.balance) || 0
  const depositAccount = depositQ.data?.deposit_account || ''
  const txns = depositQ.data?.recent_txns ?? []
  const requests = requestsQ.data ?? []

  const [amount, setAmount] = useState<number>(0)
  const [depositorName, setDepositorName] = useState('')
  const [showGuide, setShowGuide] = useState(false)

  const navItems = buildWholesaleNav(location.pathname, navigate)

  const logout = () => {
    clearAuthData('seller')
    try { localStorage.removeItem('is_distributor') } catch { /* ignore */ }
    window.location.assign('/wholesale')
  }

  const submitDisabled = chargeMut.isPending || !Number.isFinite(amount) || amount < 1 || !depositorName.trim()

  async function submitCharge() {
    if (submitDisabled) return
    try {
      const res = await chargeMut.mutateAsync({ amount: Math.round(amount), depositor_name: depositorName.trim() })
      if (res?.success) {
        toast.success(t('wholesale.deposit.chargeRequested', { defaultValue: '입금 확인 후 충전됩니다' }))
        setShowGuide(true)
        setAmount(0)
      } else {
        toast.error(t('wholesale.deposit.chargeFailed', { defaultValue: '충전 신청에 실패했습니다' }))
      }
    } catch {
      toast.error(t('wholesale.deposit.chargeFailed', { defaultValue: '충전 신청에 실패했습니다' }))
    }
  }

  const copyAccount = () => {
    if (!depositAccount) return
    try {
      navigator.clipboard?.writeText(depositAccount)
      toast.success(t('common.copied', { defaultValue: '복사되었습니다' }))
    } catch { /* clipboard 미지원 — 무시 */ }
  }

  const headerRight = (
    <>
      <span
        className="hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold"
        style={{ background: WT.brandSoft, color: WT.brand }}
      >
        {GRADE_LABEL[grade] || grade}{t('wholesale.gradeSuffix', { defaultValue: '등급' })}
      </span>
      <button
        onClick={() => navigate('/wholesale/cart')}
        aria-label={t('common.cart', { defaultValue: '장바구니' })}
        className="relative shrink-0 p-1.5 rounded-lg hover:bg-gray-100"
        style={{ color: WT.ink2 }}
      >
        <ShoppingCart className="w-5 h-5" />
        {cart.count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: WT.brand }}>
            {cart.count}
          </span>
        )}
      </button>
      <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">{t('common.logout', { defaultValue: '로그아웃' })}</span>
      </button>
    </>
  )

  return (
    <WholesaleDashboardShell
      brand={mallName}
      brandSubtitle={company}
      navItems={navItems}
      title={t('wholesale.deposit.title', { defaultValue: '예치금' })}
      headerRight={headerRight}
    >
      <SEO title="예치금 - 유통스타트 도매몰" description="예치금을 충전하고 도매 주문 결제에 사용하세요." url="/wholesale/deposits" noindex />

      <div className="space-y-5">
        {/* 잔액 카드 */}
        <section className="rounded-2xl p-5" style={{ background: WT.ink, boxShadow: WT.shCard }}>
          <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
            <Wallet className="w-4 h-4" />
            {t('wholesale.deposit.balanceLabel', { defaultValue: '현재 예치금 잔액' })}
          </div>
          <div className="mt-2 text-[34px] font-extrabold tabular-nums text-white">
            {depositQ.isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : won(balance)}
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {t('wholesale.deposit.balanceHint', { defaultValue: '예치금으로 도매 주문을 즉시 결제합니다. 잔액이 부족하면 충전하세요.' })}
          </p>
        </section>

        {/* 충전 신청 폼 */}
        <section className="rounded-2xl bg-white p-5" style={{ boxShadow: WT.shSoft }}>
          <h2 className="text-[15px] font-extrabold mb-1" style={{ color: WT.ink }}>
            {t('wholesale.deposit.chargeTitle', { defaultValue: '예치금 충전 신청' })}
          </h2>
          <p className="text-[12px] mb-4" style={{ color: WT.ink3 }}>
            {t('wholesale.deposit.chargeFlow', { defaultValue: '송금 → 관리자 확인 → 충전 순서로 처리됩니다.' })}
          </p>

          {/* 빠른 금액 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {QUICK_AMOUNTS.map((amt) => {
              const on = amount === amt
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className="h-11 rounded-xl text-[14px] font-bold tabular-nums transition"
                  style={{
                    border: '1.5px solid ' + (on ? WT.brand : WT.line),
                    background: on ? WT.brandSoft : '#fff',
                    color: on ? WT.brand : WT.ink,
                  }}
                >
                  {comma(amt)}
                </button>
              )
            })}
          </div>

          {/* 직접 입력 */}
          <label className="block text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>
            {t('wholesale.deposit.amountLabel', { defaultValue: '충전 금액(원)' })}
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={amount > 0 ? String(amount) : ''}
            onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            placeholder={t('wholesale.deposit.amountPlaceholder', { defaultValue: '직접 입력' })}
            className="w-full h-12 px-3.5 rounded-xl text-[15px] font-bold text-gray-900 tabular-nums mb-3"
            style={{ border: '1.5px solid ' + WT.line, background: WT.fill2 }}
          />

          {/* 입금자명 */}
          <label className="block text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>
            {t('wholesale.deposit.depositorLabel', { defaultValue: '입금자명' })}
          </label>
          <input
            type="text"
            value={depositorName}
            onChange={(e) => setDepositorName(e.target.value)}
            placeholder={t('wholesale.deposit.depositorPlaceholder', { defaultValue: '실제 송금하실 입금자명' })}
            maxLength={40}
            className="w-full h-12 px-3.5 rounded-xl text-[15px] font-medium text-gray-900 mb-4"
            style={{ border: '1.5px solid ' + WT.line, background: WT.fill2 }}
          />

          <button
            type="button"
            onClick={submitCharge}
            disabled={submitDisabled}
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold text-white disabled:opacity-50"
            style={{ background: WT.brand }}
          >
            {chargeMut.isPending
              ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('common.processing', { defaultValue: '처리 중...' })}</span>
              : t('wholesale.deposit.submitCharge', { defaultValue: '충전 신청하기' })}
          </button>

          {/* 입금 안내 박스 */}
          {(showGuide || !!depositAccount) && (
            <div className="mt-4 rounded-xl p-4" style={{ background: WT.brandSoft, border: '1px solid #F8C9D2' }}>
              <div className="flex items-center gap-2 text-[13px] font-extrabold mb-1.5" style={{ color: WT.brand }}>
                <Building2 className="w-4 h-4" />
                {t('wholesale.deposit.guideTitle', { defaultValue: '입금 안내' })}
              </div>
              {depositAccount ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{depositAccount}</span>
                  <button
                    type="button"
                    onClick={copyAccount}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 h-8 rounded-lg text-[12px] font-bold"
                    style={{ background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line }}
                  >
                    <Copy className="w-3.5 h-3.5" /> {t('common.copy', { defaultValue: '복사' })}
                  </button>
                </div>
              ) : (
                <p className="text-[13px] font-medium" style={{ color: WT.ink2 }}>
                  {t('wholesale.deposit.noAccount', { defaultValue: '관리자에게 입금 계좌를 문의하세요.' })}
                </p>
              )}
              <p className="mt-2 text-[12px]" style={{ color: WT.ink3 }}>
                {t('wholesale.deposit.guideNote', { defaultValue: '위 계좌로 송금하시면 관리자 확인 후 예치금이 충전됩니다. 입금자명을 정확히 입력해주세요.' })}
              </p>
            </div>
          )}
        </section>

        {/* 충전 신청 내역 */}
        <section className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: WT.shSoft }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid ' + WT.line }}>
            <h2 className="text-[14px] font-extrabold" style={{ color: WT.ink }}>
              {t('wholesale.deposit.requestsTitle', { defaultValue: '충전 신청 내역' })}
            </h2>
          </div>
          {requestsQ.isLoading ? (
            <div className="py-10 text-center text-[13px]" style={{ color: WT.ink4 }}>{t('common.loading', { defaultValue: '불러오는 중…' })}</div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: WT.ink3 }}>{t('wholesale.deposit.noRequests', { defaultValue: '충전 신청 내역이 없습니다.' })}</div>
          ) : (
            <ul>
              {requests.map((r) => {
                const badge = CHARGE_STATUS[r.status] || CHARGE_STATUS.pending
                return (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid ' + WT.line }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold tabular-nums" style={{ color: WT.ink }}>{won(r.amount)}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: WT.ink3 }}>
                        {r.depositor_name} · {(r.created_at || '').slice(0, 10)}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ color: badge.color, background: badge.bg }}>
                      {badge.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* 거래 내역 */}
        <section className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: WT.shSoft }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid ' + WT.line }}>
            <h2 className="text-[14px] font-extrabold" style={{ color: WT.ink }}>
              {t('wholesale.deposit.txnsTitle', { defaultValue: '예치금 거래 내역' })}
            </h2>
          </div>
          {depositQ.isLoading ? (
            <div className="py-10 text-center text-[13px]" style={{ color: WT.ink4 }}>{t('common.loading', { defaultValue: '불러오는 중…' })}</div>
          ) : txns.length === 0 ? (
            <div className="py-10 text-center text-[13px]" style={{ color: WT.ink3 }}>{t('wholesale.deposit.noTxns', { defaultValue: '거래 내역이 없습니다.' })}</div>
          ) : (
            <ul>
              {txns.map((tx, i) => {
                const meta = TXN_META[tx.type] || TXN_META.adjust
                const Icon = meta.icon
                const positive = tx.amount >= 0
                const sign = positive ? '+' : '−'
                const amtColor = positive ? WT.pos : WT.brand
                return (
                  <li key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: '1px solid ' + WT.line }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: WT.fill }}>
                      <Icon className="w-4 h-4" style={{ color: positive ? WT.pos : WT.ink2 }} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold" style={{ color: WT.ink }}>{meta.label}</div>
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: WT.ink3 }}>
                        {tx.memo ? `${tx.memo} · ` : ''}{(tx.created_at || '').slice(0, 16).replace('T', ' ')}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[14px] font-extrabold tabular-nums" style={{ color: amtColor }}>
                        {sign}{won(Math.abs(tx.amount))}
                      </div>
                      <div className="text-[11px] tabular-nums" style={{ color: WT.ink4 }}>
                        {t('wholesale.deposit.balanceAfter', { defaultValue: '잔액' })} {won(tx.balance_after)}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </WholesaleDashboardShell>
  )
}
