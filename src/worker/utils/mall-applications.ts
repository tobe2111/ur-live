/**
 * 🏪 **가게 개설 신청** — 운영자 셀프 온보딩 최소안 (2026-08-12, 대표 *"최소안으로 진행해줘"*)
 *
 * 왜: 몰 생성(`super_admin` + IP whitelist)과 셀러↔몰 연결(`UPDATE sellers SET mall_id`)이
 * **둘 다 수동**이었다. 파일럿 한두 곳이면 정상이지만 **매장이 열 곳만 돼도 대표가 매번 붙어야 한다.**
 * ⇒ 운영자가 **신청**하고 어드민은 **승인만** 한다. 승인 한 번에 몰 생성 + 연결 + 기존 상품 이관.
 *
 * ## 🔴 최소안의 경계 — 자동 생성이 아니다
 * 신청은 **아무것도 만들지 않는다.** 슬러그는 `urdeal.kr/{슬러그}` 라는 **영구 주소**이고
 * 예약어와 충돌하면 소비자 라우트가 통째로 죽는다(`isMallSlugCandidate` 가 1차 방어).
 * 사람이 한 번 보는 단계를 남기는 것이 이 설계의 요점이다.
 *
 * ⚠️ 이 파일은 **소비자 번들에도 실린다**(셀러 신청 API 가 쓴다). 도매 그래프를 끌어오지 않게
 *   `wholesale-malls.ts`(도매 CRUD)를 import 하지 않는다 — 테이블만 직접 다룬다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export type MallApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface MallApplicationRow {
  id: number
  seller_id: number
  slug: string
  name: string
  status: MallApplicationStatus
  note: string | null
  mall_id: number | null
  created_at: string
  reviewed_at: string | null
}

// per-DB 메모이즈 — 핸들러마다 DDL 을 쏘지 않는다(CLAUDE.md 머니/정합성 부수 룰).
const ensured = new WeakSet<D1Database>()

export async function ensureMallApplications(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS mall_applications (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         seller_id INTEGER NOT NULL,
         slug TEXT NOT NULL,
         name TEXT NOT NULL,
         status TEXT NOT NULL DEFAULT 'pending',
         note TEXT,
         mall_id INTEGER,
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         reviewed_at TEXT
       )`,
    ).run()
    // 🔴 한 셀러가 **동시에 여러 건 대기**하지 못하게 — 신청 폭주로 승인 큐가 오염되는 것을 막는다.
    //   partial UNIQUE 라 승인·반려된 과거 신청은 여러 건 남을 수 있다(이력 보존).
    await DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mall_app_pending_seller
         ON mall_applications(seller_id) WHERE status = 'pending'`,
    ).run().catch(() => { /* 구 SQLite — 없어도 아래 조회 가드가 커버 */ })
    ensured.add(DB)
  } catch {
    // 테이블 생성 실패 = 신청 기능만 비활성(조회가 빈 결과). 다른 기능은 영향 없다.
  }
}

/** 이 셀러의 **대기 중** 신청 1건 (없으면 null). */
export async function pendingApplication(DB: D1Database, sellerId: number): Promise<MallApplicationRow | null> {
  await ensureMallApplications(DB)
  return DB.prepare(
    "SELECT id, seller_id, slug, name, status, note, mall_id, created_at, reviewed_at FROM mall_applications WHERE seller_id = ? AND status = 'pending' LIMIT 1",
  ).bind(sellerId).first<MallApplicationRow>().catch(() => null)
}
