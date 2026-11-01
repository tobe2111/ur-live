/**
 * 🔗 에이전시 매장 초대 링크 — 사장님이 카톡으로 받은 링크를 여는 화면 (`/store/agency/:token`, 2026-10-11)
 *
 * 대표 *"응 링크 방식도 넣어줘"* — 에이전시가 매장을 찾아가 "저희가 맡겠습니다" 하고 링크를 보내면,
 * 사장님은 카카오로 로그인(라우트가 요구) → 내 매장 고르기 → [맡기기] 한 번. 요청·수락 단계 없이 바로 운영 시작.
 *
 * 무엇을 넘기는지 **화면이 먼저 말한다**: 상품·이용권·주문 관리는 맡기고, 정산 계좌·사업자 정보는 사장님께 남고,
 * 언제든 끊을 수 있다. 사장님이 이 문장을 안 읽고 누르면 나중에 "누가 내 매장을 만지냐" 가 된다.
 *
 * 🧩 2026-10-31 대표 *"그 링크로 들어와서 가입하면 바로 에이전시와 매장이 연동되게 하면 되잖아."* — 아직 매장이 없는
 *   사장님에게 종전엔 *"매장을 먼저 등록한 뒤 이 링크를 다시 열어 주세요"* 라고 했다(사장님이 링크를 다시 찾아야 했다).
 *   이제 등록 화면에 토큰을 실어 보내고(`/store/new?agency_invite=`), 등록이 끝나는 순간 그 화면이 맡기기까지 한다.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SEO from '@/components/SEO'
import { rememberPartner, forgetPartner } from '@/utils/partner-return'
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'
import { StoreIcon, OkIcon } from '@/components/icons/urdeal-icons'
import { AGENCY_INVITE_QUERY } from '@/shared/agency-store-invite'
import { togglePick, entrustableIds } from './store-agency-invite/pick'

interface OwnedStore { seller_id: number; name: string; status: string | null }

export default function StoreAgencyInvitePage() {
  const { token = '', agencyId = '' } = useParams()
  // 🤝 2026-10-31 제휴사 입점 위젯의 목적지(`/store/partner/:agencyId`) — 초대 링크와 같은 화면, 다른 점은 둘:
  //   ① 공개 주소라 **요청**(에이전시 수락 대기)만 보낸다 ② 매장이 없으면 등록 후 이 화면으로 돌아온다.
  const partnerId = /^\d{1,9}$/.test(agencyId) ? Number(agencyId) : 0
  const partner = !!agencyId
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [dead, setDead] = useState('')
  const [stores, setStores] = useState<OwnedStore[] | null>(null)
  // 🏪 2026-10-31 대표 *"모두 진행해줘"* — 매장이 여러 곳인 사장님(지점 여럿)은 한 번에 고른다.
  const [picked, setPicked] = useState<number[]>([])
  const [entrusted, setEntrusted] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ agencyName: string; already?: boolean; count: number; failed: number; pending?: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    if (partner && !partnerId) { setDead('제휴 링크 주소가 올바르지 않아요.'); return () => { alive = false } }
    if (partnerId) rememberPartner(partnerId)
    api.get(partner ? `/api/store-agency-invite/partner/${partnerId}` : `/api/store-agency-invite/${encodeURIComponent(token)}`)
      .then((r) => {
        if (!alive) return
        setAgencyName(r.data?.agencyName || '에이전시')
        setEntrusted(Array.isArray(r.data?.entrustedSellerIds) ? r.data.entrustedSellerIds.map(Number) : [])
      })
      .catch((e) => { if (alive) setDead(e?.response?.data?.error || '링크를 확인하지 못했어요.') })
    api.get('/api/seller/my-stores')
      .then((r) => {
        if (!alive) return
        const owned = ((r.data?.data || []) as Array<{ seller_id: number; role: string; business_name?: string | null; name?: string | null; status?: string | null }>)
          .filter((s) => s.role === 'owner')
          .map((s) => ({ seller_id: s.seller_id, name: s.business_name || s.name || `매장 ${s.seller_id}`, status: s.status ?? null }))
        setStores(owned)
      })
      .catch(() => { if (alive) setStores([]) })
    return () => { alive = false }
  }, [token, partner, partnerId])

  // 이미 맡긴 매장은 고를 수 없다 — 아직 안 맡긴 곳이 하나뿐이면 미리 골라 둔다(종전 한 곳 사장님 동작 그대로).
  const open = stores ? entrustableIds(stores.map((s) => s.seller_id), entrusted) : []
  useEffect(() => {
    if (!stores) return
    const o = entrustableIds(stores.map((s) => s.seller_id), entrusted)
    if (o.length === 1) setPicked(o)
  }, [stores, entrusted])

  async function entrust() {
    if (picked.length === 0 || busy) return
    setBusy(true); setError('')
    try {
      if (partner) {
        // 🤝 제휴 위젯 — 고른 매장마다 운영 **요청**(대기). 에이전시가 수락해야 시작된다.
        let ok = 0, failed = 0, already = false, name = agencyName || '에이전시'
        for (const sellerId of picked) {
          try {
            const r = await api.post('/api/store-agency-invite/partner-request', { agency_id: partnerId, seller_id: sellerId })
            if (r.data?.success) { ok++; name = r.data.agencyName || name; if (r.data.already) already = true } else failed++
          } catch { failed++ }
        }
        if (ok === 0) throw new Error()
        forgetPartner()
        setDone({ agencyName: name, already: already && ok === 1, count: ok, failed, pending: true })
        return
      }
      const r = await api.post('/api/store-agency-invite/accept', { token, seller_ids: picked })
      if (!r.data?.success) throw new Error(r.data?.error)
      setDone({ agencyName: r.data.agencyName, already: !!r.data.already, count: Number(r.data.entrusted) || picked.length, failed: Number(r.data.failed) || 0 })
    } catch (e: any) {
      setError(e?.response?.data?.error || '맡기지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  /** 등록 화면으로 — 등록이 끝나면 그 화면이 이 링크로 맡기기까지 한다(`StoreClaimPage`). */
  //   🤝 제휴 위젯(partner)은 토큰이 없다 — 그냥 등록으로 보내고, 등록이 끝나면 `partner-return` 이 이 화면으로 되돌린다.
  const registerHref = partner ? '/store/new' : `/store/new?${AGENCY_INVITE_QUERY}=${encodeURIComponent(token)}`

  const shell = (children: React.ReactNode) => (
    <div className="min-h-[100dvh] bg-[#F8F7FC] dark:bg-[#11141C] px-4 py-10">
      <SEO title="매장 운영 맡기기 - 유어딜" description="에이전시에 매장 운영을 맡깁니다" url="/store/agency" noindex />
      <div className="mx-auto w-full max-w-[480px]">{children}</div>
    </div>
  )

  if (dead) {
    return shell(
      <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
        <p className="text-[17px] font-semibold text-gray-900 dark:text-white">쓸 수 없는 링크예요</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">{dead}</p>
        <Link to="/" className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">홈으로</Link>
      </div>,
    )
  }

  if (done?.pending) {
    return shell(
      <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
        <OkIcon size={28} className="text-brand-text" />
        <p className="mt-3 text-[17px] font-semibold text-gray-900 dark:text-white">
          {done.already ? `이미 ${done.agencyName}에 요청했어요` : `${done.agencyName}에 운영을 요청했어요`}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          제휴사가 수락하면 이용권 등록과 운영을 도와드려요. 정산 계좌와 사업자 정보는 사장님께 그대로 남고,
          마이의 <b className="font-semibold text-gray-700 dark:text-gray-200">내 가게</b>에서 언제든 요청을 취소하거나 끊을 수 있어요.
        </p>
        <Link to="/user/profile" className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">내 가게 보기</Link>
      </div>,
    )
  }

  if (done) {
    return shell(
      <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
        <OkIcon size={28} className="text-brand-text" />
        <p className="mt-3 text-[17px] font-semibold text-gray-900 dark:text-white">
          {done.already ? `이미 ${done.agencyName} 에이전시가 운영 중이에요`
            : done.count > 1 ? `매장 ${done.count}곳을 ${done.agencyName} 에이전시에 맡겼어요` : `${done.agencyName} 에이전시에 맡겼어요`}
        </p>
        {done.failed > 0 && (
          <p className="mt-2 text-[13px] text-tone-bad">{done.failed}곳은 맡기지 못했어요. 그 매장은 링크를 다시 열어 시도해 주세요.</p>
        )}
        <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          지금부터 에이전시 직원들이 상품·이용권·주문을 관리해요. 정산 계좌와 사업자 정보는 사장님께 그대로 남고,
          셀러 화면의 <b className="font-semibold text-gray-700 dark:text-gray-200">운영자 관리</b>에서 언제든 끊을 수 있어요.
        </p>
        <Link to="/seller/operators" className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">운영자 관리 보기</Link>
      </div>,
    )
  }

  if (agencyName === null || stores === null) return <BrandLoader fullScreen />

  return shell(
    <>
      <p className="text-[13px] text-gray-500 dark:text-gray-400">{partner ? '입점 신청' : '매장 운영 맡기기'}</p>
      <h1 className="mt-1 text-[24px] font-bold tracking-[-0.01em] text-gray-900 dark:text-white">
        {partner ? <>유어딜에 입점해요<span className="mt-2 block text-[15px] font-medium text-gray-500 dark:text-gray-400">{agencyName} 제휴로 등록과 운영을 도와드려요</span></> : <>{agencyName} 에이전시가<br />매장 운영을 맡겠다고 해요</>}
      </h1>

      <div className="mt-6 rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
        <ul className="space-y-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          <li><b className="font-semibold text-gray-900 dark:text-white">맡기는 것</b> · 상품·이용권 등록과 수정, 주문 처리</li>
          <li><b className="font-semibold text-gray-900 dark:text-white">사장님께 남는 것</b> · 정산 계좌, 사업자 정보, 운영자 관리</li>
          <li><b className="font-semibold text-gray-900 dark:text-white">끊기</b> · 셀러 화면 운영자 관리에서 언제든. 끊으면 바로 못 들어와요</li>
        </ul>
      </div>

      {stores.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
          {partner ? (<>
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">아직 등록한 내 매장이 없어요</p>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
            매장을 먼저 등록해 주세요. 등록이 끝나면 이 화면으로 돌아와요.
          </p>
          <Link to={registerHref} className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">내 매장 등록하기</Link>
          </>) : (<>
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">아직 유어딜에 등록한 매장이 없어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">매장을 등록하면 등록과 동시에 {agencyName} 에이전시에 맡겨져요. 링크를 다시 열 필요 없어요.</p>
          <Link to={registerHref} className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">매장 등록하고 맡기기</Link>
          </>)}
        </div>
      ) : (
        <>
          <div className="mt-6 flex items-center">
            <p className="text-[13px] font-semibold text-gray-500 dark:text-gray-400">맡길 매장{stores.length > 1 ? ` · 여러 곳 고를 수 있어요` : ''}</p>
            {open.length > 1 && (
              <button type="button" onClick={() => setPicked(picked.length === open.length ? [] : open)}
                className="ml-auto text-[13px] font-semibold text-brand-text">
                {picked.length === open.length ? '선택 해제' : '전체 선택'}
              </button>
            )}
          </div>
          <div className="mt-2 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift">
            <ul className="divide-y divide-rule">
              {stores.map((s) => {
                const isOn = entrusted.includes(s.seller_id)
                return (
                  <li key={s.seller_id}>
                    <label className={`flex min-h-[56px] items-center gap-3 px-5 py-3 ${isOn ? 'cursor-default' : 'cursor-pointer'}`}>
                      <input type="checkbox" disabled={isOn} checked={isOn || picked.includes(s.seller_id)}
                        onChange={() => setPicked((p) => togglePick(p, s.seller_id))}
                        className="h-4 w-4 accent-[#1C69EF] disabled:opacity-40" />
                      <StoreIcon size={18} className="text-gray-400" />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 dark:text-white">{s.name}</span>
                      {isOn && <span className="shrink-0 text-[12px] text-gray-500 dark:text-gray-400">운영 중</span>}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
          {error && <p className="mt-3 text-[13px] text-tone-bad">{error}</p>}
          {open.length === 0 ? (
            <p className="mt-5 text-[13px] text-gray-500 dark:text-gray-400">내 매장은 모두 이미 {agencyName} 에이전시가 운영 중이에요.</p>
          ) : (
            <button type="button" onClick={entrust} disabled={picked.length === 0 || busy}
              className="mt-5 h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-white disabled:opacity-50">
              {busy ? (partner ? '보내는 중…' : '맡기는 중…') : partner ? `${agencyName}에 운영 요청하기` : picked.length > 1 ? `매장 ${picked.length}곳 맡기기` : `${agencyName} 에이전시에 맡기기`}
            </button>
          )}
          <p className="mt-4 text-center text-[13px] text-gray-500 dark:text-gray-400">
            목록에 없는 매장이에요? <Link to={registerHref} className="font-semibold text-brand-text">{partner ? '새로 등록하기' : '새로 등록하고 맡기기'}</Link>
          </p>
        </>
      )}
    </>,
  )
}
