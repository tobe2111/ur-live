/**
 * 🔬 CLS 원인 표본(2026-10-20) — **무엇이** 밀렸는지를 실사용 표본으로 남긴다.
 *
 * 왜: 실사용 SLO 가 홈 CLS p75 **0.20**(직전 7일 0.03)을 경보했는데, 실험실(폰·PC·태블릿 × 위치 有/無 ×
 *   스크롤 × 느린 4G)에서 **한 번도 재현되지 않았다**(전부 0.000~0.015). 저장하는 것이 숫자 하나라
 *   어느 요소가 움직였는지 알 길이 없었다 — 2026-10-19 LCP 쪼개기와 같은 처방이다: 추측으로 고치지 말고
 *   실사용 표본에서 원인을 본다.
 *
 * 수집(`web-vitals-report`) · 검증(`analytics.routes`) · 경보(`cron/vitals-slo`)가 이 파일 하나를 쓴다.
 */

/** 이 값(×1000 정수) 이상인 CLS 표본만 원인을 남긴다 — KV 쓰기를 아끼고, 0.0x 표본의 원인은 볼 필요가 없다. */
export const CLS_SOURCE_MIN = 50

const MAX_LEN = 180
/** 원인 문자열에 허용하는 글자 — 화면 글자(사용자 데이터)는 아예 담지 않는다. */
const SAFE = /^[A-Za-z0-9#.:_\-/| ()[\]!→]+$/

interface RectLike { y: number; height: number; width?: number }
interface SourceLike { node?: Node | null; previousRect: RectLike; currentRect: RectLike }

/** 요소 → `tag#id.cls1.cls2` (화면 글자 없음 · 클래스 앞 둘만). */
export function describeNode(node: Node | null | undefined): string {
  if (!node || node.nodeType !== 1) return '?'
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const raw = typeof el.className === 'string' ? el.className : (el.getAttribute?.('class') || '')
  const cls = raw.split(/\s+/).filter((c) => c && /^[A-Za-z0-9_:\-/[\]!.]+$/.test(c)).slice(0, 2)
  return `${tag}${id}${cls.length ? '.' + cls.join('.') : ''}`
}

/**
 * 가장 큰 밀림 한 건 → 원인 문자열.
 *   `div.ur-home-panel.flex|y1090→0|h90→0|t1980|w390`
 *   y·h 는 그 요소의 이전/현재 위치·높이(px), t 는 밀림 시각(ms), w 는 화면 폭.
 *   🔬 2026-10-24: 뒤에 `W이전폭→현재폭`(요소 폭) · `s스크롤`(그때 scrollY)을 덧붙인다 — 유일한 실사용 표본
 *   (`a.block.group|y114→0|h248→243|t6891|w1920`)이 **폭이 줄어 높이가 바뀐 것**(스크롤바 등장)인지
 *   **위가 접혀 올라간 것**인지 이 둘 없이는 가를 수 없었다(실험실은 어느 조건에서도 재현 0).
 */
export function clsSourceString(sources: SourceLike[] | undefined, startTime: number, viewportWidth: number, scrollY?: number): string {
  const s = (sources || []).find((x) => x?.node && x.node.nodeType === 1) || (sources || [])[0]
  if (!s) return ''
  const r = (n: number) => Math.round(Number.isFinite(n) ? n : 0)
  const out = `${describeNode(s.node)}|y${r(s.previousRect.y)}→${r(s.currentRect.y)}|h${r(s.previousRect.height)}→${r(s.currentRect.height)}|t${r(startTime)}|w${r(viewportWidth)}`
    + (typeof s.previousRect.width === 'number' && typeof s.currentRect.width === 'number' ? `|W${r(s.previousRect.width)}→${r(s.currentRect.width)}` : '')
    + (typeof scrollY === 'number' ? `|s${r(scrollY)}` : '')
  return sanitizeClsSource(out)
}

/** 서버가 받는 쪽 — 길이·글자 검증. 통과 못 하면 ''(표본 자체는 받는다). */
export function sanitizeClsSource(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const s = raw.slice(0, MAX_LEN)
  return s && SAFE.test(s) ? s : ''
}

/** 원인 표본 묶음 → 자주 나온 요소 순(위치·시각을 뺀 요소 이름으로 묶는다). */
export function topClsSources(rows: string[], n = 3): Array<{ el: string; count: number; example: string }> {
  const m = new Map<string, { count: number; example: string }>()
  for (const row of rows) {
    if (typeof row !== 'string' || !row) continue
    const el = row.split('|')[0]
    const cur = m.get(el)
    if (cur) cur.count++
    else m.set(el, { count: 1, example: row })
  }
  return [...m.entries()].map(([el, v]) => ({ el, ...v })).sort((a, b) => b.count - a.count).slice(0, n)
}

/** 경보 한 줄 — "↳ 무엇이 밀렸나: div.ur-home-panel ×6 (y1090→0 …) · …" */
export function describeClsSources(rows: string[]): string {
  const top = topClsSources(rows)
  if (!top.length) return ''
  const total = rows.filter((r) => typeof r === 'string' && r).length
  return `  ↳ 무엇이 밀렸나(표본 ${total}): ` + top.map((t) => `${t.el} ×${t.count} [${t.example.split('|').slice(1).join(' ')}]`).join(' · ')
}
