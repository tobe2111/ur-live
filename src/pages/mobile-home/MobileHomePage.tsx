import { useEffect, useRef, useState } from 'react'
import { HOME_H1, CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { useCurrentDong } from '@/hooks/useCurrentDong'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import SEO, { organizationJsonLd, webSiteJsonLd } from '@/components/SEO'
import UrDealLogo from '@/components/brand/UrDealLogo'
import SellOnUrdealRow from './SellOnUrdealRow'
import MapPill from './MapPill'
import { useNotificationSheet } from '@/components/notifications/useNotificationSheet'
import GroupBuyFeed from '@/pages/main-home/GroupBuyFeed'
import { useHomeQuerySync } from '@/pages/main-home/useHomeQuerySync'
import HomeSections from '@/components/home/HomeSections'
import { resolveHomeNear, syncNearCookie } from '@/components/home/home-near'
import UrShortsRail from '@/components/home/UrShortsRail'
import HomeBannerStrip from '@/components/home/HomeBannerStrip'
import PcHomeLocationBar, { readHomeRegion, type HomeRegion } from '@/pages/pc-home/PcHomeLocationBar'
import { readCachedLoc } from '@/shared/utils/cached-loc'
import { DEAL_CATS, type DealCategory } from '@/pages/pc-home/PcHomeRail'
import { BellIcon, BagIcon } from '@/components/icons/urdeal-icons'
import { PlayTileIcon } from '@/components/icons/category-icons'
import { HOME_CAT_ICON } from './home-cat-icons'
import { HOME_SEARCH, HOME_CATS } from '@/shared/home-chrome'
import { URSHORTS_BROWSE_PATH } from '@/shared/urshorts'
import { HOME_SHOWCASE_ENABLED } from '@/shared/feature-flags'

/**
 * 📱 모바일 메인 (2026-08-19 대표 확정 — 그루폰 모바일 홈 시안).
 *
 * ## 무엇이 바뀌었나
 * 모바일 홈은 **지도**였다(`RestaurantMapPage`). 대표 지시: *"이건 그루폰 페이지인데 모바일
 * 메인으로 해서 우리도 이걸 메인으로 해줘. 지금은 맵 링크잖아. 대신 변경되는 페이지에서
 * 맵으로 이동하기 버튼이 있어야겠지?"* ⇒ 메인은 **딜 피드**, 지도는 **상단 배너**로 간다.
 * (하단 탭 5개는 그대로 — 대표 확정 "안 넣기 — 상단 배너만".)
 *
 * ## 🧩 PC 홈과 같은 재료를 쓴다
 * 카드(`GroupBuyFeed`)·편성 섹션(`HomeSections`)·배너·위치바를 **PC 홈과 공유**한다.
 * 모바일용으로 따로 만들면, 이 레포가 이미 여러 번 겪은 대로 **한쪽만 개선되는** 상태로 간다
 * (숙소 상세가 정확히 그랬다). 여기서 모바일 고유인 것은 레이아웃(2열·세로 흐름)뿐이다.
 *
 * ⚠️ 지도로 가는 길을 **반드시** 남긴다 — 홈이 지도였으므로, 배너가 사라지면 사용자는 지도를
 *    찾을 방법이 없어진다(하단 탭에도 지도가 없다). 그래서 가드로 고정한다.
 */
export default function MobileHomePage() {
  const navigate = useNavigate()
  // 🔔 벨 → 올라오는 시트(페이지 이동 X). 배선은 `NotificationSheet` 머리말.
  const bell = useNotificationSheet()
  // 누르는 동안만 아이콘을 채운다(하단 탭의 "활성 = 면" 과 같은 말) — 손을 떼거나 벗어나면 선으로 돌아간다.
  const [pressed, setPressed] = useState<'bell' | 'cart' | null>(null)
  const pressProps = (k: 'bell' | 'cart') => ({
    onPointerDown: () => setPressed(k),
    onPointerUp: () => setPressed(null),
    onPointerLeave: () => setPressed(null),
    onPointerCancel: () => setPressed(null),
  })
  const [region, setRegion] = useState<HomeRegion>(() => (readCachedLoc() ? {} : readHomeRegion()))
  /**
   * 🧭 2026-09-05 (대표 "주말에 떠나는 숙소 섹션 아래의 일반 이용권들은 기본 디폴트가 현재 위치에서
   *   가까운 순대로"): **새로 묻지 않는다** — 지도 홈·위치바가 저장해 둔 마지막 측위만 읽는다
   *   (`readCachedLoc`, 키 `ur_last_loc_v1`). 홈에 들어왔다고 권한 팝업을 띄우는 건 과하고,
   *   거부하면 아무것도 못 하므로 결국 기존 동작으로 돌아온다.
   *   ⇒ 위치를 한 번이라도 잡은 사람은 재방문부터 첫 페인트가 '가까운 순', 아니면 지금과 동일.
   */
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(() => readCachedLoc())
  // 🧭 2026-08-30 (대표 "홈에선 현재 위치가 어딘지도 나와야지"): 좌표 → 동네 이름.
  //   서버 엔드포인트는 2026-07-07 부터 있었는데 **아무도 안 부르고 있었다**(useCurrentDong 주석).
  const dong = useCurrentDong(userLoc)
  /**
   * 📍 2026-10-13 (대표 — 위치를 정하면 맨 위가 그 지역에서 가까운 이용권, 시안 확정 "1,2 섞어서"):
   *   내 위치 → 그 좌표, 지역만 고름 → 시/도 중심. 편성 섹션이 이걸로 정렬된다(어드민 수동 섹션은 그대로).
   *   쿠키도 맞춘다 — 다음 하드로드에서 워커가 같은 위치로 섹션 시드를 받아 첫 화면부터 동네 것이 뜬다.
   */
  const near = resolveHomeNear({ userLoc, dongLabel: dong?.dong, regionKey: region.regionKey })
  useEffect(() => { syncNearCookie(near.key, near.label) }, [near.key, near.label])
  const [category, setCategory] = useState<DealCategory>('all')
  /**
   * 🧭 **위치가 저장된 지역을 이긴다** (2026-09-08 대표 *"여기엔 거리순, 가장 가까운 순이 먼저 떠야해"*).
   *
   * 🩸 이전 판은 `readCachedLoc() && !readHomeRegion().regionKey` 였다. 그래서 **예전에 지역을 골라 둔
   *   사람**은 위치가 잡혀 있어도 영영 '인기순'이었는데, 헤더는 `located` 를 우선해 "동탄5동"을 띄운다.
   *   화면은 "당신은 동탄에 있다"고 말하고 목록은 저장된 지역으로 걸러 인기순으로 줄 세운 셈이다.
   *   그 지역에 딜이 0건이면 전체 폴백까지 걸려 **동탄5동 아래 서울 강남 딜**이 떴다(대표 실측).
   *
   * ⇒ 좌표가 있으면 저장된 지역은 **적용하지 않는다**(localStorage 는 그대로 둔다 — 지역을 다시 고르면
   *   `handleRegion` 이 위치를 비우고 그 지역으로 간다). 헤더가 이미 내리는 판단을 목록도 내리게 하는 것뿐이다.
   *
   * ⚠️ 좌표가 없으면 거리순은 **만들 수 없다** → 그때만 '인기순'. 홈에서 위치를 새로 묻지는 않는다
   *   (2026-09-05 결정 유지 — 화면 열자마자 권한 팝업은 과하다).
   * 📌 여기 있던 "지역을 고른 사람에겐 가까운 순을 안 씌운다" 규칙은 이 결정으로 폐기됐다. 겹침 걱정은
   *   위 `region` 초기화가 해결한다 — 좌표가 있으면 지역을 아예 안 씌우므로 두 기준이 겹칠 일이 없다.
   *   섹션 '더보기'(`/?sort=popular`)는 `useHomeQuerySync` 가 그 위를 덮는다(더보기 = 인기순 유지).
   */
  const [sort, setSort] = useState<'popular' | 'newest' | 'discount' | 'near'>(
    () => (readCachedLoc() ? 'near' : 'popular'),
  )

  /**
   * 🔗 2026-08-27 (대표 신고 — "지금 인기 이용권의 더보기 클릭도 안되고"): 섹션 '더보기'는
   *   `/?sort=popular` 같은 **쿼리 전용 이동**인데, 그 반영이 PC 홈에만 있었다. 모바일은 같은
   *   링크를 받고도 쿼리를 안 읽어서 **폰에서 누르면 정말 아무 일도 안 일어났다.**
   *   두 홈이 같은 섹션·같은 링크를 쓰므로 로직도 한 곳(`useHomeQuerySync`)에서 공유한다.
   */
  const gridHeaderRef = useRef<HTMLElement | null>(null)
  useHomeQuerySync({ setCategory, setSort, gridHeaderRef })

  const handleLocate = (loc: { lat: number; lng: number }) => { setUserLoc(loc); setRegion({}); setSort('near') }
  const handleRegion = (r: HomeRegion) => { setRegion(r); setUserLoc(null); setSort((s) => (s === 'near' ? 'popular' : s)) }

  return (
    <div className="bg-white dark:bg-[#11141C] min-h-[100dvh]">
      {/* 🩸 2026-10-13 — 이 화면엔 제목 요소가 하나도 없었다(아래 2026-08-31 메모대로 **보이는**
          머리글을 일부러 뺀 결과인데, 요소까지 같이 사라졌다). 보이는 디자인은 그대로 두고
          `sr-only` 로 되살린다 — 박스 0이라 레이아웃 무영향이고, 워커 첫 화면과 **같은 값**이라
          마운트 때 제목이 바뀌지 않는다. */}
      <h1 className="sr-only">{HOME_H1}</h1>
      {/* 🔁 2026-10-14 — 제목·설명을 **표에서 읽는다.** 손으로 적어 둔 값이 표와 갈려 있어서
          **같은 URL 이 크롤러에 따라 다른 제목**을 냈다: JS 를 렌더하는 Googlebot 은 helmet 이
          덮은 이 값을, Yeti 는 서버가 주입한 표의 값을 봤다(실측 두 값이 달랐다).
          `jsonLd` 는 홈 전용이라 그대로 넘긴다. */}
      <SEO
        title={CONSUMER_SURFACE_SEO['/'].title}
        description={CONSUMER_SURFACE_SEO['/'].description}
        url="/"
        jsonLd={[organizationJsonLd, webSiteJsonLd]}
      />

      {/* 상단 — 2026-08-31 (대표 "더 대기업 수준의 완성도"): 크롬 4층 → 2층.
          ■ 무엇이 문제였나 (첫 400px 을 세어 보고 알았다)
            컨트롤이 9개였고 **그중 다섯이 전부 같은 형태**였다 — 테두리 두른 둥근 알약
            (지역·현위치·목록/지도·정렬) + 아이콘+라벨 세로 조합(카테고리 5개).
            형태가 하나뿐이면 화면은 "무엇이 중요한지"를 말하지 못한다. 그게 AI 티의 정체다.
          ■ 무엇을 없앴나 — 장식이 아니라 **줄**을 없앴다
            · h2 "가까운 동네 딜" + 부제 "이용권 · 공동구매 · 교환권을 할인가로" → 삭제.
              위치(동네 이름)가 곧 이 화면의 제목이다(당근·배민이 그렇다). 설명 부제는
              정보가 0인데 한 줄을 먹는다.
            · 지역 알약의 테두리·핀 아이콘, 현위치 알약 → 제목 + 옆의 작은 아이콘으로 흡수.
            · 카테고리 아이콘 5개 → 텍스트만. 선 아이콘 + 11px 라벨 조합이 가장 "만들어진" 티가 난다.
              활성은 잉크 + 밑줄로 — 색이 아니라 무게로 말한다(로즈는 하단 탭 하나에만 남긴다). */}
      {/* 🏠 2026-10-26 (대표 확정 "안 A" — 그루폰식 메인. 참고·시안: `docs/design/main-home-redesign-2026-10.md`).
          대표: *"메인페이지 UI구조가 너무 심심해 재미없어"*. 첫 화면이 [글자 줄 → 2열 카드] 한 박자였다.
          머리(붙어 있는 부분)는 [로고·알림·장바구니] + **큰 검색창** 두 줄로 줄이고, 위치와 카테고리 원은
          머리 **밖**으로 뺐다 — 다 붙여 두면 폰 화면 4분의 1이 머리가 된다(그루폰도 검색창만 붙인다).
          ⚠️ 클래스는 `shared/home-chrome` 상수다 — 워커 첫 화면이 같은 상수로 그린다(두 벌 금지). */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="px-4 h-11 flex items-center justify-between gap-2">
          <Link to="/" aria-label="홈" className="shrink-0 flex items-center"><UrDealLogo size={17} /></Link>
          {/* ⚫ 2026-10-14 (대표 *"메인의 검색, 장바구니, 알림 버튼도 마찬가지로 똑같이"* — 하단 탭과 같은 규칙):
              잉크색 선, **누르는 동안·열려 있는 동안만 면으로 채운다**(알림은 시트가 열려 있으면 채움).
              검색은 2026-10-26 부터 아래 큰 검색창이 맡는다. */}
          <div className="flex items-center gap-1 text-gray-900 dark:text-white">
            <button onClick={bell.open} aria-label="알림" className="p-2 shrink-0" {...pressProps('bell')}>
              <BellIcon className="h-[21px] w-[21px]" filled={pressed === 'bell' || bell.isOpen} />
            </button>
            <button onClick={() => navigate('/cart')} aria-label="장바구니" className="p-2 shrink-0" {...pressProps('cart')}>
              <BagIcon className="h-[21px] w-[21px]" filled={pressed === 'cart'} />
            </button>
          </div>
        </div>
        <div className={HOME_SEARCH.row}>
          <Link to="/search" aria-label="검색" className={HOME_SEARCH.pill}>
            <span className={HOME_SEARCH.text}>{HOME_SEARCH.placeholder}</span>
            <span className={HOME_SEARCH.button} aria-hidden="true"><Search className="h-[18px] w-[18px]" strokeWidth={2} /></span>
          </Link>
        </div>
      </div>

      {/* 위치 = 제목. 🗺️ 지도로 가는 길은 화면 아래 떠 있는 **지도 알약**(맨 아래 `MapPill`) 하나다. */}
      <div className="px-4 pt-4 pb-3">
        <div className="min-w-0">
          <PcHomeLocationBar tone="title" value={region} onChange={handleRegion} onLocate={handleLocate} located={!!userLoc} locatedLabel={dong?.dong} />
        </div>
      </div>

      {/* 카테고리 원 — 라벨 SSOT 는 PC 헤더와 같은 `DEAL_CATS`(둘이 갈리지 않게). 그림은 채색 아이콘
          (카테고리·서비스 타일 컨셉 — `category-icons`). 선택은 **브랜드 테두리**(선택 = 블루 규칙).
          🎬 유어쇼츠 진입점(2026-09-09 대표 확정 — 스크롤하지 않아도 보이는 자리)은 이 줄 **오른쪽 끝 고정 원**이다.
          스크롤 영역(`nav`) **밖**에 둔다 — 안에 넣으면 원이 일곱이라 첫 화면 밖으로 밀린다.
          카테고리가 아니라 다른 화면으로 가는 문이라 `<Link>` 다. 마침표는 로고 `urdeal.` 과 같은 장치. */}
      <div className={HOME_CATS.row}>
      <nav aria-label="카테고리" className={HOME_CATS.nav}>
        {DEAL_CATS.map(({ key, label }) => {
          const on = category === key
          const Icon = HOME_CAT_ICON[key]
          return (
            <button key={key} type="button" onClick={() => setCategory(key)} aria-pressed={on} className={HOME_CATS.item}>
              <span className={`${HOME_CATS.circle}${on ? ` ${HOME_CATS.circleOn}` : ''}`}><Icon size={30} /></span>
              <span className={`${HOME_CATS.label} ${on ? HOME_CATS.labelOn : HOME_CATS.labelOff}`}>{label}</span>
            </button>
          )
        })}
      </nav>
        <Link to={URSHORTS_BROWSE_PATH} className={HOME_CATS.item}>
          <span className={HOME_CATS.circle}><PlayTileIcon size={30} /></span>
          <span className={`${HOME_CATS.label} ${HOME_CATS.labelOff}`}>{HOME_CATS.shortsLabel}<span className="-ml-[3px] text-brand-text">.</span></span>
        </Link>
      </div>

      {/* 어드민 편성(섹션·배너) — 카테고리를 고르면 숨긴다(PC 홈과 같은 규칙: 화면 맨 위가 그 카테고리여야 한다). */}
      {HOME_SHOWCASE_ENABLED && category === 'all' && (
        <div className="mt-3">
          {/* 🎫 2026-09-05 (대표 "인기 이용권 섹션 위에 배너가 작게 있어야 할 것 같음" — 시안 안 2).
              첫 섹션 **위** 가로 카드 1장. 등록된 배너가 없으면 통째로 null 이라 지금 화면과 같다. */}
          <HomeBannerStrip variant="strip" />
          <HomeSections
            midBanner={<HomeBannerStrip variant="inline" />}
            shortsRail={<UrShortsRail />}
            near={near}
          />
          <HomeBannerStrip variant="wide" />
        </div>
      )}

      <section className="mt-4">
        {/* 🗺️ 지도로 가는 길은 화면 아래 **지도 알약**(`MapPill`)이 갖는다.
            2026-08-30 배너 → 08-31 위치 옆 [목록|지도] 전환 → 10-14 (대표 확정 다안·A) 떠 있는 알약.
            ⚠️ 하단 탭에 지도가 없으므로 그 알약이 **유일한 통로**다 — 지우지 말 것.
            여기 있던 h2("가까운 동네 딜")와 부제는 삭제했다. 위치가 제목을 겸하므로
            같은 말을 두 번 하게 되고, 부제는 정보가 없는데 한 줄을 먹었다. */}
        <div ref={gridHeaderRef as React.RefObject<HTMLDivElement>} className="scroll-mt-24" />
        {/* 실측: 이 피드는 히어로·편성섹션 아래라 첫 행이 접힘 밖(모바일 1,605px / PC 1,385px) */}
        <GroupBuyFeed
          firstScreen={false}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          regionKey={region.regionKey}
          districtKey={region.districtKey}
          userLoc={userLoc}
          sectionNearKey={near.key}
        />
      </section>

      {/* 🏪 판매 진입점 — **피드를 다 본 뒤**가 자리다(대표 확정 2026-09-14, 안 1).
            8/26 에 지도 모달에서 뺀 것과 같은 물건이 되지 않으려면 위로 올리면 안 된다.
            사유·노출 규칙은 `./SellOnUrdealRow` 머리주석. */}
      <SellOnUrdealRow />
      <MapPill />
      {bell.sheet}
    </div>
  )
}
