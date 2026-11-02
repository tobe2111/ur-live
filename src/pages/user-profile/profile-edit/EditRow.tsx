/**
 * ✏️ 프로필 편집의 **줄** — 평소엔 값을 보여 주고, 누르면 그 자리에서 펼쳐 고친다.
 *
 * 대표 확정 **A-2**(2026-10-11): *"A-2로 하되"* — 사람에 관한 것(이름·소개·전화번호·내 주소·SNS)을
 * 프로필 편집 한 곳으로 모으되, 입력칸 여섯을 세로로 늘어놓지 않고 **줄 목록**으로 담는다.
 *
 * ## 왜 입력칸이 아니라 줄인가
 * 여섯 개를 입력칸으로 늘어놓으면 폰 한 화면을 넘겨 스크롤이 생기고, 한 줄 고치러 들어온 사람이
 * 긴 폼을 마주한다. 줄이면 ⓐ 한 화면에 들어오고 ⓑ **"소개가 비어 있다"가 들어가자마자 보인다**
 * (빈 입력칸은 그 사실을 말해 주지 않는다) ⓒ 유어샵 관리가 쓰던 문법(접힌 줄 → 그 자리에서 펼쳐 편집)을
 * 그대로 가져온 것이라 새로 배울 게 없다.
 *
 * ⚠️ 한 번에 한 줄만 열린다 — 여는 쪽(`ProfileEditSheet`)이 `open` 으로 정한다. 둘이 동시에
 *   열리면 저장 버튼이 둘이 되고, 어느 쪽을 누른 건지 사람이 헷갈린다.
 * ⚠️ 값이 비었을 때 **빈칸으로 두지 않는다** — `아직 없어요` 로 적는다. 빈칸은 "값이 없음" 과
 *   "아직 못 불러옴" 을 구분하지 못한다(이 레포가 반복해 지키는 규칙).
 * ⚠️ `required` 인 줄은 비었을 때 **빨갛게** 말한다 — 전화번호가 그렇다. 교환권이 MMS 로 그 번호에
 *   가므로, 없다는 사실을 회색 "아직 없어요" 로 흘려 보내면 계산대 앞에서야 알게 된다
 *   (종전 모달은 라벨에 `*` 를 달아 같은 일을 했다 — 줄 목록에는 라벨 뒤에 별을 붙일 자리가 없다).
 */
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/** 접힌 줄 — 안 C 목록 문법(48px 평면 + hairline). 🎫 CLAUDE.md 표면 규칙 ⑦. */
const SHUT = 'w-full flex items-center gap-2 px-4 h-12 border-b border-rule text-left active:opacity-70'
const KEY = 'text-[15px] font-medium text-gray-900 dark:text-white shrink-0'
const VAL = 'ml-auto min-w-0 truncate text-[13px] text-gray-500 dark:text-gray-400'

export function EditRow({ label, value, empty, required, open, onOpen, children }: {
  label: string
  /** 접혔을 때 오른쪽에 보일 값. 비면 `empty` 가 대신 뜬다. */
  value?: string | null
  /** 값이 없을 때의 문구 — 기본 `아직 없어요`. */
  empty?: string
  /** 없으면 **안 되는** 값인가(위 머리말) — 비었을 때 빨갛게 적는다. */
  required?: boolean
  open: boolean
  onOpen: () => void
  /** 펼쳤을 때의 입력·안내·버튼 */
  children: ReactNode
}) {
  if (open) {
    return (
      <div className="border-b border-rule bg-wash px-4 py-4">
        <div className="text-[15px] font-medium text-gray-900 dark:text-white mb-3">{label}</div>
        {children}
      </div>
    )
  }
  const shown = (value ?? '').trim()
  return (
    <button type="button" onClick={onOpen} className={SHUT}>
      <span className={KEY}>{label}</span>
      <span className={
        shown ? VAL
          : required ? `${VAL} text-red-500 dark:text-red-400 font-medium`
            : `${VAL} text-gray-400 dark:text-gray-500`
      }>
        {shown || empty || '아직 없어요'}
      </span>
      <ChevronRight className="w-4 h-4 shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" />
    </button>
  )
}

/** 펼친 줄의 저장·취소 — 세 줄이 같은 모양을 쓰게(갈리면 줄마다 버튼이 달라진다). */
export function RowActions({ onSave, onCancel, saving, disabled, saveLabel = '저장' }: {
  onSave: () => void
  onCancel: () => void
  saving?: boolean
  disabled?: boolean
  saveLabel?: string
}) {
  return (
    <div className="flex gap-2 mt-3">
      <button
        type="button" onClick={onSave} disabled={saving || disabled}
        className={`flex-1 h-10 rounded-lg bg-brand text-white text-[15px] font-bold flex items-center justify-center ${saving ? '' : 'disabled:opacity-40'}`}
        aria-busy={saving || undefined}
      >
        {/* 🎬 2026-11-02 시안 4차 "버튼 처리 중": 처리 중엔 글자 대신 도는 표시(버튼은 흐려지지 않는다 — 눌린 게 보이게).
            끝나면 줄이 닫히고 "저장했어요" 알림이 뜬다. 두 번 눌림은 disabled 가 막는다. */}
        {saving
          ? <span role="status" aria-label="저장 중" className="w-5 h-5 rounded-full border-2 border-white/40 animate-spin" style={{ borderTopColor: '#fff' }} />
          : saveLabel}
      </button>
      <button
        type="button" onClick={onCancel}
        className="px-4 h-10 rounded-lg bg-wash text-gray-500 dark:text-gray-400 text-[15px] font-bold"
      >
        취소
      </button>
    </div>
  )
}

/** 펼친 줄의 입력칸 — 다섯 줄이 같은 치수를 쓰게. */
export const ROW_INPUT =
  'w-full h-11 px-3 rounded-lg border border-rule-strong bg-surface text-[15px] '
  + 'text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none'

/** 펼친 줄의 설명 한 줄. */
export function RowNote({ children, tone }: { children: ReactNode; tone?: 'ok' | 'bad' }) {
  const c = tone === 'ok' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'bad' ? 'text-red-500'
      : 'text-gray-500 dark:text-gray-400'
  return <p className={`mt-2 text-[12px] leading-relaxed ${c}`}>{children}</p>
}

/** 묶음 라벨 — `내 정보` / `내 가게 주소`. 🎫 표면 규칙 ⑦ 의 그룹 라벨(12px 바닥). */
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-4 pb-2 text-[12px] font-medium text-gray-500 dark:text-gray-400">{children}</div>
  )
}
