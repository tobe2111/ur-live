/**
 * 🔧 `.mjs` 가드용 **주석 제거기 SSOT** (2026-10-13 추출 — `check-anti-slop-copy.mjs` 에서 옮김)
 *
 * ## 왜 공용인가
 * 이 레포는 "소스를 문자열로 읽어 판정" 하는 가드가 많고, 그때마다 **자기 주석 제거기를 새로 쓰다
 * 다섯 번 넘어졌다**(`check-comment-stripper.mjs` 가 그 래칫이다). 순진한
 * `/\/\*[\s\S]*?\*\//g` 는 문자열·정규식 리터럴 안의 `/`+`*` 를 주석 시작으로 읽어 파일의
 * 74~81% 를 먹는다 — 그리고 증발한 구간은 검사에서 사라지므로 **빨간불이 아니라 초록불**이 된다.
 *
 * 테스트(`.ts`)의 SSOT 는 `src/tests/helpers/source-text.ts` 지만 `.mjs` 는 그 TS 를 import 할 수
 * 없다. 그래서 `.mjs` 쪽 SSOT 를 여기 하나만 둔다 — **세 번째 사본을 만들지 말 것.**
 *
 * ## 왜 상태 기계인가 (줄 접두사 판정으로 돌아가지 말 것)
 * 첫 판은 *"줄이 `*`·`//`·`{/*` 로 시작하면 주석"* 이었는데, 이 레포는 여러 줄 JSX
 * 주석(`{/* … 여러 줄 … *\/}`)을 정식으로 쓰고 그 **중간 줄은 아무 접두사가 없다.**
 * 그래서 em-dash 가 635건으로 잡혔고(거의 전부 주석), 그 값을 래칫으로 삼으면 **진짜 문구에 생긴
 * 회귀를 635건 사이에 숨겨 놓게 된다.**
 *
 * ⚠️ **이것이 못 하는 것**: 문자열 리터럴 안의 `//`·`/*` 를 추적하지 않는다(토크나이저가 아니다).
 *   URL 문자열(`'https://…'`)의 `//` 가 주석으로 먹혀 그 줄의 뒷부분이 사라질 수 있다 —
 *   *덜 지우는* 쪽이 아니라 *더 지우는* 쪽 오류라, 이걸로 "없음" 을 단언하는 가드는 안전하지만
 *   "있음" 을 단언하는 가드는 앵커가 URL 뒤에 있지 않은지 확인할 것.
 */

/** 주석을 **문자 단위로** 걷어내 `[줄번호, 코드]` 쌍으로 돌려준다(빈 줄은 유지 — 줄번호 보존). */
export function stripCommentsLines(src) {
  const out = []
  let i = 0, line = 1, mode = 'code', buf = ''
  const flush = () => { out.push([line, buf]); buf = '' }
  while (i < src.length) {
    const c = src[i], c2 = src.slice(i, i + 2), c3 = src.slice(i, i + 3)
    if (c === '\n') { flush(); line++; i++; continue }
    if (mode === 'code') {
      // ⚠️ 이 분기는 자기검사가 **독립적으로 못 지킨다**: 지워도 바로 아래 `/*` 분기가
      //    같은 주석을 삼켜서(잔재는 `{}` 뿐) 판정 결과가 같다. 더 정확하니 남기지만,
      //    "되돌려-검증 초록" 을 이 줄의 안전 근거로 삼지 말 것.
      if (c3 === '{/*') { mode = 'jsx'; i += 3; continue }
      if (c2 === '/*') { mode = 'block'; i += 2; continue }
      if (c2 === '//') { while (i < src.length && src[i] !== '\n') i++; continue }
      buf += c; i++; continue
    }
    if (mode === 'jsx') { if (c3 === '*/}') { mode = 'code'; i += 3; continue } i++; continue }
    if (c2 === '*/') { mode = 'code'; i += 2; continue }
    i++
  }
  flush()
  return out
}

/** 줄번호가 필요 없을 때 — 주석을 걷어낸 코드만(줄 수·줄번호는 보존된다). */
export function stripComments(src) {
  return stripCommentsLines(src).map(([, t]) => t).join('\n')
}
