/**
 * ⚡ **3분 등록** — 운영자가 공구 하나를 한 화면에서 연다 (세션 ③-b, O4)
 *
 * 대표 완료 기준: *"사진·가격·마감만으로 **3분 내** 등록 완주"* ·
 * UX 기준 ④: *"모바일 **한 손 조작** 기준"*.
 *
 * ## 왜 새 화면인가 (기존 폼을 줄이지 않고)
 * `SellerProductNewPage`(511줄)는 배송·옵션·상세설명·카테고리별 분기까지 다루는 **풀 폼**이다.
 * 거기서 필드를 숨기면 **한 폼이 두 가지 일을 하게 되고**, 픽업 공구에 안 쓰는 분기가 계속 따라다닌다.
 * ⇒ 별도 경로로 두고 **풀 폼은 그대로** 둔다(기존 셀러 동작 무변경).
 *
 * ## 한 손 조작 — 구체적으로
 * - 단일 컬럼 · 입력 높이 **56px**(엄지 타겟) · 라이트 고정(대시보드 룰 — dark: 금지) · `inputMode="numeric"` 로 숫자 키패드 즉시
 * - 제출 버튼은 **화면 하단 고정**(스크롤해서 찾지 않는다)
 * - 마감은 **버튼 3개(3일·7일·14일)** — 날짜 피커는 한 손으로 제일 괴로운 위젯이다
 *
 * ## 두 번 부른다 (한 번에 못 한다)
 * ① `POST /api/seller/products` — 상품 생성(**서버가 `mall_id` 스탬프**)
 * ② `PUT /api/seller/gb/:id` — 공구가·마감(**서버가 `공구가 < 상시가` 강제**)
 *
 * 🔴 **②가 실패해도 ①은 남는다**(원자적이지 않다). 그래서 실패 시 **상품이 만들어졌다는 사실과
 *   이어서 할 일을 그대로 말해준다** — 조용히 실패하면 운영자는 같은 상품을 또 만든다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import SEO from '@/components/SEO'
import api from '@/lib/api'

/** 마감 프리셋 — 날짜 피커 대신. 한 손으로 누를 수 있는 것만 남긴다. */
const DEADLINE_PRESETS = [
  { days: 3, label: '3일' },
  { days: 7, label: '7일' },
  { days: 14, label: '14일' },
] as const

function deadlineIso(days: number): string {
  return new Date(Date.now() + days * 86400_000).toISOString()
}

const INPUT = 'w-full h-14 px-4 rounded-xl border border-gray-200 text-base text-gray-900 bg-white outline-none focus:border-gray-900'
const LABEL = 'block text-sm font-semibold text-gray-800 mb-1.5'

export default function SellerQuickGbPage() {
  const navigate = useNavigate()
  const [imageUrl, setImageUrl] = useState('')
  const [name, setName] = useState('')
  const [listPrice, setListPrice] = useState('')
  const [gbPrice, setGbPrice] = useState('')
  const [days, setDays] = useState<number>(7)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** ①은 됐는데 ②가 실패한 상태 — 이걸 숨기면 운영자가 같은 상품을 또 만든다. */
  const [orphanId, setOrphanId] = useState<number | null>(null)

  const list = Number(listPrice)
  const gb = Number(gbPrice)
  const priceOk = Number.isFinite(list) && list > 0 && Number.isFinite(gb) && gb > 0 && gb < list
  const canSubmit = !saving && name.trim().length > 0 && priceOk
  const discountPct = priceOk ? Math.round((1 - gb / list) * 100) : 0

  async function submit() {
    if (!canSubmit) return
    setSaving(true); setError(null)
    try {
      // ① 상품 — mall_id 는 **서버가** sellers 에서 읽어 스탬프한다(클라가 보내지 않는다).
      let productId = orphanId
      if (!productId) {
        const res = await api.post('/api/seller/products', {
          name: name.trim(), price: gb, original_price: list, image_url: imageUrl || undefined, stock: 0,
        })
        // 응답은 `{ success, data: newProduct }` — 실제 핸들러(seller-orders.routes:1044)를 보고 맞췄다.
        productId = Number(res.data?.data?.id ?? res.data?.id)
        if (!Number.isFinite(productId) || !productId) throw new Error('상품 생성 응답을 이해하지 못했습니다')
        setOrphanId(productId)   // ②가 실패해도 재시도 시 상품을 또 만들지 않는다
      }

      // ② 공구 — 서버가 `공구가 < 상시가` 를 강제한다(어드민 조종석과 같은 함수).
      await api.put(`/api/seller/gb/${productId}`, {
        mode: 'live', price: gb, deadline: deadlineIso(days),
      })
      navigate('/seller/products?created=1')
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || '저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F5F7] pb-28">
      <SEO title="빠른 공구 등록 - 유어딜" description="사진·가격·마감만으로 공동구매를 엽니다" noindex />

      <header className="px-4 pt-6 pb-2 max-w-lg mx-auto">
        <h1 className="text-xl font-extrabold text-gray-900">빠른 공구 등록</h1>
        <p className="text-sm text-gray-500 mt-1">사진·가격·마감만 정하면 바로 열립니다.</p>
      </header>

      <div className="px-4 max-w-lg mx-auto space-y-5">
        <div>
          <label className={LABEL}>사진</label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} label="" maxSizeKB={800} />
        </div>

        <div>
          <label className={LABEL} htmlFor="q-name">상품명</label>
          <input id="q-name" className={INPUT} value={name} maxLength={80}
            onChange={(e) => setName(e.target.value)} placeholder="예: 수제 사과잼 250g" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="q-list">정가</label>
            {/* inputMode=numeric — 모바일에서 숫자 키패드가 바로 뜬다(한 손 조작) */}
            <input id="q-list" className={INPUT} value={listPrice} inputMode="numeric"
              onChange={(e) => setListPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="10000" />
          </div>
          <div>
            <label className={LABEL} htmlFor="q-gb">공구가</label>
            <input id="q-gb" className={INPUT} value={gbPrice} inputMode="numeric"
              onChange={(e) => setGbPrice(e.target.value.replace(/[^\d]/g, ''))} placeholder="7000" />
          </div>
        </div>

        {/* 🔴 서버가 어차피 거부하지만(validateGbSession), 제출 후에 알면 3분이 깨진다. 여기서 먼저 말한다. */}
        {listPrice && gbPrice && !priceOk && (
          <p className="flex items-center gap-1.5 text-sm text-rose-600">
            <AlertCircle className="w-4 h-4" /> 공구가는 정가보다 낮아야 합니다.
          </p>
        )}
        {priceOk && (
          <p className="text-sm text-emerald-700 font-semibold">{discountPct}% 할인으로 열립니다.</p>
        )}

        <div>
          <label className={LABEL}>마감</label>
          {/* 날짜 피커 대신 버튼 3개 — 한 손으로 제일 괴로운 위젯을 뺀다(UX 기준 ④). */}
          <div className="grid grid-cols-3 gap-2">
            {DEADLINE_PRESETS.map((p) => (
              <button key={p.days} type="button" onClick={() => setDays(p.days)}
                className={`h-14 rounded-xl text-base font-bold border ${
                  days === p.days
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm text-rose-700">{error}</p>
            {/* 🔴 ①만 성공한 상태를 **숨기지 않는다** — 숨기면 운영자가 같은 상품을 또 만든다. */}
            {orphanId && (
              <p className="text-xs text-rose-600 mt-1.5">
                상품(#{orphanId})은 이미 만들어졌습니다. 다시 누르면 공구 설정만 재시도합니다.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 제출 — 하단 고정. 스크롤해서 찾지 않는다(한 손 조작). */}
      <div className="fixed left-0 right-0 bottom-0 p-4 bg-white backdrop-blur border-t border-gray-100">
        <div className="max-w-lg mx-auto">
          <button type="button" onClick={submit} disabled={!canSubmit}
            className="w-full h-14 rounded-xl bg-gray-900 text-white text-base font-extrabold disabled:opacity-50 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {orphanId ? '공구 설정 다시 시도' : '공구 열기'}
          </button>
        </div>
      </div>
    </div>
  )
}
