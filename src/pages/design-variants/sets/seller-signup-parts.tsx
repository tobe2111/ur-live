/**
 * 🧩 사업자 가입 시안 공용 부품 (2026-09-21 — 대표 *"더 대기업스럽게 완성도있게"*).
 *
 * 여섯 안이 **같은 뼈대**를 쓴다. 안마다 여백·글자 크기가 다르면 비교가 아니라 다른 그림 여섯 장이 된다.
 * 치수는 국내 대형 앱(토스·네이버·카카오·배민 사장님)이 공통으로 쓰는 값에 맞췄다:
 *   내비 52 · 제목 26/900 · 부제 15 · 카드 패딩 20 · 입력 행 17.5px 값 · 하단 버튼 56.
 *
 * ⚠️ 가짜 화면이다. API 호출 0 · 상태 0 · 입력은 전부 읽기 전용(값은 갤러리의 데이터 스위치가 정한다).
 */
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Check, MapPin } from 'lucide-react'

export const CARD = 'rounded-[18px] bg-white shadow-lift'

/** 폰 캔버스 — 갤러리 카드 안쪽 여백을 걷어내고 실제 페이지와 같은 바탕에 그린다. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="-m-4 bg-warm text-gray-900">{children}</div>
}

/**
 * 상단 내비 — 기본은 **뒤로 가기만**.
 * 🔑 지금 화면은 내비에 "사업자 유저 가입", 본문에 "사업자번호만 맞으면…" 이라 제목이 두 번 나온다.
 *    대형 앱은 한 화면에 제목을 한 번만 둔다(본문 쪽). 내비는 돌아가는 길만 맡는다.
 */
export function Nav({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <div className="flex h-[52px] items-center gap-2 bg-warm px-2.5">
      <span className="flex h-9 w-9 items-center justify-center text-gray-800"><ChevronLeft className="h-[22px] w-[22px]" /></span>
      <span className="flex-1 truncate text-[15px] font-bold">{title}</span>
      {right}
    </div>
  )
}

/** 진행바 — 걸음이 여럿인 안에서만. 숫자가 아니라 길이로 말한다. */
export function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="h-[3px] bg-brand-tint">
      <div className="h-full rounded-r-full bg-brand transition-all" style={{ width: `${(step / total) * 100}%` }} />
    </div>
  )
}

/** 제목 = 질문. 화면에서 가장 큰 것이고, 이 화면이 무엇을 하는지 혼자 말한다. */
export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="px-5 pb-1 pt-6">
      <h2 className="text-[26px] font-black leading-[1.3] tracking-[-.035em] text-gray-900">{children}</h2>
      {sub && <p className="mt-2.5 text-[15px] leading-[1.6] text-gray-500">{sub}</p>}
    </header>
  )
}

/**
 * 국세청 자동 승인 뱃지.
 * 🔑 이 화면에서 사장님에게 가장 값진 한 문장인데, 지금은 카드 부제 12.5px 안에 묻혀 있다.
 *    대형 앱이라면 이걸 제목 바로 아래 뱃지로 세운다 — 기다릴 필요가 없다는 뜻이기 때문이다.
 */
export function AutoBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 text-[12.5px] font-bold text-brand-text ${className}`}>
      <Check className="h-3.5 w-3.5" strokeWidth={3} />국세청 확인되면 바로 승인
    </span>
  )
}

export type RowProps = {
  idp: string; name: string; label: string; value: string; placeholder: string
  hint?: string; num?: boolean; type?: string; auto?: boolean
}

/**
 * 밑줄형 입력 행 — 2026-09-16 대표 확정 시각 C(라벨 작게, 값 크게).
 * 채워지면 오른쪽에 체크가 뜬다: **진행을 숫자 카운터 대신 형태로** 말하는 자리.
 */
export function LineRow({ idp, name, label, value, placeholder, hint, num, type = 'text', auto }: RowProps) {
  const id = `${idp}-${name}`
  return (
    <div className="border-t border-rule py-3.5 first:border-t-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold tracking-[.02em] text-gray-400">
            {label}
            {auto && value && <span className="rounded bg-brand-tint px-1.5 py-px text-[10px] font-bold text-brand-text">자동</span>}
          </label>
          <input id={id} type={value ? 'text' : type} value={value} placeholder={placeholder} readOnly
            className={`w-full border-0 bg-transparent p-0 text-[17.5px] font-bold leading-[1.35] tracking-[-.02em] text-gray-900 placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-300 focus:outline-none ${num ? 'dash-num' : ''}`} />
        </div>
        {value && <Check className="h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={3} />}
      </div>
      {hint && <p className="mt-1 text-[11.5px] text-gray-500">{hint}</p>}
    </div>
  )
}

/** 박스형 입력 행 — 네이버 스마트스토어·카카오 비즈니스 계열의 업무용 폼 생김새. */
export function BoxRow({ idp, name, label, value, placeholder, hint, num, type = 'text' }: RowProps) {
  const id = `${idp}-${name}`
  return (
    <div className="pt-3.5 first:pt-0">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-gray-700">
        {label}<span className="text-brand-text">*</span>
      </label>
      <div className={`flex h-[52px] items-center gap-2 rounded-xl px-3.5 ${value ? 'bg-white ring-1 ring-inset ring-rule-strong' : 'bg-gray-100'}`}>
        <input id={id} type={value ? 'text' : type} value={value} placeholder={placeholder} readOnly
          className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none ${num ? 'dash-num' : ''}`} />
        {value && <Check className="h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={3} />}
      </div>
      {hint && <p className="mt-1.5 text-[12px] text-gray-500">{hint}</p>}
    </div>
  )
}

/** 약관 한 줄 — 지금은 테두리 상자 + 빨간 별표. 규칙 ①(카드 테두리 0)과 ⑥(정보상자 0)에 맞춰 한 줄로. */
export function Terms({ agreed }: { agreed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${agreed ? 'bg-brand text-white' : 'bg-white ring-1 ring-inset ring-rule-strong'}`}>
        {agreed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="flex-1 text-[14px] font-semibold text-gray-900">판매자 이용약관에 동의합니다</span>
      <span className="inline-flex items-center text-[12.5px] text-gray-500">보기<ChevronRight className="h-3.5 w-3.5" /></span>
    </div>
  )
}

/** 하단 고정 버튼 — 56px. 갤러리에선 고정이 안 되므로 흐름 끝에 두고 캡션으로 밝힌다. */
export function Cta({ label, ghost, caption = true }: { label: string; ghost?: boolean; caption?: boolean }) {
  return (
    <div className="mt-5 bg-white px-5 pb-5 pt-4 shadow-[0_-1px_0_rgb(22_24_28/0.06)]">
      {caption && <p className="mb-2.5 text-center text-[11px] text-gray-400">화면 하단 고정</p>}
      <button className={`h-[56px] w-full rounded-[14px] text-[16px] font-bold ${ghost ? 'bg-gray-100 text-gray-500' : 'bg-brand text-white'}`}>{label}</button>
    </div>
  )
}

/** 탈출구 한 줄 — 추천만 하려는 사람은 가입이 필요 없다(2026-07-02 단일 퍼널). */
export function Escape() {
  return (
    <p className="px-5 pb-6 pt-4 text-center text-[12.5px] leading-relaxed text-gray-500">
      판매 없이 추천만 하려면 가입 없이 <span className="font-bold text-brand-text">내 유어샵</span>에서 시작해요
    </p>
  )
}

/** 화면과 화면 사이 — 한 안에 여러 화면을 세로로 쌓을 때. */
export function Gap() {
  return <div className="h-2 bg-gray-200" />
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🗺️ 2026-09-21 2차 — 지도가 채우는 자리 (대표 *"카카오맵 혹은 네이버지도로 간편하게"*)
 *
 * 실측으로 드러난 것: `KakaoMapPicker` 는 가게 하나를 고르면 **여덟 가지**를 준다
 * (상호·도로명·지번·전화·카테고리·위도·경도·place_id). 매장 등록 위저드는 그걸 전부 저장하는데,
 * 가입 화면의 `AddressPickerField:61` 은 **주소 문자열 하나만 꺼내고 나머지 일곱을 버린다.**
 * 그래서 사장님이 상호·전화를 손으로 다시 친다. 아래 부품은 "버리지 않으면" 화면이 어떻게 되는지다.
 * ──────────────────────────────────────────────────────────────────────────── */

/** 가게를 아직 안 고른 상태 — 큰 검색 버튼 하나. */
export function MapSearchTile({ label = '가게 이름으로 찾기', sub = '카카오맵에서 찾아요' }: { label?: string; sub?: string }) {
  return (
    <button className="flex h-[116px] w-full flex-col items-center justify-center gap-2 rounded-[18px] bg-white shadow-lift">
      <MapPin className="h-7 w-7 text-brand" strokeWidth={1.7} />
      <span className="text-[16px] font-bold text-gray-900">{label}</span>
      <span className="text-[12.5px] text-gray-500">{sub}</span>
    </button>
  )
}

/**
 * 고른 가게 카드 — **지도가 채운 것**을 그대로 보여 준다.
 * 🔑 값마다 `자동` 표시를 달지 않는다(네 줄이 전부 자동이라 표시가 소음이 된다).
 *    대신 카드 머리에 한 번만 말하고, 사장님은 "맞다/다른 가게" 둘 중 하나만 고르면 된다.
 */
export function PickedStoreCard({ name, address, phone, category }: {
  name: string; address: string; phone: string; category: string
}) {
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-1.5 bg-brand px-4 py-2 text-[12.5px] font-bold text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />카카오맵에서 가져왔어요
      </div>
      <div className="px-5 py-4">
        <p className="text-[19px] font-black leading-tight tracking-[-.03em] text-gray-900">{name}</p>
        <dl className="mt-3">
          {[['주소', address], ['전화', phone], ['업종', category]].map(([k, v]) => (
            <div key={k} className="flex gap-3 border-t border-rule py-2 first:border-t-0 first:pt-0">
              <dt className="w-[38px] shrink-0 text-[12.5px] font-semibold text-gray-400">{k}</dt>
              <dd className="flex-1 text-[13.5px] font-semibold leading-snug text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
        <button className="mt-3 text-[13px] font-bold text-brand-text">다른 가게 고르기</button>
      </div>
    </section>
  )
}

/** 지도에 없는 가게를 위한 탈출구 — 없으면 신규 개업·무점포 사장님이 막힌다. */
export function NotOnMap() {
  return (
    <p className="px-5 pt-4 text-center text-[13px] text-gray-500">
      지도에 없는 가게인가요? <span className="font-bold text-brand-text">직접 입력할게요</span>
    </p>
  )
}

/** 지금은 못 하는 것을 정직하게 적는 자리 — 시안 안에서만 쓴다(실제 화면 문구 아님). */
export function NotYet({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 mt-4 rounded-[14px] bg-gray-100 px-4 py-3">
      <p className="text-[12px] font-bold text-gray-500">지금은 이렇게 안 됩니다</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">{children}</p>
    </div>
  )
}
