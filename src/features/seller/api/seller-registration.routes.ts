/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Registration & Switch (3 endpoints)
 *
 * 원본 위치: seller-management.routes.ts (178-617). cohesive auth/registration 블록.
 *
 * - GET  /my-seller-status     — 현재 사용자가 셀러인지 + 정보
 * - POST /switch-to-seller     — 동일 user 가 셀러 컨텍스트로 전환
 * - POST /switch-to-user       — 셀러 → 일반 유저로 전환
 *
 * 🪦 2026-10-12: POST /register-from-user 삭제 — 그 문을 부르던 가입 화면(/seller/register/supplier)이
 *   같은 날 지워졌고 가입 문은 /store/new 하나다. 되살리려면 git revert.
 * 🪦 2026-10-12: POST /register(이메일·비번 셀러 가입) 삭제 — 부르는 화면이 0 이다(가입 문 = /store/new,
 *   셀러 이메일 로그인 화면도 같은 날 카카오 /login 별칭이 됐다). 되살리려면 git revert.
 *
 * 마운트: app.route('/api/seller', sellerRegistrationRoutes) — 다른 /api/seller
 *   라우터 (kakao-link, alimtalk-mgmt, management) 와 path 겹침 0.
 */
import { Hono } from 'hono'
// 🔁 2026-09-16 (파일 분해): 상태 조회·세션 전환 3개는 별 파일로. 경로·순서 불변.
import { mountSellerSessionRoutes } from './seller-registration/session-routes'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export const sellerRegistrationRoutes = new Hono<{ Bindings: Bindings }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

let _sellerColumnsEnsured = false
async function ensureSellerColumns(db: D1Database) {
  if (_done_ensureSellerColumns.has(db)) return
  _done_ensureSellerColumns.add(db)
  if (_sellerColumnsEnsured) return
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER`).run() } catch { /* exists */ }
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'`).run() } catch { /* exists */ }
  // 🛡️ 2026-06-12 (감사 1단계): 거절 사유 — admin-tools reject 가 저장, /my-seller-status 가 반환.
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN reject_reason TEXT`).run() } catch { /* exists */ }
  _sellerColumnsEnsured = true
}

// 🔁 GET /my-seller-status · POST /switch-to-seller · POST /switch-to-user — 같은 인스턴스에 등록한다.
mountSellerSessionRoutes(sellerRegistrationRoutes, ensureSellerColumns)

// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSellerColumns = new WeakSet<object>()
