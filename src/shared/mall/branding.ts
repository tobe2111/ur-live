/**
 * 🏬 운영자 몰 브랜딩 기본값 — 세션 ③-a 입력값 〔기획 확정 2026-07-29〕
 *
 * 출처: `docs/design/operator-mall-planner-brief.md` 과제 1 (기획 산출물 §1, 대표 확정).
 *
 * ## 원칙 — **무설정 상태가 "미완성"으로 보이면 안 된다**
 * 파일럿 운영자는 꾸미기 전에 팔기 시작한다. 그래서 기본값만으로 완성된 화면이 나와야 하고,
 * 빈 배너 placeholder 같은 "채워야 할 것 같은 자리"는 **아예 렌더하지 않는다.**
 *
 * ## 열어주는 것은 5개뿐
 * 몰 이름 · 로고 1장 · 대표 색 1개 · 소개문 1줄 · 문의 링크 1개.
 * 레이아웃·폰트·카드 구조·결제/고지 영역·하단 표기는 **잠근다** — 꾸밈은 P0 판정
 * (*"엑셀을 버렸는가"*)과 무관하다.
 */

/** 운영자가 설정할 수 있는 5개 필드. 이 밖은 P0 에서 열지 않는다. */
export interface MallBranding {
  /** 표시명 2~20자. */
  name: string
  /** 로고 이미지 1장. 없으면 이니셜 아바타로 대체. */
  logoUrl?: string | null
  /** 대표 색(라이트 모드 기준 hex). 없으면 기본 딥그린. */
  color?: string | null
  /** 소개문 1줄. 없으면 이름을 넣은 기본 문장. */
  intro?: string | null
  /** 문의 링크 1개(카카오채널 등). 없으면 문의 버튼 미노출. */
  contactUrl?: string | null
}

/**
 * 기본 대표 색 — 딥그린. 유어딜 본진(로즈 `#E0526B`)과 구분되되 결제 신뢰를 주는 톤.
 * ⚠️ **다크 짝은 취향이 아니라 규격이다**(대표 확정): 두 모드 모두 본문 텍스트 대비 **WCAG AA** 충족.
 *   `MALL_COLOR_DARK` 는 어두운 배경 위에서 쓰이므로 라이트값보다 **밝게** 파생한다.
 */
export const MALL_COLOR_LIGHT = '#2E7D5B'
export const MALL_COLOR_DARK = '#5FBF95'

/**
 * 🔴 **대비는 취향이 아니라 규격이다** — 그런데 2026-08-02 까지 **검사가 없었다.**
 *
 * 위 주석이 "두 모드 모두 WCAG AA 충족" 이라고 선언해 놓고 강제하는 코드가 0 이었다.
 * 운영자가 자기 색을 고르는데(`MallBranding.color`) 옅은 색을 고르면 몰 홈의 아바타 이니셜·
 * 안전결제 띠의 **흰 글자가 그대로 안 보인다.** 파일럿은 몰 1개라 안 터지지만 몰이 늘면 터진다.
 *
 * ⚠️ 이 함수들이 **못 막는 것**: 운영자가 색을 고르는 화면이 아직 없어 저장 경로가 열리면
 *   그 지점에서 반드시 불러야 한다. 순수함수만으로는 아무것도 막지 못한다.
 */

/** sRGB 채널 → 선형값 (WCAG 2.x relative luminance 전단계). */
function linearize(c8: number): number {
  const c = c8 / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** `#RRGGBB` → 상대 휘도. 형식이 틀리면 `null`(추측하지 않는다). */
export function relativeLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return 0.2126 * linearize((n >> 16) & 255) + 0.7152 * linearize((n >> 8) & 255) + 0.0722 * linearize(n & 255)
}

/** 두 색의 WCAG 대비비(1~21). 하나라도 형식이 틀리면 `null`. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a), lb = relativeLuminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** 몰 색 위에 얹는 글자색. 라이트는 흰 글자, 다크는 잉크 글자다(§`MALL_COLOR_DARK` 는 밝은 색이다). */
export const MALL_ON_COLOR_LIGHT = '#FFFFFF'
export const MALL_ON_COLOR_DARK = '#1A1719'

/** 본문 대비 기준. 몰 색 위 글자는 12~13px 이 섞여 있어 **일반 텍스트 기준(4.5)** 을 쓴다. */
export const MALL_CONTRAST_MIN = 4.5

/**
 * 운영자가 고른 대표 색이 **쓸 수 있는 색인가**.
 * `validateMallName` / `validateMallSlug` 와 같은 자리에서 **저장 전에** 부른다.
 *
 * 라이트 모드에서 이 색은 **면**이고 그 위에 흰 글자가 올라간다 ⇒ 흰색 대비 AA 를 요구한다.
 * (다크 짝은 운영자 지정과 무관하게 `MALL_COLOR_DARK` 고정이라 여기서 검사 대상이 아니다 —
 *  `resolveMallBranding` 참조. 그 값은 아래 테스트가 잉크 글자 기준으로 고정한다.)
 */
/**
 * 🌗 **다크 짝 파생** — 운영자 색을 어두운 화면에서도 쓸 수 있게 (2026-08-12)
 *
 * 그전까지 `resolveMallBranding` 은 다크에서 **항상 기본 딥그린**을 썼다. 주석이 그 이유를 이렇게
 * 적어 뒀다: *"임의 파생이 AA 를 깨면 '대비는 규격'이라는 확정을 어긴다."* 맞는 판단이었지만,
 * 그 말은 **파생을 하지 말라**가 아니라 **AA 를 증명하며 파생하라**는 뜻이다.
 * ⇒ 밝기를 올리며 **잉크 글자(`MALL_ON_COLOR_DARK`) 대비 AA 를 만족하는 첫 지점**을 고른다.
 *
 * 🔴 **못 만들면 기본값으로 물러난다.** 아주 어두운 색(예: `#000080`)은 색상을 유지한 채로는
 *   AA 를 못 만드는 경우가 있고, 그때 *비슷한 색*을 억지로 내놓는 것보다 **규격을 지키는 다른 색**이
 *   낫다 — 안 보이는 버튼은 브랜딩이 아니다.
 *
 * ⚠️ 이 함수가 **하지 않는 것**: 색상(hue)을 바꾸지 않는다. 밝기만 올린다 — 운영자가 고른 색과
 *   같은 계열로 남아야 "내 가게 색"으로 읽힌다.
 */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

/** 원색 방향으로 흰색을 섞는다(0=원색, 1=흰색). 색상은 유지되고 밝기만 오른다. */
function lightenToward(rgb: [number, number, number], t: number): string {
  return rgbToHex(rgb[0] + (255 - rgb[0]) * t, rgb[1] + (255 - rgb[1]) * t, rgb[2] + (255 - rgb[2]) * t)
}

export function deriveMallColorDark(raw: string | null | undefined): string {
  const rgb = hexToRgb(String(raw ?? ''))
  if (!rgb) return MALL_COLOR_DARK
  // 원색이 이미 충분히 밝으면 그대로 쓴다(불필요하게 바래지 않는다).
  for (let i = 0; i <= 20; i++) {
    const cand = lightenToward(rgb, i / 20)
    const ratio = contrastRatio(cand, MALL_ON_COLOR_DARK)
    if (ratio !== null && ratio >= MALL_CONTRAST_MIN) return cand
  }
  return MALL_COLOR_DARK   // 색상을 지키면서는 규격을 못 맞춘다 — 규격이 이긴다
}

export function validateMallColor(raw: string): { ok: true } | { ok: false; reason: string } {
  const s = String(raw ?? '').trim()
  if (!/^#?[0-9a-fA-F]{6}$/.test(s)) {
    return { ok: false, reason: '색은 #RRGGBB 형식이어야 합니다' }
  }
  const ratio = contrastRatio(s, MALL_ON_COLOR_LIGHT)
  if (ratio === null) return { ok: false, reason: '색을 해석할 수 없습니다' }
  if (ratio < MALL_CONTRAST_MIN) {
    return {
      ok: false,
      reason: `너무 밝아 흰 글자가 보이지 않습니다 (대비 ${ratio.toFixed(1)}:1, 최소 ${MALL_CONTRAST_MIN}:1)`,
    }
  }
  return { ok: true }
}

/** 하단 고정 표기 — 완전 화이트라벨이 아니다(성장 루프 입구 + 책임주체 표기 자리). */
export const POWERED_BY = 'powered by 유어딜'

/**
 * 결제 화면 표기.
 * ⚠️ **환불 주체를 단정하지 않는다**〔기획 확정 2026-07-29〕 — 운영자도 `/seller/orders` 에서 직접
 * 환불을 실행할 수 있어(클래스 D 전수 확인) *"환불은 유어딜이 처리"* 가 사실과 어긋날 수 있다.
 * 법무 회신(질문 ⑥) 후 확정한다.
 */
export const PAYMENT_TRUST_NOTE = '결제는 유어딜이 안전하게 처리합니다'

/** 기본 소개문 — 이름을 넣어 "빈 자리"가 아니라 문장이 되게 한다. */
export function defaultIntro(mallName: string): string {
  return `${mallName}의 공동구매 공간입니다. 마감 전에 참여하고, 픽업일에 찾아가세요.`
}

/**
 * 로고 미설정 시 이니셜 아바타 글자 — 표시명의 **첫 글자 1자**.
 * 공백/이모지 등으로 시작해도 실제 글자를 찾아 쓴다(빈 아바타 방지).
 * 서로게이트 페어(이모지)를 반으로 자르지 않도록 코드포인트 단위로 순회한다.
 */
export function initialOf(mallName: string): string {
  for (const ch of String(mallName ?? '')) {
    if (ch.trim()) return ch.toUpperCase()
  }
  return '?'
}

/** 화면이 실제로 쓸 값 — 미설정 필드를 기본값으로 채운 뒤 넘긴다. */
export interface ResolvedMallBranding {
  name: string
  logoUrl: string | null
  initial: string
  colorLight: string
  colorDark: string
  intro: string
  contactUrl: string | null
  /** 배너는 P0 에 없다. 빈 영역을 렌더하지 말 것(placeholder 금지). */
  showBanner: false
}

export function resolveMallBranding(b: MallBranding): ResolvedMallBranding {
  const name = String(b.name ?? '').trim()
  const color = (b.color ?? '').trim()
  return {
    name,
    logoUrl: b.logoUrl?.trim() || null,
    initial: initialOf(name),
    // 라이트는 운영자 지정색 그대로(저장 시 `validateMallColor` 가 흰 글자 AA 를 이미 통과시켰다).
    // 다크는 **AA 를 증명하며 파생**한다(`deriveMallColorDark`) — 못 만들면 기본값으로 물러난다.
    //   2026-08-12 이전엔 다크가 항상 기본 딥그린이라, 운영자 색이 다크에서 통째로 사라졌다.
    colorLight: color || MALL_COLOR_LIGHT,
    colorDark: color ? deriveMallColorDark(color) : MALL_COLOR_DARK,
    intro: b.intro?.trim() || defaultIntro(name),
    contactUrl: b.contactUrl?.trim() || null,
    showBanner: false,
  }
}
