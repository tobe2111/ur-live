/**
 * 🏢 에이전시에 맡기기 — 사장님 전용 카드 (에이전시 2단계, 2026-10-11)
 *
 * 사람(운영자) 대신 **에이전시**에 매장 운영을 맡긴다. 에이전시 관리자 이메일로 요청하고, 에이전시가 수락하면
 * 그 에이전시의 직원 누구나 이 매장을 운영한다. 기간은 없고 사장님이 언제든 끊는다(대표 결정 규칙 3).
 * 정산 계좌·사업자 정보는 사장님께 그대로 남는다 — 에이전시 좌석은 언제나 '운영자'다.
 *
 * 🤝 2026-10-24 대표 확정 — **한 매장이 여러 에이전시와 함께 한다**(사장님 직접 관리와도 동시에). 그래서 카드는
 * 목록이다: 에이전시마다 상태 · **맡은 이용권 수** · 끊기. 각 에이전시는 자기가 만든 이용권만 보고 고치고,
 * 사장님은 전부 본다(성과 = 이용권 단위). 이메일 칸은 언제나 열려 있다(한 곳 더 맡기기).
 * 이미 있는 이용권도 에이전시마다 [이용권 맡기기]로 넘기거나 돌려받는다(`AgencyAssignList`). 에이전시별 판매는
 * 매출 분석의 '누가 팔았나' 카드에서 본다. 에이전시마다 [몫 정하기]로 판매액의 % 를 정하면 줄 금액이 같은 카드에 계산돼
 * 보인다(`AgencyShareEditor` — 돈은 매장이 직접 보낸다).
 *
 * ⚠️ 대시보드 = 라이트 고정(`dark:` 금지 — check-dashboard-theme).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { formatKSTDate, formatKSTShort as formatKSTDateTime } from '@/utils/date'
import AgencyAssignList from './AgencyAssignList'
import AgencyShareEditor from './AgencyShareEditor'

interface LinkState { linkId: number; agencyId: number; status: 'pending' | 'active'; agencyName: string; requestedAt: string; acceptedAt: string | null; productCount: number; sharePct: number | null }
interface Activity { id: number; label: string; at: string; agencyName: string; staff: string }

export default function AgencyLinkCard() {
  const [links, setLinks] = useState<LinkState[] | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [activity, setActivity] = useState<Activity[]>([])
  /** 이용권 맡기기를 펼친 에이전시(한 번에 하나). */
  const [openAssign, setOpenAssign] = useState<number | null>(null)
  /** 🤝 몫 % 를 펼친 에이전시(한 번에 하나). */
  const [openShare, setOpenShare] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const r = await api.get('/api/seller/agency-link')
      if (!r.data?.success) throw new Error(r.data?.error)
      setLinks(Array.isArray(r.data.data?.links) ? r.data.data.links : [])
      // 기록은 덤 — 못 불러와도 카드는 그린다.
      api.get('/api/seller/agency-link/activity').then((a) => setActivity(a.data?.data || [])).catch(() => setActivity([]))
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

  async function end(link: LinkState) {
    const message = link.status === 'pending'
      ? `${link.agencyName} 에이전시에 보낸 요청을 취소할까요?`
      : `${link.agencyName} 에이전시와의 운영을 끊을까요? 이 에이전시 직원은 지금부터 이 매장에 들어올 수 없어요. 그동안 이 에이전시가 등록한 이용권(${link.productCount}개)·주문은 매장에 그대로 남고, 이제 사장님이 관리해요.`
    if (!(await confirmDialog({ message, danger: true }))) return
    setBusy(true)
    try {
      const r = await api.post('/api/seller/agency-link/end', { link_id: link.linkId })
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
        에이전시(대행사) 관리자 이메일로 맡길 수 있어요. 여러 에이전시와 함께 할 수 있고, 사장님도 지금처럼 직접 관리해요.
        각 에이전시는 자기가 등록한 이용권만 보고 관리해요 — 매출도 이용권별로 나뉘어요. 주문·정산·사업자 정보는 사장님만 보고, 언제든 끊을 수 있어요.
      </p>

      {loadError ? (
        <div className="mt-4">
          <p className="text-[13px] text-tone-bad">{loadError}</p>
          <button type="button" onClick={load} className="mt-1 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
        </div>
      ) : links === undefined ? (
        <p className="mt-4 text-[13px] text-gray-500">불러오는 중…</p>
      ) : links.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.linkId} className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-gray-900">{link.agencyName}</p>
                <p className="text-[13px] text-gray-500">
                  {link.status === 'active'
                    ? `운영 중${link.acceptedAt ? ` · ${formatKSTDate(link.acceptedAt)} 부터` : ''} · 맡은 이용권 ${link.productCount}개`
                    : '수락 기다리는 중'}
                  {` · 몫 ${link.sharePct == null ? '미정' : `${link.sharePct}%`}`}
                </p>
              </div>
              <button type="button" onClick={() => setOpenShare(openShare === link.agencyId ? null : link.agencyId)}
                aria-expanded={openShare === link.agencyId}
                className="h-9 rounded-lg px-3 text-[13px] font-semibold text-brand-text hover:bg-gray-100">
                {openShare === link.agencyId ? '닫기' : '몫 정하기'}
              </button>
              {link.status === 'active' && (
                <button type="button" onClick={() => setOpenAssign(openAssign === link.agencyId ? null : link.agencyId)}
                  aria-expanded={openAssign === link.agencyId}
                  className="h-9 rounded-lg px-3 text-[13px] font-semibold text-brand-text hover:bg-gray-100">
                  {openAssign === link.agencyId ? '닫기' : '이용권 맡기기'}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => end(link)}
                className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {link.status === 'active' ? '끊기' : '요청 취소'}
              </button>
              {/* 🤝 에이전시 몫 %(2026-10-24 1단계) — 계산해 보여 주기만, 돈은 매장이 직접. */}
              {openShare === link.agencyId && (
                <div className="basis-full">
                  <AgencyShareEditor agencyId={link.agencyId} agencyName={link.agencyName} current={link.sharePct}
                    onSaved={() => { setOpenShare(null); load() }} />
                </div>
              )}
              {/* 🎟️ 이미 있는 이용권을 이 에이전시에 맡기기(2026-10-24) — 옮겨도 그 전 판매는 앞쪽 성과로 남는다. */}
              {openAssign === link.agencyId && (
                <div className="basis-full">
                  <AgencyAssignList agencyId={link.agencyId} agencyName={link.agencyName}
                    agencyNames={new Map(links.map((l) => [l.agencyId, l.agencyName]))} onChanged={load} />
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {activity.length > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-gray-500">에이전시가 한 일</p>
          <ul className="mt-2 divide-y divide-gray-100">
            {activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate text-gray-900">{a.label}</span>
                <span className="shrink-0 text-gray-500">{a.agencyName} · {a.staff} · {formatKSTDateTime(a.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {links !== undefined && !loadError && (
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
              className="ur-btn ur-btn-md ur-btn-primary disabled:opacity-50">{links && links.length > 0 ? '한 곳 더 맡기기' : '맡기기'}</button>
          </div>
          {formError && <p className="mt-2 text-[13px] text-tone-bad">{formError}</p>}
        </form>
      )}
    </div>
  )
}
