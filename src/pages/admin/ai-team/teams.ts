/**
 * 🏢 AI 팀 조직도 데이터 (2026-11-26). 조직도 SSOT 는 `docs/design/ai-team-operating-model.md` §3,
 *   역할 정의 SSOT 는 `.claude/agents/<key>.md`(팀 목록이 그 폴더와 같은지는 시험이 대조한다).
 *   ⚠️ 그 파일들을 ?raw 로 통째로 넣지 않는다 — 2026-11-26 넣었더니 전체 JS 예산(gzip 2.27MB)을 넘었다.
 *      화면은 한 줄 설명(`job`)만 쓰면 된다.
 *   정기 근무(`shifts`)는 지금 켜진 예약 작업 기준이다(KST). 예약 작업을 바꾸면 여기도 바꾼다.
 */
/** 정기 근무 한 칸 — days 는 요일(0=일 … 6=토), 비우면 매일. hm 은 KST "HH:MM". */
export interface Shift { days: number[]; hm: string; what: string }

export interface TeamInfo {
  key: string
  name: string
  initial: string
  job: string
  shifts: Shift[]
  /** 정해진 시각이 아니라 일이 생기면 출근(예: PR 빨간불) — 화면에 그대로 적는다 */
  onEvent?: string
}

const D = (days: number[], hm: string, what: string): Shift => ({ days, hm, what })
const DAILY: number[] = []

/** 🗓️ 2026-11-26 대표 "모두 다 해줘" — 12팀 모두 실제 예약 작업이 있다. 이 표 = 예약 작업(list_triggers)의 KST 시각.
 *  일감 처리 당번(DUTY_SHIFTS)은 팀을 가리지 않고 쌓인 일감을 그 팀 역할로 처리한다. */
export const TEAMS: TeamInfo[] = [
  { key: 'ceo-office', name: '비서실장', initial: '비', job: '주간 보고, 결재함 정리, 팀 근무 감시', shifts: [D([1], '08:52', '주간 운영 보고')] },
  { key: 'sales', name: '매장영업', initial: '영', job: '팔 수 있는 매장 늘리기, 멈춘 매장 챙기기', shifts: [D(DAILY, '08:41', '영업 아침 보고')] },
  { key: 'partnerships', name: '제휴', initial: '제', job: '인플루언서·대행사 제안과 답장 기록', shifts: [D(DAILY, '11:53', '메일 답장 확인'), D(DAILY, '15:53', '메일 답장 확인'), D(DAILY, '19:53', '메일 답장 확인')] },
  { key: 'marketing', name: '마케팅', initial: '마', job: '검색 노출 점검, 블로그 초안 검토', shifts: [D([3], '15:29', '검색 노출·블로그 점검')] },
  { key: 'support', name: '고객지원', initial: '고', job: '인스타·메일·카톡 문의 24시간 안 응대', shifts: [D(DAILY, '10:23', '인스타 DM·댓글'), D(DAILY, '14:23', '인스타 DM·댓글'), D(DAILY, '18:23', '인스타 DM·댓글')] },
  { key: 'ops', name: '운영', initial: '운', job: '사장님 승인, 환불·반품 처리 준비', shifts: [D(DAILY, '13:37', '처리 대기열 판정')] },
  { key: 'planning', name: '기획', initial: '기', job: '문서와 실제 기능이 맞는지 정리', shifts: [D([2], '14:19', '기능 상태·문서 대조')] },
  { key: 'design', name: '디자인', initial: '디', job: '손님 화면 속도·밀림을 라이브에서 재기', shifts: [D([4], '15:11', '손님 화면 실측')] },
  { key: 'dev', name: '개발', initial: '개', job: '빨간불 당일 수리, 배포', shifts: [D(DAILY, '09:07', '배포·예약 작업 판정')], onEvent: 'PR 빨간불이 나면 즉시' },
  { key: 'qa', name: '품질·보안', initial: '품', job: '배포가 실제로 되는지 다시 재기, 보안 점검', shifts: [D(DAILY, '08:47', '오류 점검'), D([1], '10:17', '보안 점검')] },
  { key: 'finance', name: '재무·정산', initial: '재', job: '원장·지급 이상 감시, 목요일 정산', shifts: [D([4], '10:37', '정산일 점검')] },
  { key: 'legal', name: '법무', initial: '법', job: '손님 문구·약관·광고 표기 확인', shifts: [D([5], '14:43', '주간 문구·약관 점검')] },
]

/** 일감 처리 당번 — 쌓인 일감을 담당 팀 역할로 처리(어느 팀이든 출근할 수 있다) */
export const DUTY_SHIFTS: Shift[] = ['09:13', '11:13', '13:13', '16:13', '19:13'].map(hm => D(DAILY, hm, '일감 처리 당번'))

const DAY = ['일', '월', '화', '수', '목', '금', '토']

/** 사람이 읽는 일정 줄 — 같은 일은 시각을 묶는다("매일 10:23 · 14:23 인스타 DM·댓글") */
export function scheduleLines(t: TeamInfo): string[] {
  const groups = new Map<string, string[]>()
  for (const s of t.shifts) {
    const k = `${s.days.length ? s.days.map(d => DAY[d]).join('·') : '매일'}|${s.what}`
    groups.set(k, [...(groups.get(k) ?? []), s.hm])
  }
  const out = [...groups].map(([k, hms]) => { const [when, what] = k.split('|'); return `${when} ${hms.join(' · ')} ${what}` })
  if (t.onEvent) out.push(t.onEvent)
  return out
}

/** 다음 출근 — now 이후 가장 가까운 근무(KST). 없으면 null. */
export function nextShift(t: TeamInfo, now = new Date()): { at: Date; label: string; what: string } | null {
  const KST = 9 * 3600_000
  const k = new Date(now.getTime() + KST) // KST 벽시계를 UTC 필드로 읽는다
  let best: { at: Date; what: string } | null = null
  for (const s of t.shifts) {
    const [h, m] = s.hm.split(':').map(Number)
    for (let add = 0; add < 8; add++) {
      const day = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + add, h, m))
      if (s.days.length && !s.days.includes(day.getUTCDay())) continue
      const at = new Date(day.getTime() - KST)
      if (at.getTime() <= now.getTime()) continue
      if (!best || at < best.at) best = { at, what: s.what }
      break
    }
  }
  if (!best) return null
  const kb = new Date(best.at.getTime() + KST)
  const sameDay = kb.getUTCDate() === k.getUTCDate() && kb.getUTCMonth() === k.getUTCMonth()
  const tomorrow = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + 1))
  const isTomorrow = kb.getUTCDate() === tomorrow.getUTCDate()
  const hm = `${String(kb.getUTCHours()).padStart(2, '0')}:${String(kb.getUTCMinutes()).padStart(2, '0')}`
  const label = `${sameDay ? '오늘' : isTomorrow ? '내일' : DAY[kb.getUTCDay()]} ${hm}`
  return { at: best.at, label, what: best.what }
}

export const FLOORS: { no: string; name: string; teams: string[] }[] = [
  { no: '5F', name: '비서실', teams: ['ceo-office'] },
  { no: '4F', name: '성장본부', teams: ['sales', 'partnerships', 'marketing'] },
  { no: '3F', name: '운영본부', teams: ['support', 'ops'] },
  { no: '2F', name: '제품본부', teams: ['planning', 'design', 'dev'] },
  { no: '1F', name: '경영지원 · 품질·보안실', teams: ['finance', 'legal', 'qa'] },
]

