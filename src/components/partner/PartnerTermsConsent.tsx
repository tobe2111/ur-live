/**
 * 파트너 약관 개별 동의(clickwrap) — 셀러·에이전시 가입 공용.
 * 약관규제법 §2① : 중요조항을 각각 요약박스+개별 체크로 노출("전체 동의" 하나로 뭉치지 않음).
 * 전문은 별도 약관 페이지 링크. 필수 조항 전부 체크돼야 부모가 제출을 허용.
 * 설계: docs/design/partner-terms-as-contract.md
 */
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'

export interface PartnerKeyClause {
  key: string
  title: string
  summary: string
  required: boolean
}

interface Props {
  clauses: PartnerKeyClause[]
  fullTermsHref: string   // 전문 약관 페이지 (예: /terms/seller)
  fullTermsLabel?: string
  value: Record<string, boolean>
  onChange: (next: Record<string, boolean>) => void
}

export default function PartnerTermsConsent({ clauses, fullTermsHref, fullTermsLabel, value, onChange }: Props) {
  function toggle(key: string) {
    onChange({ ...value, [key]: !value[key] })
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">약관 동의 <span className="text-red-500">*</span></p>
        <Link to={fullTermsHref} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
          {fullTermsLabel || '약관 전문 보기'} →
        </Link>
      </div>
      <p className="text-[11px] text-gray-400">아래 중요 조항을 각각 확인하고 동의해주세요. 가입 완료 시 계약이 성립합니다.</p>

      {clauses.map((clause) => {
        const checked = value[clause.key] === true
        return (
          <button
            type="button"
            key={clause.key}
            onClick={() => toggle(clause.key)}
            className={`w-full text-left rounded-xl border p-3 transition-colors ${
              checked ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            aria-pressed={checked}
          >
            <div className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                  checked ? 'bg-blue-600' : 'bg-white border border-gray-300'
                }`}
              >
                {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900">
                  {clause.title}
                  {clause.required && <span className="text-[10px] text-red-500 ml-1 align-middle">(필수)</span>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{clause.summary}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** 필수 조항 전부 동의했는지 클라 판정(제출 게이트). 서버도 validatePartnerConsent 로 재검증. */
export function allRequiredAgreed(clauses: PartnerKeyClause[], value: Record<string, boolean>): boolean {
  return clauses.every((c) => !c.required || value[c.key] === true)
}
