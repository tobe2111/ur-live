/**
 * 🏠 생활 이용권 업종 고르기 (2026-10-25 대표 "1번 방식으로 가자" — 사장님이 등록할 때 고른다).
 * 고른 업종은 홈 '생활' 탭 아래 칩(이사·청소·…)에서 그 이용권을 찾게 해 준다.
 * 사장님 화면(라이트 고정)용 — `dark:` 를 쓰지 않는다.
 */
import { LIFE_SUBCATS } from '@/shared/life-deal-subcat'

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function LifeSubcatPicker({ value, onChange }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-[15px] font-bold text-gray-900">어떤 일인가요? *</h2>
      <p className="mt-1 text-[13px] text-gray-500">손님이 홈 &lsquo;생활&rsquo; 탭에서 이 업종을 누르면 이 이용권이 보여요</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="업종">
        {LIFE_SUBCATS.map((s) => {
          const on = value === s.key
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(s.key)}
              className={`rounded-full px-4 py-2 text-[13px] font-medium ${on ? 'bg-brand text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
