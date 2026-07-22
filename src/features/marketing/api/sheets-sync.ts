/**
 * 📊 2026-07-21 유어애즈 — 인플루언서 풀 → 구글 스프레드시트 자동 동기화.
 *   구글 **서비스 계정**(같은 GCP 프로젝트) JWT 로 Sheets API 직접 호출 — 제3자 서비스/수동 업로드 없음.
 *   전량 미러(clear → 전체 재기록) = 멱등·드리프트 0. 매시간 cron(ur-ads) + 어드민 수동 버튼.
 *
 *   설정(전부 ur-ads 워커 Variables — 미설정 시 조용히 skip, fail-soft):
 *     GSHEETS_SA_EMAIL  = 서비스계정 이메일(...@...iam.gserviceaccount.com)
 *     GSHEETS_SA_KEY    = 서비스계정 JSON 의 private_key 값(BEGIN PRIVATE KEY PEM, \n 이스케이프 허용)
 *     GSHEETS_SHEET_ID  = 대상 스프레드시트 ID(URL 의 /d/{이것}/edit) — 시트를 SA 이메일에 편집자 공유 필수
 *     ADS_SHEETS_SYNC_ENABLED = 'true' 면 매시간 cron 동기화(수동 버튼은 게이트 무관)
 */
import type { Env } from '@/worker/types/env'

const TAB = 'pool' // 대상 탭 이름(없으면 자동 생성) — 이름 변경 시 동기화 끊김(변경 금지)
const PAGE = 5000  // D1 페이지 크기
const CHUNK = 2000 // Sheets 1회 기록 행수

// ── base64url (JWT 용, 순수 — 테스트 가능) ──────────────────────────────────
export function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** PEM(BEGIN PRIVATE KEY) → CryptoKey. secret 붙여넣기의 리터럴 \n 도 허용. */
async function importPrivateKey(pemRaw: string): Promise<CryptoKey> {
  const pem = pemRaw.replace(/\\n/g, '\n')
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der.buffer as ArrayBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

// 액세스 토큰 캐시(isolate 수명 동안) — 시트 6~8콜에 토큰 1회.
let _tok: { token: string; exp: number } | null = null

async function getToken(env: Env): Promise<string | null> {
  if (!env.GSHEETS_SA_EMAIL || !env.GSHEETS_SA_KEY) return null
  const now = Math.floor(Date.now() / 1000)
  if (_tok && _tok.exp - 120 > now) return _tok.token
  try {
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = b64url(JSON.stringify({
      iss: env.GSHEETS_SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    }))
    const key = await importPrivateKey(env.GSHEETS_SA_KEY)
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
    const jwt = `${header}.${claims}.${b64url(new Uint8Array(sig))}`
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
    })
    if (!r.ok) return null
    const j = await r.json() as { access_token?: string; expires_in?: number }
    if (!j.access_token) return null
    _tok = { token: j.access_token, exp: now + (j.expires_in || 3600) }
    return _tok.token
  } catch { return null }
}

// ── 행 매핑(순수 — 테스트 가능): 헤더와 leadToRow 는 항상 같은 순서 유지 ──────
export const SHEET_HEADER = ['ID', '플랫폼', '이름', '핸들', 'URL', '구독자수', '평균조회수', '평균댓글', '月포스팅', '이메일', '인스타', '틱톡', '기타링크(유튜브·블로그·링크인바이오)', '카테고리', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일'] as const
export interface SheetLead {
  id: number; platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; recent_avg_views: number | null; recent_avg_comments: number | null; recent_posts_30d: number | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  category: string | null; source_keyword: string | null; status: string; contact_channel: string | null
  contacted_at: string | null; follow_up_at: string | null; source: string | null; consented_at: string | null
  memo: string | null; collected_at: string
}
export function leadToRow(l: SheetLead): (string | number)[] {
  return [l.id, l.platform, l.name, l.handle || '', l.url, l.subscriber_count || 0, l.recent_avg_views ?? '', l.recent_avg_comments ?? '', l.recent_posts_30d ?? '', l.email || '', l.instagram || '',
    l.tiktok || '', l.links || '', l.category || '', l.source_keyword || '', l.status, l.contact_channel || '', l.contacted_at || '',
    l.follow_up_at || '', l.source || '', l.consented_at || '', l.memo || '', l.collected_at]
}

async function sheetsFetch(token: string, sheetId: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

/** pool 탭 보장 — 없으면 생성(1회성). */
async function ensureTab(token: string, sheetId: string): Promise<void> {
  const meta = await sheetsFetch(token, sheetId, '?fields=sheets.properties.title').catch(() => null)
  if (!meta?.ok) return
  const j = await meta.json().catch(() => null) as { sheets?: { properties?: { title?: string } }[] } | null
  if (j?.sheets?.some(s => s.properties?.title === TAB)) return
  await sheetsFetch(token, sheetId, ':batchUpdate', {
    method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
  }).catch(() => null)
}

/**
 * 인플루언서 공용 풀 전량 → 시트 미러. 반환 {ok, rows} — 실패는 error 문자열(fail-soft, 절대 throw 안 함).
 */
export async function syncInfluencerPoolToSheets(env: Env): Promise<{ ok: boolean; rows?: number; error?: string }> {
  if (!env.GSHEETS_SHEET_ID || !env.GSHEETS_SA_EMAIL || !env.GSHEETS_SA_KEY) {
    return { ok: false, error: 'NOT_CONFIGURED: GSHEETS_SA_EMAIL / GSHEETS_SA_KEY / GSHEETS_SHEET_ID (ur-ads Variables)' }
  }
  const token = await getToken(env)
  if (!token) return { ok: false, error: 'AUTH: 서비스계정 토큰 발급 실패 — SA 키/이메일 확인' }
  const sheetId = env.GSHEETS_SHEET_ID
  await ensureTab(token, sheetId)

  // D1 페이지 읽기(전량) — 공용 풀만(account_id=0).
  const rows: (string | number)[][] = [[...SHEET_HEADER]]
  for (let off = 0; ; off += PAGE) {
    const page = (await env.DB.prepare(`SELECT id, platform, name, handle, url, subscriber_count, recent_avg_views, recent_avg_comments, recent_posts_30d, email, instagram, tiktok, links,
        category, source_keyword, status, contact_channel, contacted_at, follow_up_at, source, consented_at, memo, collected_at
      FROM ad_influencer_leads WHERE account_id = 0 ORDER BY id ASC LIMIT ? OFFSET ?`)
      .bind(PAGE, off).all<SheetLead>().catch(() => null))?.results || []
    for (const l of page) rows.push(leadToRow(l))
    if (page.length < PAGE) break
  }

  // clear → 청크 기록(멱등 미러). RAW 입력(수식 해석 없음 — 시트측 수식 인젝션 원천 차단).
  const clear = await sheetsFetch(token, sheetId, `/values/${TAB}:clear`, { method: 'POST', body: '{}' }).catch(() => null)
  if (!clear?.ok) return { ok: false, error: `CLEAR: 시트 접근 실패(${clear?.status || 'net'}) — 시트를 SA 이메일에 편집자 공유했는지 확인` }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const range = `${TAB}!A${i + 1}`
    const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values: chunk }),
    }).catch(() => null)
    if (!w?.ok) return { ok: false, error: `WRITE: ${i + 1}행부터 기록 실패(${w?.status || 'net'})`, rows: i }
  }
  return { ok: true, rows: rows.length - 1 }
}
