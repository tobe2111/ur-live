import { DEAL_GRID_GAP } from '@/shared/deal-card-grid'
import { Fragment, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { resolveSectionMoreHref, isDeadEndHref } from './section-more-href'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { readHomeSectionsSeed } from '@/shared/home-section-ids'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_LG_QUERY, HOME_CARD_ABOVE_FOLD,
} from '@/shared/home-card-image'

/**
 * 🏠 ① 카테고리 섹션 + 더보기 (2026-08-04 대표 시안 승인).
 *
 * 어드민이 만든 홈 섹션(`homepage_sections`)을 주제별 한 줄씩 그린다.
 * 상품은 규칙(인기·최신·카테고리) 또는 직접 고른 목록에서 온다 — 서버가 정한다.
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
export default function HomeSections(
  { midBanner, shortsRail }: { midBanner?: React.ReactNode; shortsRail?: React.ReactNode },
) {
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
  //   시드 파싱은 `shared/home-section-ids` 가 SSOT 다 — 바로 아래 피드도 같은 시드를 읽는다
  //   (섹션에 뜬 상품을 자기 밴드 뒤로 미루려고). 파서가 둘이면 한쪽만 고쳐지고 결국 갈린다.
  const ssrSections = useMemo(() => readHomeSectionsSeed<HomeSection>(), [])

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
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${DEAL_GRID_GAP}`}>
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

  if (visible.length === 0) return <>{shortsRail}{midBanner}</>

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
                /* 🎨 2026-09-07 (대표 승인 — 홈 개선 안 C): 테두리 알약 → 밑줄 없는 글자 링크.
                   표면 규칙 첫 줄이 **테두리 0** 인데 섹션마다 붙는 더보기만 테두리를 그려,
                   화면에서 가장 안 중요한 것이 제일 진하게 보였다. 화살표도 뺀다 — 더보기라는 말이
                   이미 "눌러진다"를 말하고 있어 화살표가 같은 말을 두 번 한다.

                   ⚠️ **글자색은 원래 회색 그대로다.** 처음엔 브랜드 블루로 바꿨는데 대표가
                      *"글자 색은 흰색에서 파랑으로 넘어가진 말자"* 로 되돌렸다(다크에서 밝은 회색이
                      파랑이 되는 게 어색하다). 블루는 **면**(버튼·선택 칩)에서만 쓰고, 본문 글자를
                      파랑으로 물들이지 않는다. 눌러지는 신호는 hover 밑줄이 맡는다. */
                <Link
                  to={more}
                  className="shrink-0 text-[12.5px] font-bold text-gray-600 dark:text-gray-300 hover:underline underline-offset-4 whitespace-nowrap"
                >
                  더보기
                </Link>
              )}
            </div>
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 ${DEAL_GRID_GAP}`}>
              {sec.products.map((p, i) => (
                <GroupBuyFeedCard key={p.id} p={p} imgWidth={cardImgWidth} aboveFold={i < HOME_CARD_ABOVE_FOLD && sIdx === 0} />
              ))}
            </div>
          </section>
          {/* 🎬 2026-09-07 (대표 확정): 유어쇼츠는 **인기 이용권 다음**. 히어로 바로 아래로 올리면
              홈이 첫 딜을 보여 주는 시각(559ms→304ms로 당겨 둔 값)이 늦어지고, 4열 그리드가
              세 번 연달아 나오던 단조로움도 이 세로 레일이 끊는다. */}
          {sIdx === 0 && shortsRail}
          {sIdx === 0 && midBanner}
          </Fragment>
        )
      })}
    </>
  )
}
