/**
 * ② 이 가게로 등록 — 2026-11-03 대표 확정 4화면 시안.
 *
 * 종전 ②담당자·③운영 방식·④사업자등록증을 이 한 화면으로 줄였다. 남긴 것은 셋뿐이다:
 *  - **가게 확인**(카카오맵 + 이름·주소·전화) — 한 글자 다른 지점을 고르는 실수를 여기서 잡는다.
 *  - **연락받을 휴대폰** — 계정에 번호가 있으면 미리 채운다.
 *  - **허위 등록 경고** — 대표 *"허위로 넣는 경우 등 경고는 넣어야"*. 문구는 판매자 이용약관에 **실제로 적힌**
 *    조치(승인 거절·취소)만 말한다. 약관에 없는 제재를 화면이 약속하면 안 된다.
 * 사업자등록증은 등록 뒤 ③ 완료 화면의 할 일로 옮겼다(그때도 선택이었다 — 승인·메인 노출 조건은 그대로).
 *
 * 📜 약관 동의: 대표 확정 *"시안대로"* — 체크박스 대신 버튼 아래 안내문으로 동의를 받는다. 서버는 종전과
 *   똑같이 `terms_agreed_version` 을 받아 다시 검사하고 기록한다(`seller-stores.routes`).
 * 🕳️ 이미 등록된 매장(409 STORE_EXISTS)은 막다른 길이 아니라 `StoreTakenPanel` 로 간다.
 */
import { useState } from 'react'
import api from '@/lib/api'
import RestaurantMiniMap from '@/components/RestaurantMiniMap'
import { WarnIcon } from '@/components/icons/urdeal-icons'
import type { RegisterPlace } from '@/components/seller/StoreRegisterModal'
import { formatPhone, isValidMobilePhone, digitsOnly } from '@/utils/format-phone'
import { readStoreReferrer, clearStoreReferrer, readAcqUtmInline } from '@/utils/store-referrer'
import { TERMS_CURRENT_VERSION } from '@/pages/terms/terms-types'
import { toast } from '@/hooks/useToast'

export const FALSE_REGISTRATION_WARNING =
  '사장님이 운영하는 가게만 등록할 수 있어요. 다른 사람의 가게를 등록하거나 정보를 거짓으로 적으면 승인이 거절되거나 취소돼요.'

interface Props {
  place: RegisterPlace
  phone: string
  phoneFromAccount: boolean
  onPhone: (v: string) => void
  agencyName: string | null
  onChangePlace: () => void
  onRegistered: (sellerId: number | undefined, ownerClaimCode: string | null) => void
  onTaken: (sellerId: number | null) => void
}

export default function StoreConfirmStep({ place, phone, phoneFromAccount, onPhone, agencyName, onChangePlace, onRegistered, onTaken }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)
  const phoneOk = isValidMobilePhone(phone)
  const phoneBad = touched && !phoneOk

  async function submit() {
    setTouched(true)
    if (!phoneOk) { toast.error(phone ? '휴대폰 번호(01x)로 적어 주세요' : '연락받을 휴대폰 번호를 적어 주세요'); return }
    if (submitting) return
    setSubmitting(true)
    try {
      const r = await api.post('/api/seller/stores', {
        name: place.name,
        address: place.address,
        phone: place.phone,
        category: place.category,
        kakao_place_id: place.id,
        kakao_place_url: place.place_url,
        lat: place.lat, lng: place.lng,
        // 개인 계정의 중개 등록은 닫혀 있다(`PERSONAL_BROKER_SIGNUP_DISABLED`) — 이 문으로 성공한 등록은 원래 전부 direct 였다.
        channel: 'direct',
        manager_phone: digitsOnly(phone),
        business_cert_url: '',
        terms_agreed_version: TERMS_CURRENT_VERSION,
        // 🤝 소개자 초대(`?ref=`)는 로그인 왕복을 건너 sessionStorage 로 온다 — 놓치면 소개자가 보상을 못 받는다.
        referrer_user_id: readStoreReferrer() || undefined, acq: readAcqUtmInline(),
      })
      if (!r.data?.success) throw new Error(r.data?.error)
      clearStoreReferrer()
      onRegistered(Number(r.data.data?.seller_id) || undefined, r.data.data?.owner_claim_code || null)
    } catch (e: any) {
      if (e?.response?.status === 409 && e?.response?.data?.code === 'STORE_EXISTS') {
        onTaken(Number(e.response.data.seller_id) || null)
      } else {
        toast.error(e?.response?.data?.error || e?.message || '등록하지 못했어요. 잠시 뒤 다시 눌러 주세요')
      }
      setSubmitting(false)
    }
  }

  const sub = [place.address, place.phone].filter(Boolean).join(', ')
  const kind = place.category?.split(' > ').slice(-2).join(', ')

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain -mx-1 px-1 pb-4">
        {place.lat && place.lng ? (
          // 🏝️ 카카오 지도 타일은 다크에서도 밝다 — 지도 칸은 테마를 따르지 않는다(CLAUDE.md 지도 위 UI 규칙).
          <div className="light-island mt-5 rounded-2xl overflow-hidden">
            <RestaurantMiniMap bare name={place.name} address={place.address} lat={place.lat} lng={place.lng} placeUrl={place.place_url} height={agencyName ? 112 : 148} />
          </div>
        ) : null}

        <div className="mt-5 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold text-gray-900 dark:text-white">{place.name}</p>
            {sub && <p className="mt-1 text-[13px] text-ink-soft">{sub}</p>}
            {kind && <p className="mt-1 text-[13px] text-ink-soft">{kind}</p>}
          </div>
          <button type="button" onClick={onChangePlace} className="shrink-0 pt-1 text-[13px] font-medium text-brand-text">다른 가게</button>
        </div>

        <label className="mt-8 block">
          <span className="block text-[13px] text-ink-soft mb-2">연락받을 휴대폰 · 승인·주문·정산 소식</span>
          <span className={`ur-sn-field flex items-center gap-2 h-14 px-4 rounded-xl border-[1.5px] ${phoneBad ? 'border-tone-bad' : 'border-line focus-within:border-brand'}`} aria-invalid={phoneBad}>
            <input value={formatPhone(phone)} onChange={(e) => onPhone(e.target.value)} onBlur={() => setTouched(true)}
              inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" aria-invalid={phoneBad}
              className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[16px] font-medium tracking-wide text-gray-900 dark:text-white placeholder:text-ink-faint" />
            {phoneFromAccount && phoneOk && <span className="shrink-0 rounded-md bg-brand-tint px-2 py-1 text-[12px] text-brand-text">계정 번호</span>}
          </span>
        </label>
        {phoneBad && <p className="ur-sn-note mt-2 text-[13px] text-tone-bad">휴대폰 번호(01x)로 적어 주세요</p>}

        <div role="note" className="mt-5 flex items-start gap-3 rounded-xl bg-wash p-4">
          <WarnIcon size={18} className="shrink-0 mt-px text-tone-warn" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-gray-900 dark:text-white" data-testid="store-false-warning">{FALSE_REGISTRATION_WARNING}</p>
        </div>
      </div>

      <div className="shrink-0 pt-3">
        <button type="button" onClick={() => void submit()} disabled={submitting}
          className={`ur-btn ur-btn-lg ur-btn-primary w-full${submitting ? ' ur-busy-ring' : ''}`}>
          {submitting ? '등록하는 중…' : '이 가게로 등록하기'}
        </button>
        <p className="mt-3 text-center text-[12px] leading-relaxed text-ink-soft">
          {agencyName
            ? <>등록 0원. 누르면 판매자 이용약관에 동의하고 <b className="font-medium">{agencyName}</b> 에이전시에 운영을 맡기는 것으로 봐요.</>
            : <>등록 0원. 누르면 판매자 이용약관에 동의하는 것으로 봐요.</>}
          {' '}<a href="/terms/seller" target="_blank" rel="noopener noreferrer" className="underline">약관 보기</a>
        </p>
      </div>
    </div>
  )
}
