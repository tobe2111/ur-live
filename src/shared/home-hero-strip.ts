/**
 * 🎞️ 홈 히어로 **이용권 띠** — 한 장을 늘려 붙이는 대신, 파는 것을 흘려보낸다.
 *
 * ## 무엇이 깨져 있었나 (2026-09-28 대표 — 빨간 상자 시안)
 * 대표: *"여기 지금 들어있는 사진 비율이나 너무 마음에 안드는데? 이거 그냥 확대해서 올라가버리는거잖아"*
 *
 * 실측하니 **크롭 설정이 아니라 틀과 내용의 불일치**였다:
 *   · 히어로 사진 틀 = PC 1920 기준 **1037 × 190 = 5.46 : 1** (극단적 가로)
 *   · 라이브에 실제로 들어간 사진(id 2915 홍대 돈가스) = **540 × 720 (세로 3:4)**
 *     ⇒ 세로의 **14%** 만 보인다. 확대해서 잘린 것처럼 보이는 게 아니라 정말로 그렇다.
 *   · 우리 사진 70장 실측(2026-08-31): 세로가 더 긴 것 37% · 정사각 21% · **중앙값 정확히 1:1**
 *     ⇒ 이 틀에 맞는 사진은 우리 카탈로그에 거의 없다. 어느 한 장을 잘 고르는 문제가 아니다.
 *   · `banners` 의 히어로 배너는 **0건** — 그래서 늘 카탈로그 썸네일이 배너 자리에 들어간다.
 *
 * ## 처방 (대표 확정 — 시안 ② + "좌우로 자연스럽게 계속 이동")
 * 5.46:1 한 장 대신 **4:3 타일 여러 장**을 가로로 흘린다. 타일은 우리 사진의 실제 비율과
 * 가까워 잘려 나가는 면적이 작고(세로 3:4 원본도 `gravity=auto` 로 피사체를 잡는다), 무엇보다
 * 히어로가 *장식 사진* 이 아니라 **매대**가 된다.
 *
 * ## 🚦 트래픽 (대표 — "최대한 이상적으로 하자. 처음 5장만 받는게 가장 이상적인가?")
 * 실측(마퀴에 들어갈 딜 8개, 같은 사진으로 URL 만 바꿔 측정):
 * ```
 *   카드와 공유(width=400, DPR1)    228 KB   (평균 28.5 KB)
 *   카드와 공유(width=800, DPR2)    652 KB   (평균 81.6 KB)
 *   전용 420×315 q72                150 KB   (평균 18.7 KB)
 *   전용 384×288 q62  ← 채택        106 KB   (평균 13.3 KB)
 *   (참고) 오늘의 히어로 한 장        55 KB
 * ```
 * ⇒ **"몇 장을 먼저 받나" 보다 "한 장이 몇 KB 인가"가 큰 레버다.** 아래 매대 카드와 URL 을
 *   공유하면 스크롤해 내려가는 사람에겐 공짜지만, 안 내려가는 사람에겐 2~6배를 물린다
 *   (손익분기 = DPR1 에서 방문자의 54%, DPR2 에서 84%가 첫 줄 아래로 내려가야 이득).
 *   그래서 **전용 작은 크롭**을 따로 받는다.
 * ⇒ 그리고 마퀴는 **한 바퀴(약 34초) 안에 모든 타일이 화면에 온다** — "5장만 받는다"는 선택지가
 *   아니고 "5장을 먼저, 나머지는 늦게"만 가능하다. 그래서 앞 5장 eager · 나머지 lazy,
 *   둘째 복제본은 전부 lazy(같은 URL 이라 캐시 적중, 추가 다운로드 0).
 *   첫 화면에 실제로 보이는 건 밴드 폭(최대 900px)에 4.5장 ≈ **60KB** 로, 오늘 히어로 한 장과 비슷하다.
 *
 * ## ⚠️ byte-일치
 * 워커가 첫 타일을 `<link rel="preload">` 로 당기므로, **URL 은 여기 한 함수에서만** 만든다.
 * 한 글자라도 갈리면 preload 가 버려지고 같은 사진을 두 번 받는다(에러 없이 더 느려진다).
 */
import { cfImage } from '../utils/cf-image'
import { isOwnMedia } from './home-hero-photo'
import { priceDisplay } from './price-display'

/* ───────────────────────────── 치수 (시안 확정값) ───────────────────────────── */

/** 타일 한 장의 CSS 폭·높이(px). 4:3 에 가깝게 — 우리 사진의 실제 비율 중앙값이 1:1 이다. */
export const HERO_TILE_W = 189
export const HERO_TILE_H = 142
/** 타일 사이 간격(px). 루프 거리 계산이 이 값을 쓴다. */
export const HERO_TILE_GAP = 10
/** 한 칸이 차지하는 폭 — 루프 거리는 항상 `타일 수 × 이 값`이다. */
export const HERO_TILE_STEP = HERO_TILE_W + HERO_TILE_GAP

/** 리사이저에 요청하는 타일 크기·품질. DPR2(189×2=378)를 덮는 최소값. */
export const HERO_TILE_REQUEST_WIDTH = 384
export const HERO_TILE_REQUEST_HEIGHT = 288
export const HERO_TILE_QUALITY = 62

/* ───────────────────────────── 고르기 ───────────────────────────── */

/**
 * 아래 매대 첫 줄과 **겹치지 않게** 건너뛰는 개수.
 * 같은 딜이 히어로와 바로 아래에 40px 간격으로 두 번 나오면 매대가 좁아 보인다(시안에서 실제로 그랬다).
 * 🩸 시안을 5열로 그려 놓고 5 로 적었다가 실측에서 정정했다 — 진짜 그리드는 `md:grid-cols-4` 다
 *   (`GroupBuyFeed`·`HomeSections` 둘 다). 가드가 그 클래스를 읽어 이 값과 대조한다.
 */
export const HERO_STRIP_SKIP = 4
/** 띠에 태우는 최대 장수. 8장 × 13.3KB ≈ 106KB. */
export const HERO_STRIP_MAX = 8
/** 건너뛰고 남은 게 이보다 적으면 건너뛰기를 포기한다(딜이 적은 지역/카테고리에서 빈 띠가 되는 것 방지). */
export const HERO_STRIP_MIN_AFTER_SKIP = 4
/**
 * 한 벌(복제 전)이 가져야 할 최소 장수. 띠는 [같은 벌 2개]를 이어 붙이고 한 벌 폭만큼 밀어서
 * 무한 루프를 만드는데, **한 벌이 밴드보다 좁으면** 미는 동안 오른쪽에 빈 칸이 생긴다.
 * 밴드 최대 900px ÷ 199px = 4.5 → 5장. 모자라면 같은 딜을 되풀이해 채운다(URL 이 같아 추가 트래픽 0).
 */
export const HERO_STRIP_MIN_PER_LOOP = 5
/** 먼저 받는 장수(나머지는 lazy). 밴드에 처음부터 보이는 4.5장을 덮는다. */
export const HERO_STRIP_EAGER = 5
/** 워커가 preload 로 당기는 장수. */
export const HERO_STRIP_PRELOAD = 2

/**
 * 흐르는 속도(px/초). 대표 확정 **"보통"** — 시안의 55초/2,587px 가 이 값이다.
 * ⚠️ 장수가 달라져도 **속도는 같아야** 한다. 그래서 지속시간을 상수로 두지 않고 거리에서 구한다
 *   (지속시간을 고정하면 딜이 적은 지역에서 띠가 느려터지고, 많으면 휙 지나간다).
 */
export const HERO_STRIP_SPEED_PX_PER_SEC = 47

/**
 * 밴드 최대 폭(px). 초광폭 모니터에서 `46%` 가 카피를 밀어내지 않게 잘라 둔다.
 * ⚠️ `HERO_STRIP_MIN_PER_LOOP` 는 이 값에서 나온 수다 — 같이 고쳐야 한다.
 */
export const HERO_STRIP_BAND_MAX_PX = 900

export interface HeroTile {
  id: number | string
  src: string
  href: string
  /** 상품명(링크 이름에 쓴다 — 사진은 `alt=""` 장식이라 링크가 이름을 가져야 한다). */
  name: string
  /** 매장명(없으면 빈 문자열). */
  merchant: string
  price: number
  /** 0 이면 배지를 그리지 않는다. */
  discount: number
  /** 로딩 중 바탕색 — 흰 깜빡임 방지. */
  color: string
}

/** 타일 사진 URL — **여기서만** 만든다(워커 preload 와 byte-일치해야 한다). */
export function heroTileUrl(src: string): string {
  return cfImage(src, {
    width: HERO_TILE_REQUEST_WIDTH,
    height: HERO_TILE_REQUEST_HEIGHT,
    fit: 'cover',
    /* 🎯 세로 사진(우리 카탈로그의 37%)도 피사체를 잡는다 — 이 히어로가 욕먹은 바로 그 이유. */
    gravity: 'auto',
    quality: HERO_TILE_QUALITY,
  })
}

function toTile(raw: Record<string, unknown>): HeroTile | null {
  const src = typeof raw?.image_url === 'string' ? raw.image_url : ''
  if (!src) return null
  const id = raw?.id
  if (id == null) return null
  const { price, discount } = priceDisplay({
    price: raw?.price as number,
    original_price: raw?.original_price as number,
    discount_rate: raw?.discount_rate as number,
  })
  return {
    id: id as number,
    src,
    href: `/pass/${id}`,
    name: typeof raw?.name === 'string' ? raw.name : '',
    merchant: typeof raw?.restaurant_name === 'string' ? raw.restaurant_name : '',
    price,
    discount,
    color: typeof raw?.dominant_color === 'string' ? raw.dominant_color : '',
  }
}

/**
 * 홈 피드에서 띠에 태울 딜들.
 *
 * ⚠️ **데모 규칙은 `pickHeroPhotoFrom` 과 같다** — 실상품 우선, 데모는 *우리 호스트 사진*만.
 *   2026-08-04 에 데모 사진에 타사 워터마크 보도사진이 섞여 홈 최상단에 오를 뻔했다. 한 장짜리
 *   히어로에 적용하던 규칙인데, 여러 장을 크게 흘리는 이 띠는 **위험이 그만큼 커진다**.
 */
export function pickHeroStripFrom(data: unknown): HeroTile[] {
  if (!Array.isArray(data)) return []
  const rows = data as Array<Record<string, unknown>>
  const take = (from: number): HeroTile[] => {
    const out: HeroTile[] = []
    for (let i = from; i < rows.length && out.length < HERO_STRIP_MAX; i++) {
      const raw = rows[i]
      const img = typeof raw?.image_url === 'string' ? raw.image_url : ''
      const slug = typeof raw?.slug === 'string' ? raw.slug : ''
      if (slug.startsWith('demo-deal-') && !isOwnMedia(img)) continue
      const tile = toTile(raw)
      if (tile) out.push(tile)
    }
    return out
  }
  const skipped = take(HERO_STRIP_SKIP)
  return skipped.length >= HERO_STRIP_MIN_AFTER_SKIP ? skipped : take(0)
}

/** 시드 JSON 문자열에서 바로 — 워커가 쓰는 입구(파싱 실패는 빈 배열, fail-soft). */
export function pickHeroStripFromSeedJson(json: string): HeroTile[] {
  try {
    const parsed = JSON.parse(json) as { success?: boolean; data?: unknown }
    if (!parsed?.success) return []
    return pickHeroStripFrom(parsed.data)
  } catch {
    return []
  }
}

/* ───────────────────────────── 루프 계산 ───────────────────────────── */

export interface HeroStripLoop {
  /** 한 벌(이 배열을 두 번 이어 붙여 렌더한다). */
  strip: HeroTile[]
  /** 한 벌의 폭 = 미는 거리(px). */
  loopPx: number
  /** 그 거리를 `HERO_STRIP_SPEED_PX_PER_SEC` 로 지나는 데 걸리는 초. */
  durationSec: number
}

/**
 * 타일 목록 → 끊기지 않는 한 벌.
 *
 * 딜이 적으면 같은 딜을 되풀이해 한 벌을 `HERO_STRIP_MIN_PER_LOOP` 장 이상으로 만든다.
 * ⚠️ 되풀이는 **트래픽을 안 늘린다**(같은 URL = 캐시 적중). 대신 한 벌이 밴드보다 좁으면
 *    루프 이음매에 **빈 칸**이 보인다 — 에러가 아니라 "가끔 휑해 보인다"로만 나타나는 종류다.
 */
export function buildHeroStripLoop(tiles: HeroTile[]): HeroStripLoop | null {
  if (!tiles.length) return null
  const strip: HeroTile[] = []
  while (strip.length < HERO_STRIP_MIN_PER_LOOP) strip.push(...tiles)
  const loopPx = strip.length * HERO_TILE_STEP
  return { strip, loopPx, durationSec: Math.round(loopPx / HERO_STRIP_SPEED_PX_PER_SEC) }
}
