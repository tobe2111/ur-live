/**
 * 🔑 협업 코드 착지 — `/i/join/:code` (2026-09-19 대표 확정 플로우 6번)
 *
 * 대행사·매장이 카톡으로 보낸 링크의 도착지. 로그인 전에 "어느 매장 · 몇 %" 를 보여 주고,
 * 로그인하면 코드를 자동으로 넣어 딜을 활성한다. 그러면 원안의 "가입 유도" 와 "코드 입력" 이 한 탭이 된다.
 *
 * 흐름: 미리보기(공개 API) → [카카오 로그인] → 복귀 → 자동 입력(`/codes/redeem`) → 내 링크 표시.
 * `/i/offer/:token`(아웃리치 수락 페이지) 과 같은 골격 — 401 이면 returnUrl 로 되돌아온다.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import api from '@/lib/api'
import BrandLoader from '@/components/brand/BrandLoader'
import { isLoggedInSync } from '@/utils/auth'

interface Preview { code: string; seller_id: number; seller_name: string | null; address: string | null; commission_pct: number; requires_approval: boolean; label: string | null }
interface Redeemed { deal_id?: number; status: 'active' | 'proposed'; seller_name: string | null; commission_pct: number; store_link: string; existed: boolean }

export default function InfluencerJoinPage() {
  const { code } = useParams<{ code: string }>()
  const [params] = useSearchParams()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<Redeemed | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!code) return
    api.get(`/api/influencer-discover/code/${encodeURIComponent(code)}`)
      .then((r) => setPreview(r.data?.data || null))
      .catch((e) => setError(e?.response?.data?.error || '코드를 열 수 없어요'))
      .finally(() => setLoading(false))
  }, [code])

  const redeem = () => {
    if (!code || busy) return
    if (!isLoggedInSync()) {
      window.location.href = `/login?returnUrl=${encodeURIComponent(`/i/join/${code}?auto=1`)}`
      return
    }
    setBusy(true)
    api.post('/api/influencer-settlement/codes/redeem', { code })
      .then((r) => setDone(r.data?.data || null))
      .catch((e) => {
        if (e?.response?.status === 401) { window.location.href = `/login?returnUrl=${encodeURIComponent(`/i/join/${code}?auto=1`)}`; return }
        setError(e?.response?.data?.error || '코드를 넣지 못했어요')
      })
      .finally(() => setBusy(false))
  }

  // 로그인에서 돌아온 경우(`?auto=1`) — 다시 누르게 하지 않는다.
  useEffect(() => {
    if (!loading && preview && !done && params.get('auto') === '1' && isLoggedInSync()) redeem()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, preview])

  if (loading) return <BrandLoader fullScreen />

  return (
    <div className="min-h-[100dvh] bg-warm flex items-center justify-center p-5">
      <Helmet><meta name="robots" content="noindex, nofollow" /><title>협업 코드 - 유어딜</title></Helmet>
      <div className="w-full max-w-md">
        {error && !preview ? (
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">코드를 열 수 없어요</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        ) : done ? (
          <div className="text-center space-y-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {done.status === 'active' ? '협업이 시작됐어요' : '신청이 접수됐어요'}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>{done.seller_name || '매장'}</strong> · 커미션 <strong>{done.commission_pct}%</strong>
              {done.status === 'proposed' && <><br />매장이 승인하면 활성돼요. 승인되면 알림으로 알려드릴게요.</>}
              {done.existed && <><br />이미 이 매장과 협업 중이었어요.</>}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">아래 <strong>내 매장 링크</strong>로 팔로워가 구매하면 커미션이 적립돼요.</p>
            <div className="bg-warm rounded-xl p-3 text-sm text-gray-900 dark:text-white break-all">{done.store_link}</div>
            <button className="w-full py-3 rounded-xl bg-brand text-white font-semibold"
              onClick={() => { navigator.clipboard?.writeText(done.store_link).then(() => setCopied(true)).catch(() => {}) }}>
              {copied ? '복사됐어요' : '링크 복사하기'}
            </button>
            <Link to="/influencer/settlement" className="block text-sm font-semibold text-brand-text">마이페이지에서 성과 보기</Link>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">유어딜 협업 코드 {preview.code}</p>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{preview.seller_name || '매장'}</h1>
              {preview.address && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{preview.address}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-warm rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">판매 커미션</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{preview.commission_pct}%</p>
              </div>
              <div className="bg-warm rounded-xl p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">시작</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{preview.requires_approval ? '매장 승인 후' : '바로'}</p>
              </div>
            </div>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 leading-relaxed">
              내 링크로 이 매장의 이용권이 팔리면 결제액의 {preview.commission_pct}% 가 적립돼요. 이용권이 사용된 뒤 정산됩니다.
            </p>
            <button className="w-full py-3 rounded-xl bg-brand text-white font-semibold disabled:opacity-50" disabled={busy} onClick={redeem}>
              {busy ? '처리 중…' : isLoggedInSync() ? '협업 시작하기' : '카카오 로그인하고 시작하기'}
            </button>
            {error && <p className="text-center text-xs text-tone-bad">{error}</p>}
          </div>
        ) : null}
      </div>
    </div>
  )
}
