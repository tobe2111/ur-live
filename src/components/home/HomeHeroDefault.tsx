import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

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
 * ## 검색바를 둔 이유
 * 시안의 히어로에는 검색이 있었다. 장식만 있는 히어로는 자리만 먹는다 — 실제로 쓰이는
 * 진입점(`/search?q=`)을 얹어 첫 화면이 **일을 하게** 만든다.
 */
export default function HomeHeroDefault() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search')
  }

  return (
    <section className="relative isolate overflow-hidden bg-[#1A2C42] h-[280px] lg:h-[380px]">
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
      {/* 좌측을 눌러 흰 글자가 어떤 순간에도 읽히게 — 블룸이 흐르며 밝아지는 구간이 있다. */}
      <div
        className="absolute inset-0 -z-10"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg, rgba(26,44,66,0.88) 0%, rgba(26,44,66,0.46) 46%, rgba(26,44,66,0.10) 100%)' }}
      />

      {/* 🌗 2026-08-19: 히어로 → 아래 색면으로 이어지는 페이드. 경계선이 딱 떨어지면 '잘린 배너'로 보인다. */}
      <div className="absolute inset-x-0 bottom-0 h-16 -z-10" aria-hidden="true"
        style={{ background: 'linear-gradient(180deg, transparent, #1A2C42)' }} />

      <div className="relative h-full max-w-[1440px] mx-auto px-6 lg:px-8 flex flex-col justify-center">
        <p className="text-[12.5px] font-bold tracking-[0.14em] text-white/60">URDEAL</p>
        <h2 className="mt-2 text-[30px] lg:text-[46px] font-black tracking-tight text-white leading-[1.14] [text-wrap:balance]">
          우리 동네 이용권, <span className="text-brand">할인가로 바로</span>
        </h2>
        <p className="mt-2.5 text-[14px] lg:text-[16.5px] text-white/75">
          식사 · 미용 · 숙소 · 교환권을 온라인에서 사고 매장에서 바로 쓰세요.
        </p>

        <form onSubmit={submit} className="mt-5 w-full max-w-[520px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="지역 · 매장 · 메뉴로 찾기"
              aria-label="딜 검색"
              className="w-full pl-11 pr-24 py-3 rounded-xl bg-white/95 backdrop-blur text-[14px] text-gray-900 placeholder:text-gray-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-[13px] font-bold transition-colors"
            >
              검색
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
