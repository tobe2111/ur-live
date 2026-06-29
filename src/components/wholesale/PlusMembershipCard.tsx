// ──────────────────────────────────────────────────────────────
// 🏅 2026-06-16 Standard 멤버십(연 구독) 카드 — 대시보드용. (등급명: Basic/Standard/Premium = C/B/A)
//   도매몰은 PG 미사용 → 예치금(계좌이체 충전 잔액)에서 연 구독료 차감.
//   Basic(C) → 구독 CTA / Standard(B) → 만료일·연장 / Premium(A) → 최저가 안내(구독 불필요).
//   라이트 고정(WT). 등급은 GRADE_NAME(Basic/Standard/Premium)로 표기.
// ──────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Crown, Sparkles, Loader2, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { WT, won } from '@/pages/wholesale/wholesale-theme'

interface PlusInfo {
  fee: number; balance: number; grade: string; plus_until: string | null
  is_plus: boolean; is_premium: boolean; can_afford: boolean
}

const sellerAuth = () => ({ headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('seller_token') : ''}` } })
const fmtDate = (s: string | null) => (s || '').slice(0, 10)

export default function PlusMembershipCard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [info, setInfo] = useState<PlusInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get('/api/wholesale/plus/info', sellerAuth())
      .then((r) => { if (r.data?.success) setInfo(r.data) })
      .catch(() => { /* graceful — 카드 숨김 */ })
  }, [])
  useEffect(() => { load() }, [load])

  const subscribe = async () => {
    if (busy || !info) return
    if (info.balance < info.fee) {
      toast.error(`예치금이 부족해요 — ${won(info.fee - info.balance)} 더 필요`)
      navigate('/wholesale/deposits')
      return
    }
    const ok = await confirmDialog({
      title: 'Standard 멤버십 구독',
      message: `예치금에서 ${won(info.fee)}이 차감되고 1년간 Standard 등급(더 낮은 공급가)이 적용됩니다. 진행할까요?`,
    })
    if (!ok) return
    setBusy(true)
    try {
      const r = await api.post('/api/wholesale/plus/subscribe', {}, sellerAuth())
      if (r.data?.success) {
        toast.success('Standard 멤버십이 시작됐어요 🎉')
        setInfo((p) => p ? { ...p, is_plus: true, grade: 'B', plus_until: r.data.plus_until, balance: r.data.balance } : p)
        qc.invalidateQueries({ queryKey: queryKeys.wholesale('me') })
        qc.invalidateQueries({ queryKey: queryKeys.wholesale('deposit-me') })
        qc.invalidateQueries({ queryKey: queryKeys.wholesale('catalog') })
      } else {
        toast.error(r.data?.error || '구독 처리에 실패했어요')
      }
    } catch (e) {
      const resp = (e as { response?: { status?: number; data?: { error?: string; code?: string } } })?.response
      if (resp?.status === 402) { toast.error(resp.data?.error || '예치금이 부족합니다'); navigate('/wholesale/deposits'); return }
      toast.error(resp?.data?.error || '구독 처리 중 오류가 발생했어요')
    } finally { setBusy(false); load() }
  }

  if (!info) return null

  // Premium(A) — 구독 불필요.
  if (info.is_premium) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: WT.ink, boxShadow: WT.shCard }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.14)' }}>
          <Crown className="w-5 h-5" style={{ color: '#FFC53D' }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold text-white">Premium 회원</div>
          <div className="text-[12px]" style={{ color: 'rgba(255,255,255,0.65)' }}>최저 공급가가 적용 중이에요 (매출 기준 자동 등급)</div>
        </div>
      </div>
    )
  }

  // Standard(B) — 만료일 + (만료 임박 시) 연장.
  if (info.is_plus) {
    return (
      <div className="rounded-2xl p-4 flex items-center gap-3 bg-white" style={{ border: '1px solid ' + WT.line2 }}>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.brandSoft }}>
          <Sparkles className="w-5 h-5" style={{ color: WT.brand }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold" style={{ color: WT.ink }}>Standard 회원</div>
          <div className="text-[12px]" style={{ color: WT.ink3 }}>만료 {fmtDate(info.plus_until)} · 연 {won(info.fee)}</div>
        </div>
        <button onClick={subscribe} disabled={busy}
          className="shrink-0 inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[12.5px] font-bold disabled:opacity-50"
          style={{ border: '1px solid ' + WT.line2, color: WT.ink }}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '연장'}
        </button>
      </div>
    )
  }

  // Basic(C) — 구독 CTA.
  return (
    <div className="rounded-2xl p-4 bg-white" style={{ border: '1px solid ' + WT.brand + '33' }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0" style={{ background: WT.brandSoft }}>
          <Sparkles className="w-5 h-5" style={{ color: WT.brand }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold" style={{ color: WT.ink }}>Standard 멤버십 — 연 {won(info.fee)}</div>
          <div className="text-[12px]" style={{ color: WT.ink3 }}>구독하면 더 낮은 공급가로 사입 · 예치금에서 결제</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={subscribe} disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-11 rounded-xl text-white text-[13.5px] font-bold disabled:opacity-60"
          style={{ background: WT.brand }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /> Standard 구독하기</>}
        </button>
        {!info.can_afford && (
          <button onClick={() => navigate('/wholesale/deposits')}
            className="inline-flex items-center gap-0.5 h-11 px-3 rounded-xl text-[12.5px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
            예치금 충전 <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: WT.ink4 }}>현재 예치금 {won(info.balance)} · Premium(A)은 매출 달성 시 자동 승급</p>
    </div>
  )
}
