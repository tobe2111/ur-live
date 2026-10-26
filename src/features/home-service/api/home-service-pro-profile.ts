/**
 * 🏠 생활 업체 정보(하는 일·지역·알림 번호) 검증·저장 — `PUT /pro/me` 와 가입(`POST /pro/signup`)이 같이 쓴다.
 * 두 벌이면 검증이 갈린다(한쪽만 지역 형식을 보거나 무료 참여권을 두 번 준다).
 */
import type { Env } from '@/worker/types/env'
import { SIDO_LIST } from '@/shared/constants/region-slugs'
import { kstYmd } from '@/shared/stays-early'
import { SIGNUP_FREE_CREDITS, categoryDef } from '@/shared/home-service'
import { creditAdd } from './home-service-db'
import { dispatchBacklogToPro } from './home-service-notify'

const SIGUNGU_RE = /^[가-힣]{1,10}(시|군|구)$/

function waitUntil(c: { executionCtx?: { waitUntil(p: Promise<unknown>): void } }, p: Promise<unknown>) {
  try { c.executionCtx?.waitUntil(p) } catch { void p }
}

export type ProBody = { categories?: unknown; areas?: unknown; phone?: unknown; active?: unknown }
export type ParsedPro = { cats: string[]; areas: { sido: string; sigungu: string }[]; phone: string; active: 0 | 1 }

/** 저장 전에 — 가입은 매장 행을 만들기 **전에** 이걸로 먼저 거른다(반쪽 가입 방지). */
export function parseProBody(body: ProBody): { ok: false; error: string } | ({ ok: true } & ParsedPro) {
  const cats = Array.isArray(body.categories) ? [...new Set(body.categories.map(String))].filter((k) => categoryDef(k)) : []
  if (!cats.length) return { ok: false, error: '하는 일을 하나 이상 골라 주세요' }
  const areasIn = Array.isArray(body.areas) ? body.areas.slice(0, 40) : []
  const areas: { sido: string; sigungu: string }[] = []
  for (const a of areasIn) {
    const sido = String((a as { sido?: unknown })?.sido ?? '').trim()
    const sigungu = String((a as { sigungu?: unknown })?.sigungu ?? '').trim()
    if (!SIDO_LIST.includes(sido)) continue
    if (sigungu && !SIGUNGU_RE.test(sigungu)) continue
    if (!areas.some((x) => x.sido === sido && x.sigungu === sigungu)) areas.push({ sido, sigungu })
  }
  if (!areas.length) return { ok: false, error: '일할 지역을 하나 이상 골라 주세요' }
  const phone = String(body.phone ?? '').replace(/\D/g, '')
  if (phone && !/^01\d{8,9}$/.test(phone)) return { ok: false, error: '휴대폰 번호 형식을 확인해 주세요' }
  return { ok: true, cats, areas, phone, active: body.active === false ? 0 : 1 }
}

export async function saveProProfile(
  c: { env: Env; executionCtx?: { waitUntil(p: Promise<unknown>): void } }, DB: D1Database, sid: number, body: ProBody,
): Promise<{ ok: false; error: string } | { ok: true; granted: number }> {
  const p = parseProBody(body)
  if (!p.ok) return p
  const { cats, areas, phone: phoneRaw, active } = p
  const existed = await DB.prepare(`SELECT 1 AS x FROM home_service_pros WHERE seller_id = ?`).bind(sid).first()
  await DB.batch([
    DB.prepare(
      `INSERT INTO home_service_pros (seller_id, phone, active) VALUES (?, ?, ?)
       ON CONFLICT(seller_id) DO UPDATE SET phone = excluded.phone, active = excluded.active, updated_at = datetime('now')`,
    ).bind(sid, phoneRaw || null, active),
    DB.prepare(`DELETE FROM home_service_pro_categories WHERE seller_id = ?`).bind(sid),
    ...cats.map((k) => DB.prepare(`INSERT INTO home_service_pro_categories (seller_id, category) VALUES (?, ?)`).bind(sid, k)),
    DB.prepare(`DELETE FROM home_service_pro_areas WHERE seller_id = ?`).bind(sid),
    ...areas.map((a) => DB.prepare(`INSERT INTO home_service_pro_areas (seller_id, sido, sigungu) VALUES (?, ?, ?)`).bind(sid, a.sido, a.sigungu)),
  ])
  // 처음 등록이면 무료 참여권 — 원장 UNIQUE(grant:signup:<매장>) 라 몇 번을 저장해도 한 번만.
  const granted = existed ? false : await creditAdd(DB, sid, 'grant', SIGNUP_FREE_CREDITS, `signup:${sid}`, 0, '가입 무료 참여권')
  // 사장님이 없던 지역에 보관돼 있던 요청을 지금 보낸다(대표 "그냥 1명부터 열어줘").
  if (active) waitUntil(c, dispatchBacklogToPro(c.env, DB, sid, kstYmd(0)).catch(() => 0))
  return { ok: true, granted: granted ? SIGNUP_FREE_CREDITS : 0 }
}
