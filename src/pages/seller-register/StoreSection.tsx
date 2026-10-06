/**
 * 🏪 가게 정보 카드 — **안 B "가게부터"** (2026-09-21 대표 확정 *"응 안 B로 하는데"*).
 *
 * 🩸 종전엔 [가게명]·[매장 종류]·[매장 주소] 세 칸이 나란히 있었는데, 사장님은 그 바로 밑
 *   주소 칸에서 **이미 카카오맵으로 자기 가게를 고른 뒤**였다. 그 선택이 주는 여덟 가지
 *   (상호·도로명·지번·전화·업종·위도·경도·place_id) 중 **주소 문자열 하나만** 쓰고 일곱을
 *   버렸기 때문에, 방금 고른 가게의 상호를 손으로 다시 쳤다.
 *
 * ⇒ 고르면 [카드 한 장]으로 바뀐다 — 상호·주소·전화·업종은 **묻는 것이 아니라 확인하는 것**이다.
 *   남는 칸은 담당자 연락처(알림톡 수신)와 매장 소개(선택)뿐.
 *
 * ⚠️ **탈출구는 상시다.** 지도에 없는 가게(신규 개업·무점포)는 카드가 안 뜨고 종전 칸이
 *   그대로 남는다 — 모드 전환 버튼 같은 건 없다. 못 찾으면 그냥 아래에 적으면 된다.
 * ⚠️ 담당자 휴대폰은 **지도값으로 채우지 않는다** — 가게 대표번호(유선)로 알림톡을 보낼 수 없다.
 */
import { useTranslation } from 'react-i18next'
import { Field, ChipGroup, INPUT, STORE_CATEGORIES, formatPhone, type SignupForm, type SignupErrors } from './RegisterFields'
import AddressPickerField from './AddressPickerField'
import PickedStoreCard from './PickedStoreCard'
import type { PickedStore } from '@/shared/store-place'

export default function StoreSection({
  form, errors, place, cls, hint, storeDone, set, pickStore, clearPlace,
}: {
  form: SignupForm
  errors: SignupErrors
  place: PickedStore | null
  cls: (k: keyof SignupForm) => string
  hint: (k: keyof SignupForm, base?: string) => string | undefined
  storeDone: number
  set: <K extends keyof SignupForm>(k: K) => (v: SignupForm[K]) => void
  pickStore: (address: string, p?: PickedStore) => void
  clearPlace: () => void
}) {
  const { t } = useTranslation()
  return (
    <section className="rounded-[var(--dash-radius,16px)] border border-rule bg-white px-4 pb-3 pt-4 sm:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-extrabold text-gray-900">{t('seller.signup.storeSection', { defaultValue: '가게 정보' })}</h3>
        <span className="dash-num shrink-0 text-[12px] font-bold text-brand-text">{storeDone} / 2</span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-gray-500">{t('seller.signup.storeSectionSub', { defaultValue: '유어샵과 이용권에 그대로 보여요. 나중에 대시보드에서 바꿀 수 있어요.' })}</p>
      {/* 🏪 안 B — **가게를 먼저 고른다.** 고르고 나면 상호·주소·업종은 카드가 말하므로
          그 칸들을 없앤다(묻는 것이 아니라 확인하는 것이다). 지도에 없는 가게는
          카드가 안 뜨고 종전 칸이 그대로 남아 손으로 적을 수 있다 — 탈출구는 상시다. */}
      {place ? (
        <div className="mt-3">
          <PickedStoreCard place={place} onClear={clearPlace} />
        </div>
      ) : null}
      <div className="mt-3">
        {!place && (
          <Field id="f-address" label="가게 찾기" hint={t('seller.signup.pickHint', { defaultValue: '가게를 고르면 상호·주소·전화·업종이 한 번에 채워져요. 지도에 없으면 아래에 직접 적어 주세요.' })}>
            <AddressPickerField id="f-address" value={form.address} onChange={pickStore}
              placeholder={t('seller.signup.pickPlaceholder', { defaultValue: '가게 이름으로 찾기' })} />
          </Field>
        )}
        {!place && (
          <Field id="f-business_name" label="가게명" required hint={hint('business_name')} error={errors.business_name}>
            <input id="f-business_name" value={form.business_name}
              onChange={e => set('business_name')(e.target.value)}
              placeholder="예: 홍대 매운돈까스" autoComplete="organization"
              aria-invalid={!!errors.business_name}
              className={cls('business_name')} />
          </Field>
        )}
        <Field id="f-phone" label="연락처 (담당자 휴대폰)" required hint="주문·정산 알림톡을 받는 번호" error={errors.phone}>
          <input id="f-phone" type="tel" value={form.phone}
            onChange={e => set('phone')(formatPhone(e.target.value))}
            inputMode="numeric" autoComplete="tel" maxLength={13} placeholder="010-1234-5678"
            aria-invalid={!!errors.phone}
            className={`${cls('phone')} dash-num`} />
        </Field>
        {/* ⚠️ 지도에서 골랐어도 칩은 **그대로 보인다.** 카카오 업종을 우리 8종으로 옮긴 것은
            추측이라(`storeCategoryFromKakao`) 틀릴 수 있고, 숨기면 사장님이 고칠 길이 없다.
            맞으면 이미 선택돼 있으니 손댈 일이 없고, 틀리면 한 번 누르면 된다. */}
        <Field id="f-store_category" label="매장 종류">
          <ChipGroup name="매장 종류" value={form.store_category} onChange={set('store_category')} options={STORE_CATEGORIES} />
        </Field>
        <Field id="f-description" label="매장 소개 (선택)">
          <textarea id="f-description" value={form.description}
            onChange={e => set('description')(e.target.value)}
            placeholder="매장 분위기, 대표 메뉴, 운영 시간 등"
            rows={3} maxLength={500}
            className={`${INPUT} h-auto resize-none py-2.5`} />
        </Field>
      </div>
    </section>
  )
}
