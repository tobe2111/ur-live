/**
 * 🏢 에이전시에 맡기기 — 사장님 전용 카드 (에이전시 2단계, 2026-10-11)
 *
 * 사람(운영자) 대신 **에이전시**에 매장 운영을 맡긴다. 에이전시 관리자 이메일로 요청하고, 에이전시가 수락하면
 * 그 에이전시의 직원 누구나 이 매장을 운영한다. 기간은 없고 사장님이 언제든 끊는다(대표 결정 규칙 3).
 * 정산 계좌·사업자 정보는 사장님께 그대로 남는다 — 에이전시 좌석은 언제나 '운영자'다.
 *
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지 — check-dashboard-theme).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { formatKSTDate } from '@/utils/date'

interface LinkState { status: 'pending' | 'active'; agencyName: string; requestedAt: string; acceptedAt: string | null }

export default function AgencyLinkCard() {
  const [link, setLink] = useState<LinkState | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const r = await api.get('/api/seller/agency-link')
      if (!r.data?.success) throw new Error(r.data?.error)
      setLink(r.data.data ?? null)
    } catch (e: any) {
      setLoadError(e?.response?.data?.error || '에이전시 상태를 불러오지 못했어요')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function request(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true); setFormError('')
    try {
      const r = await api.post('/api/seller/agency-link', { email: email.trim() })
      if (!r.data?.success) throw new Error(r.data?.error)
      setEmail('')
      await load()
    } catch (e: any) {
      setFormError(e?.response?.data?.error || '요청하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  async function end() {
    if (!link) return
    const message = link.status === 'pending'
      ? `${link.agencyName} 에이전시에 보낸 요청을 취소할까요?`
      : `${link.agencyName} 에이전시와의 운영을 끊을까요? 에이전시 직원은 지금부터 이 매장에 들어올 수 없어요. 그동안 등록한 상품·주문은 매장에 그대로 남아요.`
    if (!(await confirmDialog({ message, danger: true }))) return
    setBusy(true)
    try {
      const r = await api.post('/api/seller/agency-link/end')
      if (!r.data?.success) throw new Error(r.data?.error)
      await load()
    } catch (e: any) {
      setLoadError(e?.response?.data?.error || '끊지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[var(--dash-radius,16px)] bg-white shadow-lift p-5">
      <h2 className="text-[15px] font-bold text-gray-900">에이전시에 맡기기</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-600">
        매장을 대신 운영해 줄 에이전시(대행사)가 있으면 그 에이전시 관리자 이메일로 맡길 수 있어요.
        수락하면 그 에이전시 직원들이 상품·이용권·주문을 관리해요. 정산 계좌와 사업자 정보는 사장님께 그대로 남고, 언제든 끊을 수 있어요.
      </p>

      {loadError ? (
        <div className="mt-4">
          <p className="text-[13px] text-tone-bad">{loadError}</p>
          <button type="button" onClick={load} className="mt-1 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
        </div>
      ) : link === undefined ? (
        <p className="mt-4 text-[13px] text-gray-500">불러오는 중…</p>
      ) : link ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-gray-900">{link.agencyName}</p>
            <p className="text-[13px] text-gray-500">
              {link.status === 'active'
                ? `운영 중${link.acceptedAt ? ` · ${formatKSTDate(link.acceptedAt)} 부터` : ''}`
                : '수락 기다리는 중'}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={end}
            className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
            {link.status === 'active' ? '끊기' : '요청 취소'}
          </button>
        </div>
      ) : (
        <form onSubmit={request} className="mt-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="에이전시 관리자 이메일"
              autoComplete="off"
              maxLength={254}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
            <button type="submit" disabled={busy || !email.trim()}
              className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">맡기기</button>
          </div>
          {formError && <p className="mt-2 text-[13px] text-tone-bad">{formError}</p>}
        </form>
      )}
    </div>
  )
}
