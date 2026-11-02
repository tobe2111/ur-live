/**
 * 🎁 무료 체험 신청 시트 — 연동 상태 · 자동 판정 · 신청 (2026-10-31)
 *
 * 판정은 서버(`GET /api/seeding/offer/:id/me`)가 한다 — 화면은 그 결과를 보여 주고, 신청할 때 서버가 한 번 더 본다.
 * 연동 버튼은 플랫폼 로그인 → `/api/sns-link/:p/callback` → 이 상세로 돌아온다(`?sns=`).
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { loginPathFromHere } from '@/utils/login-return'
import { FOLLOWER_WORD, PLATFORM_LABEL, type Eligibility, type SeedingOffer, type SeedingPlatform } from '@/shared/seeding'
import SnsLinkList, { type SnsLinkView } from './SnsLinkList'

interface MeView {
  eligibility: Eligibility | null
  links: SnsLinkView[]
  passes: { free_left: number; paid_left: number; total: number }
  available: Record<SeedingPlatform, boolean>
}

export default function SeedingApplySheet({ productId, offer, onClose }: { productId: number; offer: SeedingOffer; onClose: () => void }) {
  const navigate = useNavigate()
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('user_id')
  const [me, setMe] = useState<MeView | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api.get(`/api/seeding/offer/${productId}/me`).then((r) => { if (r.data?.success) setMe(r.data.data) }).catch(() => setMe(null))
  }, [productId])

  useEffect(() => {
    if (!loggedIn) return
    load()
    try {
      const q = new URLSearchParams(window.location.search)
      const sns = q.get('sns')
      if (sns) {
        if (sns === 'connected') toast.success('연동했어요')
        else if (sns === 'connected_nocount') toast.info('연동했지만 팔로워 수를 읽지 못했어요')
        else if (sns !== 'cancelled') toast.error(q.get('reason') || '연동하지 못했어요')
        window.history.replaceState({}, '', window.location.pathname)
      }
    } catch { /* noop */ }
  }, [loggedIn, load])

  async function apply() {
    setBusy(true)
    try {
      const r = await api.post('/api/seeding/apply', { product_id: productId })
      if (r.data?.success) { toast.success(r.data.message || '신청했어요'); onClose(); navigate('/my-seeding') }
      else toast.error(r.data?.error || '신청하지 못했어요')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '신청하지 못했어요')
      load()
    } finally { setBusy(false) }
  }

  const el = me?.eligibility
  return (
    <div className="ur-sheet-veil fixed inset-0 z-[10600] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="ur-sheet-in w-full max-w-md rounded-t-2xl bg-surface p-5 pb-8 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="무료 체험 신청">
        <p className="text-[17px] font-bold text-gray-900 dark:text-white">무료 체험 신청</p>
        <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
          {offer.platforms.map((p) => PLATFORM_LABEL[p]).join('·')} {FOLLOWER_WORD[offer.platforms[0]]} {formatNumber(offer.min_followers)}명 이상이면 신청할 수 있어요.
        </p>
        <p className="mt-2 text-[13px] text-gray-600 dark:text-gray-300">
          이번 달 모집 {formatNumber(offer.slots_per_month)}명{offer.offer_note ? ` · 제공: ${offer.offer_note}` : ''}
        </p>
        <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300">게시 의무: {offer.post_requirement} (방문 후 {offer.post_deadline_days}일 안)</p>

        {!loggedIn ? (
          <button type="button" onClick={() => navigate(loginPathFromHere())} className="ur-btn ur-btn-lg ur-btn-primary mt-5 w-full">
            로그인하고 신청하기
          </button>
        ) : !me ? (
          <p className="mt-5 text-[13px] text-gray-500 dark:text-gray-400">확인하는 중…</p>
        ) : (
          <>
            <div className="mt-4">
              <SnsLinkList links={me.links} available={me.available} only={offer.platforms} returnTo={`/pass/${productId}`} onChanged={load} />
            </div>
            <p className={`mt-4 text-[13px] ${el?.ok ? 'text-brand-text' : 'text-gray-600 dark:text-gray-300'}`}>
              {el?.ok ? `${PLATFORM_LABEL[el.platform!]} ${FOLLOWER_WORD[el.platform!]} ${formatNumber(el.follower_count)}명 — 신청할 수 있어요` : el?.message}
            </p>
            <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">
              사장님이 승인하면 노쇼 방지 보증금으로 신청권 1장을 써요. 남은 신청권 {formatNumber(me.passes.total)}장
              {me.passes.free_left > 0 ? ` (무료 ${formatNumber(me.passes.free_left)}장)` : ''}.
            </p>
            <button type="button" disabled={!el?.ok || busy} onClick={apply} className="ur-btn ur-btn-lg ur-btn-primary mt-5 w-full disabled:opacity-50">
              {busy ? '신청하는 중…' : '조건 확인하고 신청하기'}
            </button>
          </>
        )}
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-[13px] text-gray-500 dark:text-gray-400">닫기</button>
      </div>
    </div>
  )
}
