/**
 * 📊 2026-07-21 유어애즈 — 인플루언서 풀 → 구글 스프레드시트 자동 동기화.
 *   구글 **서비스 계정**(같은 GCP 프로젝트) JWT 로 Sheets API 직접 호출 — 제3자 서비스/수동 업로드 없음.
 *   **커서 미러**(회차당 ROWS_PER_RUN 행씩, 사이클이 끝나면 꼬리만 clear) = 멱등·드리프트 0.
 *   매시간 cron(ur-ads) + 어드민 수동 버튼.
 *   🩹 2026-08-02: 전량 미러(clear → 전체 재기록)에서 바꿨다. 전량을 한 인보케이션에 담는 구조라
 *      풀이 42k 가 되자 매시간 `Worker exceeded CPU time limit` 으로 죽었다 — 근거는 `ROWS_PER_RUN` 주석.
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
import { adsLeadsDb } from '../../../shared/ads/leads-db'

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
/**
 * 🧱 **한 회차가 미러할 최대 행수** — 전량을 한 인보케이션에 담지 않는다.
 *
 *   ## 왜 (2026-08-02 라이브)
 *   이 레인이 매시간 `Worker exceeded CPU time limit`(ms 29,191)으로 죽고 있었다.
 *   전량을 메모리에 쌓고(`rows.push(leadToRow(l))`) 청크마다 `JSON.stringify` 하는 구조라,
 *   **풀이 커질수록 확실히 더 나빠진다** — 28k행일 땐 됐고 42k행에서 죽었다.
 *   즉 "가끔 실패"가 아니라 **성장에 비례해 영구히 실패**하는 형태다.
 *
 *   ⇒ 회차당 몫을 고정하고 **커서로 이어 붙인다**(이 레포가 재분류·재추출에서 쓰는 그 패턴).
 *   12,000 이면 42k 를 4회차(=4시간)에 한 바퀴 돈다. 풀이 두 배가 되면 회차 수만 늘고 죽지 않는다.
 */
const ROWS_PER_RUN = 12_000
/** 커서 키 — `{off, total}`. `off=0` 이면 새 사이클 시작(그리드 확장·총계 재계산). */
const CURSOR_KEY = 'ads_sheets_cursor'

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
export const SHEET_HEADER = ['ID', '플랫폼', '이름', '핸들', 'URL', '점수', '구독자수', '평균조회수', '롱폼중앙값', '쇼츠%', '평균댓글', '月포스팅', '마지막글', '이메일', '메일상태', '인스타', '틱톡', '기타링크(유튜브·블로그·링크인바이오)', '카테고리', '분류근거', '제외태그', '수집키워드', '상태', '컨택채널', '컨택일', '팔로업', '출처', '동의일', '메모', '수집일'] as const
export interface SheetLead {
  id: number; platform: string; name: string; handle: string | null; url: string
  subscriber_count: number; recent_avg_views: number | null; recent_avg_comments: number | null; recent_posts_30d: number | null
  email: string | null; instagram: string | null; tiktok: string | null; links: string | null
  category: string | null; source_keyword: string | null; status: string; contact_channel: string | null
  contacted_at: string | null; follow_up_at: string | null; source: string | null; consented_at: string | null
  memo: string | null; collected_at: string
  lead_score?: number | null; median_long_views?: number | null; shorts_ratio?: number | null
  is_brand?: number | null; email_status?: string | null; last_post_at?: string | null; category_source?: string | null
  /** 🚫 소개글에 제안 거부를 명시(`declinesOutreach`) — 시트에서 손으로 고를 때도 걸러지도록 미러한다. */
  opted_out?: number | null
}
export function leadToRow(l: SheetLead): (string | number)[] {
  return [l.id, l.platform, l.name, l.handle || '', l.url, l.lead_score ?? '', l.subscriber_count || 0, l.recent_avg_views ?? '', l.median_long_views ?? '', l.shorts_ratio ?? '', l.recent_avg_comments ?? '', l.recent_posts_30d ?? '', l.last_post_at || '', l.email || '', l.email_status || '', l.instagram || '',
    l.tiktok || '', l.links || '', l.category || '', l.category ? (l.category_source || 'keyword') : '',     // 🚫 '제외태그'(구 '브랜드') — 거부 명시가 브랜드보다 강한 신호라 우선. 열 추가 없이 한 칸에 담는다
    //   (시트는 기계값 미러라 라벨이 아니라 코드값: 'optout' / 'brand' / '').
    l.opted_out ? 'optout' : l.is_brand ? 'brand' : '', l.source_keyword || '', l.status, l.contact_channel || '', l.contacted_at || '',
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

/** 이 회차를 누가 돌렸는지 — 스탬프에 남는다(아래 trigger 기록 사유 참조). */
export type SyncTrigger = 'cron' | 'manual' | 'unknown'

/**
 * 인플루언서 공용 풀 전량 → 시트 미러. 반환 {ok, rows} — 실패는 error 문자열(fail-soft, 절대 throw 안 함).
 *   🛡️ 결과를 platform_settings('ads_sheets_last_sync')에 항상 기록 — cron 실패가 무음으로 사라지지 않게(관측성).
 *
 *   🔎 2026-07-29 `trigger` 기록 신설 — **스탬프만 보고는 원인을 못 가리던 실사고**:
 *     라이브 스탬프가 `{at: 07-27T06:49, ok:true}` 로 41시간 굳어 있었는데, cron 과 어드민 수동 버튼이
 *     **같은 `/__ads/sheets-sync` 라우트**를 쓰는 탓에 그 한 줄이 두 가지로 읽혔다:
 *       ⓐ cron 이 돌다 죽었다(게이트 ON · 고장)  ⓑ cron 은 한 번도 안 돌았고 그때 사람이 눌렀다(게이트 OFF)
 *     둘은 다음 행동이 정반대인데(원인 규명 vs env 켜기) 증거가 없어 **추측 외엔 방법이 없었다**.
 *     ⇒ 출처를 한 글자 남기면 이 모호성이 영구히 사라진다. 게이트 값(`sheets_gate`)과 조합하면
 *       "켰는데 cron 기록이 없다" = 고장, "꺼졌고 마지막이 manual" = 설정 — 단정 없이 판정된다.
 */
export async function syncInfluencerPoolToSheets(env: Env, trigger: SyncTrigger = 'unknown'): Promise<SheetSyncResult> {
  // 💥 예외도 **결과로 기록**한다 — 2026-07-28 실사고: `_syncCore` 가 throw 하면(서브리퀘스트 한도 등)
  //   아래 스탬프 쓰기에 도달하지 못해 **옛 `ok:true` 스탬프가 그대로 남아** 34시간 정지가 성공처럼 보였다.
  //   (파트너풀 보강 레인의 `recordEnrichCrash` 와 같은 철학 — 무증거 종료 금지.)
  const cost = { subreq: 0 } // 이번 회차가 쓴 요청 수(추정) — 임계에 닿기 전에 보이게
  let r: SheetSyncResult
  try {
    r = await _syncCore(env, cost)
  } catch (err) {
    const e = err as { name?: string; message?: string } | null
    r = { ok: false, error: `CRASH ${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}` }
  }
  await adsLeadsDb(env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind('ads_sheets_last_sync', JSON.stringify({
      at: new Date().toISOString(), ok: r.ok, rows: r.rows ?? null,
      error: (r.error || '').slice(0, 300) || null, subreq: cost.subreq, trigger,
    })).run().catch(() => null)
  // 🕘 cron 회차는 **성공/실패 무관** 별도 키에도 마지막 시각을 남긴다 — 위 스탬프는 수동 실행이 덮어쓰므로
  //   "자동으로 돈 적이 있는가"를 보존하지 못한다(바로 그 덮어쓰기가 41시간 오진의 원인이었다).
  if (trigger === 'cron') {
    await adsLeadsDb(env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind('ads_sheets_last_cron', JSON.stringify({ at: new Date().toISOString(), ok: r.ok })).run().catch(() => null)
  }
  return r
}

/** 회차 결과 — `partial` 이면 사이클이 안 끝났고 `next` 부터 다음 회차가 이어받는다. */
export type SheetSyncResult = { ok: boolean; rows?: number; error?: string; partial?: boolean; from?: number; next?: number; total?: number }

async function _syncCore(env: Env, cost: { subreq: number }): Promise<SheetSyncResult> {
  if (!env.GSHEETS_SHEET_ID || !env.GSHEETS_SA_EMAIL || !env.GSHEETS_SA_KEY) {
    return { ok: false, error: 'NOT_CONFIGURED: GSHEETS_SA_EMAIL / GSHEETS_SA_KEY / GSHEETS_SHEET_ID (ur-ads Variables)' }
  }
  cost.subreq += 1 // 토큰 발급(캐시 미스 시 1 fetch)
  const token = await getToken(env)
  if (!token) return { ok: false, error: 'AUTH: 서비스계정 토큰 발급 실패 — SA 키/이메일 확인' }
  const sheetId = env.GSHEETS_SHEET_ID
  // 확장 열(점수/성과/메일상태/분류근거) 보장 — 미보강 DB 에서 'no such column' READ 실패 방지.
  await ensureQualityColumns(adsLeadsDb(env)); await ensurePerfExtraColumns(adsLeadsDb(env)); await ensureOutreachColumns(adsLeadsDb(env))
  cost.subreq += 3 // DDL 3종 — 전부 runDdlOnce(체크섬 1회 조회). 2026-07-28 이전엔 ALTER 10회였다.

  // 🧭 커서 — 이번 회차가 어디부터 미러할지. `off=0` 은 새 사이클(그리드 확장 + 총계 재계산).
  const cRaw = await adsLeadsDb(env).prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY)
    .first<{ value: string }>().catch(() => null)
  cost.subreq += 1
  const cur = startCursor(parseSheetCursor(cRaw?.value))
  let off = cur.off
  let total = cur.total

  if (off === 0) {
    const cnt = await adsLeadsDb(env).prepare('SELECT COUNT(*) AS n FROM ad_influencer_leads WHERE account_id = 0')
      .first<{ n: number }>().catch(() => null)
    cost.subreq += 1
    total = Math.max(0, Number(cnt?.n) || 0)
    // 탭 보장 + 그리드를 전량 크기로 확장(1000행 기본 한계 → 2001행+ 400 방지). 사이클당 1회면 충분하다.
    cost.subreq += 1
    await ensurePoolSheet(token, sheetId, total + 2, SHEET_HEADER.length)
    // 헤더는 사이클 시작에 한 번만 쓴다.
    cost.subreq += 1
    const h = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${TAB}!A1`)}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ range: `${TAB}!A1`, majorDimension: 'ROWS', values: [[...SHEET_HEADER]] }),
    }).catch(() => null)
    if (!h?.ok) return { ok: false, error: `HEADER: 시트 접근 실패(${h?.status || 'net'}) — 시트를 SA 이메일에 편집자 공유했는지 확인` }
  }

  // D1 페이지 읽기 — 공용 풀만(account_id=0). **이번 회차 몫(ROWS_PER_RUN)만** 읽고 쓴다.
  //   🛡️ 2026-07-23 전수조사: 페이지 읽기 **실패**(null)를 "마지막 페이지"로 오인하면 그 오프셋 이후 전량 누락된
  //   잘린 미러가 되는데도 "성공 N행"으로 보고됐음 — 실패는 쓰기 **이전**에 즉시 중단(시트 기존 데이터 유지).
  //   🅿️ 커서는 **실패 시 전진하지 않는다** — 다음 회차가 같은 구간을 다시 집는다(구멍 없음).
  const startOff = off
  let done = false
  let wrote = 0
  while (wrote < ROWS_PER_RUN) {
    // 🧱 **이 사이클은 자기 스냅샷까지만 쓴다** — 그리드를 그 크기로만 넓혔기 때문이다(`cycleRoom` 주석).
    //   이 상한이 없어서 사이클 도중 늘어난 행을 그리드 밖에 쓰고 400 → 커서 고착이 났다.
    const room = cycleRoom(off, total)
    if (room <= 0) { done = true; break }
    const take = Math.min(PAGE, ROWS_PER_RUN - wrote, room)
    const res = await adsLeadsDb(env).prepare(`SELECT id, platform, name, handle, url, subscriber_count, recent_avg_views, recent_avg_comments, recent_posts_30d, email, instagram, tiktok, links,
        category, source_keyword, status, contact_channel, contacted_at, follow_up_at, source, consented_at, memo, collected_at,
        lead_score, median_long_views, shorts_ratio, is_brand, email_status, last_post_at, category_source, opted_out
      FROM ad_influencer_leads WHERE account_id = 0 ORDER BY id ASC LIMIT ? OFFSET ?`)
      .bind(take, off).all<SheetLead>().catch(() => null)
    cost.subreq += 1
    if (!res) return { ok: false, error: `READ: D1 페이지 읽기 실패(offset ${off}) — 잘린 미러 방지 위해 중단(시트 기존 데이터 유지)`, rows: wrote }
    const page = res.results || []
    if (!page.length) { done = true; break }

    // 🧾 청크 단위로 **바로 기록**하고 버린다 — 전량을 메모리에 쌓던 것이 CPU 사망의 원인이었다.
    for (let i = 0; i < page.length; i += CHUNK) {
      const chunk = page.slice(i, i + CHUNK).map(leadToRow)
      const rowNo = off + i + 2 // +1 헤더, +1 1-기반
      const range = `${TAB}!A${rowNo}`
      cost.subreq += 1
      const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
        method: 'PUT', body: JSON.stringify({ range, majorDimension: 'ROWS', values: chunk }),
      }).catch(() => null)
      if (!w?.ok) {
        await saveSheetCursor(env, off + i, total)  // 성공한 데까지만 전진
        return { ok: false, error: `WRITE: ${rowNo}행부터 기록 실패(${w?.status || 'net'})`, rows: wrote + i }
      }
    }
    off += page.length
    wrote += page.length
    if (page.length < take) { done = true; break }
  }

  if (done) {
    // 🧹 사이클 끝 — 줄어든 만큼의 **꼬리만** 지운다(전체 clear 를 안 하므로 시트가 비는 구간이 없다).
    //   ⚠️ 옛 구조는 매 회차 전체 clear 후 다시 채웠다. 그건 전량을 한 번에 쓸 수 있을 때만 성립한다.
    if (off < total) {
      cost.subreq += 1
      await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(`${TAB}!A${off + 2}:AE`)}:clear`, { method: 'POST', body: '{}' }).catch(() => null)
    }
    await saveSheetCursor(env, 0, off)   // 다음 회차는 새 사이클
    return { ok: true, rows: off, partial: false, from: startOff }
  }
  await saveSheetCursor(env, off, total)
  return { ok: true, rows: wrote, partial: true, from: startOff, next: off, total }
}

/**
 * 🩹 회차 시작 커서 보정 — 커서가 **스냅샷을 지나쳐** 있으면 새 사이클(off=0)로 되돌린다.
 *
 * 왜 필요한가(2026-08-03 라이브 실측 — `ads_sheets_cursor = {off:44000, total:43597}`):
 * 그리드는 사이클 **시작 시점의 total** 로만 확장한다(`ensurePoolSheet(total+2)`). 그런데 읽기 루프는
 * 페이지가 마를 때까지 갔으므로, 사이클 도중 풀이 몇 행만 늘어도 **그리드 밖 행**을 쓰고 400 을 맞았다.
 * 그 실패는 커서를 그 자리에 저장하고 끝난다 → `off` 가 다시 0 이 되는 길이 없다 →
 * `ensurePoolSheet` 가 **영영 안 불린다** → 매 회차 같은 행에서 400. 즉 **한 번 넘어가면 영구 고착**이고,
 * 그동안 2~3칸뿐인 회차 예산에서 한 칸을 계속 태운다(실측 24시간 6회, 전부 CPU 사망 동반).
 *
 * ⚠️ `total: 0` 으로 되돌리는 게 핵심 — 그래야 호출부의 `off === 0` 분기가 총계를 다시 세고 그리드를 넓힌다.
 */
export function startCursor(cur: { off: number; total: number }): { off: number; total: number } {
  return cur.total > 0 && cur.off >= cur.total ? { off: 0, total: 0 } : cur
}

/**
 * 이번 **사이클**에 남은 행 수(시작 시점 스냅샷 기준).
 *
 * 사이클은 자기 스냅샷까지만 쓴다 — 그 크기로 그리드를 넓혔기 때문이다. 도중에 새로 들어온 행은
 * **버리는 게 아니라 다음 사이클 몫**이다(다음 사이클이 그만큼 넓힌 뒤 쓴다).
 * `total === 0`(총계 미상)이면 상한을 두지 않는다 — 종전 동작 그대로.
 */
export function cycleRoom(off: number, total: number): number {
  return total > 0 ? Math.max(0, total - off) : Number.POSITIVE_INFINITY
}

/** 커서 파싱 — 형태가 깨졌으면 0(전량 재시작)이 **안전한 방향**이다(누락보다 중복 쓰기가 낫다). */
export function parseSheetCursor(raw: string | null | undefined): { off: number; total: number } {
  try {
    const v = JSON.parse(String(raw || '{}')) as { off?: unknown; total?: unknown }
    const off = Math.max(0, Math.floor(Number(v.off) || 0))
    const total = Math.max(0, Math.floor(Number(v.total) || 0))
    return { off, total }
  } catch { return { off: 0, total: 0 } }
}

async function saveSheetCursor(env: Env, off: number, total: number): Promise<void> {
  await adsLeadsDb(env).prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(CURSOR_KEY, JSON.stringify({ off, total, at: new Date().toISOString() })).run().catch(() => null)
}
