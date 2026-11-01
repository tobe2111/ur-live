/**
 * 🏷️ 유어샵 머리의 **가게 이름 글자 크기** — 한 줄을 지키는 단 하나의 규칙 (2026-11-01).
 *
 * ## 왜 — 대표 신고 *"리스터코퍼레이션 이렇게 길게 하니까 두줄이 되네? 아무리 길어도 1줄로"*
 * 390px 실측: 이름 칸이 **132px** 밖에 없었다(같은 줄 오른쪽 버튼 묶음이 131px 을 먼저 가져간다).
 * 24px 한글은 132px 에 **5자**까지라 8자가 두 줄이 됐다. 2026-11-01 대표 확정 **2안**이
 * 버튼을 로고 줄로 올려 칸을 **294px** 로 넓히고 기본 글자를 17px 로 내렸다 — 그것만으로
 * 한글 **17자**까지 한 줄이다. 이 파일은 그 **위**를 막는 바닥이다.
 *
 * ## 🔴 측정 기반(`ResizeObserver`)으로 하지 않는 이유
 * 워커가 그리는 서버 첫 화면(`worker/utils/curator-ssr-body.ts`)은 브라우저 측정을 **모른다**.
 * 서버가 17px 로 그린 뒤 마운트 때 15px 로 바뀌면 머리 높이가 바뀌어 **아래가 전부 밀린다**
 * (이 레포가 반복해 당한 클래스). ⇒ **글자만 보고 정하는 순수 함수**를 워커와 화면이
 * **같이 쓴다.** 입력이 같으면 답이 같으므로 두 벌이 갈릴 수가 없다.
 *
 * ## 폭 추정 — 정확할 필요는 없고 **안전한 쪽으로 틀려야** 한다
 * 한글은 거의 정폭(1em)이고 ASCII 는 그 절반쯤이다. 자간 `-0.03em` 을 빼면 글자당 전진폭은
 * 대략 `fontSize × (w − 0.03)`. 실측으로 맞다: `리스터코퍼레이션` 8자 × 24px × 0.97 = **186.2px**,
 * 브라우저 실측 **186px**.
 * ⚠️ ASCII 폭(0.56)은 평균이라 `WWW` 같은 넓은 글자는 과소 추정한다. 그래서 `SAFETY` 로
 * 칸을 조금 좁게 본다 — **한 단계 일찍 줄이는 쪽**이 두 줄이 되는 것보다 낫다.
 *
 * ## 못 하는 것
 * - 실제 글꼴의 커닝·합자 — 폰트가 바뀌면 추정이 틀어진다(그때도 안전 쪽으로 틀리게 설계).
 * - 바닥(`USHOP_NAME_MIN_PX`)보다 긴 이름 — 그건 글자 크기로 못 풀고 **말줄임**이 받는다
 *   (`truncate`). "아무리 길어도 1줄" 은 그 둘이 합쳐야 지켜진다.
 */

/** 타입 스케일 ⑧ 안의 값만 쓴다(12·13·15·17·24). 큰 것부터. */
export const USHOP_NAME_SIZES = [17, 15] as const
export type UShopNameSize = (typeof USHOP_NAME_SIZES)[number]

/** 가장 작은 단계 — 이보다 길면 글자를 더 줄이지 않고 말줄임이 받는다. */
export const USHOP_NAME_MIN_PX: UShopNameSize = USHOP_NAME_SIZES[USHOP_NAME_SIZES.length - 1]

/**
 * 폰(390px)에서 이름 칸의 폭 — `390 − 40(px-5 양쪽) − 40(얼굴) − 16(gap-4)`.
 * 2026-11-01 확정 2안 기준이고, 머리 마크업을 바꾸면 **이 값도 같이 바꾼다**
 * (테스트가 `CuratorHeader` 소스의 얼굴 크기·여백과 대조한다).
 */
export const USHOP_NAME_BOX_PX = 294

/** 칸을 조금 좁게 본다 — 추정이 틀릴 때 **두 줄이 되는 쪽이 아니라 작아지는 쪽**으로 틀리게. */
const SAFETY = 0.94

/** 자간 `-0.03em` — `CuratorHeader` 의 `tracking-[-0.03em]` 과 같아야 한다. */
const TRACKING_EM = 0.03

/** 글자 하나의 전진폭(em). 한글·전각·그 밖은 1.0, ASCII 는 0.56, 공백은 0.3. */
function advanceEm(ch: string): number {
  const c = ch.codePointAt(0) ?? 0
  if (ch === ' ') return 0.3
  // ASCII 인쇄 가능 영역만 좁게 본다. 그 밖(한글·한자·가나·전각·이모지)은 정폭으로.
  if (c >= 0x20 && c <= 0x7e) return 0.56
  return 1
}

/** 이름이 `fontSize` 로 차지하는 가로 폭(px) 추정. */
export function ushopNameWidthPx(name: string, fontSize: number): number {
  let em = 0
  for (const ch of String(name ?? '')) em += Math.max(0, advanceEm(ch) - TRACKING_EM)
  return em * fontSize
}

/**
 * 이름을 **한 줄로** 담을 글자 크기(px). 큰 단계부터 내려가며 칸에 드는 첫 값을 고른다.
 * 어느 단계로도 안 들면 가장 작은 단계를 돌려준다 — 그때는 말줄임(`truncate`)이 받는다.
 *
 * @param boxPx 이름 칸의 폭. 기본값은 폰(390px) 기준.
 */
export function ushopNameSizePx(name: string, boxPx: number = USHOP_NAME_BOX_PX): UShopNameSize {
  const usable = boxPx * SAFETY
  for (const size of USHOP_NAME_SIZES) {
    if (ushopNameWidthPx(name, size) <= usable) return size
  }
  return USHOP_NAME_MIN_PX
}
