/**
 * 🏢 AI 팀 조직도 데이터 (2026-11-26). 조직도 SSOT 는 `docs/design/ai-team-operating-model.md` §3,
 *   역할 정의 SSOT 는 `.claude/agents/<key>.md`(팀 목록이 그 폴더와 같은지는 시험이 대조한다).
 *   ⚠️ 그 파일들을 ?raw 로 통째로 넣지 않는다 — 2026-11-26 넣었더니 전체 JS 예산(gzip 2.27MB)을 넘었다.
 *      화면은 한 줄 설명(`job`)만 쓰면 된다.
 *   정기 근무(`schedule`)는 지금 켜진 예약 작업 기준이다(KST). 예약 작업을 바꾸면 여기도 바꾼다.
 */
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

