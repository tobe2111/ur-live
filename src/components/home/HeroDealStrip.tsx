import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import {
  buildHeroStripLoop,
  heroTileUrl,
  HERO_TILE_H,
  HERO_TILE_W,
  HERO_STRIP_EAGER,
  HERO_STRIP_PRELOAD,
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
        /* 🚦 앞 5장만 먼저 — 밴드에 처음부터 보이는 건 최대 4.5장이다. 나머지는 한 바퀴 도는
           동안 필요해지므로 lazy 로 미룬다(트래픽 근거는 SSOT 머리말). 둘째 벌은 전부 lazy 이고
           같은 URL 이라 캐시 적중 — 추가 다운로드 0. */
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'low'}
        decoding="async"
        className="w-full h-full object-cover"
        onError={(e) => cfImageOnError(e.currentTarget, tile.src)}
      />
      <div
        className="absolute inset-x-0 bottom-0 px-2 pt-5 pb-2 text-white text-[13px] font-extrabold"
        /**
         * 🩸 2026-09-28 — **글자가 앉는 줄에서 이 그라디언트가 약했다.**
         *
         * 종전 `rgba(0,0,0,0.8) → transparent` 두 스톱은 0.8 을 **밴드 맨 아래 한 줄에서만** 낸다.
         * 글자는 그보다 위(밴드 높이 48 중 아래 24 근처)에 앉으므로 그 자리의 실효 알파는 **0.5** 였다.
         * 타일 바탕은 딜의 **대표색**(`tile.color`)이고 사진이 밝으면 그 색도 밝다 — 라이브 실측에
         * `rgb(243,243,243)`·`rgb(221,221,221)` 타일이 있었고, 그 위에서 할인율(`#7FB0FF`)이
         * **2.04:1** 이 됐다(가격 흰 글자도 4.35:1 로 간신히).
         *
         * ⇒ 고칠 자리는 **글자색이 아니라 바탕**이다. `--hero-tile-accent` 가 파랑인 근거가
         *   *"캡션은 늘 어두운 바탕"* 이었고, 그 전제를 실제로 지키게 만든 것이다(스톱 하나 추가).
         *   실측(대표색 243 타일): 할인율 2.07 → **5.83:1** · 가격 4.35 → **12.45:1**.
         *   순백(255) 사진이어도 5.58:1 이라 여유가 있다.
         *
         * ⚠️ **평면 판으로 바꾸지 않았다** — 램프를 유지해야 위쪽에 경계선이 안 생긴다(0.88 평면안은
         *    7.67:1 로 더 높았지만 사진을 더 많이 덮고 판 끝이 보인다).
         * 🛡️ `hero-deal-strip-2026-09-28.test.tsx` ⑤ 가 스톱 수와 최소 알파를 고정한다.
         */
        style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0) 100%)' }}
      >
        {tile.discount > 0 && <span className="ur-hero-tile-off mr-2">{tile.discount}%</span>}
        {formatNumber(tile.price)}원
      </div>
    </Link>
  )
}

export default function HeroDealStrip({ tiles }: { tiles: HeroTile[] }) {
  const loop = useMemo(() => buildHeroStripLoop(tiles), [tiles])
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
