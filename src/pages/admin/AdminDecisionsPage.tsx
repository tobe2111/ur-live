/**
 * 📥 2026-09-08 (대표 "매번 깃헙에서 보기에는 불편해" → "어드민에 나오는게 낫지 않나?"):
 *   결재함(docs/decisions/*.md)을 어드민에서 열람. AdminPlatformModelPage 와 같은 방식 —
 *   빌드 때 `?raw` 로 인라인 → 배포마다 자동 최신(별도 DB·복붙 없음). SSOT 는 파일.
 *   답하기(2단계)는 별도 PR — 그전까지 답은 Notion 📥 결재함 또는 채팅.
 */
import { useMemo, useState } from 'react'
import { Inbox, ExternalLink } from 'lucide-react'
import MarkdownView from '@/components/MarkdownView'
import { parseDecision, sortDecisions, slugFromPath, isDecisionFile, type Decision, type DecisionStatus } from './decisions/parse-decision'

// ⚠️ repo 의 실제 결재 파일을 빌드 시 인라인. 파일 추가·수정 → 배포 → 자동 반영.
const RAW = import.meta.glob('../../../docs/decisions/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const GITHUB_DIR = 'https://github.com/tobe2111/ur-live/blob/main/docs/decisions/'
const NOTION_INBOX = 'https://app.notion.com/p/137d57e33c1e42699dee743b00cb014e'

const STATUS_LABEL: Record<DecisionStatus, string> = {
  open: '답 필요', approved: '승인 · 구현 중', done: '반영 끝', rejected: '반려', expired: '만료',
}
const STATUS_CLS: Record<DecisionStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  done: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
}

function effectiveStatus(d: Decision): DecisionStatus {
  return d.fullyApplied ? 'done' : d.status
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] font-bold text-gray-400 tracking-wide mb-1">{label}</div>
      <div className="text-[13px] text-gray-800 leading-relaxed">{children}</div>
    </div>
  )
}

function DecisionCard({ d, open, onToggle }: { d: Decision; open: boolean; onToggle: () => void }) {
  const st = effectiveStatus(d)
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="w-full text-left px-5 py-4 flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_CLS[st]}`}>{STATUS_LABEL[st]}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold text-gray-900 leading-snug">{d.title}</span>
          <span className="block mt-1 text-[12px] text-gray-500">
            {d.role && <span className="mr-2">역할 {d.role}</span>}
            {d.grade && <span className="mr-2">등급 {d.grade}</span>}
            {d.dueOn && <span className="mr-2">기한 {d.dueOn}</span>}
            {d.raisedOn && <span>올린 날 {d.raisedOn}</span>}
          </span>
        </span>
        <span className="shrink-0 text-gray-400 text-[12px]">{open ? '접기' : '펼치기'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <Field label="질문"><MarkdownView source={d.question} /></Field>
          {d.options.length > 0 && (
            <Field label="선택지">
              <ol className="list-decimal pl-5 space-y-1">
                {d.options.map((o, i) => <li key={i}><MarkdownView source={o} /></li>)}
              </ol>
            </Field>
          )}
          {d.defaultOption && <Field label="기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않음)"><MarkdownView source={d.defaultOption} /></Field>}
          <Field label="대표 답">
            {d.decision
              ? <MarkdownView source={d.decision} />
              : <span className="text-gray-400">아직 없음 — <a className="underline text-blue-600" href={NOTION_INBOX} target="_blank" rel="noopener noreferrer">Notion 📥 결재함</a>의 "대표 답" 칸에 번호나 한 줄을 적으면 4시간 안에 반영됩니다.</span>}
          </Field>
          {d.applied && <Field label="반영"><MarkdownView source={d.applied} /></Field>}
          {d.evidence && (
            <details className="mt-3">
              <summary className="text-[12px] text-gray-500 cursor-pointer">근거 · 롤백 보기</summary>
              <div className="mt-2 text-[13px] text-gray-700"><MarkdownView source={d.evidence} /></div>
              {d.rollback && <div className="mt-2 text-[13px] text-gray-700"><span className="font-bold">롤백:</span> <MarkdownView source={d.rollback} /></div>}
            </details>
          )}
          <div className="mt-4 text-[11px] text-gray-400">
            <a className="inline-flex items-center gap-1 hover:text-gray-600" href={`${GITHUB_DIR}${d.slug}.md`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" /> 원본 파일 (GitHub)
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDecisionsPage() {
  const decisions = useMemo(() => {
    const list = Object.entries(RAW)
      .filter(([p]) => isDecisionFile(p))
      .map(([p, raw]) => parseDecision(slugFromPath(p), raw))
    return sortDecisions(list)
  }, [])
  const [openSlug, setOpenSlug] = useState<string | null>(() => decisions.find(d => d.status === 'open')?.slug ?? null)

  const needAnswer = decisions.filter(d => d.status === 'open').length
  const inProgress = decisions.filter(d => d.status === 'approved' && !d.fullyApplied).length

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-1">
        <Inbox className="w-5 h-5 text-gray-400" />
        <h1 className="text-xl font-extrabold text-gray-900">결재함</h1>
      </div>
      <p className="text-[13px] text-gray-500 mb-4">
        대표가 판단할 것만 올라옵니다. 답 필요 <span className="font-bold text-gray-900">{needAnswer}</span> · 구현 중 <span className="font-bold text-gray-900">{inProgress}</span> · 전체 {decisions.length}.
        코드(<code className="px-1 rounded bg-gray-100 text-[0.85em]">docs/decisions/*.md</code>)와 연동돼 배포 시 자동 최신화됩니다.
      </p>

      {decisions.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-[13px] text-gray-500">열린 결재가 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {decisions.map(d => (
            <DecisionCard key={d.slug} d={d} open={openSlug === d.slug} onToggle={() => setOpenSlug(openSlug === d.slug ? null : d.slug)} />
          ))}
        </div>
      )}
    </div>
  )
}
