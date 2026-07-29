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
    // 운영자 지정색은 라이트에만 적용. 다크 짝 파생은 별도 판단이 필요해 P0 에선 기본값을 쓴다
    //   (임의 파생이 AA 를 깨면 "대비는 규격"이라는 확정을 어긴다).
    colorLight: color || MALL_COLOR_LIGHT,
    colorDark: color ? MALL_COLOR_DARK : MALL_COLOR_DARK,
    intro: b.intro?.trim() || defaultIntro(name),
    contactUrl: b.contactUrl?.trim() || null,
    showBanner: false,
  }
}
