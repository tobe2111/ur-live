/**
 * 📨 2026-07-21 유어애즈 — **동의 리드 한정** 이메일 자동 발송 헬퍼 (순수 — 테스트 가능).
 *   ⚖️ [LEGAL] 자동 발송은 **사전 수신동의자에게만**(정보통신망법). 호출부(admin 라우트)가
 *   SQL 로 `consented_at IS NOT NULL` 을 강제하고, 이 모듈은 본문에 수신거부 안내를 코드로 강제한다.
 *   콜드 리드(미동의 수집 풀) 자동 발송 경로는 구조적으로 없음 — 만들지 않는다(2026-07-20 대표 합의,
 *   2026-07-21 재확인: 동의 풀만 자동, 콜드는 사람이 1건씩).
 */
import { OPT_OUT_LINE } from './influencer-outreach'

/** 발송 1회 호출당 최대 수신자(워커 subrequest·Resend rate 여유). 초과는 클라가 나눠 호출. */
export const CONSENTED_SEND_MAX = 50

/** {name}/{이름} 플레이스홀더 치환 — 캠페인 본문 개인화. */
export function personalize(template: string, name: string): string {
  return template.replaceAll('{name}', name).replaceAll('{이름}', name)
}

/** 수신거부 안내 강제 — 본문에 없으면 끝에 붙임(법규 문구, 사람이 지워도 코드가 복원). */
export function withOptOut(body: string): string {
  return body.includes(OPT_OUT_LINE) ? body : `${body}\n\n${OPT_OUT_LINE}`
}

/** plain text → 안전한 HTML(이스케이프 + 줄바꿈) — Resend 는 html 필드를 받음. */
export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.7;color:#1f2937;white-space:pre-wrap">${esc}</div>`
}

/** 인바운드 신청 접수 확인 메일(거래성 — 신청이라는 행위에 대한 확인). */
export function welcomeEmail(name: string): { subject: string; body: string } {
  return {
    subject: `[유어딜] ${name}님, 제휴 크리에이터 신청이 접수되었습니다`,
    body: `안녕하세요, ${name}님.\n유어딜 제휴 담당자입니다.\n\n제휴 크리에이터 신청이 정상 접수되었습니다. 검토 후 남겨주신 연락처로 온보딩 안내를 드리겠습니다(보통 2~3일 내).\n\n그동안 유어딜이 어떤 서비스인지 궁금하시면 https://urdeal.kr/creators 를 참고해주세요.\n\n감사합니다.\n유어딜 드림\n\n${OPT_OUT_LINE}`,
  }
}

/** 캠페인 발송용 최종 본문 조립 — 개인화 + 수신거부 강제(순서 보장: 치환 후 강제). */
export function buildCampaignBody(template: string, name: string): string {
  return withOptOut(personalize(template, name))
}
