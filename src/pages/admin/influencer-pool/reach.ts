/**
 * 📨 인플루언서 "연락하기" 채널 선택 헬퍼 (순수 — 테스트 가능).
 *   ⚖️ [LEGAL] 자동 발송 없음. 여기 함수들은 mailto/DM 링크와 붙여넣기용 텍스트만 만든다.
 *   사람이 링크를 열어 눈으로 확인하고 직접 보낸다(정보통신망법 — 광고성 정보는 사전 수신동의 필요).
 *   이메일이 없는 블로거는 인스타 DM → 블로그 쪽지/댓글 순으로 "붙여넣기용 초안"을 클립보드에 담아준다.
 */
export interface ReachLead {
  name: string
  platform: string
  url: string
  email: string | null
  instagram: string | null
  outreach_draft?: string | null   // 리드 행에서 optional 이라 undefined 허용
  /**
   * ⚖️ 서버가 만들어 준 **법정 표기 포함** 문안(`outreach-template` SSOT).
   *   ⚠️ 아래 fallback* 보다 **항상 우선**한다. 화면 폴백엔 `(광고)` 표기와 전송자 정보가 없었는데,
   *   대표가 실제로 쓰는 경로가 화면이라 **의무 표기가 빠진 쪽이 실사용 경로**였다(2026-07-29 발견).
   *   엑셀 내보내기는 이미 SSOT 를 쓰고 있었다 — 두 경로가 갈라져 있던 것.
   */
  mail_subject?: string | null
  mail_body?: string | null
}
export interface ReachDraft { subject: string; body: string; dm: string }

/** 컨택 채널 값(PATCH contact_channel 과 동일 vocab). */
export type ReachChannel = 'email' | 'dm' | 'note'

export interface ReachPlan {
  channel: ReachChannel   // 컨택 성사 시 기록할 채널
  href: string            // 원클릭으로 열 링크(메일앱/인스타DM/블로그)
  openLabel: string       // 버튼/토스트 라벨
  clipboard: string       // 열린 화면에 붙여넣을 초안 텍스트(이메일은 앱이 채우므로 dm 을 복사)
}

/** 저장된 초안 JSON 파싱(깨지면 null). */
export function parseReachDraft(raw: string | null | undefined): ReachDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<ReachDraft>
    if (d && typeof d.subject === 'string' && typeof d.body === 'string') {
      return { subject: d.subject, body: d.body, dm: typeof d.dm === 'string' ? d.dm : '' }
    }
  } catch { /* ignore */ }
  return null
}

/** 초안이 없을 때 쓰는 공통 폴백 문구(수신거부 안내 포함). */
export function fallbackSubject(name: string): string {
  // ⚖️ `(광고)` 는 정보통신망법상 영리 목적 광고성 정보의 **제목 의무 표기**다. 서버 문안(`mail_subject`)이
  //   오면 그쪽이 우선이고, 이건 그게 못 왔을 때의 안전망 — 안전망에도 표기가 있어야 의미가 있다.
  return `(광고) [유어딜] ${name}님 제휴 제안 — 동네 맛집·뷰티 공동구매 딜`
}
export function fallbackBody(name: string): string {
  return `안녕하세요, ${name}님.\n유어딜(동네 맛집·카페·뷰티·네일·숙소 공동구매 딜 플랫폼) 제휴 담당자입니다.\n${name}님 채널과 결이 잘 맞아 협업을 제안드리고자 연락드립니다.\n\n- 제안: 유어딜 딜 콘텐츠 제휴 / 공동 프로모션\n- 조건은 협의 가능합니다.\n\n관심 있으시면 회신 부탁드립니다. 감사합니다.\n\n(수신을 원치 않으시면 회신으로 알려주세요.)`
}
/** 초안이 없을 때 DM/쪽지용 짧은 폴백. */
export function fallbackDm(name: string): string {
  return `안녕하세요 ${name}님, 유어딜 제휴 담당자입니다. 동네 맛집·뷰티 딜 콘텐츠 협업을 제안드리고 싶어 연락드려요. 관심 있으시면 편하게 회신 부탁드립니다. (원치 않으시면 알려주세요, 바로 중단하겠습니다.)`
}

const IG_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/
/** 인스타 DM 딥링크 — 유효한 핸들일 때만(SSRF/오픈리다이렉트 방지). */
export function igDmHref(handle: string | null): string | null {
  if (!handle) return null
  const h = handle.replace(/^@/, '').trim()
  return IG_HANDLE_RE.test(h) ? `https://ig.me/m/${h}` : null
}

/**
 * 리드 1명에게 "지금 연락"할 최적 채널을 고른다.
 *   1) 이메일 있으면 → mailto(초안/폴백 채움), channel='email'
 *   2) 없고 인스타 있으면 → 인스타 DM 링크 + DM 초안 클립보드, channel='dm'
 *   3) 둘 다 없으면 → 블로그/채널 URL 열기 + DM 초안 클립보드(쪽지/댓글 붙여넣기), channel='note'
 * 반환 null = 열 링크가 없음(예: url 도 없음).
 */
export function pickReach(lead: ReachLead): ReachPlan | null {
  const d = parseReachDraft(lead.outreach_draft)
  const dm = (d?.dm && d.dm.trim()) || fallbackDm(lead.name)

  if (lead.email) {
    // 우선순위: AI 초안 > **서버 SSOT 문안(법정 표기 포함)** > 화면 폴백(구버전 응답 호환)
    const subject = d?.subject || lead.mail_subject || fallbackSubject(lead.name)
    const body = d?.body || lead.mail_body || fallbackBody(lead.name)
    return {
      channel: 'email',
      href: `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      openLabel: '메일 앱 열기',
      clipboard: body,
    }
  }
  const ig = igDmHref(lead.instagram)
  if (ig) {
    return { channel: 'dm', href: ig, openLabel: '인스타 DM 열기', clipboard: dm }
  }
  if (lead.url && /^https?:\/\//i.test(lead.url)) {
    return { channel: 'note', href: lead.url, openLabel: '블로그 열기(쪽지·댓글)', clipboard: dm }
  }
  return null
}
