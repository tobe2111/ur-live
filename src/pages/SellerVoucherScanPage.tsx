/**
 * 🧭 2026-06-10 (오프라인 공구 현장 동선 — 갭①): 매장 계산대용 바우처 스캔 화면 (셀러 대시보드).
 * 🎟️ 2026-07-06: 스캔 코어를 `VoucherScanner`(공유 컴포넌트)로 분리 — 독립 풀스크린 POS(StoreScanPage)와
 *   같은 스캔 로직(BarcodeDetector + iOS qr-scanner 폴백 + 수동입력 + use-by-seller CAS) 공유.
 *   이 페이지는 대시보드 맥락(SellerLayout + 사용 방식 설정 카드)만 담당.
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import VoucherScanner from '@/components/voucher/VoucherScanner'
import { VOUCHER_USAGE_PRESETS } from '@/shared/voucher-usage-conditions'

export default function SellerVoucherScanPage() {
  const { t } = useTranslation()
  return (
    <SellerLayout title={t('seller.scan.title', { defaultValue: '바우처 스캔' })}>
      <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
        <DashboardPageHeader
          icon={<Camera className="w-5 h-5" />}
          title={t('seller.scan.title', { defaultValue: '바우처 스캔' })}
          subtitle={t('seller.scan.subtitle', { defaultValue: '손님 QR을 비추면 자동으로 사용 처리돼요 (연속 스캔 가능)' })}
        />

        {/* 🎟️ 2026-07-02 (대표): 매장별 현지 사용 방식 선택 — 3모드 + 매장 확인코드 */}
        <RedemptionModeCard />

        {/* 🎟️ 2026-07-06 (대표 "사용 조건도 선택하게"): 매장 사용조건 프리셋 선택 → 이용권 '이용 안내' 표시 */}
        <UsageConditionsCard />

        {/* 스캔 코어 (공유) */}
        <VoucherScanner />
      </div>
    </SellerLayout>
  )
}

/**
 * 🎟️ 2026-07-06 (대표 "사용 조건도 흔한 것들 체크로 선택"): 매장 사용조건 프리셋 선택 카드.
 *   선택한 조건이 소비자 이용권 '이용 안내 · 매장 안내'에 표준 문구로 표시됨. 자유입력 최소화.
 */
function UsageConditionsCard() {
  const [selected, setSelected] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    api.get('/api/group-buy/redemption-settings', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (r.data?.success) {
          setSelected(Array.isArray(r.data.data.usage_conditions) ? r.data.data.usage_conditions : [])
          setCustom(r.data.data.usage_custom || '')
        }
      })
      .catch(() => { /* 미로드 */ })
      .finally(() => setLoaded(true))
  }, [])

  const toggle = (key: string) => setSelected((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key])
  const save = async () => {
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.put('/api/group-buy/redemption-settings', { usage_conditions: selected, usage_custom: custom }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      if (r.data?.success) toast.success('사용 조건이 저장됐어요')
      else toast.error(r.data?.error || '저장 실패')
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  if (!loaded) return null
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
      <p className="text-sm font-bold text-gray-900">매장 사용 조건 <span className="text-[11px] font-normal text-gray-400">(손님 이용권 ‘이용 안내’에 표시)</span></p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {VOUCHER_USAGE_PRESETS.map((p) => (
          <label key={p.key} className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer ${selected.includes(p.key) ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
            <input type="checkbox" checked={selected.includes(p.key)} disabled={saving} onChange={() => toggle(p.key)} />
            <span className="text-[12.5px] text-gray-900">{p.label}</span>
          </label>
        ))}
      </div>
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value.slice(0, 120))}
        placeholder="추가 안내 (선택 · 예: 브레이크타임 15~17시 제외)"
        className="w-full mt-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-400/40"
      />
      <button onClick={save} disabled={saving} className="w-full mt-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-50">
        {saving ? '저장 중…' : '사용 조건 저장'}
      </button>
    </div>
  )
}

/**
 * 🎟️ 2026-07-02 (대표 "사장님이 사용 방식 선택"): 매장 현지 사용 방식 카드.
 *  - scan_only  : 직원 확인만(셀프 사용 차단) — 가장 엄격.
 *  - store_code : 손님 셀프 사용 시 매장 확인코드 4자리 입력 필수(카운터 스티커) — 원격/악용 차단.
 *  - self_free  : 자유 셀프 사용(기본, 카운터 느슨한 매장). 셀프 취소 60초 허용.
 */
function RedemptionModeCard() {
  const [mode, setMode] = useState<'scan_only' | 'store_code' | 'self_free'>('self_free')
  const [storeCode, setStoreCode] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    api.get('/api/group-buy/redemption-settings', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        if (r.data?.success) { setMode(r.data.data.mode); setStoreCode(r.data.data.store_code) }
      })
      .catch(() => { /* 미로드 시 카드 숨김 유지 */ })
      .finally(() => setLoaded(true))
  }, [])

  const save = async (next: 'scan_only' | 'store_code' | 'self_free', regenerate = false) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.put('/api/group-buy/redemption-settings', { mode: next, regenerate_code: regenerate }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (r.data?.success) { setMode(r.data.data.mode); setStoreCode(r.data.data.store_code); toast.success('사용 방식이 저장됐어요') }
      else toast.error(r.data?.error || '저장 실패')
    } catch { toast.error('저장 실패') } finally { setSaving(false) }
  }

  if (!loaded) return null
  const OPTIONS: { value: 'scan_only' | 'store_code' | 'self_free'; label: string; desc: string }[] = [
    { value: 'scan_only', label: '직원 확인만', desc: '손님 셀프 사용 차단 — 직원이 QR 스캔으로만 처리 (가장 엄격)' },
    { value: 'store_code', label: '매장 확인코드', desc: '손님이 셀프 사용 시 카운터의 코드 4자리 입력 필수 (추천)' },
    { value: 'self_free', label: '자유 셀프 사용', desc: '손님이 코드 없이 셀프 사용 (카운터가 바쁜 매장, 60초 취소 허용)' },
  ]
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
      <p className="text-sm font-bold text-gray-900">현지 사용 방식</p>
      <div className="space-y-1.5">
        {OPTIONS.map((o) => (
          <label key={o.value} className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer ${mode === o.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
            <input type="radio" name="redemption-mode" checked={mode === o.value} disabled={saving}
              onChange={() => save(o.value)} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-gray-900">{o.label}</span>
              <span className="block text-[11px] text-gray-500">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === 'store_code' && storeCode && (
        <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-[11px] text-gray-500">매장 확인코드 — 카운터에 붙여두세요</p>
            <p className="text-[22px] font-black tracking-[0.4em] text-gray-900">{storeCode}</p>
          </div>
          <button onClick={() => save(mode, true)} disabled={saving} className="text-[11px] font-bold text-gray-500 hover:text-gray-900 disabled:opacity-50">
            재발급
          </button>
        </div>
      )}
    </div>
  )
}
