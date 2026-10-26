/**
 * 🏢 생활 업체 소개 페이지 `/life/biz/:id` (2026-10-26 대표 "1,2,3 모두 진행해줘").
 * 사장님이 카톡·블로그에 걸 수 있는 한 장 — 소개·인증·하는 일·지역·다른 곳 후기 링크·유어딜 후기·정찰가 이용권.
 * deal-card-ok: 오른쪽 좁은 칸(340px)의 한 줄 목록(작은 사진·이름·가격)이라 피드 카드가 아니다 — 견적 카드의 이용권 줄과 같은 모양.
 * 🔒 연락처는 절대 안 싣는다(서버 `GET /api/home-service/pros/:id` 가 애초에 안 준다). 연락은 견적 요청으로만.
 */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import BrandLoader from '@/components/brand/BrandLoader'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { formatKSTDate } from '@/utils/date'
import { LifeHeader, categoryLabel } from './life-shared'
import { RatingLine, ReviewPhotos, type ProLink, type ReviewSummary } from './life-reviews'
import { lifeBizDescription, lifeBizIndexable, lifeBizTitle } from '@/shared/seo/life-biz-seo'
import { withSiteName } from '@/shared/seo/consumer-surfaces'

interface Biz {
  id: number; name: string; verified: boolean; intro: string; links: ProLink[]
  categories: string[]; areas: { sido: string; sigungu: string | null }[]
  vouchers: { id: number; name: string; price: number | null; original_price: number | null; image_url: string | null }[]
  reviews: ReviewSummary | null; chosen_count: number
}

/** 서버가 이 페이지에 실어 준 업체(`__SSR_INITIAL_LIFEBIZ__`) — 주소의 id 와 같을 때만 쓴다. */
function readSeed(id: string | undefined): Biz | null {
  if (typeof document === 'undefined' || !id) return null
  const el = document.getElementById('__SSR_INITIAL_LIFEBIZ__')
  if (!el?.textContent) return null
  try {
    const d = (JSON.parse(el.textContent) as { data?: Biz })?.data
    return d && String(d.id) === String(id) ? d : null
  } catch { return null }
}

function areaText(areas: Biz['areas']): string {
  const out = areas.slice(0, 6).map((a) => (a.sigungu ? `${a.sido} ${a.sigungu}` : `${a.sido} 전체`))
  return out.join(', ') + (areas.length > 6 ? ` 외 ${areas.length - 6}곳` : '')
}

export default function LifeBizPage() {
  const { id } = useParams()
  const [b, setB] = useState<Biz | null>(() => readSeed(id))
  const [gone, setGone] = useState(false)

  useEffect(() => {
    api.get(`/api/home-service/pros/${id}`)
      .then((r) => (r.data?.success ? setB(r.data.data) : setGone(true)))
      .catch(() => setGone(true))
  }, [id])

  if (gone) {
    return (
      <div className="min-h-[100dvh] bg-warm px-4 py-20 text-center text-ink">
        <p className="text-[15px] font-bold">업체를 찾을 수 없어요</p>
        <Link to="/life" className="mt-4 inline-block text-[13px] font-medium text-brand-text">생활 서비스 보기</Link>
      </div>
    )
  }
  if (!b) return <BrandLoader fullScreen label="업체를 불러오는 중" />

  const first = b.categories[0]
  const recent = b.reviews?.recent ?? []
  return (
    <div className="min-h-[100dvh] bg-warm text-ink pb-safe-nav">
      <SEO title={withSiteName(lifeBizTitle(b))} description={lifeBizDescription(b)} url={`/life/biz/${b.id}`} noindex={!lifeBizIndexable(b)} />
      <LifeHeader title="업체 소개" back="/life" />
      <div className="mx-auto w-full max-w-[720px] px-4 pb-10 lg:grid lg:max-w-[1120px] lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5 lg:px-8">
        <div className="space-y-4">
          <section className="rounded-2xl bg-surface p-5 shadow-lift">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[24px] font-bold">{b.name}</h2>
              {b.verified && <span className="rounded-full bg-warm px-2 py-1 text-[12px] font-medium text-gray-600 dark:text-gray-300">사업자 인증</span>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-gray-500 dark:text-gray-400">
              <RatingLine r={b.reviews} />
              {b.chosen_count > 0 && <span>유어딜에서 {formatNumber(b.chosen_count)}번 선택됨</span>}
            </div>
            {b.intro && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">{b.intro}</p>}
            <dl className="mt-4 space-y-2 border-t border-rule pt-3 text-[13px]">
              {b.categories.length > 0 && (
                <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500 dark:text-gray-400">하는 일</dt><dd>{b.categories.map(categoryLabel).join(', ')}</dd></div>
              )}
              {b.areas.length > 0 && (
                <div className="flex gap-3"><dt className="w-14 shrink-0 text-gray-500 dark:text-gray-400">지역</dt><dd>{areaText(b.areas)}</dd></div>
              )}
            </dl>
            {b.links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {b.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow"
                    className="rounded-full bg-warm px-3 py-1 text-[12px] font-medium text-ink">{l.label} 후기 보기</a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-lift">
            <p className="text-[17px] font-bold">유어딜 후기 {b.reviews?.count ? formatNumber(b.reviews.count) : ''}</p>
            {recent.length === 0 ? (
              <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">아직 유어딜 후기가 없어요.{b.links.length ? ' 위의 다른 곳 후기를 확인해 보세요.' : ''}</p>
            ) : (
              <ul className="mt-3 divide-y divide-rule">
                {recent.map((v, i) => (
                  <li key={i} className="py-3">
                    <p className="text-[12px] text-gray-500 dark:text-gray-400"><b className="text-ink">{'★'.repeat(v.rating)}</b> {v.reviewer} · {formatKSTDate(v.created_at)}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-gray-700 dark:text-gray-200">{v.body}</p>
                    <ReviewPhotos photos={v.photos} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="mt-4 space-y-4 lg:sticky lg:top-24 lg:mt-0">
          {first && (
            <section className="rounded-2xl bg-surface p-5 shadow-lift">
              <p className="text-[15px] font-bold">이 업체에 견적 받기</p>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">요청서를 쓰면 근처 업체들이 견적을 보내요. 연락처는 고른 한 곳에만 공개돼요.</p>
              <Link to={`/life/request/${first}`} className="ur-btn ur-btn-lg ur-btn-primary mt-3 flex w-full justify-center">{categoryLabel(first)} 견적 요청하기</Link>
            </section>
          )}
          {b.vouchers.length > 0 && (
            <section className="rounded-2xl bg-surface p-5 shadow-lift">
              <p className="text-[15px] font-bold">정찰가 이용권</p>
              <ul className="mt-2 divide-y divide-rule">
                {b.vouchers.map((v) => (
                  <li key={v.id}>
                    <Link to={`/pass/${v.id}`} className="flex items-center gap-3 py-3">
                      {v.image_url
                        ? <img src={cfImage(v.image_url, { width: 112 })} onError={(e) => cfImageOnError(e.currentTarget, v.image_url)} alt="" width={56} height={56} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                        : <span className="h-14 w-14 shrink-0 rounded-xl bg-warm" />}
                      <span className="min-w-0 flex-1 truncate text-[13px]">{v.name}</span>
                      <b className="shrink-0 text-[13px]">{formatNumber(v.price)}원</b>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
