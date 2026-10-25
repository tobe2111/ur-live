/**
 * 🔗 생활 요청 공유 페이지 `/life/q/:token` — 업체 모집 영업용 (2026-10-25 대표).
 *
 * 대표: "다른 커뮤니티에 어떤 수요 건이 있다 라고 해서 그 수요건 페이지를 또 공유할 수 있어야하고, 견적에 참여하는 형태로"
 * 시안: `docs/design/assets/life-request-share-2026-10-25.png`.
 *
 * 🔒 값은 공개 API 가 `publicShareView` 로 고른 것뿐 — 이름 첫 글자·동 단위 지역·고르는 칸. 메모·사진·연락처·상세 주소는
 *   서버에서부터 안 온다. 화면은 받은 것을 그리기만 한다.
 * 참여 버튼: 사장님 좌석이 있으면 그 요청으로(업종이 없으면 업종·지역을 채운 등록 화면으로), 없으면 업체 등록으로.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { getSellerToken } from '@/lib/seller-auth'
import { toast } from '@/hooks/useToast'
import { SIGNUP_FREE_CREDITS } from '@/shared/home-service'
import { shareDescription, type ShareView } from '@/shared/home-service-share'
import { lifeCategoryPath } from '@/shared/life-seo'
import { parseUTCDate } from '@/utils/date'
import { sellerHeaders } from './life-shared'

const SEED_ID = '__SSR_INITIAL_LIFESHARE__'

function readSeed(): ShareView | null {
  if (typeof document === 'undefined') return null
  const el = document.getElementById(SEED_ID)
  if (!el?.textContent) return null
  try { return (JSON.parse(el.textContent) as { data?: ShareView })?.data ?? null } catch { return null }
}

function ageLabel(createdAt: string): string {
  const days = Math.floor((Date.now() - parseUTCDate(createdAt).getTime()) / 86_400_000)
  return days <= 0 ? '오늘 올라온 요청' : days === 1 ? '어제 올라온 요청' : `${days}일 전 요청`
}

function dateLabel(ymd: string | null): string {
  const m = ymd?.match(/^\d{4}-(\d{2})-(\d{2})$/)
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : ''
}

const ROW = 'flex gap-3 border-b border-rule py-3 text-[15px]'

export default function LifeSharePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [seed] = useState(() => {
    const s = readSeed()
    return s && typeof window !== 'undefined' && window.location.pathname.endsWith(token) ? s : null
  })
  const [v, setV] = useState<ShareView | null>(seed)
  const [failed, setFailed] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api.get(`/api/home-service/share/${token}`)
      .then((r) => setV(r.data?.data || null))
      .catch(() => { if (!seed) setFailed(true) })
  }, [token, seed])

  async function join() {
    if (!v) return
    const q = new URLSearchParams({ share: token, cat: v.category })
    if (!getSellerToken()) { navigate(`/life/pro?${q}`); return }
    setJoining(true)
    try {
      const r = await api.get(`/api/home-service/pro/share/${token}`, sellerHeaders())
      const d = r.data?.data
      if (!d) throw new Error()
      if (d.need_category) {
        q.set('sido', d.sido); q.set('sigungu', d.sigungu)
        navigate(`/life/pro?${q}`)
      } else navigate(`/life/pro/requests/${d.id}`)
    } catch {
      toast.error('요청을 열지 못했어요. 다시 시도해 주세요')
    } finally { setJoining(false) }
  }

  if (failed) {
    return (
      <div className="min-h-[100dvh] bg-surface px-4 py-20 text-center text-ink">
        <SEO title="요청을 찾을 수 없어요 - 유어딜" description="생활 서비스 견적 요청" url={`/life/q/${token}`} noindex />
        <p className="text-[15px]">요청을 찾을 수 없어요.</p>
        <Link to="/life" className="mt-4 inline-block text-[15px] font-medium text-brand-text">생활 서비스 보기</Link>
      </div>
    )
  }
  if (!v) return <BrandLoader fullScreen label="요청을 불러오는 중" />

  const seats = Array.from({ length: v.maxQuotes }, (_, i) => i < v.quoteCount)
  const date = dateLabel(v.date)
  return (
    <div className="min-h-[100dvh] bg-surface text-ink">
      <SEO title={`${v.title} - 유어딜`} description={shareDescription(v)} url={`/life/q/${token}`} noindex={!v.open} />
      <div className="ur-content-narrow px-5 pb-40 pt-5">
        <div className="flex items-center gap-2">
          <Link to="/life" aria-label="유어딜 생활 서비스"><UrDealLogo size={20} /></Link>
          <span className="text-[13px] text-gray-500 dark:text-gray-400">생활 서비스 · 견적 요청</span>
        </div>
        <div className="mt-5 flex gap-2 text-[12px] font-medium">
          <span className={v.open ? 'rounded-full bg-brand-tint px-3 py-1 text-brand-text' : 'rounded-full bg-warm px-3 py-1 text-gray-500 dark:text-gray-400'}>
            {v.open ? '모집 중' : '마감'}
          </span>
          <span className="rounded-full bg-warm px-3 py-1 text-gray-500 dark:text-gray-400">{ageLabel(v.createdAt)}</span>
        </div>
        <h1 className="mt-4 text-[28px] font-bold leading-snug tracking-tight">{v.title}</h1>
        <p className="mt-2 text-[15px] text-gray-500 dark:text-gray-400">{v.region}{date ? ` · 희망 ${date}` : ''}</p>

        <section className="mt-6 rounded-2xl bg-warm p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[17px]">남은 견적 자리</p>
            <p className="text-[17px] font-bold tabular-nums text-brand-text">{v.seatsLeft} / {v.maxQuotes}</p>
          </div>
          <div className="mt-3 flex gap-2">
            {seats.map((taken, i) => <span key={i} className={`h-2 flex-1 rounded-full ${taken ? 'bg-brand' : 'bg-gray-200 dark:bg-gray-700'}`} />)}
          </div>
          <p className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">먼저 보낸 {v.maxQuotes}곳까지만 견적을 낼 수 있어요</p>
        </section>

        <h2 className="mt-8 text-[17px] font-bold">요청 내용</h2>
        <dl className="mt-1">
          {v.rows.map((r) => (
            <div key={r.label} className={ROW}>
              <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{r.label}</dt>
              <dd className="min-w-0 flex-1 break-words">{r.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="mt-8 text-[17px] font-bold">손님 정보</h2>
        <dl className="mt-1">
          {[['이름', v.masked.name], ['연락처', v.masked.phone], ['상세 주소', v.masked.address]].map(([k, val]) => (
            <div key={k} className={ROW}>
              <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="flex-1 text-gray-500 dark:text-gray-400">{val}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded-2xl bg-warm px-4 py-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          {v.photoCount > 0 ? `현장 사진 ${v.photoCount}장${v.hasMemo ? '과 메모' : ''}는 가입한 업체에게 보여요. ` : v.hasMemo ? '메모는 가입한 업체에게 보여요. ' : ''}
          연락처는 손님이 고른 업체에만 공개돼요.
        </p>
        {v.photoCount > 0 && (
          <div className="mt-3 flex gap-2" aria-hidden>
            {Array.from({ length: Math.min(v.photoCount, 4) }, (_, i) => <span key={i} className="h-20 w-20 rounded-xl bg-gray-200 blur-[2px] dark:bg-gray-700" />)}
          </div>
        )}
        {!v.open && (
          <Link to={lifeCategoryPath(v.category)} className="mt-8 block text-center text-[15px] font-medium text-brand-text">
            {v.label} 견적 요청하기
          </Link>
        )}
      </div>

      {v.open && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="ur-content-narrow px-5 py-3">
            <button type="button" onClick={join} disabled={joining} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-60">
              {joining ? '여는 중' : '이 견적에 참여하기'}
            </button>
            <p className="mt-2 text-center text-[12px] text-gray-500 dark:text-gray-400">처음이면 참여권 {SIGNUP_FREE_CREDITS}장 무료</p>
          </div>
        </div>
      )}
    </div>
  )
}
