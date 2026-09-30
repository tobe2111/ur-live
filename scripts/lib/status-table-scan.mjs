/**
 * 🚦 **상태표 판정 — 순수 모듈** (2026-09-29 분리)
 *
 * 왜 스크립트에서 떼어냈나: 판정이 스크립트 안에 있으면 시험이 그 파일을 **문자열로** 읽을 수밖에
 * 없고, 그러면 `if (…) { … } && false` 처럼 **문자열은 남고 행동만 죽는** 변형을 못 잡는다
 * (2026-09-29 에 실제로 그 주입이 헛돌았다). 여기로 옮기면 시험이 **동작을 직접 잰다**.
 */

/** 중화되는(=MONO 로 리맵되는) 색조. `red` 만 살아남으므로 제외한다. */
export const NEUTRALIZED =
  'pink|rose|fuchsia|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple'

export const HUE = new RegExp(`\\b(?:bg|text|border|ring)-(?:${NEUTRALIZED})-\\d{2,3}\\b`)
const LABEL_KEY = /\b(?:label|t|text)\s*:/
const COLOR_KEY = /\b(?:cls|c|color|bg|className)\s*:/

/** 한 객체 리터럴의 최대 길이 — 이보다 길면 상태표가 아니라 컴포넌트 본문이다. */
export const MAX_OBJ = 600

/**
 * 소스에서 `{ … }` 를 **중괄호 균형**으로 뽑는다.
 *
 * 🩸 종전 판정은 `\{[^{}]*label…[^{}]*cls…\}` 였다. `[^{}]` 가 중괄호를 금지하는데
 *    CLAUDE.md 는 **모든 UI 문자열에 `t(키, { defaultValue })` 를 강제**한다 ⇒ 소비자 상태표는
 *    라벨 안에 중괄호가 **항상** 있어서 매칭이 거기서 끊겼다. 즉 가드가 자기가 막으려던 것에
 *    눈을 감고 있었고, `entries: []` 라 초록불로 "0건" 이 떠 있었다.
 */
export function objectLiterals(src) {
  const out = []
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '{') continue
    let depth = 0
    const end = Math.min(src.length, i + MAX_OBJ)
    for (let j = i; j < end; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (depth === 0) { out.push(src.slice(i, j + 1)); i = j; break }
      }
    }
  }
  return out
}

/** 이 소스가 가진 위반 개수 — 라벨 키와 색 키가 한 객체에 있고 그 색이 중화되는 색조일 때. */
export function violations(src) {
  return objectLiterals(src).filter((o) => LABEL_KEY.test(o) && COLOR_KEY.test(o) && HUE.test(o)).length
}

/**
 * 가드 자신이 실패할 수 있는지 확인하는 **대조 픽스처**.
 * 시험이 이것을 그대로 돌려 판정하므로, 여기 한 줄이 죽으면 시험이 빨간불이 된다.
 */
export const FIXTURES = {
  /** 명백한 위반 — 하드코딩 라벨 */
  plain: { src: `const S = { rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' } }`, expect: 1 },
  /** 🩸 2026-09-29 의 눈먼 자리 — 라벨 안의 `t(…, { … })` 중괄호 */
  i18n: { src: `const S = { r: { label: t('a.b', { defaultValue: '반려' }), cls: 'text-rose-600' } }`, expect: 1 },
  /** 규칙대로 — tone 과 기능 빨강은 위반이 아니다 */
  ok: {
    src: `const S = { rejected: { t: '반려', c: 'bg-tone-bad-bg text-tone-bad' }, x: { label: 'x', cls: 'bg-red-50 text-red-700' } }`,
    expect: 0,
  },
}
