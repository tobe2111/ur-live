/**
 * 🏛️ 사업자 상태 스윕 — 국세청 상태조회로 **폐업 리드 자동 정리** (2026-07-27, 수집 방법 전수조사 마감).
 *   사업자번호 보유 리드(통신판매·가맹·수동)를 100건/틱씩 국세청에 조회 → 폐업(b_stt_cd '03')이면 active=0
 *   → 죽은 연락처에 아웃리치 시간 낭비 방지(정확도·완성도). 휴업('02')은 재개 가능이라 유지.
 *
 *   API: api.odcloud.kr/api/nts-businessman/v1/status — data.go.kr **"국세청_사업자등록정보 진위확인 및
 *   상태조회 서비스" 활용신청 필요**(같은 인증키). 미신청/오류 시 완전 fail-soft(no-op + note 기록).
 *   일 1회(ur-ads cron hourUTC=19 = KST 04시), 커서 순환 — 리드 늘어도 전량 주기 커버.
 */
import type { Env } from '@/worker/types/env'
import { ensureCompanySchema } from './company-discovery'

export interface NtsSweepStats { last_run: string; checked: number; closed: number; cursor: number; total_closed: number; note?: string }
const STATS_KEY = 'ads_ntsstatus_stats'
const CURSOR_KEY = 'ads_ntsstatus_cursor'

export async function sweepBusinessStatus(env: Env): Promise<NtsSweepStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const key = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: NtsSweepStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as NtsSweepStats : null } catch { prev = null }
  const persist = async (s: NtsSweepStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }
  const done = async (checked: number, closed: number, cursor: number, note?: string): Promise<NtsSweepStats> => {
    const s: NtsSweepStats = { last_run: stamp, checked, closed, cursor, total_closed: (prev?.total_closed || 0) + closed, note }
    await persist(s); return s
  }
  if (!key) return done(0, 0, 0, 'NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY 미설정')

  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRaw?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0

  // 활성 + 사업자번호 보유 리드 100건(커서 이후). 소진 시 커서 리셋(다음 틱에 처음부터 재순환).
  const rows = (await DB.prepare("SELECT id, business_no FROM ad_company_leads WHERE active = 1 AND business_no IS NOT NULL AND business_no != '' AND id > ? ORDER BY id ASC LIMIT 100")
    .bind(cursor).all<{ id: number; business_no: string }>().catch(() => null))?.results || []
  if (!rows.length) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, '0').run().catch(() => null)
    return done(0, 0, 0, prev?.note?.startsWith('NOT_') ? prev.note : undefined)
  }

  // 사업자번호 정규화(10자리) → b_no 배열. 비정상 번호는 조회 제외(그대로 유지 — 허위 판정 방지).
  const byBno = new Map<string, number[]>()
  for (const r of rows) {
    const d = String(r.business_no).replace(/\D/g, '')
    if (d.length !== 10) continue
    const list = byBno.get(d) || []; list.push(r.id); byBno.set(d, list)
  }
  const bnos = [...byBno.keys()]
  let closed = 0
  let note: string | undefined
  if (bnos.length) {
    const res = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: bnos }), signal: AbortSignal.timeout(15000),
    }).catch(() => null)
    if (!res || !res.ok) {
      note = `API: ${res ? `HTTP ${res.status}` : '네트워크 오류'} — 국세청 상태조회 활용신청 필요 여부 확인`
    } else {
      const data = await res.json().catch(() => null) as { data?: Array<{ b_no?: string; b_stt_cd?: string }> } | null
      const closedIds: number[] = []
      for (const d of (data?.data || [])) {
        // '03' = 폐업(국세청 코드). '01' 계속사업자 / '02' 휴업(재개 가능 — 유지).
        if (String(d.b_stt_cd || '').trim() === '03') { const ids = byBno.get(String(d.b_no || '').replace(/\D/g, '')); if (ids) closedIds.push(...ids) }
      }
      if (closedIds.length) {
        const ph = closedIds.map(() => '?').join(',')
        const r = await DB.prepare(`UPDATE ad_company_leads SET active = 0, description = COALESCE(description, '') || ' [국세청 폐업확인 ${stamp.slice(0, 10)}]' WHERE id IN (${ph})`)
          .bind(...closedIds).run().catch(() => null)
        closed = (r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0
      }
    }
  }
  const lastId = rows[rows.length - 1].id
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(lastId)).run().catch(() => null)
  return done(rows.length, closed, lastId, note)
}
