/**
 * 🏢 '중개·대행사에요' 를 고른 사람에게 — 대신 등록은 이제 에이전시 계정으로 (2026-10-11 대표 *"모두 다 하자"*).
 *   스위치 `PERSONAL_BROKER_SIGNUP_DISABLED`(feature-flags) · 문구 SSOT `shared/agency-copy.ts`(서버 410 과 같은 문장).
 */
import { Link } from 'react-router-dom'
import { PERSONAL_BROKER_SIGNUP_DISABLED } from '@/shared/feature-flags'
import { BROKERED_VIA_AGENCY_MSG, AGENCY_SIGNUP_PATH } from '@/shared/agency-copy'

export { PERSONAL_BROKER_SIGNUP_DISABLED, BROKERED_VIA_AGENCY_MSG }

export default function BrokeredViaAgencyNote() {
  return (
    <div className="rounded-xl bg-brand-tint p-4">
      <p className="text-[13px] leading-relaxed text-gray-800">{BROKERED_VIA_AGENCY_MSG}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-gray-600">
        이미 유어딜에 있는 매장이면 에이전시에서 만든 초대 링크를 사장님께 보내 [맡기기]를 받으면 돼요.
      </p>
      <Link to={AGENCY_SIGNUP_PATH} className="mt-3 inline-flex h-9 items-center rounded-lg bg-brand px-3 text-[13px] font-semibold text-white">
        에이전시로 가입하기
      </Link>
    </div>
  )
}
