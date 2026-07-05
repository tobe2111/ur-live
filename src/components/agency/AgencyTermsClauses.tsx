/**
 * 📜 2026-07-05 에이전시 가입 중요 조항 4개 요약 박스 + 개별 체크 (약관 적용가이드 2항).
 *
 * 커미션 조건(1%·24개월·회수)은 기록 없는 약관으론 다툼 소지가 가장 큰 조항 —
 * 요약을 가입 화면에 직접 노출하고 개별 체크를 받아 terms_agreements(버전 포함)에 증적을 남긴다.
 * 서버(/api/agency/register, /register-from-user)도 4개 전부 true 를 강제.
 *
 * ⚠️ 요율·기간 수치는 어드민(platform_settings) 조정 대상 — 여기 문구는 약관 문서와 함께 유지.
 */
import { useTranslation } from 'react-i18next'

export interface AgencyClauses {
  commission: boolean
  clawback: boolean
  settlement: boolean
  terms: boolean
}

export const EMPTY_AGENCY_CLAUSES: AgencyClauses = { commission: false, clawback: false, settlement: false, terms: false }

export function allAgencyClausesAgreed(c: AgencyClauses): boolean {
  return c.commission && c.clawback && c.settlement && c.terms
}

export default function AgencyTermsClauses({
  value,
  onChange,
}: {
  value: AgencyClauses
  onChange: (next: AgencyClauses) => void
}) {
  const { t } = useTranslation()
  const rows: Array<{ k: keyof AgencyClauses; title: string; desc: string }> = [
    {
      k: 'commission',
      title: t('agency.terms.commissionTitle', { defaultValue: '영입 커미션 조건' }),
      desc: t('agency.terms.commissionDesc', { defaultValue: '커미션은 영입한 매장에서 실제 판매가 발생한 경우에만, 해당 매출 기준으로 매장별 최초 24개월 한도 내에서 지급됩니다 (기본 1% — 플랫폼 정책에 따름).' }),
    },
    {
      k: 'clawback',
      title: t('agency.terms.clawbackTitle', { defaultValue: '커미션 회수(환불 역전)' }),
      desc: t('agency.terms.clawbackDesc', { defaultValue: '지급된 커미션의 근거 거래가 환불·취소되면 해당 커미션은 회수됩니다.' }),
    },
    {
      k: 'settlement',
      title: t('agency.terms.settlementTitle', { defaultValue: '정산·원천징수' }),
      desc: t('agency.terms.settlementDesc', { defaultValue: '정산은 플랫폼 정산 주기에 따라 관련 법령상 원천징수 후 지급됩니다.' }),
    },
    {
      k: 'terms',
      title: t('agency.terms.termsTitle', { defaultValue: '에이전시 약관·개인정보' }),
      desc: t('agency.terms.termsDesc', { defaultValue: '에이전시 이용약관 전문 및 개인정보 수집·이용에 동의합니다.' }),
    },
  ]
  const all = allAgencyClausesAgreed(value)
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <label className="flex items-center gap-2.5 pb-2 border-b border-gray-200 cursor-pointer">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => {
            const v = e.target.checked
            onChange({ commission: v, clawback: v, settlement: v, terms: v })
          }}
          className="w-4 h-4 accent-blue-600"
        />
        <span className="text-sm font-bold text-gray-900">
          {t('agency.terms.allAgree', { defaultValue: '중요 조항 전체 동의 (필수)' })}
        </span>
      </label>
      <div className="mt-1 space-y-1">
        {rows.map((r) => (
          <label key={r.k} className="flex items-start gap-2.5 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={value[r.k]}
              onChange={(e) => onChange({ ...value, [r.k]: e.target.checked })}
              className="mt-0.5 w-4 h-4 accent-blue-600"
            />
            <span>
              <span className="block text-[13px] font-semibold text-gray-800">[필수] {r.title}</span>
              <span className="block text-[11px] text-gray-500 leading-relaxed mt-0.5">{r.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-gray-400">
        {t('agency.terms.logNote', { defaultValue: '동의 내역은 약관 버전과 함께 기록됩니다.' })}
      </p>
    </div>
  )
}
