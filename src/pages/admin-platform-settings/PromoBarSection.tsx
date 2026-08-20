/**
 * 📣 최상단 프로모 바 편집 (2026-08-19 — 대표 확정 "만들기, 어드민에서 켜고 끄기").
 *
 * 그루폰 홈 맨 위의 프로모 띠를 여기서 정한다. **켜야만 나온다** — 지금은 홍보할 게 없어 기본 OFF.
 * 값은 `platform_settings` 에 저장되고 공개 `GET /api/promo-bar` 가 읽는다.
 *
 * 페이지(AdminPlatformSettingsPage)가 600줄 한도에 가까워 별도 파일로 뺐다(file-size 룰).
 */

const PROMO_KEYS = {
  enabled: 'promo_bar_enabled',
  text: 'promo_bar_text',
  cta: 'promo_bar_cta',
  href: 'promo_bar_href',
  bg: 'promo_bar_bg',
  version: 'promo_bar_version',
} as const

export default function PromoBarSection({
  settings,
  setSettings,
}: {
  settings: Record<string, string>
  setSettings: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const on = settings[PROMO_KEYS.enabled] === 'true'
  const set = (k: string, v: string) => setSettings(prev => ({ ...prev, [k]: v }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-gray-900">최상단 프로모 바</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              소비자 홈 맨 위에 뜨는 띠(PC). <span className="font-semibold text-gray-600">꺼두면 아예 안 나온다</span> —
              빈 띠가 자리를 먹지 않는다. 저장 후 최대 5분 뒤 반영(엣지 캐시).
            </p>
          </div>
          <button
            type="button"
            onClick={() => set(PROMO_KEYS.enabled, on ? 'false' : 'true')}
            aria-pressed={on}
            className={`shrink-0 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              on ? 'bg-gray-900 text-white hover:bg-black' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {on ? '켜짐' : '꺼짐'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        <label className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">문구</span>
            <span className="block text-xs text-gray-400 mt-0.5">비우면 켜져 있어도 안 나온다. 한 줄로 짧게</span>
          </span>
          <input
            value={settings[PROMO_KEYS.text] ?? ''}
            placeholder="예: 첫 구매 5,000원 할인 쿠폰"
            onChange={e => set(PROMO_KEYS.text, e.target.value)}
            className="w-72 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
          />
        </label>

        <label className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">버튼 문구</span>
            <span className="block text-xs text-gray-400 mt-0.5">비우면 버튼 없이 문구만</span>
          </span>
          <input
            value={settings[PROMO_KEYS.cta] ?? ''}
            placeholder="예: 받으러 가기"
            onChange={e => set(PROMO_KEYS.cta, e.target.value)}
            className="w-72 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
          />
        </label>

        <label className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">버튼 링크</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              <span className="font-semibold text-gray-600">사이트 내부 경로만</span> (예: <code>/vouchers</code>).
              외부 주소를 넣으면 서버가 링크를 버린다
            </span>
          </span>
          <input
            value={settings[PROMO_KEYS.href] ?? ''}
            placeholder="/vouchers"
            onChange={e => set(PROMO_KEYS.href, e.target.value)}
            className="w-72 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
          />
        </label>

        <label className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">배경색</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              <code>#1A2C42</code> 형식. 비우면 브랜드 잉크색
            </span>
          </span>
          <input
            value={settings[PROMO_KEYS.bg] ?? ''}
            placeholder="#1A2C42"
            onChange={e => set(PROMO_KEYS.bg, e.target.value)}
            className="w-40 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
          />
        </label>

        <label className="flex items-center justify-between gap-4 px-5 py-4">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-900">버전</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              닫기(X)를 누른 사람에게 <span className="font-semibold text-gray-600">다시 보여주려면 숫자를 올린다</span>.
              문구만 바꾸면 이미 닫은 사람에게는 안 보인다
            </span>
          </span>
          <input
            value={settings[PROMO_KEYS.version] ?? ''}
            placeholder="1"
            onChange={e => set(PROMO_KEYS.version, e.target.value.replace(/[^0-9]/g, ''))}
            className="w-28 text-right shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium"
          />
        </label>
      </div>

      {/* 미리보기 — 저장 전에 어떻게 보일지 그 자리에서 확인 */}
      {on && (settings[PROMO_KEYS.text] || '').trim() && (
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-400 mb-2">미리보기</p>
          <div
            className="rounded-lg px-6 py-2.5 flex items-center justify-center gap-3 text-white"
            style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(settings[PROMO_KEYS.bg] || '') ? settings[PROMO_KEYS.bg] : '#1A2C42' }}
          >
            <span className="text-[13px] font-bold">{settings[PROMO_KEYS.text]}</span>
            {(settings[PROMO_KEYS.cta] || '').trim() && (
              <span
                className="px-3.5 py-1 rounded-full bg-white text-[12px] font-extrabold"
                style={{ color: /^#[0-9a-fA-F]{6}$/.test(settings[PROMO_KEYS.bg] || '') ? settings[PROMO_KEYS.bg] : '#1A2C42' }}
              >
                {settings[PROMO_KEYS.cta]}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
