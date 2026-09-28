/**
 * 🛍️ 유어샵 공유 카드(SVG) — 생성기만. 데이터 조회·사진 인라인은 호출부(`og-image.routes.ts`)가 한다.
 *
 * 라우트에서 떼어 낸 이유: 이 카드는 **눈으로 봐야** 판정된다. 모듈이 독립이면 테스트가
 * 실제로 렌더해 볼 수 있다(라우트 안에 있으면 Hono·Env 때문에 못 부른다).
 */

export interface CuratorForOG {
  id: number
  handle: string
  name: string
  bio: string | null
  profile_image: string | null
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/** 글자 수로 자른다(한글 폭 기준 근사) — 카드 밖으로 새면 그게 더 흉하다. */
function clamp(s: string, n: number): string {
  const t = String(s || '').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

// 카드를 굽는 쪽(카카오 스크래퍼)의 폰트를 우리가 못 고른다. `system-ui` 는 환경에 따라
// **라틴을 세리프로** 떨어뜨려서(로컬 렌더 실측) 한글 폰트 → Arial → sans-serif 로 고정한다.
/** 타일 줄 치수 — 카드와 **사진 요청 크기**가 같은 식을 쓰게 하는 SSOT. */
export const TILE_X = 100
export const TILE_ROW_W = 1004
export const TILE_GAP = 20
export const TILE_H = 236

/** 사진 n 장일 때 타일 한 장의 폭. 몇 장이든 줄을 꽉 채운다. */
export function tileWidth(n: number): number {
  return n > 0 ? (TILE_ROW_W - TILE_GAP * (n - 1)) / n : 0
}

const OG_FONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Nanum Gothic",Arial,sans-serif'

/**
 * 🛍️ 유어샵 공유 카드 (1200×630)
 *
 * 2026-09-28 대표 신고 *"카카오로 링크 공유했는데 이 형태 너무한데?"* 로 전면 재설계.
 * **두 가지가 겹쳐 카드가 새까맸다**:
 *   ① 사진을 외부 `<image href>` 로 불러와서 카톡이 **한 장도 안 그렸다**(→ `inlineImage` 로 박아 넣는다)
 *   ② 바탕 `#11141C` 과 빈 칸 `#1D1F29` 이 거의 같은 검정이라, 안 그려진 자리가 **티도 안 났다**
 *
 * ⇒ 흰 카드로 뒤집었다. 카톡 대화방은 대개 어두워서 **흰 카드가 눈에 띈다**(다크 카드는
 *   대화 배경에 묻힌다). 🎫 디자인 시스템의 화이트 면 + 브랜드 블루 밴드(티켓 은유)를 따른다.
 *
 * 🔄 **`og:image` 주소에는 판 번호(`?v=N`)를 붙인다**(`worker/index.ts`). 카카오는 스크랩 결과를
 *   캐시해서, 주소가 그대로면 고쳐 배포해도 **옛 카드가 계속 나간다** — 잘못 나간 카드는 회수할
 *   방법이 우리에게 없다. 이 카드 디자인을 또 바꾸면 그 숫자를 올릴 것.
 *
 * 🔒 **사진이 0장이어도 멀쩡해야 한다** — 스크래퍼가 사진을 못 받아 오는 날은 반드시 온다.
 *   그때는 타일 줄을 아예 빼고 신원 블록을 가운데로 키운다(빈 칸 4개를 보여주지 않는다).
 */
export function generateCuratorSVG(curator: CuratorForOG, profileUri: string | null, tileUris: string[]): string {
  // 15자 — 52px 한글은 글자당 약 52px 이라 x=248 에서 시작하면 15자에 1,028px.
  //   카드 오른쪽 안전선(1,104)을 안 넘는 최대치다(18자로 두니 실제로 넘쳤다).
  const name = clamp(curator.name || curator.handle, 15)
  const handle = escapeXml(curator.handle)
  const bio = clamp(curator.bio || `${curator.name || curator.handle}님이 고른 이용권`, 34)
  const initial = escapeXml((curator.name || curator.handle || '?').slice(0, 1))
  const tiles = tileUris.filter(Boolean).slice(0, 4)
  const hasTiles = tiles.length > 0

  // 타일은 **몇 장이든 줄을 꽉 채운다**. 고정 폭으로 두면 3장일 때 오른쪽이 휑하게 빈다
  // (첫 렌더에서 실제로 그랬다). 높이는 236 고정이고 폭만 장수 따라 달라진다.
  const tileW = tileWidth(tiles.length)

  const avatar = (cx: number, cy: number, r: number) =>
    profileUri
      ? `<clipPath id="cprofile"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <image href="${escapeXml(profileUri)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#cprofile)" preserveAspectRatio="xMidYMid slice"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#E4EDFD"/>
    <text x="${cx}" y="${cy + r * 0.36}" font-size="${Math.round(r * 1.05)}" font-family="${OG_FONT}" font-weight="800" fill="#1C69EF" text-anchor="middle">${initial}</text>`

  // 사진이 있으면 [위 신원 + 아래 타일 줄], 없으면 신원만 가운데로 키운다.
  const body = hasTiles
    ? `${avatar(146, 144, 58)}
    <text x="248" y="134" font-size="52" font-family="${OG_FONT}" font-weight="800" fill="#16181C">${escapeXml(name)}</text>
    <text x="248" y="182" font-size="28" font-family="${OG_FONT}" fill="#8A8F98">@${handle}</text>
    <text x="100" y="258" font-size="27" font-family="${OG_FONT}" fill="#4B5563">${escapeXml(bio)}</text>
    ${tiles.map((uri, i) => {
      const x = Math.round(TILE_X + i * (tileW + TILE_GAP))
      const w = Math.round(tileW)
      return `<image href="${escapeXml(uri)}" x="${x}" y="296" width="${w}" height="${TILE_H}" preserveAspectRatio="xMidYMid slice" clip-path="url(#tile${i})"/>
    <clipPath id="tile${i}"><rect x="${x}" y="296" width="${w}" height="${TILE_H}" rx="18"/></clipPath>`
    }).join('\n    ')}`
    : `${avatar(600, 232, 78)}
    <text x="600" y="368" font-size="60" font-family="${OG_FONT}" font-weight="800" fill="#16181C" text-anchor="middle">${escapeXml(name)}</text>
    <text x="600" y="418" font-size="30" font-family="${OG_FONT}" fill="#8A8F98" text-anchor="middle">@${handle}</text>
    <text x="600" y="480" font-size="28" font-family="${OG_FONT}" fill="#4B5563" text-anchor="middle">${escapeXml(bio)}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><clipPath id="card"><rect x="32" y="32" width="1136" height="566" rx="28"/></clipPath></defs>
  <rect width="1200" height="630" fill="#F8F7FC"/>
  <rect x="32" y="32" width="1136" height="566" rx="28" fill="#FFFFFF"/>
  <rect x="32" y="32" width="14" height="566" fill="#1C69EF" clip-path="url(#card)"/>

  ${body}

  <text x="100" y="578" font-size="24" font-family="${OG_FONT}" font-weight="800" fill="#1C69EF">유어딜 유어샵</text>
  <text x="1104" y="578" font-size="22" font-family="${OG_FONT}" fill="#9CA3AF" text-anchor="end">urdeal.kr/u/${handle}</text>
</svg>`
}
