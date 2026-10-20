/**
 * 📨 콜드 제휴 제안 발송 — 안전장치 (2026-07-28 대표 결정으로 신설).
 *
 * ⚖️ **규칙 변경 이력 — 다음 세션이 반드시 읽을 것**
 *   2026-07-20·07-21: "콜드(미동의 수집 풀) 자동 발송 경로는 만들지 않는다 — 동의 풀만 자동, 콜드는 사람이
 *     1건씩" 로 대표와 합의(→ `outreach-send.ts` 헤더).
 *   2026-07-28: 대표가 **명시적으로 뒤집음** — "이메일 위주로 갈 거고, 수집한 이메일은 제휴 제안을 받고파
 *     하는 이메일들이야. 제휴 제안을 할 거야." 근거: 수집 대상이 유튜브 채널의 **공개된 비즈니스 문의
 *     이메일**(제휴 문의를 받으려고 본인이 공개한 주소)이라는 것. AskUserQuestion 으로 3개 선택지
 *     (콜드 신설 / 1:1 검토 / 동의 퍼널 우선) 제시 후 **'콜드 발송 경로 신설(규칙 변경)'** 을 선택.
 *
 * ⚠️ 남는 리스크(대표에게 고지 완료): 정보통신망법 제50조는 영리 목적 광고성 정보에 **사전 수신동의**를
 *   요구한다. 공개된 문의용 주소라도 '사전 동의'는 아니므로 형식적 위반 소지가 남는다. 그래서 이 경로는
 *   법이 요구하는 표시·차단 의무를 **전부 코드로 강제**하고(제목 (광고) 표기 · 수신거부 안내 · 전송자 정보 ·
 *   야간 금지), 콜드 전용 제동장치를 추가한다. 아래 가드는 **약화 금지** — 약화하면 규칙 변경의 전제가 깨진다.
 *
 * 콜드 전용 제동장치(동의 경로에는 없는 것):
 *   ① 1일 상한   — 하루 총 발송량 제한(평판 보호 + 사고 시 피해 상한)
 *   ② 반송 회로차단 — 최근 발송의 반송/신고 비율이 임계 초과면 발송 자체를 거부(리스트가 나쁘다는 신호)
 *   ③ 긴 쿨다운  — 같은 사람에게 재발송 금지 기간을 동의 경로(7일)보다 길게(30일)
 *   ④ force 없음 — 동의 경로의 `force`(재발송 강행) 같은 우회 스위치를 두지 않는다
 */

/** 1회 호출당 최대 수신자(동의 경로 50 보다 보수적). */
export const COLD_SEND_MAX = 30
/** 하루 총 콜드 발송 상한. */
export const COLD_DAILY_MAX = 200
/** 같은 리드에 대한 재발송 금지 기간(일). */
export const COLD_COOLDOWN_DAYS = 30
/** 반송 회로차단 — 최근 표본이 이 수 이상일 때만 비율을 판단(소표본 과민반응 방지). */
export const COLD_BOUNCE_MIN_SAMPLE = 20
/** 반송/스팸신고 비율이 이 값을 넘으면 발송 거부(%). */
export const COLD_BOUNCE_MAX_PCT = 8

/** KST 기준 날짜 키 — 1일 상한 카운터(발송 제한은 수신자 기준 시간대로 세는 게 맞다). */
export function coldDailyKey(nowMs: number): string {
  return `ads_cold_sent_${new Date(nowMs + 9 * 3600_000).toISOString().slice(0, 10)}`
}

export interface ColdGuardResult {
  ok: boolean
  error?: string
  /** 오늘 남은 발송 가능 수(ok 일 때). */
  remaining?: number
}

/**
 * 발송 **전** 게이트 — 1일 상한과 반송 회로차단을 함께 판단한다.
 * @param used  오늘 이미 보낸 수(platform_settings 카운터)
 * @param sample 최근 콜드 발송 표본 { sent, bad } (bad = bounced + complained)
 */
export function evaluateColdGuards(used: number, sample: { sent: number; bad: number }): ColdGuardResult {
  const remaining = COLD_DAILY_MAX - used
  if (remaining <= 0) {
    return { ok: false, error: `오늘 콜드 발송 한도(${COLD_DAILY_MAX}건)를 모두 사용했습니다. 내일 다시 시도해주세요` }
  }
  if (sample.sent >= COLD_BOUNCE_MIN_SAMPLE) {
    const pct = (sample.bad / sample.sent) * 100
    if (pct > COLD_BOUNCE_MAX_PCT) {
      return {
        ok: false,
        error: `최근 발송의 반송·스팸신고 비율이 ${pct.toFixed(1)}% 로 임계(${COLD_BOUNCE_MAX_PCT}%)를 넘었습니다. `
          + '주소 품질을 점검하기 전까지 콜드 발송을 중단합니다(발신 도메인 평판 보호).',
      }
    }
  }
  return { ok: true, remaining }
}
