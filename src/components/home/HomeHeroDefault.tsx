import { Link } from 'react-router-dom'
import { ArrowRight, Map } from 'lucide-react'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'
import PcHomeLocationBar, { type HomeRegion } from '@/pages/pc-home/PcHomeLocationBar'

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
const DEFAULT_DESC = '예약도 대기도 없이. 식사 · 미용 · 숙소 · 교환권.'

/**
 * 🖼️ 우리가 직접 올린 사진인가 — R2(`/api/media/…` · `media.ur-team.com`).
 *
 * 왜 호스트로 가르나: 2026-08-04 에 **데모 사진에 타사 워터마크 보도사진(YONHAP)이 섞여** 홈
 * 최상단에 오를 뻔했다. 그때의 처방은 "데모를 전부 금지"였는데, 그 규칙은 **라이브 카탈로그가
 * 100% 데모가 되자 히어로를 영구히 빈 색면으로** 만들었다(2026-08-27 실측: 시드 50/50 데모,
 * 어드민 배너 0건 → 사진 소스가 아예 없음).
 *
 * ⇒ 금지의 축을 "데모냐"에서 **"사진의 출처가 우리냐"** 로 옮긴다. 사고의 원인은 데모라는 사실이
 *   아니라 **남의 사진**이었다. 우리 버킷에 우리가 올린 것은 그 위험이 구조적으로 없다.
 */
function isOwnMedia(url: string): boolean {
  return url.startsWith('/api/media/') || /^https?:\/\/media\.ur-team\.com\//.test(url)
}

/**
 * 홈 SSR 시드에서 히어로에 쓸 사진 1장. 없으면 null(= 사진 없는 색면).
 *
 * 우선순위: ① 실상품(비데모) → ② 실상품이 하나도 없으면 **우리 호스트 데모**.
 * ⚠️ 외부 호스트 사진을 가진 데모는 어느 단계에서도 안 쓴다(위 `isOwnMedia` 주석의 사고).
 */
export function pickHeroPhoto(): { src: string; href: string } | null {
  if (typeof document === 'undefined') return null
  try {
    const el = document.getElementById('__SSR_INITIAL_MAIN__')
    if (!el?.textContent) return null
    const parsed = JSON.parse(el.textContent) as { success?: boolean; data?: unknown }
    if (!parsed?.success || !Array.isArray(parsed.data)) return null
    let ownDemo: { src: string; href: string } | null = null
    for (const raw of parsed.data as Array<Record<string, unknown>>) {
      const img = typeof raw?.image_url === 'string' ? raw.image_url : ''
      const slug = typeof raw?.slug === 'string' ? raw.slug : ''
      const id = raw?.id
      if (!img) continue
      const hit = { src: img, href: id != null ? `/group-buy/${id}` : '/' }
      if (slug.startsWith('demo-deal-')) {
        // 데모는 **마지막 수단**이고, 그중에서도 우리가 올린 사진만. 실상품을 계속 찾는다.
        if (!ownDemo && isOwnMedia(img)) ownDemo = hit
        continue
      }
      return hit
    }
    return ownDemo
  } catch { /* 손상된 inject — 사진 없이 간다 */ }
  return null
}

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
}

export default function HomeHeroDefault({
  content,
  controls,
}: {
  content?: HeroContent
  controls?: HeroControls
}) {
  // 시드는 하드로드 시점에 이미 문서에 있으므로 **동기 1회**로 읽는다(리렌더/왕복 0).
  const seed = content?.photo ? null : pickHeroPhoto()
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
      {/* 배경 — 잉크 위에 로즈 블룸 2개 + 빛줄기. 전부 CSS(용량 0 · 요청 0). */}
      <div
        className="absolute -inset-[18%] ur-hero-bloom-a"
        aria-hidden="true"
        style={{ background: 'radial-gradient(closest-side, rgba(224,82,107,0.55), transparent 72%)' }}
      />
      <div
        className="absolute -inset-[10%] ur-hero-bloom-b"
        aria-hidden="true"
        style={{ background: 'radial-gradient(closest-side, rgba(120,90,220,0.34), transparent 70%)' }}
      />
      <div
        className="absolute inset-y-0 w-1/3 ur-hero-sweep"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)' }}
      />

      {/* 📸 우측 미디어 — 좌·우 양끝을 색면으로 페이드한다(대표 요청 "양쪽 그라데이션").
          `mask-image` 로 픽셀을 투명하게 깎아 색면이 그대로 비치게 한다 — 위에 반투명 막을
          덧대는 방식은 사진이 뿌옇게 죽는다. 세로 끝도 눌러 위아래 경계선을 없앤다. */}
      {hasMedia && (
        <div className="hidden md:block absolute inset-y-0 right-0 w-[46%] lg:w-[54%]" aria-hidden="true"
          /* 📐 2026-08-24: `lg:block`(1024+) 이라 **태블릿엔 사진이 아예 없었다** — 색면만 남아
             허전했다. md(768)부터 보이되 폭은 46% 로 좁혀 카피가 눌리지 않게 한다. */
          style={{
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%), linear-gradient(180deg, transparent 0%, #000 12%, #000 84%, transparent 100%)',
            maskImage:
              'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%), linear-gradient(180deg, transparent 0%, #000 12%, #000 84%, transparent 100%)',
            WebkitMaskComposite: 'source-in',
            maskComposite: 'intersect',
          }}
        >
          {content?.videoUrl ? (
            <video className="w-full h-full object-cover" src={content.videoUrl} autoPlay muted loop playsInline />
          ) : (
            <img
              src={cfImage(photoSrc, { width: 1280, quality: 76 }) || photoSrc}
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

      {/* 🌗 히어로 → 아래 색면으로 이어지는 페이드. 경계선이 딱 떨어지면 '잘린 배너'로 보인다. */}
      <div className="absolute inset-x-0 bottom-0 h-12" aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, transparent, var(--home-field))' }} />

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
            />
          )}
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 shrink-0 px-5 py-2 rounded-full border border-white/45 text-white text-[13px] font-bold tracking-wide hover:bg-white hover:text-[var(--home-field)] transition-colors"
          >
            <Map className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
            지도에서 가까운 딜 보기
            <ArrowRight className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
          </Link>
          {/* 사진이 실제 딜이면 그 딜로 가는 통로를 남긴다(사진만 있고 갈 곳이 없으면 장식이 된다). */}
          {hasMedia && photoHref !== '/map' && (
            <Link to={photoHref} className="text-[12.5px] font-bold text-white/60 hover:text-white transition-colors">
              사진 속 딜 보기 →
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
