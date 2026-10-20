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
 * ## 🩸 2026-10-14 — 문자열·템플릿·정규식을 추적하지 않아 코드를 먹고 있었다
 * 여기 오래 *"⚠️ 이것이 못 하는 것: 문자열 리터럴 안의 `//`·`/*` 를 추적하지 않는다"* 고 적혀
 * 있었다. **한계를 적어 둔 것과 그 폭발 반경을 잰 것은 다른 일이고, 아무도 재지 않았다.**
 * 실측: `app.use('/api/*', m());` 한 줄이 그 `/*` 를 블록주석 시작으로 읽어 **다음 닫는 기호까지
 * 코드를 통째로** 지웠다(단일·이중·백틱 전부). `src/worker/index.ts:832` 의
 * `const bt = '유어딜 블로그 — …'` 가 그렇게 증발했고, 증발한 구간은 검사에서 사라지므로
 * `not.toContain(...)` 류 단언이 **빨간불이 아니라 초록불**이 된다.
 *
 * 🔑 **정답 구현이 같은 레포에 이미 있었다** — `src/tests/helpers/source-text.ts` 가 2026-08-27 에
 * 스캐너로 교체되며 문자열·템플릿·정규식을 추적한다. 즉 **승인된 제거기가 둘인데 정확도가 달랐다.**
 * 이 파일을 그 스캐너와 같은 판정으로 맞췄다(규칙을 맞춘 것이고 세 번째 사본이 아니다 —
 * `.mjs` 는 그 TS 를 import 할 수 없다). 두 벌이 다시 갈리지 않게
 * `src/tests/unit/comment-stripper-parity-2026-10-14.test.ts` 가 **같은 입력에 같은 판정**인지 잠근다.
 *
 * 📏 **수리로 되찾은 것(실측)**: `check-ghost-classes` 가 보는 소스 토큰 **189,948 → 190,407**
 *   (+459). 그 구간에 숨은 유령 클래스는 검사에서 아예 빠져 있었다.
 *   ⚠️ 반대로 `check-anti-slop-copy` 의 R1 범위(27파일)에서는 **실측 영향 0** 이었다 —
 *   그 파일들에는 *실행되는 코드* 자리에 `/*` 를 담은 문자열이 없다(트리거로 보였던 두 곳은
 *   주석 안이었다). 즉 이 수리의 값은 "지금 숨은 위반을 드러내는 것" 이 아니라
 *   **"가드가 보는 범위를 되찾고 두 제거기의 판정을 하나로 묶는 것"** 이다.
 *
 * ⚠️ **여전히 못 하는 것**: 정규식 판정은 휴리스틱이다(앞 토큰이 연산자면 정규식). 실패 시에도
 *   *덜 지우는* 쪽으로 기운다 — 주석이 남는 것은 오탐을 만들지만 코드가 사라지는 것은 **초록불**을
 *   만들기 때문에, 애매하면 안 지우는 쪽을 고른다.
 */

/**
 * 여는 기호가 **같은 줄에서** 닫히는가. 문자열·정규식 오판을 한 줄로 가둬 두는 안전판이다 —
 * 오판해도 "덜 지우는" 쪽이면 주석이 남을 뿐이지만, "더 지우는" 쪽이면 **코드가 증발하고 가드가
 * 초록**이 된다(이 파일 머리말의 2026-10-14 사고). `source-text.ts` 의 같은 이름 함수와 쌍이다.
 */
function hasCloserOnLine(src, from, closer) {
  for (let j = from + 1; j < src.length; j++) {
    if (src[j] === '\n') return false
    if (src[j] === '\\') { j++; continue }
    if (src[j] === closer) return true
  }
  return false
}

/** 주석을 **문자 단위로** 걷어내 `[줄번호, 코드]` 쌍으로 돌려준다(빈 줄은 유지 — 줄번호 보존). */
export function stripCommentsLines(src) {
  const out = []
  let i = 0, line = 1, mode = 'code', buf = ''
  let prev = ''            // 직전의 의미 있는 문자(정규식 판정용)
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
      // 🆕 2026-10-14 문자열·템플릿 — 주석 분기보다 **뒤에 있어도** 되는 이유는 스캐너가
      //   문자 단위라 여는 따옴표에 먼저 도달하기 때문이다(그 안의 `/*` 에는 도달하지 않는다).
      if (c === '"' || c === "'" || c === '`') {
        // 🩸 따옴표가 그 줄에서 안 닫히면 문자열이 아니다 — JSX 본문의 아포스트로피
        //   (`don't`·`대표's`)가 그 경우다. 백틱만 여러 줄이 정상이다.
        if (c !== '`' && !hasCloserOnLine(src, i, c)) { buf += c; prev = c; i++; continue }
        buf += c; i++
        while (i < src.length) {
          const d = src[i]
          if (d === '\\') {
            // 줄바꿈 이스케이프도 줄을 넘긴다 — 안 세면 뒤 줄의 줄번호가 전부 밀린다.
            if (src[i + 1] === '\n') { buf += d; flush(); line++; i += 2; continue }
            buf += d + (src[i + 1] ?? ''); i += 2; continue
          }
          if (d === '\n') { flush(); line++; i++; continue }   // 백틱 여러 줄
          buf += d; i++
          if (d === c) break
        }
        prev = c; continue
      }
      // 🆕 2026-10-14 정규식 리터럴 — `prev === '<'` 은 **JSX 닫는 태그**(`</div>`)다.
      //   그걸 정규식 시작으로 읽으면 다음 `/` 까지(= 파일 대부분) 삼킨다.
      if (c === '/' && prev !== '<' && /[(,=:[!&|?{};+\-*%^~<>]/.test(prev) && hasCloserOnLine(src, i, '/')) {
        buf += c; i++
        let inClass = false
        while (i < src.length) {
          const d = src[i]
          if (d === '\\') { buf += d + (src[i + 1] ?? ''); i += 2; continue }
          if (d === '\n') { flush(); line++; i++; continue }
          if (d === '[') inClass = true
          else if (d === ']') inClass = false
          buf += d; i++
          if (d === '/' && !inClass) break
        }
        prev = '/'; continue
      }
      buf += c
      if (!/\s/.test(c)) prev = c
      i++; continue
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
