/**
 * 📜 가입 화면 약관 동의 박스 (2026-07-05 약관 v1.0 시행)
 * - 약관 전체 동의 체크(필수) + "약관 보기" 새 탭 링크
 * - core(선택): 핵심 조항 요약을 항상 노출하고 개별 동의 체크 —
 *   에이전시 파트너 약관 전문(前文) "제4조·제5조·제9조·제10조는 요약 고지 및 개별 동의" 이행.
 * 가입 페이지는 force-light-theme 라 라이트 고정 색상 사용.
 */
import { ExternalLink } from 'lucide-react'

export interface CoreTermsConsent {
  label: string
  items: { label: string; text: string }[]
  agreed: boolean
  onChange: (v: boolean) => void
}

export default function TermsConsentBox({
  termsLabel, termsPath, agreed, onAgreedChange, core,
}: {
  termsLabel: string
  termsPath: string
  agreed: boolean
  onAgreedChange: (v: boolean) => void
  core?: CoreTermsConsent
}) {
  return (
    <div className="bg-white rounded-2xl p-5 space-y-4 border border-gray-100">
      <div className="flex items-start justify-between gap-2">
        <label className="flex items-start gap-2.5 cursor-pointer flex-1">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => onAgreedChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-gray-900"
          />
          <span className="text-[13px] font-semibold text-gray-900 leading-snug">
            {termsLabel} <span className="text-red-500">*</span>
          </span>
        </label>
        <a
          href={termsPath}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-[12px] text-gray-500 underline hover:text-gray-900 mt-0.5"
        >
          약관 보기 <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {core && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="bg-gray-50 rounded-xl p-3.5 space-y-2">
            {core.items.map((it, i) => (
              <div key={i}>
                <p className="text-[12px] font-bold text-gray-800">{it.label}</p>
                <p className="text-[11.5px] text-gray-600 leading-relaxed">{it.text}</p>
              </div>
            ))}
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={core.agreed}
              onChange={e => core.onChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-gray-900"
            />
            <span className="text-[13px] font-semibold text-gray-900 leading-snug">
              {core.label} <span className="text-red-500">*</span>
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
