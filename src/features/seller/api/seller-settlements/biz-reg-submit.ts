/**
 * 🪪 사업자등록증 (재)제출 — 반려 뒤에도 **돌아올 길**이 있어야 한다 (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * 그 전 이 자리에 구멍이 셋 있었다:
 *  ① **매장이 반려된 뒤 서류를 고쳐 내도 심사 큐로 안 돌아갔다** — 등록증 상태만 'pending' 으로 바꾸고
 *     `sellers.status = 'rejected'` 는 그대로 둬서, 어드민 승인 화면(status='pending' 목록)에 다시 뜨지 않았다.
 *     사장님 화면엔 "제출되었습니다" 가 떴으니 본인은 기다리고, 어드민은 받은 게 없다.
 *  ② **아무 https 주소나 받았다** — 등록증 칸에 남의 서버 주소를 넣으면 어드민 화면이 그걸 띄운다.
 *     가입 문은 이미 우리 업로드 자리(`/api/media/uploads/biz-cert/`)만 받는다 — 같은 규칙으로 맞춘다
 *     (우리 도메인의 절대 주소는 경로로 바꿔 저장 — 라이브에 그 모양이 섞여 있다).
 *  ③ 어드민 알림 링크가 없는 화면(`/admin/sellers`)을 가리켰다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { BIZ_CERT_PATH } from '../../../../worker/utils/store-ownership-claims'

const OWN_HOSTS = new Set(['urdeal.kr', 'www.urdeal.kr', 'live.ur-team.com', 'ur-live.pages.dev']) // legacy-domain-ok — 이전 전에 저장된 절대 주소를 받기 위한 호스트 집합(표시 문자열 아님)

/** 우리 업로드 자리의 등록증만 경로로 돌려준다. 그 밖은 null. */
export function normalizeBizCertUrl(raw: unknown): string | null {
  const s = String(raw ?? '').trim()
  if (!s || s.length > 2000) return null
  if (BIZ_CERT_PATH.test(s)) return s
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' || !OWN_HOSTS.has(u.hostname)) return null
    return BIZ_CERT_PATH.test(u.pathname) ? u.pathname : null
  } catch { return null }
}

export type BizRegSubmitResult =
  | { ok: true; resubmittedStore: boolean }
  | { ok: false; status: 400; error: string }

export async function submitBizRegistration(
  db: D1Database,
  sellerId: number | string,
  body: { image_url?: unknown; business_number?: unknown },
): Promise<BizRegSubmitResult> {
  const imageUrl = normalizeBizCertUrl(body.image_url)
  if (!imageUrl) return { ok: false, status: 400, error: '사업자등록증은 업로드한 사진만 제출할 수 있어요' }
  const businessNumber = String(body.business_number ?? '').trim()
  if (businessNumber && !/^\d{3}-?\d{2}-?\d{5}$|^\d{10}$/.test(businessNumber.replace(/[^\d-]/g, ''))) {
    return { ok: false, status: 400, error: '사업자등록번호 형식이 올바르지 않습니다 (예: 123-45-67890)' }
  }
  await db.prepare(
    `UPDATE sellers
        SET business_registration_image_url = ?,
            business_registration_status = 'pending',
            business_registration_reject_reason = NULL,
            business_number = COALESCE(NULLIF(?, ''), business_number),
            updated_at = datetime('now')
      WHERE id = ?`,
  ).bind(imageUrl, businessNumber, sellerId).run()

  // ① 반려된 매장이면 심사 큐로 되돌린다 — CAS(rejected 일 때만). 정지(suspended)는 건드리지 않는다:
  //    정지는 운영 판단이라 서류를 다시 낸다고 풀리면 안 된다.
  const back = await db.prepare(
    "UPDATE sellers SET status = 'pending', updated_at = datetime('now') WHERE id = ? AND status = 'rejected'",
  ).bind(sellerId).run().catch(() => null)
  const resubmittedStore = Number(back?.meta?.changes ?? 0) === 1
  if (resubmittedStore) {
    await db.prepare(
      "INSERT INTO seller_status_history (seller_id, prev_status, new_status, reason) VALUES (?, 'rejected', 'pending', '등록증 재제출')",
    ).bind(sellerId).run().catch(() => null)
  }
  return { ok: true, resubmittedStore }
}
