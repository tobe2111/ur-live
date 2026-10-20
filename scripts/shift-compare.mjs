/**
 * 📐 두 스냅의 글자 위치를 대조한다 — `visual-preview.mjs --shift` 의 판정 몸통(순수 함수, 시험 가능).
 *
 * 스냅: `{ pos: { [글자]: number[] /* 문서 순서의 y 전부 *\/ }, vh }`
 *
 * 🩸 2026-10-14 — 예전엔 글자마다 **첫 번째 위치만** 담았다. 교환권 화면은 로딩 중엔 "교환권" 이 하단 탭
 *   하나뿐이고, 다 그리면 맨 위 제목도 "교환권" 이다. 첫 번째끼리 대조하니 탭 라벨이 제목 자리로 812px
 *   "올라간" 것으로 읽혀 **밀림이 없는데 빨간불**이 났다(PR #1784 CI).
 *   ⇒ 같은 글자의 위치를 전부 모으고, **두 스냅에서 개수가 같을 때만** 순서대로 짝짓는다.
 *   ⚠️ 잃는 것: 같은 글자가 하나 더 생기면서 **동시에** 기존 것이 밀린 경우는 못 본다.
 */
export function compareSnaps(a, b, threshold = 8) {
  const fold = a.vh || 0
  const moved = [], gone = [], born = []
  let movedVisible = 0
  for (const [k, ys] of Object.entries(a.pos)) {
    if (!(k in b.pos)) { gone.push(k); continue }
    const ys2 = b.pos[k]
    if (ys.length !== ys2.length) continue
    for (let i = 0; i < ys.length; i++) {
      const y = ys[i], d = ys2[i] - y
      if (Math.abs(d) > threshold) {
        const vis = y < fold
        if (vis) movedVisible++
        moved.push(`${vis ? '👁️ ' : '   '}${k} ${y}→${ys2[i]} (${d > 0 ? '+' : ''}${d})`)
      }
    }
  }
  for (const k of Object.keys(b.pos)) if (!(k in a.pos)) born.push(k)
  return { moved, gone, born, movedVisible }
}
