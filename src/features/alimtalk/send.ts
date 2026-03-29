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

  // 1. 잔액 확인
  const credit = await DB.prepare(
    'SELECT balance FROM seller_credits WHERE seller_id = ?'
  ).bind(sellerId).first<{ balance: number }>();

  if (!credit || credit.balance < 1) {
    console.warn(`[Alimtalk] seller ${sellerId} 잔액 부족 (${credit?.balance ?? 0}건)`);
    return { success: false, error: '알림톡 크레딧이 부족합니다' };
  }

  // 템플릿 코드 미설정 (검수 중) → 발송 스킵, 로그만 기록
  if (!templateCode || templateCode === 'TBD') {
    console.warn('[Alimtalk] 템플릿 코드 미설정 — 발송 스킵');
    await DB.prepare(`
      INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, error_msg, created_at)
      VALUES (?, ?, 'TBD', ?, ?, 0, '템플릿 검수 대기 중', datetime('now'))
    `).bind(sellerId, receiver, message, orderId ?? null).run();
    return { success: false, error: '템플릿 검수 대기 중' };
  }

  // 2. 알리고 API 호출
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

  // 3. 성공 시만 크레딧 차감 (D1 batch)
  if (result.success) {
    await DB.batch([
      DB.prepare(`
        UPDATE seller_credits SET balance = balance - 1, updated_at = datetime('now')
        WHERE seller_id = ? AND balance >= 1
      `).bind(sellerId),
      DB.prepare(`
        INSERT INTO credit_transactions (seller_id, type, amount, description, created_at)
        VALUES (?, 'deduct', -1, ?, datetime('now'))
      `).bind(sellerId, `알림톡 발송 - ${orderId ?? '수동'}`),
      DB.prepare(`
        INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, created_at)
        VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
      `).bind(sellerId, receiver, templateCode, message, orderId ?? null),
    ]);
  } else {
    // 실패 로그만 기록, 크레딧 차감 없음
    await DB.prepare(`
      INSERT INTO alimtalk_logs (seller_id, receiver, template_code, message, order_id, success, error_msg, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, datetime('now'))
    `).bind(sellerId, receiver, templateCode, message, orderId ?? null, result.message).run();
  }

  return { success: result.success, error: result.success ? undefined : result.message };
}
