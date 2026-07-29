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
import { ensureQualityColumns } from './influencer-quality'
import { ensurePerfExtraColumns } from './influencer-performance'
import { ensureOutreachColumns } from './outreach-webhook'

const TAB = 'pool' // 대상 탭 이름(없으면 자동 생성) — 이름 변경 시 동기화 끊김(변경 금지)
/**
 * 🧮 2026-07-28 무음 정지 근본수리 — 페이지/청크 크기는 **서브리퀘스트 예산 문제**다.
 *
 *   실사고: 시트 미러가 07-27 06:49 이후 **34시간 정지**했는데 스탬프는 `ok:true` 인 옛 값 그대로라
 *   화면에도 경보에도 아무 신호가 없었다. 원인은 이 함수가 **풀 크기에 선형으로** 서브리퀘스트를 쓴다는 것:
 *     D1 페이지 ⌈N/PAGE⌉ + 시트 PUT ⌈N/CHUNK⌉ + DDL + 토큰/메타/clear/스탬프.
 *   구 상수(5000/2000)로 33,730명일 때 38, 37,414명일 때 **41** — 무료 플랜 인보케이션 한도(≈50, D1 포함)에
 *   풀 성장만으로 닿는다. 넘으면 예외 → **스탬프 기록도 못 하고 죽는다**(그래서 옛 ok:true 가 남았다).
 *
 *   ⇒ ① 한 번에 더 많이 읽고/쓴다(요청 수를 1/4로) ② 예외를 잡아 **crash 를 스탬프에 남긴다**
 *     ③ 이번 회차가 쓴 요청 수를 스탬프에 적어, 다시 임계에 닿기 **전에** 화면에서 보이게 한다.
 *   크기 상한 근거: Sheets values.update 는 요청 본문 크기가 실질 한계 — 8,000행 × 30열 ≈ 5MB 로 안전권.
 *   D1 은 10,000행 × 30열 페이지가 결과 크기 한계 안(실측 페이지 8→4).
 */
const PAGE = 10_000 // D1 페이지 크기
const CHUNK = 8_000 // Sheets 1회 기록 행수

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
//   2026-07-27 엑셀 다운로드(influencer-pool-export)와 "같은 열 세계"로 확장 — 🏅점수·롱폼중앙값·쇼츠%·
//   마지막글·메일상태·분류근거·브랜드. 시트는 **기계값 미러**(status='new' 등 raw — 필터/재활용용,
//   한국어 라벨은 엑셀 다운로드 담당).
export const SHEET_HEADER = ['ID', '플랫폼', '이름', '핸들', 'URL', '점수', '구독자수', '평균조회수', '롱폼중앙값', '쇼츠%', '평균댓글', '月포스팅', '마지막글', '이메일', '메일상태', '인스타', '틱톡', '기타링크(유튜브·블로그·링크인바이오)', '카테고리', '분류근거', '브랜드', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일'] as const
export interface SheetLead {
  id: number; platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; recent_avg_views: number | null; recent_avg_comments: number | null; recent_posts_30d: number | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  category: string | null; source_keyword: string | null; status: string; contact_channel: string | null
  contacted_at: string | null; follow_up_at: string | null; source: string | null; consented_at: string | null
  memo: string | null; collected_at: string
  lead_score?: number | null; median_long_views?: number | null; shorts_ratio?: number | null
  is_brand?: number | null; email_status?: string | null; last_post_at?: string | null; category_source?: string | null
}
export function leadToRow(l: SheetLead): (string | number)[] {
  return [l.id, l.platform, l.name, l.handle || '', l.url, l.lead_score ?? '', l.subscriber_count || 0, l.recent_avg_views ?? '', l.median_long_views ?? '', l.shorts_ratio ?? '', l.recent_avg_comments ?? '', l.recent_posts_30d ?? '', l.last_post_at || '', l.email || '', l.email_status || '', l.instagram || '',
    l.tiktok || '', l.links || '', l.category || '', l.category ? (l.category_source || 'keyword') : '', l.is_brand ? 1 : '', l.source_keyword || '', l.status, l.contact_channel || '', l.contacted_at || '',
    l.follow_up_at || '', l.source || '', l.consented_at || '', l.memo || '', l.collected_at]
}

async function sheetsFetch(token: string, sheetId: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
}

/** pool 탭 보장 + 그리드 크기(행/열)를 데이터 전량에 맞게 확장.
 *  ⚠️ 신규 시트/탭 기본 그리드는 1000행이라 28k행 미러 시 2001행+ 기록이 'exceeds grid limits'(400)로 실패.
 *  → 쓰기 전에 rowCount/columnCount 를 needRows/needCols 이상으로 키운다(작으면만; 이미 크면 no-op). */
async function ensurePoolSheet(token: string, sheetId: string, needRows: number, needCols: number): Promise<void> {
  const meta = await sheetsFetch(token, sheetId, '?fields=sheets.properties(sheetId,title,gridProperties)').catch(() => null)
  if (!meta?.ok) return
  const j = await meta.json().catch(() => null) as { sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] } | null
  const tab = j?.sheets?.find(s => s.properties?.title === TAB)?.properties
  if (!tab) { // 없으면 필요한 크기로 바로 생성
    await sheetsFetch(token, sheetId, ':batchUpdate', {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB, gridProperties: { rowCount: needRows, columnCount: needCols } } } }] }),
    }).catch(() => null)
    return
  }
  const curRows = tab.gridProperties?.rowCount || 0, curCols = tab.gridProperties?.columnCount || 0
  if (curRows >= needRows && curCols >= needCols) return // 이미 충분
  await sheetsFetch(token, sheetId, ':batchUpdate', {
    method: 'POST', body: JSON.stringify({ requests: [{ updateSheetProperties: {
      properties: { sheetId: tab.sheetId, gridProperties: { rowCount: Math.max(curRows, needRows), columnCount: Math.max(curCols, needCols) } },
      fields: 'gridProperties.rowCount,gridProperties.columnCount',
    } }] }),
  }).catch(() => null)
}

/**
 * 인플루언서 공용 풀 전량 → 시트 미러. 반환 {ok, rows} — 실패는 error 문자열(fail-soft, 절대 throw 안 함).
 *   🛡️ 결과를 platform_settings('ads_sheets_last_sync')에 항상 기록 — cron 실패가 무음으로 사라지지 않게(관측성).
 */
export async function syncInfluencerPoolToSheets(env: Env): Promise<{ ok: boolean; rows?: number; error?: string }> {
  // 💥 예외도 **결과로 기록**한다 — 2026-07-28 실사고: `_syncCore` 가 throw 하면(서브리퀘스트 한도 등)
  //   아래 스탬프 쓰기에 도달하지 못해 **옛 `ok:true` 스탬프가 그대로 남아** 34시간 정지가 성공처럼 보였다.
  //   (파트너풀 보강 레인의 `recordEnrichCrash` 와 같은 철학 — 무증거 종료 금지.)
  const cost = { subreq: 0 } // 이번 회차가 쓴 요청 수(추정) — 임계에 닿기 전에 보이게
  let r: { ok: boolean; rows?: number; error?: string }
  try {
    r = await _syncCore(env, cost)
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    r = { ok: false, error: `CRASH ${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }
  }
  await env.DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_sheets_last_sync', JSON.stringify({
      at: new Date().toISOString(), ok: r.ok, rows: r.rows ?? null,
      error: (r.error || '').slice(0, 300) || null, subreq: cost.subreq,
    })).run().catch(() => null)
  return r
}

async function _syncCore(env: Env, cost: { subreq: number }): Promise<{ ok: boolean; rows?: number; error?: string }> {
  if (!env.GSHEETS_SHEET_ID || !env.GSHEETS_SA_EMAIL || !env.GSHEETS_SA_KEY) {
    return { ok: false, error: 'NOT_CONFIGURED: GSHEETS_SA_EMAIL / GSHEETS_SA_KEY / GSHEETS_SHEET_ID (ur-ads Variables)' }
  }
  cost.subreq += 1 // 토큰 발급(캐시 미스 시 1 fetch)
  const token = await getToken(env)
  if (!token) return { ok: false, error: 'AUTH: 서비스계정 토큰 발급 실패 — SA 키/이메일 확인' }
  const sheetId = env.GSHEETS_SHEET_ID
  // 확장 열(점수/성과/메일상태/분류근거) 보장 — 미보강 DB 에서 'no such column' READ 실패 방지.
  await ensureQualityColumns(env.DB); await ensurePerfExtraColumns(env.DB); await ensureOutreachColumns(env.DB)
  cost.subreq += 3 // DDL 3종 — 전부 runDdlOnce(체크섬 1회 조회). 2026-07-28 이전엔 ALTER 10회였다.

  // D1 페이지 읽기(전량) — 공용 풀만(account_id=0).
  //   🛡️ 2026-07-23 전수조사: 페이지 읽기 **실패**(null)를 "마지막 페이지"로 오인하면 그 오프셋 이후 전량 누락된
  //   잘린 미러가 되는데도 "성공 N행"으로 보고됐음 — 실패는 clear **이전**에 즉시 중단(시트 기존 데이터 보존).
  const rows: (string | number)[][] = [[...SHEET_HEADER]]
  for (let off = 0; ; off += PAGE) {
    const res = await env.DB.prepare(`SELECT id, platform, name, handle, url, subscriber_count, recent_avg_views, recent_avg_comments, recent_posts_30d, email, instagram, tiktok, links,
        category, source_keyword, status, contact_channel, contacted_at, follow_up_at, source, consented_at, memo, collected_at,
        lead_score, median_long_views, shorts_ratio, is_brand, email_status, last_post_at, category_source
      FROM ad_influencer_leads WHERE account_id = 0 ORDER BY id ASC LIMIT ? OFFSET ?`)
      .bind(PAGE, off).all<SheetLead>().catch(() => null)
    cost.subreq += 1
    if (!res) return { ok: false, error: `READ: D1 페이지 읽기 실패(offset ${off}) — 잘린 미러 방지 위해 중단(시트 기존 데이터 유지)` }
    const page = res.results || []
    for (const l of page) rows.push(leadToRow(l))
    if (page.length < PAGE) break
  }

  // 탭 보장 + 그리드를 데이터 전량 크기로 확장(1000행 기본 한계 → 2001행+ 400 방지) 후 clear → 청크 기록.
  cost.subreq += 1 // 시트 메타 조회(+ 확장 필요 시 1)
  await ensurePoolSheet(token, sheetId, rows.length + 1, SHEET_HEADER.length)
  // clear → 청크 기록(멱등 미러). RAW 입력(수식 해석 없음 — 시트측 수식 인젝션 원천 차단).
  cost.subreq += 1
  const clear = await sheetsFetch(token, sheetId, `/values/${TAB}:clear`, { method: 'POST', body: '{}' }).catch(() => null)
  if (!clear?.ok) return { ok: false, error: `CLEAR: 시트 접근 실패(${clear?.status || 'net'}) — 시트를 SA 이메일에 편집자 공유했는지 확인` }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const range = `${TAB}!A${i + 1}`
    cost.subreq += 1
    const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values: chunk }),
    }).catch(() => null)
    if (!w?.ok) return { ok: false, error: `WRITE: ${i + 1}행부터 기록 실패(${w?.status || 'net'})`, rows: i }
  }
  return { ok: true, rows: rows.length - 1 }
}
