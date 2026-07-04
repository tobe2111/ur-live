/**
 * 🎯 2026-07-01 (대표 — 동네딜 추첨 응모): 상세 페이지 추첨 응모 블록.
 *
 *   이 상품이 추첨 대상(fcfs_enabled)일 때만 노출 — 아니면 렌더 0(null). 결제 없음(응모형).
 *   상세 페이지의 --gbd-* CSS 변수로 페이지와 동일 톤. 잠긴 결제(Toss)/SSR 무접촉(독립 컴포넌트).
 */
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

interface FcfsDetail { enabled: boolean; spots: number; appliedDisplay: number; deadline: string | null }

export default function FcfsApplyBlock({ productId }: { productId: number }) {
  const [info, setInfo] = useState<FcfsDetail | null>(null)
  const [applied, setApplied] = useState(false)
  // 🎯 2026-07-04 (당첨자 결제 게이트 동반): 'selected'=당첨(구매 가능) / 'paid'=구매 완료 구분 표시.
  const [myStatus, setMyStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!Number.isFinite(productId)) return
    let alive = true
    api.get(`/api/fcfs/${productId}`).then((r) => { if (alive && r.data?.success) setInfo(r.data.data as FcfsDetail) }).catch(() => {})
    // 비로그인이면 401 — 무시(응모 상태 없음).
    api.get(`/api/fcfs/${productId}/me`).then((r) => {
      const st = r.data?.data?.status
      if (alive && r.data?.success && (st === 'applied' || st === 'selected' || st === 'paid')) {
        setApplied(true)
        setMyStatus(String(st))
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [productId])

  if (!info?.enabled) return null
  const closed = info.deadline ? new Date(info.deadline).getTime() < Date.now() : false
  const isWinner = myStatus === 'selected'
  const isPaid = myStatus === 'paid'

  const apply = () => {
    if (busy || applied || closed) return
    setBusy(true)
    api.post(`/api/fcfs/${productId}/apply`)
      .then((res) => {
        setApplied(true)
        const disp = res.data?.data?.appliedDisplay
        if (typeof disp === 'number') setInfo((p) => (p ? { ...p, appliedDisplay: disp } : p))
        toast.success(res.data?.data?.already ? '이미 응모했어요' : '🎉 응모 완료! 당첨 시 안내드려요')
      })
      .catch((e) => {
        if (e?.response?.status === 401) toast.error('응모하려면 로그인이 필요해요')
        else toast.error(e?.response?.data?.error || '응모 처리 중 오류가 발생했어요')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div style={{ padding: '4px 18px 20px' }}>
      <div style={{ borderRadius: 16, border: '1px solid var(--gbd-line)', background: 'var(--gbd-card)', padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--gbd-ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🎯 추첨 응모 <span style={{ color: 'var(--gbd-sub)', fontWeight: 700 }}>{formatNumber(info.appliedDisplay)}/{formatNumber(info.spots)}명</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--gbd-sub)', lineHeight: 1.5 }}>
            {isPaid ? '🎉 당첨 · 구매 완료' : isWinner ? '🎉 당첨! 아래 구매 버튼으로 결제해주세요 — 미결제 시 예비 당첨자에게 넘어갈 수 있어요' : closed ? '응모가 마감되었어요' : applied ? '응모 완료 · 당첨 시 안내드려요' : '결제 없이 응모하면 추첨으로 선정돼요 · 당첨자만 구매 가능'}
          </p>
        </div>
        <button
          type="button"
          onClick={apply}
          disabled={busy || applied || closed}
          style={{ flex: '0 0 auto', padding: '11px 16px', borderRadius: 12, fontSize: 13.5, fontWeight: 800, border: 'none', cursor: busy || applied || closed ? 'default' : 'pointer', background: isWinner ? '#16a34a' : 'var(--gbd-ink)', color: isWinner ? '#fff' : 'var(--gbd-card)', opacity: (applied && !isWinner) || closed ? 0.45 : 1 }}
        >
          {isPaid ? '구매 완료' : isWinner ? '🎉 당첨' : applied ? '응모 완료' : closed ? '마감' : busy ? '처리 중…' : '응모하기'}
        </button>
      </div>
    </div>
  )
}
