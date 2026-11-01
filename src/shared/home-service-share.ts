/**
 * 🔗 생활 요청 공유 페이지(`/life/q/:token`) — 공개해도 되는 값만 고르는 SSOT (2026-10-25 대표).
 *
 * 대표: "다른 커뮤니티에 어떤 수요 건이 있다 라고 해서 그 수요건 페이지를 또 공유할 수 있어야하고, 견적에 참여하는 형태로"
 *       · "이름, 연락처, 상세 주소는 마스킹 처리해줘" · (검색 노출) "노출해줘".
 * 시안: `docs/design/life-request-share.md`.
 *
 * 🔒 이 함수 밖으로 나가는 것은 **고르는 칸(select·multi·숫자·날짜)과 동 단위 지역**뿐이다.
 *   - 메모(textarea·text)는 손님이 가게 이름을 적으라는 칸이라 안 내보낸다 — 장수만 센다.
 *   - 사진은 장수만 — 가입한 업체는 요청함에서 본다.
 *   - 연락처·상세 주소는 **값을 아예 받지 않는다**(가린 모양만 만든다). 이름은 SQL 이 첫 글자만 잘라 넘긴다.
 *     원본이 이 함수에 들어오지 않으면 샐 수 없다.
 * 서버(공개 API)와 워커(검색 메타)가 이 함수 하나를 쓴다 — 두 벌이면 한쪽만 새 칸을 가린다.
 */
import { categoryDef, type HomeServiceCategory } from './home-service-categories'

export const SHARE_TOKEN_LENGTH = 12
const TOKEN_RE = /^[A-Za-z0-9]{12}$/

export function isShareToken(t: unknown): t is string {
  return typeof t === 'string' && TOKEN_RE.test(t)
}

/** 추측할 수 없는 토큰(62^12 ≈ 3.2×10^21) — 번호(id)를 쓰면 다른 요청을 차례로 훑을 수 있다. */
export function newShareToken(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  while (out.length < SHARE_TOKEN_LENGTH) {
    for (const b of rand(16)) {
      if (b < 248) out += A[b % 62] // 248 = 62×4 — 나머지 편향 없이
      if (out.length === SHARE_TOKEN_LENGTH) break
    }
  }
  return out
}

export interface ShareRow {
  category: string
  details: Record<string, string>
  status: string
  quote_count: number
  max_quotes: number
  created_at: string
  /** 이름은 **첫 글자만** 받는다(시안 `김**`). 나머지는 이 함수에 들어오지 않는다. */
  name_initial?: string | null
}

export interface ShareView {
  category: HomeServiceCategory
  label: string
  title: string
  region: string
  dong: string
  date: string | null
  open: boolean
  status: string
  seatsLeft: number
  maxQuotes: number
  quoteCount: number
  rows: { label: string; value: string }[]
  photoCount: number
  hasMemo: boolean
  masked: { name: string; phone: string; address: string }
  createdAt: string
}

/** 동 단위 지역 글에서 마지막 낱말(망원동). 없으면 시·구. */
function dongOf(region: string): string {
  const t = region.trim().split(/\s+/).filter(Boolean)
  return t[t.length - 1] || ''
}

export function shareTitle(label: string, dong: string, biz?: string): string {
  return [dong, biz, label].filter(Boolean).join(' ') + ' 견적 요청'
}

export function publicShareView(r: ShareRow): ShareView | null {
  const def = categoryDef(r.category)
  if (!def) return null
  const d = r.details || {}
  const regionKey = def.regionFields[0]
  const region = (d[regionKey] || '').split(/\s+/).slice(0, 3).join(' ')
  const dong = dongOf(region)
  const rows: ShareView['rows'] = []
  let photoCount = 0
  let hasMemo = false
  for (const f of def.fields) {
    const v = d[f.key]
    if (!v) continue
    if (f.type === 'photos') { photoCount = v.split(',').filter(Boolean).length; continue }
    if (f.type === 'textarea' || f.type === 'text') { hasMemo = true; continue }
    if (f.type === 'region') {
      if (f.key !== regionKey) rows.push({ label: f.label, value: v.split(/\s+/).slice(0, 3).join(' ') })
      continue
    }
    if (f.type === 'date') continue
    rows.push({ label: f.label, value: f.unit ? `${v} ${f.unit}` : v })
  }
  const open = r.status === 'open' && r.quote_count < r.max_quotes
  return {
    category: def.key,
    label: def.label,
    title: shareTitle(def.label, dong, d.biz),
    region,
    dong,
    date: d[def.dateField] || null,
    open,
    status: r.status,
    seatsLeft: Math.max(0, r.max_quotes - r.quote_count),
    maxQuotes: r.max_quotes,
    quoteCount: r.quote_count,
    rows,
    photoCount,
    hasMemo,
    masked: { name: `${(r.name_initial || '').trim().slice(0, 1) || '손님'}**`, phone: '010-****-****', address: `${dong || '-'} *** ***` },
    createdAt: r.created_at,
  }
}

/** 검색·카톡 카드 설명 한 줄 — 화면 글과 같은 값으로. */
export function shareDescription(v: ShareView): string {
  const head = v.rows.slice(0, 3).map((r) => r.value).join(' · ')
  const seat = v.open ? `남은 견적 자리 ${v.seatsLeft}/${v.maxQuotes}` : '마감된 요청'
  return `${v.region} · ${head ? head + ' · ' : ''}${seat}. 유어딜에 가입한 업체가 견적을 보내요.`
}
