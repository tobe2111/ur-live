import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { CATEGORY_META } from '@/shared/deal-category-icon'
import {
  buildHeroStripLoop,
  heroTileUrl,
  HERO_TILE_H,
  HERO_TILE_W,
  HERO_STRIP_EAGER,
  HERO_STRIP_PRELOAD,
  HERO_STRIP_WARM_TIMEOUT_MS,
  type HeroTile,
} from '@/shared/home-hero-strip'

/**
 * 🎞️ 히어로 우측 **이용권 띠** — 대표 확정(2026-09-28, 시안 ② + *"좌우로 자연스럽게 계속 이동"*).
 *
 * 왜 사진 한 장을 버렸는지·타일 크기와 트래픽 숫자는 전부 `shared/home-hero-strip` 머리말에 있다.
 * 여기는 **그리는 일만** 한다.
 *
 * ## 움직임
 * 같은 벌을 두 번 이어 붙이고 한 벌 폭(`--ur-hero-loop`)만큼 민다 — 끝나는 순간 둘째 벌의 첫 타일이
 * 첫 벌의 첫 타일 자리에 정확히 와 있어 이음매가 안 보인다. 속도는 장수와 무관하게 일정하다
 * (거리에서 지속시간을 구한다 — 지속시간을 고정하면 딜 수에 따라 속도가 널뛴다).
 *
 * · **커서를 올리면 멈춘다**(`:hover`/`:focus-within`) — 읽으려는데 지나가 버리면 화나는 종류다.
 * · `prefers-reduced-motion` 이면 아예 안 움직인다(정지한 매대로 남는다 — 사라지지 않는다).
 * · 양끝은 `mask-image` 로 색면에 녹인다. 타일이 **칼같이 잘리면** 고장 난 것처럼 보인다.
 *
 * ## ⚠️ 둘째 벌은 스크린리더·탭 이동에서 뺀다
 * 같은 링크가 두 번 읽히면 목록이 두 배로 들린다. `aria-hidden` + `tabIndex={-1}` 한 쌍이어야 한다
 * (한쪽만 두면 "숨겨졌는데 포커스는 가는" 더 나쁜 상태가 된다).
 */

/**
 * 📐 밴드의 자 — **`HomeHeroDefault` 의 사진 밴드와 같은 오른쪽 기준**을 쓴다(아래 매대와 끝을 맞춘다).
 * 폭만 다르다: 사진은 46/54%, 띠는 38/46%. 띠는 왼쪽 끝이 카피(h2)와 부딪히면 안 되는데,
 * 시안 1차에서 실제로 부딪혔다(밴드 좌측 611 vs 제목 끝 ~650).
 */
const BAND =
  'hidden md:block absolute z-20 top-1/2 -translate-y-1/2 w-[38%] lg:w-[46%] max-w-[900px] overflow-hidden ' +
  'right-[calc(max(0px,(100vw-1440px)/2)+1.5rem)] lg:right-[calc(max(0px,(100vw-1440px)/2)+2rem)]'

function Tile({ tile, eager, priority, clone }: { tile: HeroTile; eager: boolean; priority: boolean; clone?: boolean }) {
  const label = `${tile.merchant} ${tile.name}`.trim() || tile.name
  const title = tile.merchant || tile.name
  /* 🏷️ 라벨 변환은 **화면의 일**이다 — 공유 모듈(`home-hero-strip`)은 워커가 import 하므로
     아이콘을 든 SSOT 를 거기서 쓸 수 없다. 그래서 키만 받아 여기서 그 SSOT 로 바꾼다. */
  /* 항목이 **정확히 둘**(지역·종류)이라 출력에 점이 하나다 — 그 래칫이 스스로 허용하는 짝이고
     ("주소 · 거리"), JOIN 휴리스틱은 배열 길이를 못 세어 일괄로 잡는다. */
  const sub = [tile.region, CATEGORY_META[tile.category]?.label].filter(Boolean).join(' · ') // middle-dot-ok
  return (
    <Link
      to={tile.href}
      aria-label={clone ? undefined : label}
      aria-hidden={clone || undefined}
      tabIndex={clone ? -1 : undefined}
      className="relative block shrink-0 rounded-xl overflow-hidden transition-transform duration-200 hover:-translate-y-[3px]"
      style={{ width: HERO_TILE_W, height: HERO_TILE_H, backgroundColor: tile.color || 'rgb(255 255 255 / 0.08)' }}
    >
      <img
        src={heroTileUrl(tile.src) || tile.src}
        alt=""
        width={HERO_TILE_W}
        height={HERO_TILE_H}
        /**
         * 🚦 앞 5장만 **먼저** — 밴드에 처음부터 보이는 건 최대 4.5장이다(트래픽 근거는 SSOT 머리말).
         *
         * 🔴 2026-10-10 (대표 *"지금 메인에서 이용권 사진 안나오는 문제 해결해줘. 영구적으로"*):
         *   나머지를 `lazy` 로 둔 것이 **사진이 안 나오는 바로 그 원인**이었다. 이 띠는 마퀴라
         *   한 바퀴(약 34초) 안에 **모든 타일이 반드시 화면에 온다** — 그런데 `lazy` 는 *화면에
         *   들어온 뒤에야* 받기 시작하므로, 그 타일은 받는 동안 **대표색 사각형으로 먼저 보인다.**
         *   브라우저 실측(1440×900, 캐시 끔):
         *   ```
         *     빠른 회선        140프레임 중   9 (6%)  빈 타일 최대 1장
         *     800kbps/500ms   140프레임 중 118 (84%) 빈 타일 최대 **4장** ← 대표 화면 그대로
         *   ```
         *   ⇒ **markup 은 그대로 두고**, 부모가 첫 페인트 뒤 한가할 때 나머지 URL 을 캐시에
         *     미리 넣는다(아래 `warmUrls` 주석 — 속성을 eager 로 바꾸는 길은 실측에서 막혔다).
         *     바이트는 그대로다 — 어차피 34초 안에 받는 것을 *언제* 받느냐만 바뀐다.
         *     둘째 벌은 같은 URL 이라 캐시 적중(추가 다운로드 0).
         */
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding="async"
        className="w-full h-full object-cover"
        onError={(e) => cfImageOnError(e.currentTarget, tile.src)}
      />
      <div
        className="absolute inset-x-0 bottom-0 px-2 pt-5 pb-2 text-white"
        /**
         * 🏪 2026-10-07 (대표 "B안으로 진행") — 캡션이 **한 줄에서 세 줄**이 됐다.
         *
         * 종전엔 `[할인율 가격]` 한 줄뿐이라 사진만 보고는 **어느 가게인지 알 수 없었다**(대표:
         * *"이거 너무 정보가 없는데?"*). 그런데 매장명은 **이미 타일에 와 있었다** — `aria-label`
         * 에만 쓰이고 화면엔 안 그렸다. 지역·정가는 피드에 있던 것을 새로 싣는다(새 요청 0).
         * 라이브 실측(활성 50건): 매장명·주소·정가 **전부 100%** 보유.
         *
         * 🔴 **스크림을 같이 고쳐야 했다 — 글자가 높아지면 종전 램프로는 안 보인다.**
         * 밴드가 48 → 86px 이 되어 글자 상단이 60% → **76.7%** 로 올라간다. 종전 스톱
         * (0.85 / 0.75@60 / 0)의 그 지점 알파는 **0.436** 이고, 순백 사진 위 할인 빨강이
         * **1.06:1** 이다(사실상 안 보인다). 다시 재서 (0.92 / 0.84@78 / 0)로 바꿨다:
         * ```
         *   글자줄 알파 0.841 → 합성 배경 40
         *   할인 빨강 #FF5C69  4.87:1   매장명 흰색      14.65:1
         *   지역 흰70%         8.3:1    정가 취소선 흰50%  4.81:1   (전부 AA)
         * ```
         * ⚠️ 더 진한 안(0.94/0.88@80)도 통과했지만 **사진을 더 덮는다** — 여유가 충분한 쪽 중
         *   덜 덮는 것을 골랐다. 램프는 유지한다(평면 판은 위쪽에 경계선이 보인다).
         * 🛡️ `hero-deal-strip-2026-09-28.test.tsx` ⑤ 가 스톱을 **파싱해 대비를 계산**한다 —
         *   기하(패딩·글자 크기)를 또 바꾸면 그 시험이 먼저 빨간불을 낸다. 그게 이번에 나를 세웠다.
         */
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.84) 78%, rgba(0,0,0,0) 100%)' }}
      >
        {/* 🏪 매장명 — 비어 있으면 상품명으로 떨어진다(이름 없는 타일을 만들지 않는다). */}
        <div className="text-[15px] font-bold leading-tight truncate">{title}</div>
        {/* 🗺️ 지역 · 종류 — 둘 다 없으면 **줄 자체를 안 그린다**(빈 자리를 남기지 않는다). */}
        {sub && <div className="mt-1 text-[12px] text-white/70 truncate">{sub}</div>}
        <div className="mt-1 text-[13px] font-extrabold whitespace-nowrap">
          {/* 🔴 할인율은 **가격 이득**이라 빨강이다(2026-09-07 대표 확정 — 블루는 행동 전용). */}
          {tile.discount > 0 && <span className="ur-hero-tile-off mr-1">{tile.discount}%</span>}
          {tile.origPrice > tile.price && (
            <s className="mr-1 font-medium text-white/50">{formatNumber(tile.origPrice)}</s>
          )}
          {formatNumber(tile.price)}원
        </div>
      </div>
    </Link>
  )
}

export default function HeroDealStrip({ tiles }: { tiles: HeroTile[] }) {
  const loop = useMemo(() => buildHeroStripLoop(tiles), [tiles])

  /**
   * 🔥 **한가해지면 나머지 타일을 미리 받아 둔다** (2026-10-10 — 대표 *"메인에서 이용권 사진
   * 안나오는 문제 해결해줘. 영구적으로"*).
   *
   * 마퀴는 사용자가 스크롤하지 않아도 모든 타일을 화면으로 데려온다. 그래서 `loading="lazy"` 는
   * 여기서 *"필요할 때 받는다"* 가 아니라 **"이미 늦었을 때 받는다"** 가 된다 — 타일은 받는 동안
   * 반드시 대표색 사각형으로 먼저 보인다. 브라우저 실측(1440×900 · 캐시 끔 · 35초=140프레임):
   * ```
   *   빠른 회선         빈 타일이 보이는 프레임   9 (6%)   동시 최대 1장
   *   2 Mbps/120ms                            9 (6%)   동시 최대 1장
   *   800 kbps/500ms                        118 (84%)  동시 최대 **4장**  ← 대표 신고 화면
   * ```
   *
   * 🩸 **처음엔 `loading` 을 lazy→eager 로 접으려 했는데 실측에서 뒤집혔다.** 크로미움은 속성이
   *   바뀌어도 **보류된 lazy 로드를 시작하지 않는다**(`loading` 프로퍼티·`setAttribute`·
   *   `removeAttribute`·같은 값 `src` 재대입 — **넷 다 요청 0건**). 명세의 "lazy load resumption"
   *   을 믿고 그냥 갔으면 markup 만 바뀌고 증상은 그대로였을 것이다.
   * ⇒ 대신 **바이트를 캐시에 미리 넣는다**(`new Image()`). 같은 URL 이라 타일이 화면에 들어올 때는
   *   캐시 적중이다. 실측(800kbps/500ms, 같은 URL): **화면 진입 → 그려지기 980ms → 59ms**,
   *   네트워크 요청은 **1회 그대로**(워밍분을 재사용한다).
   *
   * ⚠️ 첫 페인트는 **한 글자도 안 바뀐다** — markup 은 종전 그대로이고, 워밍은 `requestIdleCallback`
   *   뒤에 시작한다. 총 바이트도 그대로다(어차피 한 바퀴 안에 받는 것을 *언제* 받느냐만 바뀐다).
   * ⚠️ **데이터 절약 모드면 안 한다** — `cf-image` 가 이미 존중하는 신호와 같은 판단이다.
   */
  const warmUrls = useMemo(() => {
    const rest = loop ? loop.strip.slice(HERO_STRIP_EAGER) : []
    return [...new Set(rest.map((t) => heroTileUrl(t.src) || t.src).filter(Boolean))]
  }, [loop])

  useEffect(() => {
    if (typeof window === 'undefined' || warmUrls.length === 0) return
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (conn?.saveData) return
    let cancelled = false
    const run = () => {
      if (cancelled) return
      for (const u of warmUrls) {
        const img = new Image()
        // 디코딩까지 서두르지 않는다 — 바이트만 캐시에 들어오면 된다.
        img.decoding = 'async'
        img.fetchPriority = 'low'
        img.src = u
      }
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (h: number) => void
    }
    if (w.requestIdleCallback) {
      const h = w.requestIdleCallback(run, { timeout: HERO_STRIP_WARM_TIMEOUT_MS })
      return () => { cancelled = true; w.cancelIdleCallback?.(h) }
    }
    const t = window.setTimeout(run, HERO_STRIP_WARM_TIMEOUT_MS)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [warmUrls])

  if (!loop) return null
  const { strip, loopPx, durationSec } = loop

  return (
    /* 양끝 페이드(mask)와 캡션 강조색은 `.ur-hero-band` 가 index.css 에서 준다. */
    <div className={`ur-hero-band ${BAND}`}>
      <div
        className="ur-hero-marquee flex w-max gap-[10px]"
        style={
          { '--ur-hero-loop': `${loopPx}px`, '--ur-hero-dur': `${durationSec}s` } as React.CSSProperties
        }
      >
        {strip.map((t, i) => (
          <Tile key={`a-${i}-${t.id}`} tile={t} eager={i < HERO_STRIP_EAGER} priority={i < HERO_STRIP_PRELOAD} />
        ))}
        {strip.map((t, i) => (
          <Tile key={`b-${i}-${t.id}`} tile={t} eager={false} priority={false} clone />
        ))}
      </div>
    </div>
  )
}
