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
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'
import { StoreIcon, OkIcon } from '@/components/icons/urdeal-icons'
import { AGENCY_INVITE_QUERY } from '@/shared/agency-store-invite'

interface OwnedStore { seller_id: number; name: string; status: string | null }

export default function StoreAgencyInvitePage() {
  const { token = '' } = useParams()
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [dead, setDead] = useState('')
  const [stores, setStores] = useState<OwnedStore[] | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ agencyName: string; already?: boolean } | null>(null)

  useEffect(() => {
    let alive = true
    api.get(`/api/store-agency-invite/${encodeURIComponent(token)}`)
      .then((r) => { if (alive) setAgencyName(r.data?.agencyName || '에이전시') })
      .catch((e) => { if (alive) setDead(e?.response?.data?.error || '링크를 확인하지 못했어요.') })
    api.get('/api/seller/my-stores')
      .then((r) => {
        if (!alive) return
        const owned = ((r.data?.data || []) as Array<{ seller_id: number; role: string; business_name?: string | null; name?: string | null; status?: string | null }>)
          .filter((s) => s.role === 'owner')
          .map((s) => ({ seller_id: s.seller_id, name: s.business_name || s.name || `매장 ${s.seller_id}`, status: s.status ?? null }))
        setStores(owned)
        if (owned.length === 1) setPicked(owned[0].seller_id)
      })
      .catch(() => { if (alive) setStores([]) })
    return () => { alive = false }
  }, [token])

  async function entrust() {
    if (!picked || busy) return
    setBusy(true); setError('')
    try {
      const r = await api.post('/api/store-agency-invite/accept', { token, seller_id: picked })
      if (!r.data?.success) throw new Error(r.data?.error)
      setDone({ agencyName: r.data.agencyName, already: !!r.data.already })
    } catch (e: any) {
      setError(e?.response?.data?.error || '맡기지 못했어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  /** 등록 화면으로 — 등록이 끝나면 그 화면이 이 링크로 맡기기까지 한다(`StoreClaimPage`). */
  const registerHref = `/store/new?${AGENCY_INVITE_QUERY}=${encodeURIComponent(token)}`

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

  if (done) {
    return shell(
      <div className="rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift">
        <OkIcon size={28} className="text-brand-text" />
        <p className="mt-3 text-[17px] font-semibold text-gray-900 dark:text-white">
          {done.already ? `이미 ${done.agencyName} 에이전시가 운영 중이에요` : `${done.agencyName} 에이전시에 맡겼어요`}
        </p>
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
      <p className="text-[13px] text-gray-500 dark:text-gray-400">매장 운영 맡기기</p>
      <h1 className="mt-1 text-[24px] font-bold tracking-[-0.01em] text-gray-900 dark:text-white">{agencyName} 에이전시가<br />매장 운영을 맡겠다고 해요</h1>

      <div className="mt-6 rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
        <ul className="space-y-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          <li><b className="font-semibold text-gray-900 dark:text-white">맡기는 것</b> · 상품·이용권 등록과 수정, 주문 처리</li>
          <li><b className="font-semibold text-gray-900 dark:text-white">사장님께 남는 것</b> · 정산 계좌, 사업자 정보, 운영자 관리</li>
          <li><b className="font-semibold text-gray-900 dark:text-white">끊기</b> · 셀러 화면 운영자 관리에서 언제든. 끊으면 바로 못 들어와요</li>
        </ul>
      </div>

      {stores.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white dark:bg-[#1D1F29] p-5 shadow-lift">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white">아직 유어딜에 등록한 매장이 없어요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">매장을 등록하면 등록과 동시에 {agencyName} 에이전시에 맡겨져요. 링크를 다시 열 필요 없어요.</p>
          <Link to={registerHref} className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand px-5 text-[15px] font-semibold text-white">매장 등록하고 맡기기</Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[13px] font-semibold text-gray-500 dark:text-gray-400">맡길 매장</p>
          <div className="mt-2 rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift">
            <ul className="divide-y divide-rule">
              {stores.map((s) => (
                <li key={s.seller_id}>
                  <label className="flex min-h-[56px] cursor-pointer items-center gap-3 px-5 py-3">
                    <input type="radio" name="store" checked={picked === s.seller_id} onChange={() => setPicked(s.seller_id)}
                      className="h-4 w-4 accent-[#1C69EF]" />
                    <StoreIcon size={18} className="text-gray-400" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 dark:text-white">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {error && <p className="mt-3 text-[13px] text-tone-bad">{error}</p>}
          <button type="button" onClick={entrust} disabled={!picked || busy}
            className="mt-5 h-12 w-full rounded-xl bg-brand text-[15px] font-semibold text-white disabled:opacity-50">
            {busy ? '맡기는 중…' : `${agencyName} 에이전시에 맡기기`}
          </button>
          <p className="mt-4 text-center text-[13px] text-gray-500 dark:text-gray-400">
            목록에 없는 매장이에요? <Link to={registerHref} className="font-semibold text-brand-text">새로 등록하고 맡기기</Link>
          </p>
        </>
      )}
    </>,
  )
}
