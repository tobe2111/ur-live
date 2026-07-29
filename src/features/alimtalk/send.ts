/**
 * 알림톡 발송 내부 유틸
 * order.routes.ts 등에서 import해서 사용
 *
 * - 크레딧 잔액 확인 → 알리고 API 호출 → 크레딧 차감 → 로그 기록
 * - 발송 실패 시 크레딧 차감하지 않음
 */

import { sendAlimtalk } from './aligo';
import type { D1Database } from '@cloudflare/workers-types';

// ── 🔔 SMS 대체발송(failover) 게이트 — 2026-07-11 pre-flip-risk-audit §⑤ ──────────
// 카카오 장애/알림톡 거부 시 Aligo 가 서버측에서 SMS 로 대체발송하는 파라미터
// (aligo.ts `failover`/`fsubject_1`/`fmessage_1`)를 이 공용 경로 한 곳(single choke
// point)에서만 주입한다 — 호출부(payment.routes / seller-orders.routes 등) 개별 수정 금지.
//
// ⚠️ 활성 절차(기본 OFF — 켜기 전 반드시):
//   ① Aligo 콘솔에 SMS 발신번호(ALIGO_SENDER_PHONE 과 동일 번호) 등록·인증 확인
//   ② Cloudflare 대시보드 env `ALIMTALK_SMS_FAILOVER=true` 설정
//   과금: 대체발송은 알림톡 "실패 건"에만 SMS 요금 발생.
//
// env 는 request context 밖(공용 유틸)이라 `cloudflare:workers` 의 top-level env 로
// 읽는다(호출부 시그니처 불변). 비-Workers 런타임(vitest 등)은 import 실패 → fail-closed(OFF).
let _failoverGate: Promise<boolean> | null = null;
function isSmsFailoverEnabled(): Promise<boolean> {
  if (!_failoverGate) {
    _failoverGate = import('cloudflare:workers')
      .then((mod) => (mod.env as { ALIMTALK_SMS_FAILOVER?: string } | undefined)?.ALIMTALK_SMS_FAILOVER === 'true')
      .catch(() => false);
  }
  return _failoverGate;
}

/** Aligo 대체 SMS 필드 길이 안전 truncate — fsubject(LMS 제목) ~30자, fmessage(LMS 본문) 2,000byte(EUC-KR 한글 2byte ≈ 1,000자). */
function truncateForSms(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

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
  //    SMS failover: 게이트 ON + 발신번호 보유 시에만 필드 자체를 추가 (OFF = 기존 payload byte-동일).
  //    대체 문안은 알림톡 본문 재사용 — Aligo 가 길이에 따라 SMS/LMS 자동 선택.
  //    발신번호 없이 failover=Y 를 보내면 Aligo 가 요청 전체를 거부할 수 있어 senderPhone 필수.
  const failoverOn = (await isSmsFailoverEnabled()) && !!senderPhone;
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
    ...(failoverOn ? {
      failover: 'Y' as const,
      fsubject_1: truncateForSms(subject, 30),
      fmessage_1: truncateForSms(message, 1000),
    } : {}),
  });

  // failover 발동 여부 + Aligo 응답 코드 로깅 (스키마 변경 없음 — 콘솔 수준).
  // 주의: 대체 SMS 실제 발송 여부는 Aligo 서버측 후처리라 동기 응답엔 없음 — "요청됨"만 기록.
  if (failoverOn) {
    console.log(`[Alimtalk] SMS failover=Y 요청 (tpl=${templateCode}, code=${result.code})`);
  }

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
      `).bind(sellerId, receiver, templateCode, message, orderId ?? null,
        // failover 요청 여부를 기존 error_msg 텍스트에만 표기 (컬럼 추가 없음). 게이트 OFF 면 기존과 byte-동일.
        failoverOn ? `[failover=Y] ${result.message}` : result.message),
    ]);
  }

  return { success: result.success, error: result.success ? undefined : result.message };
}
