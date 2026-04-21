/**
 * 알림톡 발송 내부 유틸
 * order.routes.ts 등에서 import해서 사용
 *
 * - 크레딧 잔액 확인 → 알리고 API 호출 → 크레딧 차감 → 로그 기록
 * - 발송 실패 시 크레딧 차감하지 않음
 */

import { sendAlimtalk } from './aligo';
import type { D1Database } from '@cloudflare/workers-types';

interface SendAlimtalkOptions {
  DB: D1Database;
  aligoApiKey: string;
  aligoUserId: string;
  aligoSenderKey: string;
  sellerId: number;
  receiver: string;     // 수신자 전화번호 (하이픈 없이 또는 있어도 됨)
  receiverName: string;
  templateCode: string;
  subject: string;
  message: string;
  orderId?: string;
  senderPhone?: string; // 발신번호 (기본값: 알리고 계정 발신번호)
}

/**
 * 알림톡 발송 + 크레딧 차감
 * @returns { success, deducted } deducted=true면 크레딧 1건 차감됨
 */
export async function sendSellerAlimtalk(opts: SendAlimtalkOptions): Promise<{ success: boolean; error?: string }> {
  const {
    DB, aligoApiKey, aligoUserId, aligoSenderKey,
    sellerId, receiver, receiverName,
    templateCode, subject, message, orderId,
    senderPhone = '',  // ALIGO_SENDER_PHONE 환경변수로 주입 필요
  } = opts;

  // 템플릿 코드 미설정 (검수 중) → 발송 스킵, 로그만 기록 (크레딧 차감 없음)
  if (!templateCode || templateCode === 'TBD') {
    console.warn('[Alimtalk] 템플릿 코드 미설정 — 발송 스킵');
    await DB.prepare(`
      INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, error_msg, created_at)
      VALUES (?, ?, 'TBD', ?, ?, 0, '템플릿 검수 대기 중', datetime('now'))
    `).bind(sellerId, receiver, message, orderId ?? null).run();
    return { success: false, error: '템플릿 검수 대기 중' };
  }

  // 1. 원자적 크레딧 차감 (race-free).
  //    기존 SELECT → check → UPDATE 는 동시 발송 시 잔액이 음수가 될 수 있었음.
  //    "UPDATE ... WHERE balance >= 1" 은 단일 statement라 D1/SQLite 보장됨.
  const deductResult = await DB.prepare(
    "UPDATE seller_credits SET balance = balance - 1, updated_at = datetime('now') WHERE seller_id = ? AND balance >= 1"
  ).bind(sellerId).run();

  if (!deductResult.meta.changes) {
    console.warn(`[Alimtalk] seller ${sellerId} 크레딧 부족 — 차감 실패`);
    return { success: false, error: '브랜드메시지 크레딧이 부족합니다' };
  }

  // 2. 알리고 API 호출 (크레딧이 이미 차감된 상태)
  const result = await sendAlimtalk({
    apikey: aligoApiKey,
    userid: aligoUserId,
    senderkey: aligoSenderKey,
    tpl_code: templateCode,
    sender: senderPhone,
    receiver_1: receiver.replace(/-/g, ''),
    recvname_1: receiverName,
    subject_1: subject,
    message_1: message,
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
      `).bind(sellerId, receiver, templateCode, message, orderId ?? null, result.message),
    ]);
  }

  return { success: result.success, error: result.success ? undefined : result.message };
}
