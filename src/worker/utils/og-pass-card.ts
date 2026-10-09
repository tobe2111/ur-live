/**
 * 🦦 이용권 공유 카드(SVG, 1200×630) — 생성기만. 조회·사진 인라인은 호출부(`og-image.routes.ts`)가 한다.
 *
 * 2026-10-09 대표 확정 시안 ② ("좋다 모두 해줘" · 공유 카드 "바꾸기"):
 *   이용권 링크를 카톡에 붙이면 상품 사진 **원본 한 장**이 그대로 나갔다 — 어느 서비스의 링크인지
 *   카드만 봐서는 알 수 없었다. 사진은 그대로 주인공으로 두고 **귀퉁이에만** `urdeal.` 표시와
 *   유달이를 얹는다. 앱 밖에서 유달이가 보이는 거의 유일한 자리다.
 *
 * 규칙
 *   · 카드 위에 가격·할인율을 쓰지 않는다 — 카톡이 제목·설명을 카드 아래에 따로 보여 주고,
 *     마스코트 문서가 "가격 옆 유달이" 를 금지한다.
 *   · 바깥 그림 참조 0 — 사진·유달이 모두 data URI(카카오는 SVG 속 외부 그림을 안 가져온다).
 *   · 사진을 못 받아도 멀쩡해야 한다 — 그때는 옅은 브랜드 바탕에 유달이와 이름을 크게 그린다.
 */
import { UDAL_OG_PNG, UDAL_OG_PNG_W, UDAL_OG_PNG_H } from './og-udal-png'

export const PASS_CARD_W = 1200
export const PASS_CARD_H = 630
/** 사진을 받는 크기 — 카드 비율 그대로, 인라인 한도(160KB) 안에 들도록 카드보다 작게. */
export const PASS_PHOTO_W = 960
export const PASS_PHOTO_H = 504

const OG_FONT = '"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Nanum Gothic",Arial,sans-serif'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function clamp(s: string, n: number): string {
  const t = String(s || '').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

export interface PassForOG {
  name: string
  restaurant_name: string | null
}

export function generatePassCardSVG(p: PassForOG, photoUri: string | null): string {
  const udalW = 212
  const udalH = Math.round(udalW * UDAL_OG_PNG_H / UDAL_OG_PNG_W)
  // 귀퉁이에서 고개를 내민다 — 발끝은 카드 아래로 조금 잘린다.
  const udalX = PASS_CARD_W - udalW - 40
  const udalY = PASS_CARD_H - udalH + 40
  const udal = `<image href="${UDAL_OG_PNG}" x="${udalX}" y="${udalY}" width="${udalW}" height="${udalH}"/>`

  // 좌하단 `urdeal.` 알약 — 로고와 같은 장치(소문자 + 브랜드 블루 점).
  const pill = `<g>
    <rect x="40" y="${PASS_CARD_H - 112}" width="196" height="72" rx="36" fill="#FFFFFF"/>
    <text x="76" y="${PASS_CARD_H - 62}" font-size="40" font-weight="800" letter-spacing="-1" font-family='${OG_FONT}' fill="#16181C">urdeal</text>
    <circle cx="200" cy="${PASS_CARD_H - 70}" r="8" fill="#1C69EF"/>
  </g>`

  if (photoUri) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${PASS_CARD_W}" height="${PASS_CARD_H}" viewBox="0 0 ${PASS_CARD_W} ${PASS_CARD_H}">
  <rect width="${PASS_CARD_W}" height="${PASS_CARD_H}" fill="#D9DCE1"/>
  <image href="${photoUri}" x="0" y="0" width="${PASS_CARD_W}" height="${PASS_CARD_H}" preserveAspectRatio="xMidYMid slice"/>
  ${pill}
  ${udal}
</svg>`
  }

  // 사진 없음 — 빈 회색 칸 대신 이름을 주인공으로.
  const name = clamp(p.name, 16)
  const store = clamp(p.restaurant_name || '', 22)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PASS_CARD_W}" height="${PASS_CARD_H}" viewBox="0 0 ${PASS_CARD_W} ${PASS_CARD_H}">
  <rect width="${PASS_CARD_W}" height="${PASS_CARD_H}" fill="#EAF1FE"/>
  ${store ? `<text x="72" y="200" font-size="36" font-weight="600" font-family='${OG_FONT}' fill="#4F545A">${escapeXml(store)}</text>` : ''}
  <text x="72" y="${store ? 278 : 250}" font-size="64" font-weight="800" letter-spacing="-1.5" font-family='${OG_FONT}' fill="#16181C">${escapeXml(name)}</text>
  <text x="72" y="${store ? 346 : 318}" font-size="34" font-weight="600" font-family='${OG_FONT}' fill="#1C69EF">매장에서 바로 쓰는 이용권</text>
  ${pill}
  ${udal}
</svg>`
}
