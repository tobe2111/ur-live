/**
 * 🏨 숙박 이용권 — 판매 방식 · 유효기간 · 이용 안내 (결재 2026-11-24 "추천대로 진행")
 *
 * 종전 등록 화면은 숙박을 언제나 '날짜 지정' 으로만 저장했다. 작은 숙소는 같은 방을 다른 예약 앱에도 올려 두어
 * 달력을 맞추지 못하면 이중 판매가 난다 → 기본을 **먼저 판매**(손님이 먼저 사고 날짜는 매장과 따로 잡는다)로 둔다.
 * 규칙·문구의 SSOT 는 `shared/stay-sale-mode` — 서버(`/stays/:id/info`)가 같은 판정을 다시 한다.
 */
import { STAY_SALE_MODES, STAY_VALIDITY_OPTIONS, STAY_USE_NOTE_MAX, sellsStayVoucher, type StaySaleMode } from '@/shared/stay-sale-mode'

const PICK = 'py-2 rounded-lg border-2 text-xs font-bold'
const ON = 'border-brand bg-brand-tint text-brand-text'
const OFF = 'border-gray-200 text-gray-700'

/** 등록 위저드와 수정 화면(체크인·정책 탭)이 같은 부품을 쓴다 — 값은 부모가 들고 바뀐 것만 올려 준다. */
export default function StaySaleFields({ mode, validityDays, note, onChange }: {
  mode: StaySaleMode
  validityDays: number
  note: string
  onChange: (patch: { mode?: StaySaleMode; validityDays?: number; note?: string }) => void
}) {
  const hint = STAY_SALE_MODES.find((m) => m.value === mode)?.hint
  return (
    <div className="space-y-3" data-stay-sale>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">판매 방식</p>
        <div className="grid grid-cols-3 gap-2">
          {STAY_SALE_MODES.map((m) => (
            <button key={m.value} type="button" aria-pressed={mode === m.value} onClick={() => onChange({ mode: m.value })}
              className={`${PICK} ${mode === m.value ? ON : OFF}`}>
              {m.label}
            </button>
          ))}
        </div>
        {hint && <p className="mt-1 text-[12px] text-gray-500">{hint}</p>}
      </div>

      {sellsStayVoucher(mode) && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">유효기간 <span className="text-tone-bad">*</span></p>
          <div className="grid grid-cols-3 gap-2">
            {STAY_VALIDITY_OPTIONS.map((o) => (
              <button key={o.days} type="button" aria-pressed={validityDays === o.days} onClick={() => onChange({ validityDays: o.days })}
                className={`${PICK} ${validityDays === o.days ? ON : OFF}`}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-gray-500">손님이 산 날부터 이 기간 안에 날짜를 잡아 이용해요.</p>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-700">쓸 수 없는 날 · 이용 안내
        <textarea value={note} maxLength={STAY_USE_NOTE_MAX} rows={2}
          onChange={(e) => onChange({ note: e.target.value })}
          placeholder="예: 12/24~25, 설·추석 연휴는 이용할 수 없어요. 예약은 이용 3일 전까지 전화로 잡아 주세요"
          className="mt-1 w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none" />
        <span className="text-[12px] font-normal text-gray-500">손님이 사기 전에 상세 화면에서 봐요.</span>
      </label>
    </div>
  )
}
