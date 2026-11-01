/**
 * 🎁 무료 체험 이용권 목록 (`/influencer/seeding`) — 모집 깔때기의 착지 (2026-11-01)
 *
 * ## 왜 이 화면이 생겼나
 * 2026-10-31 에 신청·사장님 승인·신청권까지 다 만들었는데 **인플루언서가 "무엇을 신청할 수 있는지"
 * 볼 곳이 없었다.** 신청은 상세(`/pass/:id`)의 [이 이용권 팔아보기] 에서만 열리므로 **그 상세 주소를
 * 이미 아는 사람만** 신청할 수 있었다 — `/my-seeding` 의 빈 상태가 *"이용권 상세의 … 에서 신청할 수
 * 있어요"* 라고 말하면서 링크를 못 주고 있던 것이 그 증거다. 모집 메일·DM 이 착지할 곳이 이 화면이다.
 *
 * ## 규율
 * - **자격을 여기서 판정하지 않는다.** 팔로워·패널티·중복 판정은 상세의 `checkEligibility` 한 곳에만
 *   둔다(두 곳에서 판정하면 목록은 "신청 가능" 인데 상세는 거절하는 날이 온다). 이 화면은 *조건을 적어*
 *   주고 상세로 보낸다.
 * - 로그인 없이 보인다 — 모집 메일을 받은 사람이 먼저 보고 결정한다. 로그인 유도는 상세·신청 시트가 한다.
 * - 상세 주소는 `detailHref` SSOT 로 만든다(서버가 주소를 내려주지 않는다 — 두 벌이 되면 갈린다).
 * - 줄은 `DealRow`(줄 카드 SSOT)로 — 사진 폴백·가격 표시·prefetch 가 그 안에 있다.
 *
 * ⚠️ 색인하지 않는다(`noindex`) — 자리가 0 이면 본문이 비는 화면이고, 이 화면의 유입은 검색이 아니라
 *    모집 메일·DM 이다. 섣불리 색인시키면 thin content 가 된다.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import DealRow from '@/components/deal/DealRow'
import { detailHref } from '@/shared/product-flow'
import { FOLLOWER_WORD, PLATFORM_LABEL, type SeedingPlatform } from '@/shared/seeding-labels'
import { formatNumber } from '@/utils/format'

interface OpenOffer {
  product_id: number; name: string; image_url: string | null; price: number; original_price: number | null
  category: string | null; deal_only: number | null; restaurant_name: string | null; restaurant_address: string | null
  platforms: SeedingPlatform[]; min_followers: number; slots_left: number
  post_requirement: string; post_deadline_days: number
}

/** "인스타그램 1,000 팔로워 이상" — 조건이 없으면 조건 없음을 그대로 말한다(숨기지 않는다). */
function conditionText(o: OpenOffer): string {
  const names = (o.platforms || []).map((p) => PLATFORM_LABEL[p] || p).join('·')
  if (!(o.min_followers > 0)) return names ? `${names} 연동` : '조건 없음'
  const word = FOLLOWER_WORD[o.platforms?.[0]] || '팔로워'
  return `${names} ${formatNumber(o.min_followers)} ${word} 이상`
}

export default function InfluencerSeedingPage() {
  const [offers, setOffers] = useState<OpenOffer[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    api.get('/api/seeding/open')
      .then((r) => {
        if (!alive) return
        if (r.data?.success) setOffers(r.data.data?.offers ?? [])
        else setFailed(true)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  return (
    <div className="min-h-[100dvh] bg-warm pb-24">
      <SEO title="무료 체험 이용권 - 유어딜" description="매장이 무상으로 제공하는 이용권을 찾아 신청해 보세요" url="/influencer/seeding" noindex />
      <div className="mx-auto max-w-xl px-4 pt-5">
        <h1 className="text-[24px] font-bold text-gray-900 dark:text-white">무료 체험 이용권</h1>
        <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
          매장이 무상으로 제공하는 이용권이에요. 신청하면 사장님 확인 뒤 방문 날짜를 정해요.
        </p>
        <div className="mt-3 flex gap-2">
          <Link to="/my-seeding" className="ur-btn ur-btn-sm ur-btn-secondary flex-1">내 체험 신청</Link>
          <Link to="/influencer" className="ur-btn ur-btn-sm ur-btn-secondary flex-1">어떻게 버나요?</Link>
        </div>

        {offers === null && !failed && <div className="mt-8"><BrandLoader label="체험 이용권을 불러오고 있어요" /></div>}

        {failed && (
          <p className="mt-8 text-[13px] text-gray-500 dark:text-gray-400">
            목록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
          </p>
        )}

        {offers !== null && offers.length === 0 && (
          <div className="mt-8 rounded-2xl bg-surface p-5 shadow-lift">
            <p className="text-[15px] font-medium text-gray-900 dark:text-white">지금은 열린 체험이 없어요</p>
            <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
              무상 제공은 매장이 직접 켜고 매달 모집 인원이 정해져 있어요. 이용권을 내 유어샵에 담아
              고유 링크로 파는 것은 지금도 할 수 있어요.
            </p>
            <Link to="/vouchers" className="ur-btn ur-btn-md ur-btn-primary ur-btn-block mt-4">이용권 둘러보기</Link>
          </div>
        )}

        {offers !== null && offers.length > 0 && (
          <ul className="mt-4 space-y-2">
            {offers.map((o) => {
              const to = detailHref({ id: o.product_id, deal_only: o.deal_only, category: o.category })
              return (
                <li key={o.product_id}>
                  <DealRow
                    to={to}
                    imageUrl={o.image_url}
                    eyebrow={o.restaurant_name || undefined}
                    title={o.name}
                    price={o.price}
                    originalPrice={o.original_price}
                    meta={
                      <span className="text-[12px] text-gray-500 dark:text-gray-400">
                        {conditionText(o)} · 남은 자리 {formatNumber(o.slots_left)}
                      </span>
                    }
                    trailing={<span className="text-[13px] font-medium text-brand-text">신청</span>}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
