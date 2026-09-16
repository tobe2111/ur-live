/**
 * 📥 2026-09-08 (대표 "지금 이 깃헙에 나오는거 어드민에 나오는게 낫지 않나?"):
 *   결재 파일(docs/decisions/<날짜>-<slug>.md)을 어드민 카드로 바꾸는 순수 파서.
 *   SSOT 는 파일이다(`docs/decisions/_template.md` 형식). 이 파서는 읽기만 한다.
 *   ⚠️ 템플릿의 필드명·섹션 제목이 바뀌면 여기와 테스트를 같이 고칠 것.
 */

export type DecisionStatus = 'open' | 'approved' | 'rejected' | 'expired' | 'done'

export interface Decision {
  slug: string
  title: string
  status: DecisionStatus
  grade: string
  role: string
  raisedOn: string
  dueOn: string
  question: string
  evidence: string
  options: string[]
  defaultOption: string
  rollback: string
  decision: string
  applied: string
  /** 파일 상태가 approved 이고 반영 커밋에 "머지 대기" 가 없으며 해시가 하나라도 있으면 true */
  fullyApplied: boolean
}

const FIELD_RE = /^(상태|등급|역할|올린 날|기한):\s*(.*)$/

function section(body: string, heading: string): string {
  // "## 질문" · "## 근거 (실측 …)" 처럼 제목 뒤에 괄호 설명이 붙어도 잡는다.
  const re = new RegExp(`^##\\s+${heading}[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm')
  const m = body.match(re)
  return (m?.[1] ?? '').trim()
}

function isBlank(v: string): boolean {
  const t = v.trim()
  return t === '' || t === '<비워 둠>' || t === '<비워 둔다>'
}

export function parseDecision(slug: string, raw: string): Decision {
  const text = raw.replace(/\r\n/g, '\n')
  const title = (text.match(/^#\s+(.+)$/m)?.[1] ?? slug).trim()
  const fields: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = line.match(FIELD_RE)
    if (m) fields[m[1]] = m[2].trim()
  }
  const statusRaw = (fields['상태'] ?? 'open').toLowerCase()
  const status: DecisionStatus = (['open', 'approved', 'rejected', 'expired', 'done'] as const).includes(statusRaw as DecisionStatus)
    ? (statusRaw as DecisionStatus)
    : 'open'
  const optionsBody = section(text, '선택지')
  const options = optionsBody
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^\d+\.\s/.test(l))
    .map(l => l.replace(/^\d+\.\s*/, ''))
  const decision = section(text, '결정')
  const applied = section(text, '반영 커밋')
  const fullyApplied =
    status === 'approved' && !isBlank(applied) && !/머지 대기/.test(applied) && /\b[0-9a-f]{7,40}\b/.test(applied)
  return {
    slug,
    title,
    status,
    grade: fields['등급'] ?? '',
    role: fields['역할'] ?? '',
    raisedOn: fields['올린 날'] ?? '',
    dueOn: fields['기한'] ?? '',
    question: section(text, '질문'),
    evidence: section(text, '근거'),
    options,
    defaultOption: section(text, '기본안'),
    rollback: section(text, '롤백'),
    decision: isBlank(decision) ? '' : decision,
    applied: isBlank(applied) ? '' : applied,
    fullyApplied,
  }
}

/** 표시 순서: 대표 답이 필요한 것 → 구현 중 → 끝난 것 → 반려/만료. 같은 묶음 안에서는 기한 이른 순. */
const ORDER: Record<DecisionStatus, number> = { open: 0, approved: 1, done: 2, rejected: 3, expired: 3 }
export function sortDecisions(list: Decision[]): Decision[] {
  return [...list].sort((a, b) => {
    const ra = a.fullyApplied ? ORDER.done : ORDER[a.status]
    const rb = b.fullyApplied ? ORDER.done : ORDER[b.status]
    if (ra !== rb) return ra - rb
    return (a.dueOn || '9999').localeCompare(b.dueOn || '9999')
  })
}

/** `../../../docs/decisions/2026-09-07-foo.md` → `2026-09-07-foo` */
export function slugFromPath(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '')
}

export function isDecisionFile(path: string): boolean {
  const name = path.replace(/^.*\//, '')
  return name.endsWith('.md') && !name.startsWith('_') && name !== 'README.md'
}
