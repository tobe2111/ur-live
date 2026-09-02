import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { resolveSectionMoreHref, isDeadEndHref } from './section-more-href'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_LG_QUERY, HOME_CARD_ABOVE_FOLD,
} from '@/shared/home-card-image'

/**
 * 🏠 ① 카테고리 섹션 + 더보기 (2026-08-04 대표 시안 승인).
 *
 * 어드민이 만든 홈 섹션(`homepage_sections`)을 주제별 한 줄씩 그린다.
 * 상품은 규칙(인기·마감임박·최신·카테고리) 또는 직접 고른 목록에서 온다 — 서버가 정한다.
 *
 * 🚫 **상품이 0건인 섹션은 서버가 목록에서 빼고 내려준다.** 여기서 또 거르지 않아도 되지만,
 *    방어적으로 한 번 더 본다(서버가 바뀌어도 홈에 빈 제목이 남지 않게).
 *
 * 카드가 링크하는 곳은 `canonicalDetailPath` SSOT 로 정한다 — 교환권(`deal_only=1`)은 `/vouchers`,
 * 숙소는 `/stays`, 나머지 이용권은 `/group-buy` 다. 이름으로 찍으면 반드시 틀린다.
 */

/** 서버 `CARD_COLS`(section-rules.ts)가 실어 주는 필드 — 카드(`GroupBuyFeedCard`) 계약과 같은 모양. */
interface SectionProduct {
  id: number
  name: string
  price: number
  original_price?: number
  image_url?: string
  category?: string
  deal_only?: number
  dominant_color?: string | null
  restaurant_name?: string
  restaurant_address?: string
  discount_rate?: number
  sold_count?: number
  avg_rating?: number
  /** 🖼️ 2026-08-19: hover 캐러셀용 갤러리(서버가 잘라 내려줌). */
  images?: string[] | string | null
}
interface HomeSection {
  id: number
  title: string
  subtitle?: string | null
  more_href?: string | null
  products: SectionProduct[]
}

/**
 * 🛍️ 2026-08-19 (대표 신고 — "지금 인기 이용권 카드 디자인과 가까운 동네딜 카드가 다르네"):
 * 이 파일이 갖고 있던 자체 `DealCard`(이미지+제목+가격만)를 **삭제**하고 피드와 **같은 카드**
 * (`GroupBuyFeedCard`)를 쓴다. 카드가 두 벌이면 한쪽만 고쳐지고 결국 갈린다 — 실제로 그렇게 됐다.
 * 링크 목적지(`canonicalDetailPath`)·hover 캐러셀·평점/거리/할인 pill 전부 그 카드가 SSOT 다.
 */

/**
 * @param midBanner 첫 섹션 **뒤에** 끼워 넣을 노드(③ 중간 배너). 섹션이 하나도 없으면 이것만
 *   남는다 — 배너 컴포넌트 자신이 "없으면 null" 이라 결국 아무것도 안 그려진다.
 */
export default function HomeSections({ midBanner }: { midBanner?: React.ReactNode }) {
  /**
   * 🖼️ 카드 사진 해상도 — 열 수를 아는 쪽이 정한다(2026-08-27).
   *   이 섹션은 룩을 위해 `pc` 를 **항상** 넘기는데, 예전엔 그 플래그가 이미지 폭까지 정해서
   *   **모바일·태블릿도 PC용 큰 사진**을 받았다(실측 필요폭의 2.3배). 룩과 해상도를 분리한다.
   */
  //   ⚠️ 폭·중단점·eager 개수는 **워커의 preload 와 같은 값이어야 한다**(`shared/home-card-image`).
  //     한 글자만 달라도 브라우저가 preload 를 안 쓰고 같은 사진을 두 번 받는다.
  const isLgViewport = useMediaQuery(HOME_CARD_LG_QUERY)
  const cardImgWidth = isLgViewport ? HOME_CARD_IMG_WIDTH_LG : HOME_CARD_IMG_WIDTH_BASE

  /**
   * 🏠 2026-08-22 (대표 "인기 이용권이 먼저 안 뜨고 가까운 동네딜이 먼저 보여"): 워커가 홈 HTML 에
   * `__SSR_INITIAL_SECTIONS__` 를 함께 실어 보낸다(`worker/index.ts` SECTIONS 보조 슬롯).
   * **첫 render 에서 동기로** 읽어야 의미가 있다 — useEffect 로 읽으면 이미 한 프레임 늦어
   * 스켈레톤이 한 번 깜빡이고, 그게 대표가 본 "늦게 끼어든다"의 실체다.
   * 시드가 없으면(다른 표면·콜드 타임아웃) undefined → 평소대로 fetch. 회귀 0.
   */
  const ssrSections = useMemo<HomeSection[] | undefined>(() => {
    try {
      const el = document.getElementById('__SSR_INITIAL_SECTIONS__')
      if (!el?.textContent) return undefined
      const r = JSON.parse(el.textContent) as { success?: boolean; data?: HomeSection[] }
      return r?.success && Array.isArray(r.data) ? r.data : undefined
    } catch {
      return undefined // 깨진 시드 하나가 홈을 못 열게 하면 안 된다
    }
  }, [])

  const { data: sections = [], isLoading } = useApiQuery<HomeSection[]>(
    ['home', 'sections'],
    '/api/sections',
    {
      select: (raw) => {
        const r = raw as { success?: boolean; data?: HomeSection[] }
        return r?.success && Array.isArray(r.data) ? r.data : []
      },
      staleTime: 5 * 60_000,
      initialData: ssrSections,
      // ⚠️ initialData 는 기본적으로 "신선함"으로 간주된다 — 그대로 두면 시드가 낡아도 갱신이 안 된다.
      //   (가드: check-query-initialdata) 마운트마다 백그라운드 갱신시켜 화면은 즉시, 값은 최신으로.
      refetchOnMount: 'always',
    },
  )

  const visible = sections.filter(s => Array.isArray(s.products) && s.products.length > 0)

  /**
   * 🧱 2026-08-19 (대표 신고 — "첫 접속하면 지금 인기 이용권이 먼저 안뜨고 … 시간 지나면 보여"):
   *   섹션은 동네딜 피드(SSR 0-RTT)와 달리 **응답이 온 뒤에야** 존재했다. 그래서 늦게 *끼어들며*
   *   아래 콘텐츠를 밀어냈다 — 사용자에겐 "없다가 갑자기 생긴다"로 보인다.
   *   ⇒ 응답을 기다리는 동안 **자리를 잡아 둔다**(제목 줄 + 카드 4칸). 늦게 와도 화면이 안 밀린다.
   *   ⚠️ 로딩이 끝났는데 섹션이 0건이면 자리를 **남기지 않는다** — 대표 확정 "안 올리면 아예 안 보이게".
   */
  if (isLoading && visible.length === 0) {
    return (
      <>
        <section className="ur-home-panel light-island" aria-hidden="true">
          <div className="h-[22px] w-40 rounded bg-gray-100 dark:bg-white/[0.06] mb-1" />
          <div className="h-[15px] w-56 rounded bg-gray-100 dark:bg-white/[0.06] mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-[4/3] rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
                <div className="h-[13px] w-3/4 rounded bg-gray-100 dark:bg-white/[0.06] mt-2.5" />
                <div className="h-[13px] w-1/2 rounded bg-gray-100 dark:bg-white/[0.06] mt-1.5" />
              </div>
            ))}
          </div>
        </section>
        {midBanner}
      </>
    )
  }

  if (visible.length === 0) return <>{midBanner}</>

  return (
    <>
      {visible.map((sec, sIdx) => {
        // 🔗 링크 해석은 SSOT(`section-more-href`)가 한다 — 차단·별칭정본화·쿼리보존을 **한 번에**.
        //   여기 인라인으로 두는 동안 같은 신고가 세 번 났다(08-17 플래시 · 08-19 쿼리유실 ·
        //   08-27 버튼실종). 특히 `safeInternalPath` 가 쿼리를 버린다는 사실을 두 번 놓쳤다 —
        //   그래서 순수 함수로 빼서 **실제 입력으로** 테스트한다. 경위는 그 파일 주석에.
        const more = resolveSectionMoreHref(sec.more_href)
        const moreIsDeadEnd = isDeadEndHref(more)
        return (
          <Fragment key={sec.id}>
          {/* 📐 가로 여백은 홈 컨테이너가 준다 — 여기서 또 주면 좌우가 어긋난다. */}
          {/* 📐 2026-08-17 (대표 — 컴팩트): 섹션 하단 여백·제목·그리드 gap 축소(피드 그리드와 동일 톤). */}
          <section className="ur-home-panel light-island">
            <div className="flex items-end justify-between gap-4 mb-3">
              <div className="min-w-0">
                <h3 className="text-[17px] font-black tracking-tight text-gray-900 dark:text-white">
                  {sec.title}
                </h3>
                {sec.subtitle && (
                  <p className="mt-0.5 text-[12.5px] text-gray-500 dark:text-gray-400">{sec.subtitle}</p>
                )}
              </div>
              {more && !moreIsDeadEnd && (
                <Link
                  to={more}
                  className="shrink-0 px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-[#2C2F35] text-[12.5px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors whitespace-nowrap"
                >
                  더보기 →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 lg:gap-4">
              {sec.products.map((p, i) => (
                <GroupBuyFeedCard key={p.id} p={p} imgWidth={cardImgWidth} aboveFold={i < HOME_CARD_ABOVE_FOLD && sIdx === 0} />
              ))}
            </div>
          </section>
          {sIdx === 0 && midBanner}
          </Fragment>
        )
      })}
    </>
  )
}
