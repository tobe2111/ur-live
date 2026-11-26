/**
 * 🏢 AI 팀 조직도 데이터 (2026-11-26). 조직도 SSOT 는 `docs/design/ai-team-operating-model.md` §3,
 *   역할 정의 SSOT 는 `.claude/agents/<key>.md`. 설명 한 줄은 그 파일의 프론트매터 `description` 을
 *   빌드 때 그대로 읽는다(?raw) — 파일을 고치면 배포마다 화면이 따라온다.
 *   정기 근무(`schedule`)는 지금 켜진 예약 작업 기준이다(KST). 예약 작업을 바꾸면 여기도 바꾼다.
 */
import ceoOffice from '../../../../.claude/agents/ceo-office.md?raw'
import sales from '../../../../.claude/agents/sales.md?raw'
import partnerships from '../../../../.claude/agents/partnerships.md?raw'
import marketing from '../../../../.claude/agents/marketing.md?raw'
import support from '../../../../.claude/agents/support.md?raw'
import ops from '../../../../.claude/agents/ops.md?raw'
import planning from '../../../../.claude/agents/planning.md?raw'
import design from '../../../../.claude/agents/design.md?raw'
import dev from '../../../../.claude/agents/dev.md?raw'
import qa from '../../../../.claude/agents/qa.md?raw'
import finance from '../../../../.claude/agents/finance.md?raw'
import legal from '../../../../.claude/agents/legal.md?raw'

export const AGENT_RAW: Record<string, string> = {
  'ceo-office': ceoOffice, sales, partnerships, marketing, support, ops,
  planning, design, dev, qa, finance, legal,
}

export interface TeamInfo {
  key: string
  name: string
  initial: string
  job: string
  schedule: string[]
}

export const TEAMS: TeamInfo[] = [
  { key: 'ceo-office', name: '비서실장', initial: '비', job: '아침 보고 1통, 결재함, 팀 근무 감시', schedule: ['월 08:52 주간 운영 보고'] },
  { key: 'sales', name: '매장영업', initial: '영', job: '팔 수 있는 매장 늘리기, 멈춘 매장 챙기기', schedule: ['매일 08:41 영업 아침 보고'] },
  { key: 'partnerships', name: '제휴', initial: '제', job: '인플루언서·대행사 제안과 답장 기록', schedule: ['매일 11:53 · 15:53 · 19:53 메일 답장 확인'] },
  { key: 'marketing', name: '마케팅', initial: '마', job: '인스타·블로그 초안, 검색 노출', schedule: [] },
  { key: 'support', name: '고객지원', initial: '고', job: '인스타·메일·카톡 문의 24시간 안 응대', schedule: ['매일 10:23 · 14:23 · 18:23 인스타 DM·댓글'] },
  { key: 'ops', name: '운영', initial: '운', job: '사장님 승인, 환불·반품 처리 준비', schedule: [] },
  { key: 'planning', name: '기획', initial: '기', job: '문서와 실제 기능이 맞는지 정리', schedule: [] },
  { key: 'design', name: '디자인', initial: '디', job: '화면이 디자인 규칙대로인지 렌더해서 확인', schedule: [] },
  { key: 'dev', name: '개발', initial: '개', job: '빨간불 당일 수리, 배포', schedule: ['PR 빨간불이 나면 즉시'] },
  { key: 'qa', name: '품질·보안', initial: '품', job: '배포가 실제로 되는지 다시 재기, 보안 점검', schedule: ['매일 08:47 오류 점검', '월 10:17 보안 점검'] },
  { key: 'finance', name: '재무·정산', initial: '재', job: '원장·지급 이상 감시, 목요일 정산', schedule: [] },
  { key: 'legal', name: '법무', initial: '법', job: '출시 전 약관·광고 표기·개인정보 확인', schedule: [] },
]

export const FLOORS: { no: string; name: string; teams: string[] }[] = [
  { no: '5F', name: '비서실', teams: ['ceo-office'] },
  { no: '4F', name: '성장본부', teams: ['sales', 'partnerships', 'marketing'] },
  { no: '3F', name: '운영본부', teams: ['support', 'ops'] },
  { no: '2F', name: '제품본부', teams: ['planning', 'design', 'dev'] },
  { no: '1F', name: '경영지원 · 품질·보안실', teams: ['finance', 'legal', 'qa'] },
]

/** 프론트매터의 description 한 줄. 없으면 빈 문자열. */
export function agentDescription(raw: string | undefined): string {
  const m = raw?.match(/^---\n([\s\S]*?)\n---/)
  const line = m?.[1].split('\n').find(l => l.startsWith('description:'))
  return line ? line.slice('description:'.length).trim() : ''
}
