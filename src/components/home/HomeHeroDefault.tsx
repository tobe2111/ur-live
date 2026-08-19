import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { cfImage } from '@/utils/cf-image'

/**
 * 🏠 히어로 **기본 배경** (2026-08-04 대표 *"히어로도 브랜드 배경으로 적합한 거 영상으로"*).
 *
 * 어드민이 히어로 배너를 올리지 않았을 때 홈 최상단에 깔리는 화면.
 * 배너를 올리면 그 이미지/영상이 **이걸 대체한다** — 여기는 '아무것도 없을 때'의 기본값이다.
 *
 * ## 왜 영상 파일이 아닌가
 * ① 저작권이 확인된 소스가 없다 ② 외부 영상 호스트는 CSP 가 막는다
 * ③ **홈 최상단에 수 MB 를 얹으면 첫 화면이 느려진다** — 이 레포가 로딩에 들인 노력을
 *    한 번에 되돌리는 짓이다(잠금표가 지키는 바로 그 경로).
 * ⇒ 브랜드 로즈 블룸이 서로 다른 주기로 흐르고 빛줄기가 가로지르는 **코드 배경**으로
 *   같은 인상을 만든다. 용량 0 · 네트워크 요청 0 · `prefers-reduced-motion` 존중(index.css).
 *
 * ## 📸 2026-08-19 (대표 — "그루폰처럼 사진 + 양쪽 그라데이션")
 * 우측에 사진 한 장을 넣되 **파일을 새로 들이지 않는다**. 지금 홈에 실려 있는 SSR 시드
 * (`__SSR_INITIAL_MAIN__`, 0-RTT)에서 **우리가 실제로 파는 딜**의 사진을 하나 고른다:
 *  - 출처가 안전하다(우리 상품 = 권리 확보분). 2026-08-04 워터마크 보도사진 사고의 재발 경로가 없다.
 *  - 네트워크 왕복 0(시드는 이미 문서 안에 있다). 카드가 어차피 받을 이미지라 사실상 공짜다.
 *  - 데모 상품(`demo-deal-*`)은 고르지 않는다 — 첫 화면 얼굴이 데모면 안 된다.
 *  - 없으면 **사진 없이** 지금 모습 그대로(빈 칸을 만들지 않는다).
 * 사진 좌·우는 색면(#1A2C42)으로 페이드시켜 '잘라 붙인 배너'가 아니라 색면에 녹아들게 한다.
 *
 * ## 검색바를 둔 이유
 * 시안의 히어로에는 검색이 있었다. 장식만 있는 히어로는 자리만 먹는다 — 실제로 쓰이는
 * 진입점(`/search?q=`)을 얹어 첫 화면이 **일을 하게** 만든다.
 */

/** 홈 SSR 시드에서 히어로에 쓸 사진 1장. 없으면 null(= 사진 없는 현행 모습). */
function pickHeroPhoto(): { src: string; href: string } | null {
  if (typeof document === 'undefined') return null
  try {
    const el = document.getElementById('__SSR_INITIAL_MAIN__')
    if (!el?.textContent) return null
    const parsed = JSON.parse(el.textContent) as { success?: boolean; data?: unknown }
    if (!parsed?.success || !Array.isArray(parsed.data)) return null
    for (const raw of parsed.data as Array<Record<string, unknown>>) {
      const img = typeof raw?.image_url === 'string' ? raw.image_url : ''
      const slug = typeof raw?.slug === 'string' ? raw.slug : ''
      const id = raw?.id
      if (!img || slug.startsWith('demo-deal-')) continue
      return { src: img, href: id != null ? `/group-buy/${id}` : '/' }
    }
  } catch { /* 손상된 inject — 사진 없이 간다 */ }
  return null
}

export default function HomeHeroDefault() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  // 시드는 하드로드 시점에 이미 문서에 있으므로 **동기 1회**로 읽는다(리렌더/왕복 0).
  const [photo] = useState(pickHeroPhoto)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search')
  }

  return (
    /* 📐 2026-08-19 (대표 — "그루폰 정도만큼 높이 줄이나?"): 380 → 300px(lg) / 280 → 240px.
       그루폰 홈의 초록 히어로 띠와 같은 높이대다. 딜이 첫 화면에 더 들어온다. */
    <section className="relative isolate overflow-hidden bg-[#1A2C42] h-[240px] lg:h-[300px]">
      {/* 배경 — 잉크 위에 로즈 블룸 2개 + 빛줄기. 전부 CSS. */}
      <div
        className="absolute -z-10 -inset-[18%] ur-hero-bloom-a"
        aria-hidden="true"
        style={{ background: 'radial-gradient(closest-side, rgba(224,82,107,0.55), transparent 72%)' }}
      />
      <div
        className="absolute -z-10 -inset-[10%] ur-hero-bloom-b"
        aria-hidden="true"
        style={{ background: 'radial-gradient(closest-side, rgba(120,90,220,0.34), transparent 70%)' }}
      />
      <div
        className="absolute -z-10 inset-y-0 w-1/3 ur-hero-sweep"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent)' }}
      />

      {/* 📸 우측 사진 — 화면 오른쪽 절반에 깔고 **좌·우 양끝을 색면으로 페이드**한다(대표 요청).
          `mask-image` 로 픽셀을 투명하게 깎아 색면이 그대로 비치게 한다 — 위에 반투명 막을
          덧대는 방식은 사진이 뿌옇게 죽는다. 세로 끝도 살짝 눌러 위아래 경계선을 없앤다.
          lg 미만은 사진을 그리지 않는다(폭이 좁아 글자와 겹친다). */}
      {photo && (
        <div className="hidden lg:block absolute inset-y-0 right-0 w-[54%] -z-10" aria-hidden="true">
          <img
            src={cfImage(photo.src, { width: 900, quality: 72 }) || photo.src}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            style={{
              WebkitMaskImage:
                'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%), linear-gradient(180deg, transparent 0%, #000 12%, #000 84%, transparent 100%)',
              maskImage:
                'linear-gradient(90deg, transparent 0%, #000 26%, #000 82%, transparent 100%), linear-gradient(180deg, transparent 0%, #000 12%, #000 84%, transparent 100%)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
          />
        </div>
      )}

      {/* 좌측을 눌러 흰 글자가 어떤 순간에도 읽히게 — 블룸이 흐르며 밝아지는 구간이 있다.
          사진이 들어오면 글자 뒤가 더 밝아지므로 좌측을 조금 더 눌러 준다. */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background: photo
            ? 'linear-gradient(90deg, rgba(26,44,66,0.96) 0%, rgba(26,44,66,0.88) 38%, rgba(26,44,66,0.30) 62%, rgba(26,44,66,0.05) 100%)'
            : 'linear-gradient(90deg, rgba(26,44,66,0.88) 0%, rgba(26,44,66,0.46) 46%, rgba(26,44,66,0.10) 100%)',
        }}
      />

      {/* 🌗 히어로 → 아래 색면으로 이어지는 페이드. 경계선이 딱 떨어지면 '잘린 배너'로 보인다. */}
      <div className="absolute inset-x-0 bottom-0 h-14 -z-10" aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, transparent, #1A2C42)' }} />

      <div className="relative h-full max-w-[1440px] mx-auto px-6 lg:px-8 flex flex-col justify-center">
        <p className="text-[12px] font-bold tracking-[0.14em] text-white/60">URDEAL</p>
        <h2 className="mt-1.5 text-[26px] lg:text-[40px] font-black tracking-tight text-white leading-[1.14] [text-wrap:balance]">
          우리 동네 이용권, <span className="text-brand">할인가로 바로</span>
        </h2>
        <p className="mt-2 text-[13px] lg:text-[15px] text-white/75">
          식사 · 미용 · 숙소 · 교환권을 온라인에서 사고 매장에서 바로 쓰세요.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <form onSubmit={submit} className="w-full max-w-[460px]">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="지역 · 매장 · 메뉴로 찾기"
                aria-label="딜 검색"
                className="w-full pl-11 pr-24 py-2.5 rounded-xl bg-white/95 backdrop-blur text-[14px] text-gray-900 placeholder:text-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-[13px] font-bold transition-colors"
              >
                검색
              </button>
            </div>
          </form>

          {/* ▶ 아웃라인 CTA (그루폰 `BOOK THE HOUR →` 자리). 사진이 있으면 그 딜로, 없으면 지도로. */}
          <Link
            to={photo?.href || '/map'}
            className="hidden lg:inline-flex items-center gap-1.5 shrink-0 px-5 py-2.5 rounded-full border border-white/45 text-white text-[13px] font-bold tracking-wide hover:bg-white hover:text-[#1A2C42] transition-colors"
          >
            내 주변 딜 보기
            <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  )
}
