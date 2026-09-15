/**
 * 🧍 **투숙객 정보 — 아는 것은 묻지 않는다** (2026-09-15, 대표 신고)
 *
 * 대표: *"숙소 이용권 결제 시, 이미 가입을 한 고객의 정보로 등록이 되지 않아? 이 페이지가 필요한가?
 * 만약 정보가 없으면 등록이 필요하겠지만."*
 *
 * ## 왜 빈칸이었나 (실측)
 * 두 예약 모달은 **이미 채우려 하고 있었다** — `localStorage.user_name / user_phone / user_email`.
 * 그런데 `user_phone` 은 **레포 전체에서 쓰는 곳이 0곳**이라 구조적으로 영원히 빈칸이었고,
 * `user_email` 은 카카오가 이메일 동의를 받은 경우에만 찼다. 서버는 알고 있었다 —
 * `users.phone` 은 알림톡·리마인더 cron 8곳이 읽어 문자를 보낸다.
 * 끊긴 곳은 `/api/auth/me` 의 **세션 쿠키 분기가 phone 을 안 내려준 것** 하나였다(한국 소비자가 타는 분기).
 *
 * ## 그래서 이 화면이 필요 없나 — **아니다. 다만 묻는 방식이 틀렸다**
 * 숙소는 **투숙객이 구매자와 다를 수 있다**(선물·대리 예약). 호텔이 이름·번호를 받는 진짜 이유가 그것이고,
 * 서버도 `guest_name`·`guest_phone` 이 없으면 400 으로 막는다. 그래서 필드는 남기되 **기본값은 내 정보**로 두고,
 * 다른 사람이 묵을 때만 펼친다.
 *
 * ## 규칙
 *  - 값의 진실은 **서버**(`useUserProfile` → `/api/auth/me`). localStorage 는 서버 응답의 거울일 뿐이다.
 *  - 이름·전화번호가 **둘 다** 있으면 접어서 한 줄로 보여 준다. 하나라도 없으면 **펼친 채로 시작**한다
 *    (대표가 말한 *"정보가 없으면 등록이 필요하겠지"* 가 이 자리다).
 *  - 전화번호는 가운데를 가린다. 결제 직전 화면에 남의 번호가 통째로 떠 있을 이유가 없다.
 *
 * ⚠️ **이 컴포넌트는 값을 저장하지 않는다.** 프로필에 번호를 채워 넣는 것(`PATCH /api/auth/profile`)은
 * 별개 동작이라 여기서 몰래 하지 않는다 — 예약 폼에 친 번호가 소리 없이 계정 정보를 바꾸면 안 된다.
 */
import { useEffect, useState } from 'react'
import { useUserProfile } from '@/hooks/queries/useUserProfile'

export interface GuestIdentity {
  guest_name: string
  guest_phone: string
  guest_email: string
}

/** 010-1234-5678 → 010-••••-5678. 숫자가 모자라면 그대로 둔다(가리는 시늉만 하지 않는다). */
export function maskPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (d.length < 10) return raw || ''
  const head = d.slice(0, 3)
  const tail = d.slice(-4)
  return `${head}-••••-${tail}`
}

export default function GuestIdentityFields({
  value, onChange, nameLabel = '예약자 이름',
}: {
  value: GuestIdentity
  onChange: (next: GuestIdentity) => void
  /** 단일 객실은 `예약자 이름`, 묶음은 `대표 예약자 이름` — 두 모달이 쓰던 말을 그대로 지킨다. */
  nameLabel?: string
}) {
  const { data: profile } = useUserProfile()
  // 처음부터 아는 값이 다 있으면 접는다. 없으면 펼친 채로 시작해 바로 입력하게 한다.
  const [expanded, setExpanded] = useState(false)
  const [seeded, setSeeded] = useState(false)

  // 서버 프로필이 늦게 도착할 수 있다(쿠키 세션 → /me 왕복). 도착하면 **비어 있는 칸만** 채운다 —
  // 사용자가 이미 고쳐 친 값을 덮으면 안 된다.
  useEffect(() => {
    if (!profile || seeded) return
    const next = { ...value }
    if (!next.guest_name && profile.name) next.guest_name = profile.name
    if (!next.guest_phone && profile.phone) next.guest_phone = profile.phone
    if (!next.guest_email && profile.email) next.guest_email = profile.email
    setSeeded(true)
    if (next.guest_name !== value.guest_name || next.guest_phone !== value.guest_phone
        || next.guest_email !== value.guest_email) onChange(next)
  }, [profile, seeded, value, onChange])

  const known = value.guest_name.trim().length >= 2 && value.guest_phone.replace(/\D/g, '').length >= 10
  const set = (k: keyof GuestIdentity) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value })

  if (known && !expanded) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-white/[0.04] px-3 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">투숙객</p>
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {value.guest_name} · {maskPhone(value.guest_phone)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="shrink-0 text-[12px] font-bold text-brand-text underline underline-offset-2"
        >
          다른 분이 투숙해요
        </button>
      </div>
    )
  }

  return (
    <>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{nameLabel} *</label>
        <input value={value.guest_name} onChange={set('guest_name')} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">전화번호 *</label>
        <input value={value.guest_phone} onChange={set('guest_phone')} placeholder="010-1234-5678" className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">이메일</label>
        <input type="email" value={value.guest_email} onChange={set('guest_email')} className="w-full px-3 py-2 bg-white dark:bg-[#1D1F29] border border-gray-300 dark:border-[#2C2F35] rounded-lg text-sm text-gray-900 dark:text-white" />
      </div>
    </>
  )
}
