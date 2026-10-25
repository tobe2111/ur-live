/**
 * 🏠 생활 사장님 — 근처 이사·청소 요청을 알림톡으로 받고, 참여권 1장으로 견적을 보낸다 (2026-10-24 대표 확정).
 * 사업자 유저(판매 좌석)로 로그인해야 한다. 등록하면 무료 참여권 3장.
 * 로그인 전에는 모집 랜딩(`pro/ProLanding`)을 그린다 — 2026-10-25 부터 이 화면을 색인한다.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { getSellerToken } from '@/lib/seller-auth'
import { LifeHeader, sellerHeaders } from './life-shared'
import ProSetupForm, { type ProMe } from './pro/ProSetupForm'
import { isShareToken } from '@/shared/home-service-share'
import { toast } from '@/hooks/useToast'
import ProCredits from './pro/ProCredits'
import ProInbox from './pro/ProInbox'
import ProLanding from './pro/ProLanding'
import { LIFE_PRO_SEO } from '@/shared/seo/life-hub-seo'
import { withSiteName } from '@/shared/seo/consumer-surfaces'

export default function LifeProPage() {
  const hasToken = !!getSellerToken()
  const [me, setMe] = useState<ProMe | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)
  // 🔗 공유 링크에서 온 업체(`?share=&cat=&sido=&sigungu=`) — 등록을 마치면 그 요청으로 바로 보낸다.
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const share = params.get('share')
  const shareToken = isShareToken(share) ? share : null
  const prefill = { cat: params.get('cat'), sido: params.get('sido'), sigungu: params.get('sigungu') }

  const goShared = useCallback(async () => {
    if (!shareToken) return false
    try {
      const r = await api.get(`/api/home-service/pro/share/${shareToken}`, sellerHeaders())
      const d = r.data?.data
      if (d && !d.need_category) { navigate(`/life/pro/requests/${d.id}`, { replace: true }); return true }
    } catch { /* 요청이 사라졌으면 이 화면에 남는다 */ }
    return false
  }, [shareToken, navigate])

  const onSaved = useCallback(() => {
    if (shareToken) {
      goShared().then((ok) => { if (!ok) toast.error('이 요청의 업종을 하는 일에 넣어 주세요') })
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken, goShared])

  const load = useCallback(() => {
    if (!hasToken) return
    api.get('/api/home-service/pro/me', sellerHeaders())
      .then((r) => { setMe(r.data?.data || null); setTick((t) => t + 1) })
      .catch(() => setFailed(true))
  }, [hasToken])
  useEffect(load, [load])
  // 이미 그 업종으로 등록한 업체는 이 화면을 거치지 않고 요청으로 간다.
  useEffect(() => { if (hasToken && shareToken) void goShared() }, [hasToken, shareToken, goShared])

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title={withSiteName(LIFE_PRO_SEO.title)} description={LIFE_PRO_SEO.description} url="/life/pro" />
      <LifeHeader title={hasToken ? '생활 요청 받기' : '업체 등록'} back="/life" />
      <div className="ur-content-narrow space-y-4 px-4 pb-10">
        {shareToken && (
          <p className="rounded-2xl bg-brand-tint p-4 text-[13px] text-brand-text">
            {hasToken ? '이 요청의 업종과 지역을 채워 두었어요. 저장하면 바로 견적을 낼 수 있어요.' : '공유받은 요청에 견적을 내려면 먼저 업체로 등록해 주세요.'}
          </p>
        )}
        {!hasToken ? <ProLanding /> : failed ? (
          <p className="py-16 text-center text-[13px] text-tone-bad">정보를 불러오지 못했어요. 다시 로그인해 주세요.</p>
        ) : !me ? <BrandLoader label="불러오는 중" /> : (
          <>
            {!me.seller.approved && (
              <p className="rounded-2xl bg-surface p-4 text-[13px] shadow-lift">
                가게 심사가 끝나면 견적을 보낼 수 있어요. 지금 등록해 두면 심사가 끝나는 대로 근처 요청이 와요.
              </p>
            )}
            {me.registered && <ProCredits me={me} onChanged={load} />}
            {me.registered && <ProInbox refreshKey={tick} />}
            <h2 className="pt-2 text-[17px] font-bold">{me.registered ? '등록 정보' : '처음 등록'}</h2>
            <ProSetupForm me={me} onSaved={onSaved} prefill={prefill} />
          </>
        )}
      </div>
    </div>
  )
}
