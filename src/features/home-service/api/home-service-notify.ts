/**
 * 🏠 생활 견적 — 알림톡 보내기 (2026-10-24)
 *
 * 세 통뿐이다: 사장님 "새 요청" · 손님 "견적 도착" · 사장님 "손님이 선택".
 * 템플릿이 카카오 승인 전이면 `sendSystemAlimtalk` → `text-notice` 가 **보내지 않고 기록만** 남긴다
 * (배포 없이 어드민 `alimtalk_approved_templates` 에 이름을 적는 순간 나가기 시작한다).
 *
 * 🔑 같은 사장님에게 같은 요청을 두 번 보내지 않는다 — `home_service_dispatch`(요청, 사장님) PK 를
 *   **먼저** 잡고(`INSERT OR IGNORE`) 잡혔을 때만 보낸다. 요청 접수 직후 보내기와, 사장님이 새로
 *   가입했을 때 보관된 요청 보내기가 같은 함수를 지나므로 둘이 겹쳐도 한 통이다.
 */
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import {
  HOME_TPL, MAX_DISPATCH_PER_REQUEST, categoryDef, msgRequestNew,
  type HomeServiceCategory,
} from '../../../shared/home-service'
import { MATCH_PROS_SQL, OPEN_REQUESTS_FOR_PRO_SQL, loadPartners } from './home-service-db'
import { partnerCategoriesCsv } from '../../../shared/home-service'

interface ReqRow {
  id: number; category: HomeServiceCategory; summary: string; desired_date: string
  sido: string; sigungu: string; sido2: string | null; sigungu2: string | null; status: string
}

async function claimAndSend(env: unknown, DB: D1Database, req: ReqRow, sellerId: number, phone: string | null): Promise<boolean> {
  const claim = await DB.prepare(
    `INSERT OR IGNORE INTO home_service_dispatch (request_id, seller_id) VALUES (?, ?)`,
  ).bind(req.id, sellerId).run()
  if (!claim.meta?.changes) return false
  if (!phone) return true // 번호가 없어도 요청함에는 뜬다
  const label = categoryDef(req.category)?.label || '생활'
  await sendSystemAlimtalk(env, phone, HOME_TPL.requestNew, msgRequestNew(label, req.summary, req.desired_date), {
    dedupKey: `req:${req.id}`,
  }).catch(() => null)
  return true
}

/** 새 요청을 맞는 사장님들에게. 반환: 알림을 잡은 사장님 수. */
export async function dispatchRequest(env: unknown, DB: D1Database, requestId: number): Promise<number> {
  const req = await DB.prepare(
    `SELECT id, category, summary, desired_date, sido, sigungu, sido2, sigungu2, status
       FROM home_service_requests WHERE id = ?`,
  ).bind(requestId).first<ReqRow>()
  if (!req || req.status !== 'open') return 0
  const { results } = await DB.prepare(MATCH_PROS_SQL).bind(
    req.category, req.sido, req.sigungu, req.sido2, req.sido2, req.sigungu2, req.id, MAX_DISPATCH_PER_REQUEST,
  ).all<{ seller_id: number; phone: string | null }>()
  let n = 0
  // 🤝 제휴 업체 먼저(2026-10-25 간판 제휴사) — 지역과 무관하게, 판매 승인된 매장일 때만.
  const partnerId = (await loadPartners(DB))[req.category]
  if (partnerId) {
    const p = await DB.prepare(
      `SELECT COALESCE(NULLIF(hp.phone, ''), s.phone) AS phone FROM sellers s
         LEFT JOIN home_service_pros hp ON hp.seller_id = s.id
        WHERE s.id = ? AND s.status IN ('approved', 'active')`,
    ).bind(partnerId).first<{ phone: string | null }>()
    if (p && (await claimAndSend(env, DB, req, partnerId, p.phone))) n++
  }
  for (const p of results ?? []) if (await claimAndSend(env, DB, req, p.seller_id, p.phone)) n++
  return n
}

/**
 * 사장님이 새로 등록(또는 지역·카테고리를 바꿨을) 때 — 그 지역에 **보관돼 있던** 요청을 보낸다.
 * 대표 "그냥 1명부터 열어줘": 사장님이 없던 지역의 요청은 버리지 않고 기다렸다가 여기서 나간다.
 * 한꺼번에 몰아 보내지 않게 최근 5건까지만.
 */
export async function dispatchBacklogToPro(env: unknown, DB: D1Database, sellerId: number, todayYmd: string): Promise<number> {
  const pro = await DB.prepare(
    `SELECT COALESCE(NULLIF(p.phone, ''), s.phone) AS phone, p.active, s.status
       FROM home_service_pros p JOIN sellers s ON s.id = p.seller_id WHERE p.seller_id = ?`,
  ).bind(sellerId).first<{ phone: string | null; active: number; status: string }>()
  if (!pro || !pro.active || !['approved', 'active'].includes(String(pro.status))) return 0
  const csv = partnerCategoriesCsv(await loadPartners(DB), sellerId)
  const { results } = await DB.prepare(OPEN_REQUESTS_FOR_PRO_SQL).bind(sellerId, todayYmd, csv, sellerId, sellerId, 5)
    .all<{ id: number }>()
  let n = 0
  for (const r of results ?? []) {
    const req = await DB.prepare(
      `SELECT id, category, summary, desired_date, sido, sigungu, sido2, sigungu2, status
         FROM home_service_requests WHERE id = ?`,
    ).bind(r.id).first<ReqRow>()
    if (req && (await claimAndSend(env, DB, req, sellerId, pro.phone))) n++
  }
  return n
}
