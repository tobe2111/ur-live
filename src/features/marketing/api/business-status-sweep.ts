/**
 * 🏛️ 사업자 상태 스윕 — 국세청 상태조회로 **폐업 리드 자동 정리** (2026-07-27, 수집 방법 전수조사 마감).
 *   사업자번호 보유 리드(통신판매·가맹·수동)를 회차당 100건 × 여러 묶음씩 국세청에 조회 → 폐업(b_stt_cd '03')이면 active=0
 *   → 죽은 연락처에 아웃리치 시간 낭비 방지(정확도·완성도). 휴업('02')은 재개 가능이라 유지.
 *
 *   API: api.odcloud.kr/api/nts-businessman/v1/status — data.go.kr **"국세청_사업자등록정보 진위확인 및
 *   상태조회 서비스" 활용신청 필요**(같은 인증키). 미신청/오류 시 완전 fail-soft(no-op + note 기록).
 *   일 1회(ur-ads cron hourUTC=19 = KST 04시), 커서 순환 — 리드 늘어도 전량 주기 커버.
 */
import type { Env } from '@/worker/types/env'
import { ensureCompanySchema } from './company-discovery'
import { describePublicDataFailure, serviceKeyParam } from './public-data-diag'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export interface NtsSweepStats { last_run: string; checked: number; closed: number; cursor: number; total_closed: number; note?: string }
const STATS_KEY = 'ads_ntsstatus_stats'
const CURSOR_KEY = 'ads_ntsstatus_cursor'
/** 국세청 상태조회는 호출당 최대 100건. */
const NTS_PER_CALL = 100
/** 회차당 기본 묶음 수 — 하루 1회라 1,000건/일, 55,000건 한 바퀴 ≈ 55일(예전 550일). */
const NTS_DEFAULT_BATCHES = 10
/** env 로도 이 위로는 못 올린다 — 서브리퀘스트(무료 ~50)와 벽시계 안에 머물게. */
const NTS_MAX_BATCHES = 20
/** 회차 벽시계 마감 — 느린 날 부모를 붙잡지 않게. */
const NTS_RUN_DEADLINE_MS = 20_000

export async function sweepBusinessStatus(env: Env): Promise<NtsSweepStats> {
  const DB = adsLeadsDb(env)
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

  /**
   * 📦 **한 회차에 여러 묶음** (2026-11-02 대표 *"다 해줘"* — 파트너 풀 개선 목록 ⑦).
   *   예전엔 하루 1회 × 100건이라 사업자번호 보유 활성 리드 55,065건을 한 바퀴 도는 데 **550일**이 걸렸다
   *   (실측: 활성 81,166건 중 폐업 확인을 한 번이라도 받은 행 0). 국세청 API 는 호출당 100건까지 받으므로
   *   **호출 수만 늘리면 된다** — 행은 한 번에 읽고, 100건씩 나눠 조회하고, 폐업분은 한 번에 내린다.
   *   서브리퀘스트 = 읽기 1 + 조회 N + 쓰기 1 + 부기 3 — 무료 한도(~50) 안. 벽시계 마감으로 느린 날도 끊는다.
   *   🔻 롤백: env `ADS_NTS_BATCHES=1`.
   */
  const batches = Math.min(NTS_MAX_BATCHES, Math.max(1, parseInt((env as unknown as { ADS_NTS_BATCHES?: string }).ADS_NTS_BATCHES || '', 10) || NTS_DEFAULT_BATCHES))
  const rows = (await DB.prepare("SELECT id, business_no FROM ad_company_leads WHERE active = 1 AND merged_into IS NULL AND business_no IS NOT NULL AND business_no != '' AND id > ? ORDER BY id ASC LIMIT ?")
    .bind(cursor, batches * NTS_PER_CALL).all<{ id: number; business_no: string }>().catch(() => null))?.results || []
  if (!rows.length) {
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, '0').run().catch(() => null)
    return done(0, 0, 0, prev?.note?.startsWith('NOT_') ? prev.note : undefined)
  }

  const startedAt = Date.now()
  const closedIds: number[] = []
  let note: string | undefined
  let lastDone = cursor // 실제로 조회를 마친 마지막 id — 실패·마감으로 끊기면 거기서 다음 회차가 잇는다
  for (let i = 0; i < rows.length; i += NTS_PER_CALL) {
    if (Date.now() - startedAt > NTS_RUN_DEADLINE_MS) { note = note || '마감 — 남은 묶음은 다음 회차'; break }
    const chunk = rows.slice(i, i + NTS_PER_CALL)
    // 사업자번호 정규화(10자리) → b_no 배열. 비정상 번호는 조회 제외(그대로 유지 — 허위 판정 방지).
    const byBno = new Map<string, number[]>()
    for (const r of chunk) {
      const d = String(r.business_no).replace(/\D/g, '')
      if (d.length !== 10) continue
      const list = byBno.get(d) || []; list.push(r.id); byBno.set(d, list)
    }
    const bnos = [...byBno.keys()]
    if (bnos.length) {
      const res = await fetch(`https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${serviceKeyParam(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: bnos }), signal: AbortSignal.timeout(15000),
      }).catch(() => null)
      if (!res || !res.ok) {
        // 🩺 본문을 남긴다 — 예전엔 `HTTP 503` 만 남기고 "활용신청 필요 여부 확인" 이라는 **추측**을 붙였다.
        //   실제로는 활용신청이 2026-06-01 부터 승인돼 있었다(대표 화면 확인) → 추측이 오답을 가리키고 있었다.
        //   odcloud 는 원인을 본문 JSON 으로 준다(키 불일치/인코딩/한도/점검). 그걸 그대로 노출한다.
        note = `API: ${await describePublicDataFailure(res, '네트워크 오류')}`
        break // 이 묶음은 조회 못 했다 — 커서를 여기서 멈춰 다음 회차가 이 묶음부터 다시 본다
      }
      const data = await res.json().catch(() => null) as { data?: Array<{ b_no?: string; b_stt_cd?: string }> } | null
      for (const d of (data?.data || [])) {
        // '03' = 폐업(국세청 코드). '01' 계속사업자 / '02' 휴업(재개 가능 — 유지).
        if (String(d.b_stt_cd || '').trim() === '03') { const ids = byBno.get(String(d.b_no || '').replace(/\D/g, '')); if (ids) closedIds.push(...ids) }
      }
    }
    lastDone = chunk[chunk.length - 1].id
  }
  let closed = 0
  if (closedIds.length) {
    // id 는 DB 가 준 정수뿐이라 문자열 보간이 안전하다(바인딩 100개 상한을 피하려고 묶음 하나로 쓴다).
    const r = await DB.prepare(`UPDATE ad_company_leads SET active = 0, description = COALESCE(description, '') || ' [국세청 폐업확인 ${stamp.slice(0, 10)}]' WHERE id IN (${closedIds.map(n => Math.trunc(Number(n))).join(',')})`)
      .run().catch(() => null)
    closed = (r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(lastDone)).run().catch(() => null)
  const checked = rows.filter(r => r.id <= lastDone).length
  return done(checked, closed, lastDone, note)
}
