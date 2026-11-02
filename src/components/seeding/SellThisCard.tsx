/**
 * 🎁 이용권 상세 — "이 이용권 팔아보기" (2026-10-31 대표 확정 플로우)
 *
 * 두 갈래:
 *   ① 내 유어샵에 담기 — 고유 링크로 판매. 누르면 바로 담기고 링크가 복사된다(기존 담기 SSOT `usePinAction`).
 *   ② 무료 체험 신청 — 사장님이 제공을 켰을 때만. 연동한 SNS 팔로워로 자동 판정 → 신청.
 *      제공을 안 켰으면 "이 매장은 무상 체험을 제공하지 않아요" 를 그대로 보인다(숨기지 않는다).
 *
 * 주인 본인에게는 안 보인다(자기 가게를 담거나 신청할 일이 없다 — 서버도 막는다).
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePinAction } from '@/features/curator/hooks/usePinAction'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import { FOLLOWER_WORD, PLATFORM_LABEL } from '@/shared/seeding-labels'
import type { SeedingOffer } from '@/shared/seeding'
// 신청 시트는 누를 때만 받는다 — 상세 첫 화면 무게에 넣지 않는다(surface-budgets).
const SeedingApplySheet = lazy(() => import('./SeedingApplySheet'))

type OfferView = (SeedingOffer & { slots_left: number }) | { enabled: false }

export default function SellThisCard({ productId, price, hideForOwner: isOwner }: { productId: number; price?: number; hideForOwner?: boolean }) {
  const { togglePin, isPinning } = usePinAction()
  const [offer, setOffer] = useState<OfferView | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!(productId > 0) || isOwner) return
    let alive = true
    api.get(`/api/seeding/offer/${productId}`)
      .then((r) => { if (alive && r.data?.success) setOffer(r.data.data) })
      .catch(() => { if (alive) setOffer({ enabled: false }) })
    // 플랫폼 로그인에서 돌아오면 바로 신청 창을 다시 연다.
    try { if (new URLSearchParams(window.location.search).get('sns')) setOpen(true) } catch { /* noop */ }
    return () => { alive = false }
  }, [productId, isOwner])

  if (isOwner || !(productId > 0)) return null
  const on = offer && offer.enabled ? offer : null

  return (
    // 📏 2026-11-02: 좌우 여백 0 이라 글자가 화면 끝에 붙어 잘렸다(라이브 left=0 실측). 다른 구역과 같은 20/16.
    <div style={{ padding: '20px 16px' }}>
      <p className="text-[15px] font-bold text-gray-900 dark:text-white">이 이용권 팔아보기</p>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        내 유어샵에 담아 고유 링크로 팔거나, 매장이 제공하면 무료로 체험해 볼 수 있어요.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={isPinning} onClick={() => togglePin(productId, price)}
          className="rounded-xl bg-warm px-3 py-3 text-[15px] font-medium text-gray-900 disabled:opacity-60 dark:text-white">
          내 유어샵에 담기
        </button>
        <button type="button" disabled={!on} onClick={() => setOpen(true)}
          className="rounded-xl bg-brand px-3 py-3 text-[15px] font-medium text-white disabled:bg-warm disabled:text-gray-500">
          무료 체험 신청
        </button>
      </div>
      {/* 📏 한 줄 고정 — 정보가 늦게 와도 아래 내용이 밀리지 않게(기다리는 동안 같은 높이의 빈 줄). 조건 전문은 신청 시트가 보인다. */}
      <p className={`mt-3 truncate text-[13px] text-gray-500 dark:text-gray-400 ${offer ? '' : 'invisible'}`}>
        {on
          ? `무상 체험 제공: ${on.platforms.map((p) => PLATFORM_LABEL[p]).join('·')} ${FOLLOWER_WORD[on.platforms[0]]} ${formatNumber(on.min_followers)}명 이상, 이번 달 남은 자리 ${formatNumber(on.slots_left)}`
          : offer ? (
            <>
              이 매장은 무상 체험을 제공하지 않아요.{' '}
              {/* 🎁 2026-11-01: 종전엔 여기가 막다른 길이었다 — 제공을 안 켠 상세에 온 사람에게 다음 걸음을 준다. */}
              <Link to="/influencer/seeding" className="font-medium text-brand-text underline">다른 체험 보기</Link>
            </>
          ) : '체험 정보를 확인하는 중'}
      </p>
      {open && on && <Suspense fallback={null}><SeedingApplySheet productId={productId} offer={on} onClose={() => setOpen(false)} /></Suspense>}
    </div>
  )
}
