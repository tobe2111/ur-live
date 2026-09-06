/**
 * 매장 영입자(소개자) 재배정 — 에이전시·사람 공용 SSOT
 *
 * 🧱 2026-08-31 분리 — `admin-sellers.routes.ts` 가 파일크기 래칫(1078줄)을 넘겨서
 *   같은이름 폴더로 뺐다(레포 룰: "600줄 전에 폴더로", 대형 파일은 성장 금지).
 *   그런데 **줄 수를 줄이려고 쪼갠 것이 아니다** — 두 핸들러는 존재확인 테이블·컬럼 이름만
 *   다르고 나머지(낙관적 잠금·상호배제·감사로그·409)가 **글자 단위로 같은 복제본**이었다.
 *   복제본이 둘이면 한쪽만 고쳐지는 사고가 난다. 실제로 그랬다 — 아래 참조.
 *
 * 🩸 이 파일이 존재하는 진짜 이유(2026-08-31 수리한 버그):
 *   `sellers.introduced_by_influencer_id` 를 나머지 네 곳은 전부 **`users.id`** 로 읽는데
 *   (적립 `influencer-store-intro-commission` · 지급 `marketing.routes /payouts/process` ·
 *    매장 카드 GET 의 `JOIN users` · 등록 링크 `seller-stores.routes`),
 *   재배정 API 만 **`sellers.id`** 로 검증하고 있었다(2026-05-21 작성 당시엔 영입자가 셀러였고,
 *   2026-08-26 "신분이 아니라 행위" 확정 뒤 이 자리만 안 따라왔다).
 *   ⚠️ 두 id 공간이 **라이브에서 실제로 겹친다**(셀러 3·5·6 ↔ 유저 3·5·6). 셀러 5 를 지정하면
 *   저항 없이 저장되고 2% 는 **유저 5** 에게 간다 — 에러가 없어서 정산 때까지 모른다.
 *
 * 🔒 한 가게 = 1 lock-in: 에이전시를 넣으면 사람이 비워지고, 사람을 넣으면 에이전시가 비워진다.
 * 🔒 낙관적 잠금: `WHERE COALESCE(updated_at,'') = COALESCE(?,'')` — 두 어드민이 동시에 바꾸면
 *   나중 요청이 409 를 받는다(감사로그가 "5→10" 인데 실제로는 "5→20" 이 되던 2026-05-22 사고).
 */
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'

/**
 * 🌇 2026-09-05 에이전시 일몰 — `'agency'` 종류 삭제(대표 "에이전시 남은 잔재 다 삭제").
 * 어드민 UI 는 원래 `reassign-influencer` 하나만 불렀고, agency 쪽 라우트는 화면 없이 살아 있는
 * **쓰기 경로**였다 — 일몰된 개념에 매장을 붙일 수 있는 문은 남겨 두지 않는다.
 */
export type IntroducerKind = 'influencer'

interface KindSpec {
  /** sellers 의 대상 컬럼 */
  column: string
  /** 상호배제로 비울 반대편 컬럼 */
  otherColumn: string
  /** 요청 body 의 id 필드명 */
  bodyField: string
  /** 존재 확인 테이블 — 🩸 influencer 는 `users` 다(위 주석 참조) */
  existsTable: string
  /** 존재하지 않을 때의 메시지 */
  notFoundError: string
  /** admin_audit_log 의 action */
  auditAction: string
  /** 응답의 이전/새 값 필드명 */
  prevField: string
  nextField: string
}

const SPECS: Record<IntroducerKind, KindSpec> = {
  influencer: {
    column: 'introduced_by_influencer_id',
    otherColumn: 'introduced_by_agency_id',
    bodyField: 'new_influencer_id',
    // 🩸 `sellers` 가 아니다 — 적립·지급·조회가 전부 users.id 로 읽는다.
    existsTable: 'users',
    notFoundError: '대상 유저를 찾을 수 없습니다. (유저 id 를 입력하세요 — 셀러 id 가 아닙니다)',
    auditAction: 'influencer_reassign',
    prevField: 'previous_influencer_id',
    nextField: 'new_influencer_id',
  },
}

interface CurrentRow {
  introduced_by_agency_id: number | null
  introduced_by_influencer_id: number | null
  updated_at: string | null
}

/**
 * 두 재배정 엔드포인트의 공용 본문.
 * `safeErr` 는 호출부(admin-sellers.routes)의 `safeAdminError` 를 그대로 받는다 —
 * 그 함수는 파일 안 40여 곳이 쓰고 있어 여기로 옮기지 않았다.
 */
export async function reassignIntroducer(
  c: Context<{ Bindings: Env }>,
  kind: IntroducerKind,
  safeErr: (err: unknown, env: Env) => string,
): Promise<Response> {
  const spec = SPECS[kind]
  try {
    const { DB } = c.env
    const sellerId = c.req.param('id')
    if (!sellerId || !/^\d+$/.test(String(sellerId))) return c.json({ success: false, error: 'Invalid ID' }, 400)

    const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '').trim()
    if (!reason || reason.length < 5) {
      return c.json({ success: false, error: '재배정 사유를 최소 5자 이상 입력하세요.' }, 400)
    }

    // 🔒 필드가 **없는 것**과 **명시적 null(해제)** 을 구분한다.
    //   분리 전 코드는 필드가 빠지면 `undefined` 를 그대로 bind 해 D1 이 던졌다(500).
    //   그걸 조용히 null 로 접으면 오타 한 번에 **영입자가 해제**된다 — 지금 붙어 있는 2% 가 사라진다.
    //   그래서 500 도 무음 해제도 아닌 400 으로 명시한다.
    const raw = body[spec.bodyField]
    if (raw === undefined) {
      return c.json({ success: false, error: `${spec.bodyField} 를 보내세요 (해제하려면 null).` }, 400)
    }
    let newId: number | null = null
    if (raw !== null) {
      const n = Number(raw)
      if (!Number.isInteger(n) || n <= 0) {
        return c.json({ success: false, error: `${spec.bodyField} 가 올바른 번호가 아닙니다.` }, 400)
      }
      newId = n
    }

    if (newId != null) {
      const found = await DB.prepare(`SELECT id FROM ${spec.existsTable} WHERE id = ? LIMIT 1`).bind(newId).first()
      if (!found) return c.json({ success: false, error: spec.notFoundError }, 404)
    }

    // 현재 값 (감사 로그용 + 낙관적 잠금 기준값)
    const current = await DB.prepare(
      'SELECT introduced_by_agency_id, introduced_by_influencer_id, updated_at FROM sellers WHERE id = ?',
    ).bind(sellerId).first<CurrentRow>()
    if (!current) return c.json({ success: false, error: '셀러를 찾을 수 없습니다.' }, 404)

    const previousId = current[spec.column as keyof CurrentRow] as number | null
    const previousUpdatedAt = current.updated_at
    const otherHeld = current[spec.otherColumn as keyof CurrentRow] as number | null

    // 한 가게 = 1 lock-in — 새 값을 넣는데 반대편이 잡혀 있으면 같은 UPDATE 에서 비운다.
    const clearOther = newId != null && otherHeld != null
    const setClause = clearOther
      ? `${spec.column} = ?, ${spec.otherColumn} = NULL`
      : `${spec.column} = ?`
    const casResult = await DB.prepare(
      `UPDATE sellers SET ${setClause}, introduced_at = datetime('now'), updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND COALESCE(updated_at, '') = COALESCE(?, '')`,
    ).bind(newId, sellerId, previousUpdatedAt).run()

    if (!casResult.meta?.changes) {
      return c.json({
        success: false,
        error: '다른 어드민이 방금 수정했습니다. 새로고침 후 다시 시도하세요.',
        code: 'CONCURRENT_MODIFICATION',
      }, 409)
    }

    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } | undefined }).get('user')
    try {
      await DB.prepare(
        `INSERT INTO admin_audit_log (actor_id, actor_email, action, resource_type, resource_id, old_value, new_value, ip, created_at)
         VALUES (?, ?, ?, 'seller', ?, ?, ?, ?, datetime('now'))`,
      ).bind(
        String(actor?.id || 'unknown'),
        actor?.email || null,
        spec.auditAction,
        sellerId,
        JSON.stringify({ [spec.column]: previousId }),
        JSON.stringify({ [spec.column]: newId, reason }),
        c.req.header('CF-Connecting-IP') || null,
      ).run()
    } catch { /* admin_audit_log 없으면 silent skip */ }

    return c.json({
      success: true,
      data: { seller_id: sellerId, [spec.prevField]: previousId, [spec.nextField]: newId, reason },
    })
  } catch (err) {
    return c.json({ success: false, error: safeErr(err, c.env) }, 500)
  }
}
