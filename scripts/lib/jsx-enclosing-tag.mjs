/**
 * 🔎 JSX 속성 위치에서 **감싸는 여는 태그 이름**을 찾는다. (2026-08-31)
 *
 * ■ 왜 공유 모듈인가
 *   버튼 체계 코드모드(adopt-button-system)와 래칫(check-dashboard-button-system)이
 *   **같은 판정**을 써야 한다. 갈리면 "코드모드는 안 바꿨는데 래칫은 위반이라 한다"가 난다.
 *
 * ■ 왜 단순한 lastIndexOf('<') 로는 안 되나 — 실제로 안 됐다
 *   2026-08-31 되돌려-검증에서 **위반을 주입했는데 초록불**이 떴다. 원인:
 *     <button disabled={submitting || form.items.length < 2}
 *             className="w-full py-3 bg-gray-900 text-white …">
 *   `lastIndexOf('<')` 이 **`< 2` 의 비교 연산자**를 집어 태그 이름 매칭이 실패했고,
 *   그대로 `continue` 라 **버튼이 아닌 것으로 분류**됐다. 즉 래칫이 조용히 헛돌고 있었다.
 *
 * ■ 판정
 *   1) `<` 다음 글자가 알파벳이어야 한다(`< 2` 배제).
 *   2) `<` 앞 글자가 식별자/닫는 괄호가 아니어야 한다(`a<b` 같은 비교 배제).
 *   3) 그 태그와 대상 위치 사이에 **따옴표·중괄호 밖의 `>`** 가 없어야 한다
 *      (있으면 그 태그는 이미 닫혔다 = 감싸는 태그가 아니다). 이게 진짜 판별자다.
 *
 * ⚠️ 못 잡는 것: `x <y` 처럼 공백이 한쪽에만 있는 비교는 여전히 태그 후보로 보인다
 *    (이름이 버튼류가 아니라 결과적으로 '버튼 아님' 이 되므로 안전한 쪽으로 틀린다).
 */

/** seg 안에 따옴표·중괄호 밖의 `>` 가 있는가 = 그 태그가 이미 닫혔는가. */
function closedBefore(seg) {
  let q = null, brace = 0
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i], prev = seg[i - 1]
    if (q) { if (c === q && prev !== '\\') q = null; continue }
    if (c === '"' || c === "'" || c === '`') { q = c; continue }
    if (c === '{') brace++
    else if (c === '}') brace--
    else if (c === '>' && brace <= 0 && prev !== '=' && prev !== '-') return true
  }
  return false
}

export function enclosingTagName(src, at, window = 800) {
  const from = Math.max(0, at - window)
  const win = src.slice(from, at)
  const opens = []
  for (let i = 0; i < win.length; i++) {
    if (win[i] !== '<') continue
    if (!/[A-Za-z]/.test(win[i + 1] || '')) continue          // (1)
    if (/[A-Za-z0-9_$)\]]/.test(win[i - 1] || ' ')) continue  // (2)
    opens.push(i)
  }
  for (let k = opens.length - 1; k >= 0; k--) {
    if (closedBefore(win.slice(opens[k] + 1))) continue        // (3)
    return win.slice(opens[k] + 1).match(/^([A-Za-z][\w.]*)/)?.[1] || ''
  }
  return ''
}

/** 실제로 누를 수 있는 요소인가. */
export const BUTTONISH = /^(button|a|Link|NavLink|Button)$/
