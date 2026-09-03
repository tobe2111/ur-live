import { Link } from 'react-router-dom'
import { cfImage, cfSrcSet, cfImageOnError } from '@/utils/cf-image'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import { HOME_HERO_REQUEST_WIDTH, HOME_HERO_QUALITY } from '@/shared/home-hero-image'
import PcHomeLocationBar, { type HomeRegion } from '@/pages/pc-home/PcHomeLocationBar'
import { useHeroPhoto } from './useHeroPhoto'

/**
 * 🏠 히어로 (2026-08-19 대표 확정 — **통합형 190px**, 시안 4개 중 ②안).
 *
 * ## 무엇이 바뀌었나
 * 이전엔 [히어로 300px] 아래에 [위치바 흰 패널 145px]이 따로 있었다. 헤더까지 더하면
 * **딜이 나오기까지 559px** — 첫 화면의 절반 이상이 딜이 아니었다(라이브 실측).
 * ⇒ 위치·지도 버튼을 **히어로 안 칩으로 흡수**하고, 자리만 먹던 검색창을 뺐다(상단 헤더에
 *   이미 대형 검색이 있다 — 같은 기능이 한 화면에 두 벌이면 반드시 갈린다).
 *   결과: 헤더 114 + 히어로 190 = **304px**(−255px).
 *
 * ## 왜 검색창을 지웠나
 * 2026-08-19 이전 판 주석은 *"장식만 있는 히어로는 자리만 먹는다"* 며 검색을 넣었다.
 * 그 뒤 헤더 2행 개편에서 **헤더 검색바가 46px 대형으로 커졌다** — 그래서 히어로 검색은
 * 중복이 됐다. 대표 지시: *"그 부분엔 검색창이 없어야 할 것 같어."*
 *
 * ## 📸 사진 — 어드민이 지정한다 (대표 확정)
 * `banner_type='hero'` 배너를 올리면 그 사진·카피가 여기에 들어온다(`HomeHeroBanner` 가 넘긴다).
 * **안 올리면** 홈 SSR 시드(`__SSR_INITIAL_MAIN__`, 0-RTT)에서 우리가 실제로 파는 딜 사진을
 * 하나 골라 쓴다 — 네트워크 왕복 0, 출처 안전(우리 상품), 데모(`demo-deal-*`)는 제외.
 * 사진 좌·우는 색면(`--home-field`)으로 페이드시켜 '잘라 붙인 배너'가 아니라 색면에 녹아들게 한다.
 * ⚠️ 색면 hex 를 여기 적지 말 것 — 페이지 색면(`PcHomePage`)과 **같은 값이어야** 이음매가 안 생긴다.
 */

/** 기본 카피 — 대표 확정 D안(가치형: 사서 바로 쓴다). 어드민 배너에 제목이 있으면 그게 이긴다. */
const DEFAULT_TITLE_HEAD = '사서 '
const DEFAULT_TITLE_ACCENT = '바로 쓰는'
const DEFAULT_TITLE_TAIL = ' 동네 이용권'
const DEFAULT_DESC = '예약도 대기도 없이. 식사, 미용, 숙소, 교환권.'

/**
 * 홈 SSR 시드에서 히어로에 쓸 사진 1장. 없으면 null(= 사진 없는 색면).
 *
 * ⚠️ **고르는 규칙 자체는 여기 없다** — `shared/home-hero-photo` 가 SSOT 다.
 *   워커가 이 사진을 `<link rel="preload">` 로 미리 받게 하려면(2026-08-29) 워커와 클라이언트가
 *   **똑같은 사진**을 골라야 한다. 규칙이 두 벌이면 반드시 갈리고, 갈리면 preload 가 버려져
 *   같은 사진을 두 번 받는다(에러 없이 더 느려진다). 이 함수는 DOM 에서 시드를 꺼내 넘기기만 한다.
 */

export interface HeroContent {
  /** 어드민이 올린 히어로 사진(없으면 시드에서 고른다). */
  photo?: string
  /** 사진을 눌렀을 때 갈 곳(어드민 배너의 link_url). */
  photoHref?: string
  title?: string
  description?: string
  /** 어드민이 올린 영상 배경(있으면 사진 대신). */
  videoUrl?: string
}

export interface HeroControls {
  region: HomeRegion
  onRegionChange: (r: HomeRegion) => void
  onLocate: (loc: { lat: number; lng: number }) => void
  located: boolean
  /** 🧭 2026-08-30: GPS 로 잡은 동네 이름(없으면 위치바가 '내 주변' 으로 폴백). */
  locatedLabel?: string
}

export default function HomeHeroDefault({
  content,
  controls,
}: {
  content?: HeroContent
  controls?: HeroControls
}) {
  /**
   * 🖼️ 사진 소스. 하드로드면 문서 시드(동기·왕복 0), 앱 안에서 들어왔으면 홈 피드 캐시.
   *   ⚠️ 2026-09-03 이전에는 **시드만** 봤다 — 그래서 홈 탭을 눌러 들어오면 시드가 없어
   *      색면만 남았고, 새로고침해야 사진이 나왔다(대표 신고 "심각해").
   */
  const seed = useHeroPhoto(!content?.photo)
  const photoSrc = content?.photo || seed?.src || ''
  const photoHref = content?.photoHref || seed?.href || '/map'
  const hasMedia = !!photoSrc || !!content?.videoUrl

  return (
    /* 📐 통합형 190px — 고정 높이가 아니라 최소 높이다. 카피가 길어지면 잘리는 대신 늘어난다
       (시안 작업 중 고정 높이로 카피가 잘리는 걸 실제로 겪었다). */
    <section className="relative bg-[var(--home-field)] min-h-[190px] flex">
      {/* 🪟 2026-08-19 (대표 신고 — "전국 버튼 클릭 시, 지역선택 탭이 가려져서 안보여"):
          배경 레이어를 **이 래퍼 안으로** 넣고 `overflow-hidden` 을 여기에만 준다.
          ⚠️ 이전엔 `<section>` 자체가 `overflow-hidden isolate` 였다. 사진 마스크·블룸이 히어로 밖으로
             번지지 않게 하려던 것인데, 같은 속성이 **콘텐츠까지** 잘랐다 — 위치 드롭다운은 히어로
             아래로 펼쳐지는 요소라 상단 몇 px 만 보이고 잘려 나갔다(`isolate` 는 z-index 를 이 안에
             가둬서, z-10500 을 줘도 밖으로 못 나온다). 배경만 가두면 둘 다 성립한다. */}
      <div className="absolute inset-0 overflow-hidden isolate pointer-events-none" aria-hidden="true">
      {/* 🎫 2026-09-02 (대표 "메인페이지에 저 그라데이션 로즈?핑크색? 안맞는 것 같은데"): 로즈 블룸 2개 + 빛줄기 삭제.
          표면 체계 규칙 ⑥ "그라디언트 0" 이고, 강조색은 블루 하나뿐이다. 바탕은 색면(--home-field) 그대로. */}
      {/* 📸 우측 미디어 — 좌·우 양끝을 색면으로 페이드한다(대표 요청 "양쪽 그라데이션").
          `mask-image` 로 픽셀을 투명하게 깎아 색면이 그대로 비치게 한다 — 위에 반투명 막을
          덧대는 방식은 사진이 뿌옇게 죽는다.
          🎫 2026-09-02 (대표 "위아래부분까지 그라데이션은 안해도 될 것 같은데"): 세로(180deg) 마스크와
          하단 h-12 페이드를 뺐다. 사진은 히어로 위아래 끝까지 꽉 차고, 페이드는 **좌우만**. */}
      {hasMedia && (
        <div
          className="hidden md:block absolute inset-y-0 w-[46%] lg:w-[54%] right-[calc(max(0px,(100vw-1440px)/2)+1.5rem)] lg:right-[calc(max(0px,(100vw-1440px)/2)+2rem)]"
          aria-hidden="true"
          /* 📐 2026-08-24: `lg:block`(1024+) 이라 **태블릿엔 사진이 아예 없었다** — 색면만 남아
             허전했다. md(768)부터 보이되 폭은 46% 로 좁혀 카피가 눌리지 않게 한다.
             🖼️ 2026-09-03 (대표 — 빨간 상자 시안 "아래의 길이와 맞게끔"): `right-0` 이라 사진이
             **뷰포트 오른쪽 끝**까지 갔는데, 바로 아래 매대는 `max-w-[1440px] + px-6/8` 안에 있어
             넓은 화면일수록 두 오른쪽 끝이 어긋났다(1904px 에서 264px 차이). 색면은 전체 폭 그대로
             두고(그게 이 히어로의 바탕이다) **사진만** 아래 매대와 같은 자로 당긴다. 폭(46/54%)은
             건드리지 않아 좁은 화면의 균형은 그대로다 — 오른쪽 여백만 생긴다. */
          style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%)',
            maskImage: 'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%)',
          }}
        >
          {content?.videoUrl ? (
            <video className="w-full h-full object-cover" src={content.videoUrl} autoPlay muted loop playsInline />
          ) : (
            <img
              src={cfImage(photoSrc, { width: HOME_HERO_REQUEST_WIDTH, quality: HOME_HERO_QUALITY }) || photoSrc}
              /* 🔍 2026-08-22 (대표 — "이미지 화질이 깨지는 문제"): `width: 900` **한 장**이었다.
                 이 사진은 PC 에서 **1,037px 폭**으로 그려지므로 레티나(DPR 2)면 2,074px 이 필요하다
                 → 실효 0.43배로 눈에 띄게 흐렸다. ⚠️ 리사이저는 정상이다(요청한 폭을 그대로 준다) —
                 **우리가 작게 요청한 것**이 원인이라 quality 만 올려선 안 고쳐진다.
                 base 1024 → 1x 1024 / 2x 2048 / 3x 3072 중 브라우저가 DPR 에 맞는 한 장만 받는다. */
              srcSet={cfSrcSet(photoSrc, BANNER_SLOT_SPECS.hero.srcSetBase!)}
              alt=""
              /* 🐢 2026-08-19 (대표 — "히어로에 있는 사진 이미지도 마찬가지고"): `lazy` 였다.
                 히어로는 **첫 화면 최상단**이라 lazy 는 틀린 선택이다 — 브라우저가 다른 자원을
                 다 받은 뒤에야 시작해서 늦게 나타났다. 이 사진은 사실상 LCP 요소다. */
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full h-full object-cover"
              onError={(e) => cfImageOnError(e.currentTarget, photoSrc)}
            />
          )}
        </div>
      )}

      {/* 좌측을 눌러 흰 글자가 어떤 순간에도 읽히게 — 블룸이 흐르며 밝아지는 구간이 있다. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: hasMedia
            ? 'linear-gradient(90deg, rgb(var(--home-field-rgb) / 0.96) 0%, rgb(var(--home-field-rgb) / 0.88) 38%, rgb(var(--home-field-rgb) / 0.30) 62%, rgb(var(--home-field-rgb) / 0.05) 100%)'
            : 'linear-gradient(90deg, rgb(var(--home-field-rgb) / 0.88) 0%, rgb(var(--home-field-rgb) / 0.46) 46%, rgb(var(--home-field-rgb) / 0.10) 100%)',
        }}
      />

      </div>{/* ← 배경 래퍼 끝. 아래 콘텐츠는 잘리지 않는다(드롭다운이 히어로 밖으로 펼쳐진다). */}

      <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-6 flex flex-col justify-center">
        <h2 className="text-[26px] md:text-[29px] lg:text-[32px] font-black tracking-tight text-white leading-[1.16] [text-wrap:balance]">
          {content?.title || (
            <>{DEFAULT_TITLE_HEAD}<span className="text-brand">{DEFAULT_TITLE_ACCENT}</span>{DEFAULT_TITLE_TAIL}</>
          )}
        </h2>
        <p className="mt-1.5 text-[13px] lg:text-[14px] text-white/75">
          {content?.description || DEFAULT_DESC}
        </p>

        {/* 🗺️ 위치·지도 — 이전엔 히어로 **아래 흰 패널**에 있던 것을 여기로 흡수했다(대표 확정).
            잉크 배경 위라 칩은 `tone="hero"`(반투명 흰 테두리)로 그린다 — 드롭다운 패널은
            그대로 흰색이라 지역 목록의 가독성은 손해 보지 않는다. */}
        <div className="mt-3.5 flex items-center gap-2.5 flex-wrap">
          {controls && (
            <PcHomeLocationBar
              tone="hero"
              value={controls.region}
              onChange={controls.onRegionChange}
              onLocate={controls.onLocate}
              located={controls.located}
              locatedLabel={controls.locatedLabel}
            />
          )}
          {/* 🎫 2026-09-03 (대표 확정 — 히어로 컨트롤 안 1): 고스트 아웃라인 → **브랜드 블루 면 하나**.
              종전엔 위치 칩 둘과 이 버튼이 전부 같은 반투명 테두리 알약이라, 화면이 무엇을 먼저 누르라고
              말하지 않았다(대표 "AI 느낌"). 서비스 전체가 쓰는 규칙(주 버튼은 블루)을 이 히어로에도 적용한다.
              아이콘과 화살표를 뺀 이유: 왼쪽 칩에 이미 핀·조준 둘이 있어 아이콘이 셋 연달았고, 색을 채운
              버튼은 그 자체가 "여기를 눌러라"라서 화살표가 같은 말을 두 번 한다. */}
          <Link
            to="/map"
            className="inline-flex items-center shrink-0 h-[38px] px-5 rounded-full bg-brand text-white text-[13.5px] font-extrabold hover:bg-[#1557C8] transition-colors shadow-[0_6px_18px_-8px_rgba(28,105,239,0.9)]"
          >
            지도에서 딜 찾기
          </Link>
        </div>
      </div>

      {/* 🖼️ 2026-09-03 (안 1): 컨트롤 행에 있던 "사진 속 딜 보기"를 **사진 오른쪽 아래**로 옮겼다.
          왼쪽 글자 뭉치 옆에 있으면 무엇을 가리키는 말인지 알 수 없고, 주 버튼 옆에서 화살표를 하나 더
          만들었다. 사진 위에 있으면 설명이 필요 없다. 사진이 실제 딜일 때만 — 갈 곳이 없으면 장식이다. */}
      {hasMedia && photoHref !== '/map' && (
        <Link
          to={photoHref}
          /* 사진 오른쪽 끝이 매대와 정렬됐으니 이 링크도 같은 자를 쓴다 — 안 그러면 사진 밖에 뜬다. */
          className="absolute z-20 bottom-3 right-[calc(max(0px,(100vw-1440px)/2)+2.5rem)] lg:right-[calc(max(0px,(100vw-1440px)/2)+3rem)] text-[12px] font-bold text-white/70 hover:text-white transition-colors drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)]"
        >
          사진 속 딜 보기 →
        </Link>
      )}
    </section>
  )
}
