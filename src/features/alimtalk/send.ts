/**
 * 셀러 손님에게 가는 쇼핑 주문 알림톡(주문완료·배송시작·주문취소) — 셀러 크레딧 1건 차감.
 *
 * - 승인 확인 → 크레딧 원자 차감 → 네이버 클라우드 SENS 발송 → 로그 기록
 * - 발송 실패 시 크레딧을 되돌린다
 *
 * 📨 2026-10-12: 발송처가 알리고 → 네이버 클라우드 SENS 로 바뀌었다(대표 "이걸로 가자" · "알리고 잔해들 빼고").
 *   알리고는 보내는 서버의 고정 IP 등록이 필수인데 Cloudflare 는 나가는 IP 가 매번 달라 한 통도 못 보냈다.
 *   템플릿 코드는 SENS 에 등록할 때 우리가 정한다 — 우리 이름(`order_confirm` 등)을 그대로 쓴다.
 *   SMS 대체발송(failover)은 없앴다(대표 "문자는 안 쓸거고 카톡만" 2026-10-11).
 */

import type { D1Database } from '@cloudflare/workers-types';
import { sendSensAlimtalk, sensConfigured, type SensEnv } from '../../lib/ncp-sens';
import { approvedTemplateCode } from '../../lib/text-notice';

interface SendAlimtalkOptions {
  DB: D1Database;
  /** NCP_* 키가 든 env (ur-live 바인딩). */
  env: unknown;
  sellerId: number;
  receiver: string;     // 수신자 전화번호 (하이픈 없이 또는 있어도 됨)
  /** 우리 템플릿 이름 — 어드민 `alimtalk_approved_templates` 에 있어야 나간다. */
  templateCode: string;
  message: string;
  orderId?: string;
}

/**
 * 알림톡 발송 + 크레딧 차감
 */
export async function sendSellerAlimtalk(opts: SendAlimtalkOptions): Promise<{ success: boolean; error?: string }> {
  const { DB, env, sellerId, receiver, templateCode, message, orderId } = opts;
  const e = (env ?? {}) as Record<string, unknown>;
  if (!sensConfigured(e)) return { success: false, error: 'sens_not_configured' };

  // 템플릿 승인 전 → 발송 스킵, 로그만 기록 (크레딧 차감 없음)
  const code = await approvedTemplateCode(DB, templateCode);
  if (!code) {
    await DB.prepare(`
      INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, error_msg, created_at)
      VALUES (?, ?, ?, ?, ?, 0, '템플릿 검수 대기 중', datetime('now'))
    `).bind(sellerId, receiver, templateCode, message, orderId ?? null).run();
    return { success: false, error: '템플릿 검수 대기 중' };
  }

  // 1. 원자적 크레딧 차감 (race-free).
  //    "UPDATE ... WHERE balance >= 1" 은 단일 statement라 D1/SQLite 보장됨.
  const deductResult = await DB.prepare(
    "UPDATE seller_credits SET balance = balance - 1, updated_at = datetime('now') WHERE seller_id = ? AND balance >= 1"
  ).bind(sellerId).run();

  if (!deductResult.meta.changes) {
    console.warn(`[Alimtalk] seller ${sellerId} 크레딧 부족 — 차감 실패`);
    return { success: false, error: '브랜드메시지 크레딧이 부족합니다' };
  }

  // 2. SENS 호출 (크레딧이 이미 차감된 상태)
  const result = await sendSensAlimtalk(e as SensEnv, {
    templateCode: code,
    to: receiver.replace(/-/g, ''),
    content: message,
  });

  // 3. 결과에 따라 로그 기록 + (실패 시) 크레딧 롤백
  if (result.success) {
    await DB.batch([
      DB.prepare(`
        INSERT INTO credit_transactions (seller_id, type, amount, description, created_at)
        VALUES (?, 'deduct', -1, ?, datetime('now'))
      `).bind(sellerId, `브랜드메시지 발송 - ${orderId ?? '수동'}`),
      DB.prepare(`
        INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `).bind(sellerId, receiver, templateCode, message, orderId ?? null),
    ]);
  } else {
    // 발송 실패 → 차감된 크레딧 복구 + 실패 로그
    await DB.batch([
      DB.prepare(
        "UPDATE seller_credits SET balance = balance + 1, updated_at = datetime('now') WHERE seller_id = ?"
      ).bind(sellerId),
      DB.prepare(`
        INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, error_msg, created_at)
        VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))
      `).bind(sellerId, receiver, templateCode, message, orderId ?? null, result.error ?? 'unknown'),
    ]);
  }

  return { success: result.success, error: result.success ? undefined : result.error };
}
