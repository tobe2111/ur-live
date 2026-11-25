/**
 * 🚫 2026-11-25 발송 대상에서 반드시 빠져야 하는 리드 — 수신거부 · 거부 회신 · 스팸 신고 (유어애즈).
 *
 * 발송 대기열(`outreach-queue.ts`)은 이 조건을 봤지만 어드민의 두 발송 버튼(동의 리드 발송 · 콜드 제안)은 안 봤다.
 * 콜드 발송은 `opted_out` · `is_brand` · 이미 연락한 리드(`contacted_at`)도 걸러내지 않았다.
 * 지금은 메일 키가 없어 실제로 나가지 않지만, 키를 넣는 순간 수신거부한 사람에게 광고가 간다.
 */
export const NOT_SUPPRESSED_SQL = "AND COALESCE(opted_out, 0) = 0 AND (email_status IS NULL OR email_status NOT IN ('opt_out', 'complained', 'bounced'))"
