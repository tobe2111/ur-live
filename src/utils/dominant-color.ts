/**
 * 카드 이미지 도미넌트 컬러 — 클라이언트 lazy 백필.
 *
 * 동작:
 *   1. 카드 이미지 onLoad 시 extractDominantColor() 로 1x1 canvas 평균색 추출.
 *   2. DB 의 dominant_color 가 null 인 상품만 reportDominantColor() 로 서버 전송.
 *   3. 서버는 dominant_color IS NULL 일 때만 UPDATE (first-write-wins).
 *
 * 비용 0: 서버 이미지 디코딩/cf-image 사용 없음. 실제 트래픽에 자연 분산.
 * 보안: 서버가 hex 형식 검증 + null 일 때만 set → 값 변조 영향 = placeholder 색 1회뿐.
 *
 * CORS: cfImage 출력은 거의 same-origin (/cdn-cgi, /api/image/resize) → canvas tainted 안 됨.
 *       외부 원본 fallback 은 tainted → getImageData throw → catch 후 skip.
 */

export function extractDominantColor(img: HTMLImageElement): string | null {
  try {
    if (!img.naturalWidth || !img.naturalHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    if (d[3] === 0) return null // 완전 투명 → skip
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${hex(d[0])}${hex(d[1])}${hex(d[2])}`
  } catch {
    return null // tainted canvas (cross-origin) 등 → skip
  }
}

const REPORTED_KEY = 'ur_domcolor_reported_v1'
let reportedSet: Set<number> | null = null

function getReported(): Set<number> {
  if (reportedSet) return reportedSet
  try {
    const raw = JSON.parse(localStorage.getItem(REPORTED_KEY) || '[]')
    reportedSet = new Set(Array.isArray(raw) ? raw : [])
  } catch {
    reportedSet = new Set()
  }
  return reportedSet
}

function persistReported() {
  if (!reportedSet) return
  try {
    // 최근 2000개만 유지 (localStorage 무한 증가 방지).
    localStorage.setItem(REPORTED_KEY, JSON.stringify([...reportedSet].slice(-2000)))
  } catch {
    /* quota 초과 등 무시 */
  }
}

let queue: { id: number; color: string }[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flush() {
  flushTimer = null
  if (queue.length === 0) return
  const items = queue.splice(0, 50)
  fetch('/api/products/dominant-color', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
    keepalive: true,
  }).catch(() => {})
  if (queue.length > 0 && !flushTimer) flushTimer = setTimeout(flush, 1500)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
}

/**
 * 도미넌트 컬러 서버 보고 (이 브라우저에서 상품당 1회).
 * @param id 상품 id
 * @param color "#RRGGBB"
 */
export function reportDominantColor(id: number, color: string): void {
  if (!Number.isInteger(id) || id <= 0) return
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
  const reported = getReported()
  if (reported.has(id)) return
  reported.add(id)
  persistReported()
  queue.push({ id, color })
  if (!flushTimer) flushTimer = setTimeout(flush, 1500)
}
