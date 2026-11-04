/**
 * 🚪 /join — 유어딜 시작하기 (2026-11-04 대표 확정 **시안 B "손님 먼저, 사업자는 아래"**).
 *
 * 대표: *"딜 사고 소개하기 이게 뭐야,, 뭐 합리적인 이용권 찾기 라던지,, 그리고 에이전시 버튼도 있어야 할거고 너무 성의없는 페이지다"*
 *   → 시안 A(세 갈래 나란히)·B(손님 먼저) 중 *"B가 낫겠네"*. 시안: `docs/design/join-page-2026-11-04.md`.
 *
 * - 맨 위는 **손님**(이 주소로 오는 대부분): 무엇을 하는 곳인지 세 줄 + **실제 인기 이용권 세 장** + 카카오로 시작.
 *   이용권은 홈 피드와 같은 주소(`usePopularPassFeed` — 예열 키)에서 온다. 못 받으면 그 줄을 안 그린다(가짜 카드 없음).
 * - 아래 **사업자라면**: 내 가게 이용권 팔기(`/store/new`) · 에이전시로 여러 매장 운영(`/agency/signup`, 이메일 계정).
 * - 🗑️ '딜 사고 소개하기' 는 뺐다 — 소개(담기)는 손님 길 안의 덤으로만 말한다(행위 2개 원칙은 그대로: 담기는 누구나).
 * - 🎨 종전엔 늘 검은 화면(`bg-[#11141C]` 고정)이었다 → 사이트 테마(화이트/다크)를 따른다.
 * deal-card-ok: 가입 화면의 맛보기 사진 세 장(사진·할인율·이름·가격 한 줄)이지 딜 목록 카드가 아니다. 목적지는 이용권 상세 정본 `/pass/:id`.
 * 🏁 2026-06-15 원칙 유지: 손님은 따로 가입하지 않는다 — 로그인이 곧 시작이다.
 */

import { Link } from 'react-router-dom'
import SEO from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import { StoreIcon, PeopleIcon } from '@/components/icons/urdeal-icons'
import { ChevronRight } from 'lucide-react'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { usePopularPassFeed, type PopularPass } from '@/hooks/usePopularPassFeed'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { canonicalDetailPath } from '@/shared/product-flow'

/** 보여 줄 이용권 세 장 — 사진 있고 교환권(딜 결제) 아닌 것. 피드 순서(인기순) 그대로. */
export function pickJoinPasses(feed: PopularPass[] | null): PopularPass[] {
  return (feed || []).filter((p) => p.image_url && Number(p.deal_only) !== 1).slice(0, 3)
}

const pct = (p: PopularPass) => {
  const o = Number(p.original_price), s = Number(p.price)
  return o > 0 && s > 0 && o > s ? Math.round((1 - s / o) * 100) : 0
}

const POINTS = [
  '동네 식당·뷰티·숙소 이용권을 할인가로',
  '매장에서 QR 한 번이면 사용 끝',
  '마음에 든 이용권은 내 유어샵에 담아 소개',
]

const BIZ = [
  { to: '/store/new', Icon: StoreIcon, title: '내 가게 이용권 팔기', hint: '가게 등록 · 매출 현금 정산', testId: 'join-store' },
  { to: '/agency/signup', Icon: PeopleIcon, title: '에이전시로 여러 매장 운영', hint: '이메일 계정 · 직원 초대', testId: 'join-agency' },
] as const

export default function JoinChoicePage() {
  const passes = pickJoinPasses(usePopularPassFeed(true))
  return (
    <>
      <SEO title={CONSUMER_SURFACE_SEO['/join'].title} description={CONSUMER_SURFACE_SEO['/join'].description} url="/join" />
      <div className="min-h-[100dvh] bg-surface text-gray-900 dark:text-white">
        <div className="ur-content-narrow px-5 pt-8 pb-12">
          <Link to="/" aria-label="유어딜 홈" className="inline-block"><UrDealLogo /></Link>

          <h1 className="mt-5 text-[24px] font-bold leading-snug tracking-[-0.01em]">동네 이용권, 할인가로 사서<br />바로 쓰기</h1>
          <ul className="mt-3 space-y-2" data-testid="join-points">
            {POINTS.map((t) => (
              <li key={t} className="flex items-baseline gap-2 text-[15px] text-gray-600 dark:text-gray-300">
                <span aria-hidden="true" className="h-[6px] w-[6px] shrink-0 -translate-y-[2px] rounded-full bg-brand" />{t}
              </li>
            ))}
          </ul>

          {passes.length === 3 && (
            <div className="mt-5 grid grid-cols-3 gap-2" data-testid="join-passes">
              {passes.map((p) => (
                <Link key={p.id} to={canonicalDetailPath(p as never) ?? `/pass/${p.id}`} className="block min-w-0 active:opacity-80">
                  <div className="aspect-square overflow-hidden rounded-xl bg-wash">
                    <img src={cfImage(p.image_url!, { width: 240 }) || p.image_url!} alt="" loading="lazy" className="h-full w-full object-cover"
                      onError={(e) => cfImageOnError(e.currentTarget, p.image_url!)} />
                  </div>
                  <p className="mt-1 truncate text-[12px] text-gray-900 dark:text-white">
                    {pct(p) > 0 && <b className="mr-1 font-medium text-sale">{pct(p)}%</b>}{p.name || '이용권'}
                  </p>
                  {p.price != null && <p className="text-[12px] tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(Number(p.price))}원</p>}
                </Link>
              ))}
            </div>
          )}

          <Link to="/login?returnUrl=%2F" className="ur-btn ur-btn-lg ur-btn-primary mt-5 flex w-full justify-center" data-testid="join-start">
            카카오로 시작하기
          </Link>
          <Link to="/vouchers" className="mt-3 block text-center text-[13px] font-medium text-brand-text">로그인 없이 이용권 둘러보기</Link>

          <p className="mt-8 text-[13px] font-medium text-gray-500 dark:text-gray-400">사업자라면</p>
          <div className="mt-1 divide-y divide-rule">
            {BIZ.map((b) => (
              <Link key={b.to} to={b.to} data-testid={b.testId} className="flex items-center gap-3 py-3 active:opacity-70">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-text">
                  <b.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{b.title}</span>
                  <span className="block text-[13px] text-gray-500 dark:text-gray-400">{b.hint}</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={1.6} aria-hidden="true" />
              </Link>
            ))}
          </div>

          <p className="mt-8 text-center text-[13px] text-gray-500 dark:text-gray-400">
            이미 계정이 있나요? {/* login-return-ok: 가입 흐름 안의 안내 링크 */}<Link to="/login" className="font-medium text-gray-900 underline dark:text-white">로그인</Link>
          </p>
        </div>
      </div>
    </>
  )
}
