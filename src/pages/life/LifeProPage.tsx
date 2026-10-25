/**
 * 🏠 생활 사장님 — 근처 이사·청소 요청을 알림톡으로 받고, 참여권 1장으로 견적을 보낸다 (2026-10-24 대표 확정).
 * 사업자 유저(판매 좌석)로 로그인해야 한다. 등록하면 무료 참여권 3장.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { getSellerToken } from '@/lib/seller-auth'
import { LifeHeader, sellerHeaders } from './life-shared'
import ProSetupForm, { type ProMe } from './pro/ProSetupForm'
import ProCredits from './pro/ProCredits'
import ProInbox from './pro/ProInbox'

function NeedSellerLogin() {
  return (
    <section className="space-y-3 rounded-2xl bg-surface p-5 shadow-lift">
      <p className="text-[15px] font-bold">사장님 계정으로 들어와 주세요</p>
      <p className="text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
        유어딜에 가게를 등록한 사장님이 근처 방역·청소·수리·이사 요청을 알림톡으로 받고 견적을 보낼 수 있어요.
        처음 등록하면 무료 참여권 3장을 드려요.
      </p>
      <Link to="/login?returnUrl=%2Flife%2Fpro" className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center">카카오로 로그인</Link>
      <Link to="/store/new" className="block py-2 text-center text-[13px] font-bold text-brand-text">아직 가게가 없어요 · 가게 등록하기</Link>
    </section>
  )
}

export default function LifeProPage() {
  const hasToken = !!getSellerToken()
  const [me, setMe] = useState<ProMe | null>(null)
  const [failed, setFailed] = useState(false)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    if (!hasToken) return
    api.get('/api/home-service/pro/me', sellerHeaders())
      .then((r) => { setMe(r.data?.data || null); setTick((t) => t + 1) })
      .catch(() => setFailed(true))
  }, [hasToken])
  useEffect(load, [load])

  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title="생활 업체 - 방역·청소·수리·이사 요청 받기 - 유어딜" description="근처 가게 방역·후드 청소·시설 수리·숙소 청소·이사·입주청소 요청을 알림톡으로 받고 견적을 보내세요." url="/life/pro" />
      <LifeHeader title="생활 요청 받기" back="/life" />
      <div className="ur-content-narrow space-y-4 px-4 pb-10">
        {!hasToken ? <NeedSellerLogin /> : failed ? (
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
            <ProSetupForm me={me} onSaved={load} />
          </>
        )}
      </div>
    </div>
  )
}
